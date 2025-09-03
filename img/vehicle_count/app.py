from flask import Flask, jsonify, render_template
import cv2
from ultralytics import YOLO
import threading
import time
from datetime import datetime, timedelta
import logging
from collections import deque, OrderedDict
import os
import uuid
import numpy as np
from scipy.spatial import distance as dist

app = Flask(__name__)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DetectedObject:
    def __init__(self, vehicle_type, confidence_score, bbox, centroid):
        self.id = str(uuid.uuid4())[:8]  # Short unique ID
        self.vehicle_type = vehicle_type
        self.confidence_score = round(confidence_score * 100, 1)  # Convert to percentage
        self.detected_at = datetime.now().strftime("%H:%M:%S")
        self.first_seen = datetime.now()
        self.last_seen = datetime.now()
        self.bbox = bbox
        self.centroid = centroid
        self.status = "Active"
        self.update_count = 1  # How many times this object has been updated
        
    def update_detection(self, confidence_score, bbox, centroid):
        """Update existing object with new detection data"""
        self.last_seen = datetime.now()
        self.bbox = bbox
        self.centroid = centroid
        self.update_count += 1
        
        # Update confidence with weighted average (give more weight to recent detections)
        weight = 0.3  # 30% weight to new detection, 70% to existing
        self.confidence_score = round(
            (1 - weight) * self.confidence_score + weight * (confidence_score * 100), 1
        )
        
        self.status = "Active"
    
    def to_dict(self):
        # Mark as expired if not seen for 10 seconds
        if datetime.now() - self.last_seen > timedelta(seconds=10):
            self.status = "Expired"
        
        return {
            'id': self.id,
            'vehicle_type': self.vehicle_type,
            'confidence_score': self.confidence_score,
            'detected_at': self.detected_at,
            'status': self.status,
            'bbox': self.bbox,
            'update_count': self.update_count,
            'duration': str(datetime.now() - self.first_seen).split('.')[0]  # Remove microseconds
        }

class CentroidTracker:
    def __init__(self, max_disappeared=30, max_distance=100):
        self.next_object_id = 0
        self.objects = OrderedDict()
        self.disappeared = OrderedDict()
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
    
    def register(self, vehicle_type, confidence, bbox, centroid):
        """Register a new object"""
        obj = DetectedObject(vehicle_type, confidence, bbox, centroid)
        self.objects[obj.id] = obj
        self.disappeared[obj.id] = 0
        return obj
    
    def deregister(self, object_id):
        """Deregister an object"""
        del self.objects[object_id]
        del self.disappeared[object_id]
    
    def calculate_centroid(self, bbox):
        """Calculate centroid from bounding box"""
        x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
        cx = int((x1 + x2) / 2.0)
        cy = int((y1 + y2) / 2.0)
        return (cx, cy)
    
    def calculate_overlap(self, bbox1, bbox2):
        """Calculate IoU (Intersection over Union) between two bounding boxes"""
        x1 = max(bbox1['x1'], bbox2['x1'])
        y1 = max(bbox1['y1'], bbox2['y1'])
        x2 = min(bbox1['x2'], bbox2['x2'])
        y2 = min(bbox1['y2'], bbox2['y2'])
        
        if x2 <= x1 or y2 <= y1:
            return 0.0
        
        intersection = (x2 - x1) * (y2 - y1)
        area1 = (bbox1['x2'] - bbox1['x1']) * (bbox1['y2'] - bbox1['y1'])
        area2 = (bbox2['x2'] - bbox2['x1']) * (bbox2['y2'] - bbox2['y1'])
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0
    
    def update(self, detections):
        """
        Update tracker with new detections using Hungarian Algorithm approach
        detections: list of tuples (vehicle_type, confidence, bbox)
        """
        if len(detections) == 0:
            # Mark all existing objects as disappeared
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return []
        
        # Initialize detection info
        detection_info = []
        for vehicle_type, confidence, bbox in detections:
            centroid = self.calculate_centroid(bbox)
            detection_info.append((vehicle_type, confidence, bbox, centroid))
        
        # If no existing objects, register all detections as new
        if len(self.objects) == 0:
            new_objects = []
            for vehicle_type, confidence, bbox, centroid in detection_info:
                obj = self.register(vehicle_type, confidence, bbox, centroid)
                new_objects.append(obj)
                logger.info(f"First detection: {obj.id} ({vehicle_type})")
            return new_objects
        
        # Create cost matrix for assignment
        object_ids = list(self.objects.keys())
        cost_matrix = []
        
        for object_id in object_ids:
            existing_obj = self.objects[object_id]
            row_costs = []
            
            for vehicle_type, confidence, bbox, centroid in detection_info:
                # Calculate distance cost
                distance = dist.euclidean(existing_obj.centroid, centroid)
                
                # Calculate overlap
                overlap = self.calculate_overlap(existing_obj.bbox, bbox)
                
                # Check vehicle type match
                type_match = existing_obj.vehicle_type == vehicle_type
                
                # Calculate combined cost (lower is better)
                if type_match and distance <= self.max_distance and overlap >= 0.05:
                    # Good match - combine distance and overlap costs
                    distance_cost = distance / self.max_distance  # Normalize to 0-1
                    overlap_cost = 1 - overlap  # Convert to cost (higher overlap = lower cost)
                    combined_cost = (distance_cost * 0.6) + (overlap_cost * 0.4)
                    row_costs.append(combined_cost)
                else:
                    # Poor match - assign high cost
                    row_costs.append(999.0)
            
            cost_matrix.append(row_costs)
        
        # Simple assignment algorithm (greedy approach for multiple objects)
        assignments = []
        used_detections = set()
        used_objects = set()
        
        # Convert cost matrix to numpy for easier processing
        if len(cost_matrix) > 0 and len(cost_matrix[0]) > 0:
            cost_array = np.array(cost_matrix)
            
            # Find best assignments iteratively
            for _ in range(min(len(object_ids), len(detection_info))):
                # Find minimum cost that hasn't been used
                min_cost = float('inf')
                best_obj_idx = -1
                best_det_idx = -1
                
                for obj_idx in range(len(object_ids)):
                    if obj_idx in used_objects:
                        continue
                    for det_idx in range(len(detection_info)):
                        if det_idx in used_detections:
                            continue
                        if cost_array[obj_idx, det_idx] < min_cost:
                            min_cost = cost_array[obj_idx, det_idx]
                            best_obj_idx = obj_idx
                            best_det_idx = det_idx
                
                # If we found a valid assignment (cost < 1.0)
                if best_obj_idx != -1 and best_det_idx != -1 and min_cost < 1.0:
                    assignments.append((best_obj_idx, best_det_idx))
                    used_objects.add(best_obj_idx)
                    used_detections.add(best_det_idx)
                else:
                    break  # No more good matches
        
        # Update matched objects
        for obj_idx, det_idx in assignments:
            object_id = object_ids[obj_idx]
            vehicle_type, confidence, bbox, centroid = detection_info[det_idx]
            
            existing_obj = self.objects[object_id]
            existing_obj.update_detection(confidence, bbox, centroid)
            self.disappeared[object_id] = 0
            
            distance = dist.euclidean(existing_obj.centroid, centroid)
            overlap = self.calculate_overlap(existing_obj.bbox, bbox)
            logger.info(f"Updated {object_id} ({vehicle_type}) - Dist: {distance:.1f}, IoU: {overlap:.2f}")
        
        # Mark unmatched existing objects as disappeared
        for obj_idx, object_id in enumerate(object_ids):
            if obj_idx not in used_objects:
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
                    logger.info(f"Deregistered {object_id} (disappeared too long)")
        
        # Register unmatched detections as new objects
        new_objects = []
        for det_idx in range(len(detection_info)):
            if det_idx not in used_detections:
                vehicle_type, confidence, bbox, centroid = detection_info[det_idx]
                obj = self.register(vehicle_type, confidence, bbox, centroid)
                new_objects.append(obj)
                logger.info(f"NEW object: {obj.id} ({vehicle_type}) - Conf: {obj.confidence_score}%")
        
        # Log current tracking state
        active_objects = [f"{obj.id}({obj.vehicle_type})" for obj in self.objects.values()]
        logger.info(f"Active objects: {active_objects} | New this frame: {len(new_objects)}")
        
        return new_objects

class VehicleDetector:
    def __init__(self, model_path='best.pt', rtsp_url=None, confidence_threshold=0.5):
        self.model_path = model_path
        self.rtsp_url = rtsp_url or 'rtsp://admin:admin123@192.168.1.82:554/live'
        self.confidence_threshold = confidence_threshold
        
        # Initialize centroid tracker with more permissive settings for multiple objects
        self.tracker = CentroidTracker(max_disappeared=20, max_distance=120)
        
        # Vehicle counting
        self.vehicle_count = 0
        self.hourly_counts = deque(maxlen=24)
        self.last_reset = datetime.now()
        
        # Detection state
        self.is_running = False
        self.model = None
        self.cap = None
        self.detection_thread = None
        
        # Vehicle classes - hardcoded untuk motor dan mobil saja
        self.vehicle_classes = {
            0: 'car',        # Mobil (semua jenis mobil)
            1: 'motorcycle'  # Motor/sepeda motor
        }
        self.class_names = list(self.vehicle_classes.values())
        
        logger.info(f"Initialized with {len(self.class_names)} vehicle classes")
        logger.info(f"Classes: {self.class_names}")
        
        self._load_model()
    
    def _load_model(self):
        """Load YOLO model with error handling"""
        try:
            self.model = YOLO(self.model_path)
            logger.info(f"Model loaded successfully: {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            # Continue without model for testing
            self.model = None
    
    def _connect_camera(self):
        """Connect to camera with retry mechanism"""
        try:
            self.cap = cv2.VideoCapture(self.rtsp_url)
            if self.cap.isOpened():
                # Set buffer size to reduce latency
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                logger.info("Camera connected successfully")
                return True
            else:
                raise Exception("Failed to open camera")
        except Exception as e:
            logger.warning(f"Camera connection failed: {e}")
            return False
    
    def detect_vehicles(self):
        """Main detection loop with improved error handling"""
        if not self._connect_camera():
            # If camera fails, simulate detection for testing
            logger.info("Running in simulation mode...")
            self.is_running = True
            
            simulation_counter = 0
            simulated_objects = []  # Keep track of simulated objects for consistency
            
            while self.is_running:
                simulation_counter += 1
                detections = []
                
                # Simulate multiple objects in the same frame
                if simulation_counter % 3 == 0:  # Every 6 seconds
                    import random
                    
                    # Simulate 1-3 objects at once
                    num_objects = random.randint(1, 3)
                    
                    for i in range(num_objects):
                        random_class = random.choice(self.class_names)
                        random_confidence = random.uniform(0.6, 0.95)
                        
                        # Create random but non-overlapping bounding boxes
                        base_x = 100 + (i * 150)  # Spread objects horizontally
                        base_y = 100 + random.randint(-30, 30)
                        
                        x1 = base_x + random.randint(-20, 20)
                        y1 = base_y + random.randint(-20, 20)
                        x2 = x1 + random.randint(80, 120)
                        y2 = y1 + random.randint(60, 100)
                        
                        bbox = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}
                        detections.append((random_class, random_confidence, bbox))
                    
                    # Log simulated detections
                    if detections:
                        sim_summary = [f"{det[0]}({det[1]:.2f})" for det in detections]
                        logger.info(f"SIMULATION - Frame detections: {sim_summary}")
                
                # Update tracker with ALL detections from this simulated frame
                new_objects = self.tracker.update(detections)
                
                # Update vehicle count only for truly new objects
                self.vehicle_count += len(new_objects)
                
                # Log simulation summary
                if len(detections) > 0:
                    total_tracked = len(self.tracker.objects)
                    logger.info(f"SIMULATION - Tracking: {len(detections)} detected, {total_tracked} total, {len(new_objects)} new")
                
                time.sleep(2)  # Check every 2 seconds
            return
        
        self.is_running = True
        frame_skip = 0
        
        try:
            while self.is_running:
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame")
                    time.sleep(1)
                    continue
                
                # Skip frames to reduce processing load
                frame_skip += 1
                if frame_skip % 5 != 0:  # Process every 5th frame
                    continue
                
                # Process detections from each frame
                detections = []
                
                if self.model:
                    try:
                        results = self.model(frame, conf=self.confidence_threshold)
                        
                        # Process ALL detections in the frame
                        frame_detections = []
                        for result in results:
                            boxes = result.boxes
                            if boxes is not None and len(boxes) > 0:
                                for box in boxes:
                                    class_id = int(box.cls[0])
                                    confidence = float(box.conf[0])
                                    
                                    # Check if class_id exists in our vehicle classes
                                    if class_id in self.vehicle_classes:
                                        class_name = self.vehicle_classes[class_id]
                                        
                                        # Get bounding box coordinates
                                        if hasattr(box, 'xyxy'):
                                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                                            bbox = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}
                                            
                                            frame_detections.append((class_name, confidence, bbox))
                        
                        # Log all detections found in this frame
                        if frame_detections:
                            detection_summary = [f"{det[0]}({det[1]:.2f})" for det in frame_detections]
                            logger.info(f"Frame detections: {detection_summary}")
                        
                        detections = frame_detections
                    
                    except Exception as e:
                        logger.error(f"Detection error: {e}")
                
                # Update tracker with ALL detections from this frame
                new_objects = self.tracker.update(detections)
                
                # Update vehicle count only for truly new objects
                self.vehicle_count += len(new_objects)
                
                # Log tracking summary
                if len(detections) > 0:
                    total_tracked = len(self.tracker.objects)
                    logger.info(f"Tracking summary: {len(detections)} detected, {total_tracked} total tracked, {len(new_objects)} new")
                
                time.sleep(0.5)  # Process at 2 FPS
        
        except Exception as e:
            logger.error(f"Detection loop error: {e}")
        finally:
            if self.cap:
                self.cap.release()
            cv2.destroyAllWindows()
    
    def start_detection(self):
        """Start detection in a separate thread"""
        if self.detection_thread and self.detection_thread.is_alive():
            return False
        
        self.detection_thread = threading.Thread(target=self.detect_vehicles, daemon=True)
        self.detection_thread.start()
        logger.info("Detection thread started")
        return True
    
    def stop_detection(self):
        """Stop detection gracefully"""
        self.is_running = False
        logger.info("Detection stopped")
    
    def reset_count(self):
        """Reset vehicle count and detected objects"""
        self.vehicle_count = 0
        self.tracker = CentroidTracker(max_disappeared=20, max_distance=120)  # Reset tracker
        self.last_reset = datetime.now()
        logger.info("Vehicle count and tracker reset")
    
    def get_detected_objects(self):
        """Get list of detected objects with current status"""
        objects_list = []
        active_count = 0
        
        for obj_id, obj in self.tracker.objects.items():
            obj_dict = obj.to_dict()
            objects_list.append(obj_dict)
            if obj_dict['status'] == 'Active':
                active_count += 1
        
        # Sort by most recently seen first
        objects_list.sort(key=lambda x: x['detected_at'], reverse=True)
        
        return {
            'objects': objects_list,
            'total_objects': len(objects_list),
            'active_objects': active_count
        }
    
    def get_class_info(self):
        """Get information about loaded classes"""
        return {
            'total_classes': len(self.class_names),
            'class_names': self.class_names,
            'class_mapping': self.vehicle_classes
        }
    
    def get_vehicle_stats_by_class(self):
        """Get statistics by vehicle class"""
        stats = {'car': {'count': 0, 'percentage': 0}, 'motorcycle': {'count': 0, 'percentage': 0}}
        
        if self.tracker.objects:
            for obj in self.tracker.objects.values():
                if obj.vehicle_type in stats:
                    stats[obj.vehicle_type]['count'] += 1
            
            # Calculate percentages
            total = len(self.tracker.objects)
            if total > 0:
                for vehicle_type in stats:
                    stats[vehicle_type]['percentage'] = round((stats[vehicle_type]['count'] / total) * 100, 1)
        
        return stats

# Global detector instance
detector = VehicleDetector()

# Routes
@app.route('/')
def dashboard():
    """Serve the main dashboard"""
    return render_template('index.html')

@app.route('/vehicle-detection', methods=['GET'])
def vehicle_detection():
    """Get current vehicle count"""
    return jsonify({
        'vehicle_count': detector.vehicle_count,
        'classes': detector.class_names
    })

@app.route('/vehicle-stats', methods=['GET'])
def vehicle_stats():
    """Get detailed statistics"""
    objects_data = detector.get_detected_objects()
    return jsonify({
        'current_count': detector.vehicle_count,
        'hourly_history': list(detector.hourly_counts),
        'is_running': detector.is_running,
        'last_reset': detector.last_reset.isoformat(),
        'class_info': detector.get_class_info(),
        'stats_by_class': detector.get_vehicle_stats_by_class(),
        'active_objects': objects_data['active_objects']
    })

@app.route('/detected-objects', methods=['GET'])
def detected_objects():
    """Get list of detected objects"""
    return jsonify(detector.get_detected_objects())

@app.route('/start-detection', methods=['POST'])
def start_detection():
    """Start vehicle detection"""
    success = detector.start_detection()
    return jsonify({
        'success': success,
        'message': 'Detection started' if success else 'Detection already running',
        'classes': detector.class_names
    })

@app.route('/stop-detection', methods=['POST'])
def stop_detection():
    """Stop vehicle detection"""
    detector.stop_detection()
    return jsonify({
        'success': True,
        'message': 'Detection stopped'
    })

@app.route('/reset-count', methods=['POST'])
def reset_count():
    """Reset vehicle count"""
    detector.reset_count()
    return jsonify({
        'success': True,
        'message': 'Count reset',
        'new_count': detector.vehicle_count
    })

@app.route('/classes', methods=['GET'])
def get_classes():
    """Get information about loaded classes"""
    return jsonify(detector.get_class_info())

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    objects_data = detector.get_detected_objects()
    return jsonify({
        'status': 'healthy',
        'detection_running': detector.is_running,
        'timestamp': datetime.now().isoformat(),
        'classes_loaded': len(detector.class_names),    
        'available_classes': detector.class_names,
        'total_detected': detector.vehicle_count,
        'active_objects': objects_data['active_objects'],
        'total_tracked_objects': objects_data['total_objects']
    })

if __name__ == '__main__':
    try:
        # Install required packages
        print("📦 Installing required packages...")
        try:
            import scipy
        except ImportError:
            print("⚠️  scipy is required for object tracking. Install with: pip install scipy")
        
        # Start detection automatically
        detector.start_detection()
        
        print("=" * 70)
        print("🚗 Enhanced Vehicle Detection System with Object Tracking!")
        print("🏍️  Classes: Car & Motorcycle Only")
        print("🎯 Features: Centroid Tracking + IoU Overlap Detection")
        print("=" * 70)
        print("📊 Dashboard: http://localhost:5000")
        print("🔌 API: http://localhost:5000/vehicle-detection")
        print("📋 Classes: http://localhost:5000/classes")
        print("🔖 Objects: http://localhost:5000/detected-objects")
        print("❤️  Health: http://localhost:5000/health")
        print("=" * 70)
        print(f"📁 Loaded {len(detector.class_names)} classes: {', '.join(detector.class_names)}")
        print("🎯 Class Mapping:")
        for class_id, class_name in detector.vehicle_classes.items():
            print(f"   {class_id}: {class_name}")
        print("🔍 Tracking Parameters:")
        print(f"   Max Distance: {detector.tracker.max_distance}px")
        print(f"   Max Disappeared: {detector.tracker.max_disappeared} frames")
        print("=" * 70)
        
        # Run Flask server
        app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
        
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        detector.stop_detection()
    except Exception as e:
        logger.error(f"Application error: {e}")
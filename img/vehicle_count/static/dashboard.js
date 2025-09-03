// Chart setup with modern design
const ctx = document.getElementById('analytics-chart').getContext('2d');

// Color themes for different periods
const colorThemes = {
    day: {
        gradient: ['#667eea', '#764ba2'],
        background: 'rgba(102, 126, 234, 0.1)',
        border: '#667eea'
    },
    week: {
        gradient: ['#f093fb', '#f5576c'],
        background: 'rgba(240, 147, 251, 0.1)',
        border: '#f093fb'
    },
    month: {
        gradient: ['#4facfe', '#00f2fe'],
        background: 'rgba(79, 172, 254, 0.1)',
        border: '#4facfe'
    }
};

// Initialize chart
let analyticsChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Vehicle Detections',
            data: [],
            backgroundColor: colorThemes.day.background,
            borderColor: colorThemes.day.border,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#667eea',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: function(context) {
                        return context[0].label;
                    },
                    label: function(context) {
                        return `${context.parsed.y} vehicles detected`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#6b7280',
                    font: {
                        size: 12,
                        weight: '500'
                    }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#6b7280',
                    font: {
                        size: 12,
                        weight: '500'
                    },
                    maxRotation: 45
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutCubic'
        }
    }
});

// Global variables
let updateInterval;
let isConnected = true;
let currentPeriod = 'day';

// Generate sample data for different periods
function generateSampleData(period) {
    const data = {
        day: {
            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            data: [12, 8, 25, 45, 38, 52, 68, 42]
        },
        week: {
            labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            data: [234, 187, 298, 345, 412, 389, 267]
        },
        month: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            data: [1250, 1434, 1123, 1567]
        }
    };
    
    return data[period] || data.day;
}

// Change chart period
function changePeriod(period) {
    currentPeriod = period;
    
    // Update active button
    document.querySelectorAll('.chart-control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    
    // Update chart theme
    const theme = colorThemes[period];
    analyticsChart.data.datasets[0].backgroundColor = theme.background;
    analyticsChart.data.datasets[0].borderColor = theme.border;
    
    // Update chart data
    const sampleData = generateSampleData(period);
    analyticsChart.data.labels = sampleData.labels;
    analyticsChart.data.datasets[0].data = sampleData.data;
    
    // Update chart with animation
    analyticsChart.update('active');
    
    // Show notification
    const periodText = period.charAt(0).toUpperCase() + period.slice(1);
    showNotification(`📊 Switched to ${periodText} view`, 'info');
}

// Update data function
async function updateData() {
    try {
        const [statsResponse, objectsResponse] = await Promise.all([
            fetch('/vehicle-stats'),
            fetch('/detected-objects')
        ]);
        
        if (!statsResponse.ok || !objectsResponse.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const statsData = await statsResponse.json();
        const objectsData = await objectsResponse.json();
        
        // Update connection status
        updateConnectionStatus(true);
        
        // Update display values (removed current-count since we removed total detected)
        document.getElementById('active-objects').textContent = objectsData.active_objects;
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
        
        // Update detection status
        const statusElement = document.getElementById('detection-status');
        const statusTextElement = document.getElementById('status-text');
        
        if (statsData.is_running) {
            statusElement.textContent = '●';
            statusElement.className = 'stat-value status-running';
            statusTextElement.textContent = 'Running';
        } else {
            statusElement.textContent = '⏸';
            statusElement.className = 'stat-value status-stopped';
            statusTextElement.textContent = 'Stopped';
        }
        
        // Update objects table
        updateObjectsTable(objectsData.objects);
        
        // Update analytics chart with real data if available
        if (statsData.analytics && statsData.analytics[currentPeriod]) {
            const analyticsData = statsData.analytics[currentPeriod];
            analyticsChart.data.labels = analyticsData.labels;
            analyticsChart.data.datasets[0].data = analyticsData.data;
            analyticsChart.update('none');
        }
        
    } catch (error) {
        console.error('Error updating data:', error);
        updateConnectionStatus(false);
    }
}

// Update objects table
function updateObjectsTable(objects) {
    const tableBody = document.getElementById('objects-table-body');
    const noObjectsDiv = document.getElementById('no-objects');
    const objectCountBadge = document.getElementById('object-count-badge');
    
    // Update count badge
    objectCountBadge.textContent = `${objects.length} objects`;
    
    if (objects.length === 0) {
        noObjectsDiv.style.display = 'block';
        tableBody.innerHTML = '';
        return;
    }
    
    noObjectsDiv.style.display = 'none';
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Add new rows
    objects.forEach(obj => {
        const row = document.createElement('tr');
        
        // Determine confidence class
        let confidenceClass = 'confidence-low';
        if (obj.confidence_score >= 80) confidenceClass = 'confidence-high';
        else if (obj.confidence_score >= 60) confidenceClass = 'confidence-medium';
        
        // Determine vehicle type class
        const vehicleClass = obj.vehicle_type === 'car' ? 'vehicle-car' : 'vehicle-motorcycle';
        
        // Determine status class
        const statusClass = obj.status === 'Active' ? 'status-active' : 'status-expired';
        
        row.innerHTML = `
            <td><strong>#${obj.id}</strong></td>
            <td><span class="vehicle-type-badge ${vehicleClass}">
                ${obj.vehicle_type === 'car' ? '🚗' : '🏍️'} ${obj.vehicle_type}
            </span></td>
            <td><span class="confidence-score ${confidenceClass}">${obj.confidence_score}%</span></td>
            <td>${obj.detected_at}</td>
            <td><span class="${statusClass}">${obj.status}</span></td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status');
    if (connected) {
        statusIndicator.className = 'status-indicator connected';
        isConnected = true;
    } else {
        statusIndicator.className = 'status-indicator';
        isConnected = false;
    }
}

// Control functions
async function startDetection() {
    const button = document.getElementById('start-btn');
    const originalText = button.innerHTML;
    
    try {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Starting...';
        
        const response = await fetch('/start-detection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('🚀 Detection started successfully!', 'success');
        } else {
            showNotification(result.message, 'warning');
        }
        
    } catch (error) {
        console.error('Error starting detection:', error);
        showNotification('❌ Failed to start detection', 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalText;
        
        setTimeout(updateData, 500);
    }
}

async function stopDetection() {
    const button = document.getElementById('stop-btn');
    const originalText = button.innerHTML;
    
    try {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Stopping...';
        
        const response = await fetch('/stop-detection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('⏹️ Detection stopped successfully!', 'success');
        } else {
            showNotification('❌ Failed to stop detection', 'error');
        }
        
    } catch (error) {
        console.error('Error stopping detection:', error);
        showNotification('❌ Failed to stop detection', 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalText;
        
        setTimeout(updateData, 500);
    }
}

async function resetCount() {
    const button = document.getElementById('reset-btn');
    const originalText = button.innerHTML;
    
    if (!confirm('Are you sure you want to reset all vehicle data? This will clear all detected objects and analytics data.')) {
        return;
    }
    
    try {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Resetting...';
        
        const response = await fetch('/reset-count', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('🔄 All data reset successfully!', 'success');
            
            // Reset chart data to sample data
            const sampleData = generateSampleData(currentPeriod);
            analyticsChart.data.labels = sampleData.labels;
            analyticsChart.data.datasets[0].data = sampleData.data;
            analyticsChart.update();
            
            // Clear objects table
            updateObjectsTable([]);
        } else {
            showNotification('❌ Failed to reset data', 'error');
        }
        
    } catch (error) {
        console.error('Error resetting data:', error);
        showNotification('❌ Failed to reset data', 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalText;
        
        setTimeout(updateData, 500);
    }
}

// Refresh data manually
async function refreshData() {
    const button = document.getElementById('refresh-btn');
    const originalText = button.innerHTML;
    
    try {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = 'Refreshing...';
        
        await updateData();
        showNotification('🔁 Data refreshed successfully!', 'success');
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('❌ Failed to refresh data', 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = originalText;
    }
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.style.animation = 'slideOut 0.3s ease-in-out forwards';
        setTimeout(() => notification.remove(), 300);
    });
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-in-out forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Auto-reconnection function
function startAutoReconnect() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(() => {
        updateData();
    }, 3000); // Update every 3 seconds
}

// Health check function
async function healthCheck() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
            updateConnectionStatus(true);
            return true;
        }
    } catch (error) {
        console.error('Health check failed:', error);
        updateConnectionStatus(false);
    }
    return false;
}

// Theme animation for chart
function animateChartTheme() {
    const canvas = document.getElementById('analytics-chart');
    canvas.style.transition = 'all 0.3s ease';
    
    // Add subtle glow effect
    setTimeout(() => {
        canvas.style.filter = 'drop-shadow(0 0 20px rgba(102, 126, 234, 0.3))';
        setTimeout(() => {
            canvas.style.filter = 'none';
        }, 1000);
    }, 100);
}

// Initialize application
function initialize() {
    console.log('🚗 Modern Vehicle Detection Dashboard initialized');
    
    // Initialize with sample data
    changePeriod('day');
    
    // Start data updates
    updateData();
    startAutoReconnect();
    
    // Setup periodic health checks
    setInterval(healthCheck, 15000);
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        } else {
            startAutoReconnect();
            updateData();
        }
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'r':
                    e.preventDefault();
                    refreshData();
                    break;
                case '1':
                    e.preventDefault();
                    changePeriod('day');
                    break;
                case '2':
                    e.preventDefault();
                    changePeriod('week');
                    break;
                case '3':
                    e.preventDefault();
                    changePeriod('month');
                    break;
            }
        }
    });
    
    // Show welcome notification
    setTimeout(() => {
        showNotification('🎉 Dashboard loaded successfully! Use Ctrl+1/2/3 to switch views, Ctrl+R to refresh.', 'success');
    }, 500);
}

// Add CSS for slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

// Add some interactive features
document.addEventListener('mousemove', function(e) {
    // Subtle parallax effect for the background
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    document.body.style.backgroundPosition = `${x * 10}px ${y * 10}px`;
});

// Add touch gestures for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
});

function handleGesture() {
    const threshold = 100;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > threshold) {
        if (diff > 0) {
            // Swipe left - next period
            const periods = ['day', 'week', 'month'];
            const currentIndex = periods.indexOf(currentPeriod);
            const nextIndex = (currentIndex + 1) % periods.length;
            changePeriod(periods[nextIndex]);
        } else {
            // Swipe right - previous period
            const periods = ['day', 'week', 'month'];
            const currentIndex = periods.indexOf(currentPeriod);
            const prevIndex = currentIndex === 0 ? periods.length - 1 : currentIndex - 1;
            changePeriod(periods[prevIndex]);
        }
    }
} 
// Project data
const projectData = {
    'lokatani': {
        title: 'STARFINDO Road Damage Detection',
        role: 'Machine Learning Engineer',
        period: 'Maret - Juni 2025',
        description: 'Developed a web application using Flask to display real-time road damage detection results, enhancing user experience and accessibility.',
        technologies: ['HTML', 'Tailwind CSS', 'Chart.js', 'Flask API', 'ESP32', 'Machine Learning', 'Yolo'],
        features: [
            'Real-time Detection → Identifies road damages (potholes, cracks, surface degradation) using YOLOv8.',
            'Damage Classification → Differentiates between multiple damage types with confidence scores.',
            'Location Tracking → Captures GPS coordinates of detected damages.',
            'Data Storage → Syncs detection results (image, type,location) to Firebase in real-time.',
            'Visualization Dashboard → Displays road damage reports on a web-based dashboard with mapping support.'
        ],
        challenges: [
            'Dataset Quality & Diversity → Road damage images often varied in lighting, angle, and resolution, making model training more complex.',
            'Real-time Performance → Balancing high detection accuracy with fast inference speed on mobile devices.',
            'Model Optimization → Converting YOLOv8 to TensorFlow Lite while maintaining performance and minimizing size.',
            'Data Integration → Ensuring smooth communication between detection pipeline and Firebase for real-time updates.'
        ]
    },
    'smart-door': {
        title: 'Smart Door Lock with Face Recognition',
        role: 'Frontend Development',
        period: 'September 2023 - Februari 2024',
        description: 'Smart door lock with face recognition, equipped with Python API, database management, and robust security system.',
        technologies: ['Python', 'Face Recognition API', 'SQLite/MySQL', 'REST API', 'Encryption', 'Authentication Protocols', 'IoT Sensors'],
        features: [
            'Robust Python API for communication between IoT devices and server',
            'Database management for user data and access log storage',
            'High-accuracy face recognition system',
            'End-to-end encryption protocol for data security',
            'Multi-layer authentication system for secure access',
            'Real-time logging and monitoring of access system',
            'Layered security policies with fail-safe mechanism',
            'API endpoints for user management and access control',
            'Integration with hardware sensors for presence detection'
        ],
        challenges: [
            'Optimization of face recognition algorithms for high accuracy',
            'Implementation of multi-layer security protocols without compromising performance',
            'Efficient database management for large-scale access logs',
            'Seamless hardware-software integration'
        ]
    },
    'network-simulation': {
        title: 'Network Infrastructure Simulation',
        role: 'Network Designer & Administrator',
        period: 'Desember 2023 - Februari 2024',
        description: 'Network infrastructure design and simulation with routing configuration, segmentation, and server management.',
        technologies: ['Cisco Packet Tracer', 'Router Configuration', 'Switch Management', 'DNS Server', 'HTTP Server', 'ACL', 'Network Security'],
        features: [
            'Enterprise network topology design with multiple subnets',
            'Routing protocol configuration (OSPF, EIGRP, RIP) for path optimization',
            'Network segmentation for traffic isolation and security',
            'Implementation of Access Control Lists (ACL) for traffic filtering',
            'Setup and configuration of DNS server for name resolution',
            'Deployment of HTTP server with load balancing configuration',
            'VLAN configuration for network segmentation',
            'Implementation of network monitoring and troubleshooting tools',
            'Disaster recovery planning and redundancy setup'
        ],
        challenges: [
            'Routing optimization for maximum network performance',
            'Balancing security and accessibility in ACL configuration',
            'Scalability planning for future network expansion',
            'Integration of multiple services within a single infrastructure'
        ]
    },
    'iot-hardware': {
        title: 'IoT Hardware Development',
        role: 'Hardware IoT Specialist',
        period: 'Maret - September 2024',
        description: 'IoT device development with Arduino and ESP8266, including component selection and sensor programming.',
        technologies: ['Arduino', 'ESP8266', 'ESP32', 'nRF24L01+', 'Various Sensors', 'Actuators', 'C/C++', 'IoT Protocols'],
        features: [
            'Selection and evaluation of optimal components (Arduino, ESP8266, nRF24L01+)',
            'Hardware assembly with considerations for EMI and power consumption',
            'Embedded systems programming using C/C++ for optimal performance',
            'Implementation of wireless communication using nRF24L01+ protocol',
            'Integration of various sensors (temperature, humidity, motion, light)',
            'Actuator control for automated system response',
            'Power management optimization for battery-powered devices',
            'Data logging and transmission to cloud platforms',
            'Real-time monitoring dashboard for device status',
            'OTA (Over-The-Air) update capability for remote maintenance'
        ],
        challenges: [
            'Power consumption optimization for battery-powered applications',
            'Reliability testing under various environmental conditions',
            'Integration of multiple sensors with a single microcontroller',
            'Wireless communication stability in industrial environments'
        ]
    }
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    initScrollAnimations();
    initSmoothScroll();
    initProjectModals();
    initMobileMenu();
    initHeaderScroll();
    initScrollToTop();
});

// Scroll Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// Smooth Scroll for Navigation
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const header = document.querySelector('header');
                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Project Modal System
function initProjectModals() {
    const modal = document.getElementById('projectModal');
    const closeBtn = document.querySelector('.close');
    const projectCards = document.querySelectorAll('.project-card');

    if (!modal || !closeBtn) return;

    // Open modal when project card is clicked
    projectCards.forEach(card => {
        card.addEventListener('click', function() {
            const projectId = this.getAttribute('data-project');
            const project = projectData[projectId];
            
            if (project) {
                showProjectModal(project);
            }
        });
    });

    // Close modal when X is clicked
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Show Project Modal
function showProjectModal(project) {
    const modal = document.getElementById('projectModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalRole = document.getElementById('modalRole');
    const modalContent = document.getElementById('modalContent');

    if (!modal || !modalTitle || !modalRole || !modalContent) return;

    // Set modal content
    modalTitle.textContent = project.title;
    modalRole.textContent = project.role;

    // Get project image if it's the STARFINDO project (corrected title)
    const projectImageHTML = project.title === 'STARFINDO Road Damage Detection' ? 
        `<div class="modal-project-image" style="margin-bottom: 2rem; text-align: center;">
            <img src="img/Lokatani.png" alt="${project.title}" style="max-width: 100%; height: 300px; object-fit: cover; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        </div>` : '';

    // Build modal content HTML
    const contentHTML = `
        ${projectImageHTML}
        
        <div class="project-period" style="color: #667eea; font-weight: 600; margin-bottom: 1rem;">
            ${project.period}
        </div>
        
        <div class="project-overview" style="margin-bottom: 2rem;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.2rem;">Project Overview</h3>
            <p style="line-height: 1.6; color: #666;">${project.description}</p>
        </div>

        <div class="tech-stack-section" style="margin-bottom: 2rem;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.2rem;">Technologies Used</h3>
            <div class="tech-stack">
                ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
        </div>

        <div class="features-section" style="margin-bottom: 2rem;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.2rem;">Key Features & Achievements</h3>
            <ul style="list-style: none; padding: 0;">
                ${project.features.map(feature => `
                    <li style="padding: 0.5rem 0; border-left: 3px solid #667eea; padding-left: 1rem; margin-bottom: 0.5rem; background: #f8f9ff; border-radius: 0 5px 5px 0;">
                        ${feature}
                    </li>
                `).join('')}
            </ul>
        </div>

        <div class="challenges-section">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.2rem;">Technical Challenges Solved</h3>
            <ul style="list-style: none; padding: 0;">
                ${project.challenges.map(challenge => `
                    <li style="padding: 0.5rem 0; border-left: 3px solid #764ba2; padding-left: 1rem; margin-bottom: 0.5rem; background: #f3f0ff; border-radius: 0 5px 5px 0;">
                        ${challenge}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    modalContent.innerHTML = contentHTML;

    // Show modal with animation
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Add entrance animation
    const modalContentEl = document.querySelector('.modal-content');
    if (modalContentEl) {
        modalContentEl.style.transform = 'translateY(-50px)';
        modalContentEl.style.opacity = '0';
        
        setTimeout(() => {
            modalContentEl.style.transform = 'translateY(0)';
            modalContentEl.style.opacity = '1';
            modalContentEl.style.transition = 'all 0.3s ease';
        }, 10);
    }
}

// Mobile Menu Toggle
function initMobileMenu() {
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', function() {
            navLinks.classList.toggle('show');
        });
    }
}

// Header Scroll Effect
function initHeaderScroll() {
    const header = document.querySelector('header');
    if (!header) return;
    
    let lastScrollTop = 0;

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }
        
        // Add background blur effect when scrolling
        if (scrollTop > 50) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = 'none';
        }
        
        lastScrollTop = scrollTop;
    });
}

// Typing Animation for Hero Text
function initTypingAnimation() {
    const heroTitle = document.querySelector('.hero h1');
    const heroSubtitle = document.querySelector('.hero p');
    
    if (heroTitle && heroSubtitle) {
        const titleText = heroTitle.textContent;
        const subtitleText = heroSubtitle.textContent;
        
        heroTitle.textContent = '';
        heroSubtitle.textContent = '';
        
        let titleIndex = 0;
        let subtitleIndex = 0;
        
        function typeTitle() {
            if (titleIndex < titleText.length) {
                heroTitle.textContent += titleText.charAt(titleIndex);
                titleIndex++;
                setTimeout(typeTitle, 100);
            } else {
                setTimeout(typeSubtitle, 500);
            }
        }
        
        function typeSubtitle() {
            if (subtitleIndex < subtitleText.length) {
                heroSubtitle.textContent += subtitleText.charAt(subtitleIndex);
                subtitleIndex++;
                setTimeout(typeSubtitle, 50);
            }
        }
        
        setTimeout(typeTitle, 1000);
    }
}

// Parallax Effect for Hero Section
function initParallaxEffect() {
    const hero = document.querySelector('.hero');
    
    if (hero) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            hero.style.transform = `translateY(${rate}px)`;
        });
    }
}

// Contact Form Animation
function initContactAnimations() {
    const contactItems = document.querySelectorAll('.contact-item');
    
    contactItems.forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Skill Items Animation
function initSkillAnimations() {
    const skillItems = document.querySelectorAll('.skill-item');
    
    skillItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
        
        item.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(360deg)';
                icon.style.transition = 'transform 0.3s ease';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
            }
        });
    });
}

// Scroll to top functionality
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Initialize scroll to top button
function initScrollToTop() {
    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollTopBtn.className = 'scroll-top-btn';
    scrollTopBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        color: white;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 1000;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    `;
    
    scrollTopBtn.addEventListener('click', scrollToTop);
    document.body.appendChild(scrollTopBtn);
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollTopBtn.style.opacity = '1';
            scrollTopBtn.style.visibility = 'visible';
        } else {
            scrollTopBtn.style.opacity = '0';
            scrollTopBtn.style.visibility = 'hidden';
        }
    });
}

// Initialize additional animations when page loads
window.addEventListener('load', function() {
    initContactAnimations();
    initSkillAnimations();
    initParallaxEffect();
});
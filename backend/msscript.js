// Function to scroll to a specific section
function scrollToSection(sectionIndex) {
    const sections = document.querySelectorAll('.immersive-section');
    const dots = document.querySelectorAll('.scroll-dot');
    
    // Deactivate all dots and then activate the current one
    dots.forEach((dot, index) => {
        if (index === sectionIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    if (sections[sectionIndex]) {
        sections[sectionIndex].scrollIntoView({ behavior: 'smooth' });
    }
}

// Placeholder functions for the buttons
function openItineraryPlanner() {
    alert('AI Journey Planner is not yet implemented. Please check back later!');
}

function openCulturalHub() {
    alert('Cultural Immersion Hub is not yet implemented. Please check back later!');
}

function viewDestination(name) {
    alert(`You are now exploring the sacred space of ${name}.`);
}

function openGoogleMaps(location) {
    const url = `https://www.google.com/maps/search/?api=1&query=${location},+Jharkhand`;
    window.open(url, '_blank');
}

function openSoundscape(name) {
    alert(`Soundscape for ${name} is playing. Imagine the sounds of ${name}.`);
}

function showTransport() {
    alert('Real-time transport intelligence is not yet active.');
}

function openMarketplace() {
    alert('The Sacred Marketplace is currently under development.');
}

function findGuides() {
    alert('Connecting you with a local mystic guide...');
}

function openAnalytics() {
    alert('Accessing Neural Analytics data...');
}

function bookEvent(event) {
    alert(`Thank you for your interest in the ${event} festival. Booking is not yet available.`);
}

// Function to show the notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.querySelector('p').textContent = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000); // Notification disappears after 5 seconds
    }
}

// Parallax effect for neural network background
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('.neural-network');
    const speed = scrolled * 0.5;
    parallax.style.transform = `translateY(${speed}px)`;
});

// Update active dot on scroll
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('.immersive-section');
    const dots = document.querySelectorAll('.scroll-dot');
    const scrollPosition = window.pageYOffset;

    sections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
            dots.forEach(dot => dot.classList.remove('active'));
            dots[index].classList.add('active');
        }
    });
});

// Show the welcome notification on page load
document.addEventListener('DOMContentLoaded', () => {
    showNotification('🌌 Welcome, seeker. The digital realm of Jharkhand awaits your exploration...');
});
// Loading animation for initial page load
document.addEventListener('DOMContentLoaded', () => {
  // Show loading animation immediately
  const loading = document.querySelector('.loading-animation');
  if (loading) {
    loading.style.display = 'flex';
    loading.classList.remove('hide');
  }
  
  // Hide loading after page is fully loaded
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (loading) {
        loading.classList.add('hide');
        setTimeout(() => {
          loading.style.display = 'none';
        }, 500);
      }
    }, 1500);
  });
  
  // Trigger animations after page loads
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);
  
  // Initialize hero slider
  initHeroSlider();
  
  // Initialize email functionality
  initEmailForm();
});

// Mobile menu toggle
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
menuBtn?.addEventListener('click', () => {
  menu.classList.toggle('open');
  menuBtn.classList.toggle('active');
});

// Smooth scroll + active link highlight
const links = [...document.querySelectorAll('nav a[href^="#"]')];
links.forEach(a => a.addEventListener('click', (e) => {
  e.preventDefault();
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (el) {
    window.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
    menu.classList.remove('open');
    menuBtn.classList.remove('active');
  }
}));

const sections = ['home', 'about', 'services', 'team', 'contact'].map(id => document.getElementById(id));
const onScroll = () => {
  const y = window.scrollY + 80;
  sections.forEach(sec => {
    if (!sec) return;
    const link = document.querySelector(`nav a[href="#${sec.id}"]`);
    if (y >= sec.offsetTop && y < sec.offsetTop + sec.offsetHeight) {
      links.forEach(l => l.classList.remove('active'));
      link?.classList.add('active');
    }
  });
  
  // Scroll progress
  const winHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const scrollTop = window.pageYOffset;
  const scrollPercent = (scrollTop / (docHeight - winHeight)) * 100;
  const progressBar = document.querySelector('.scroll-progress-bar');
  if (progressBar) {
    progressBar.style.width = scrollPercent + '%';
  }
  
  // Hide/show header on scroll
  const header = document.querySelector('header');
  let lastScrollY = window.scrollY;
  
  if (lastScrollY > 200) {
    header.classList.add('hide');
  } else {
    header.classList.remove('hide');
  }
};
document.addEventListener('scroll', onScroll);

// Scroll animation for elements
const scrollElements = document.querySelectorAll('.animate-on-scroll');
const elementInView = (el, dividend = 1) => {
  const elementTop = el.getBoundingClientRect().top;
  return (
    elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend
  );
};
const displayScrollElement = (element) => {
  element.classList.add('is-visible');
};
const hideScrollElement = (element) => {
  element.classList.remove('is-visible');
};
const handleScrollAnimation = () => {
  scrollElements.forEach((el) => {
    if (elementInView(el, 1.15)) {
      displayScrollElement(el);
    } else {
      hideScrollElement(el);
    }
  });
};
window.addEventListener('scroll', () => {
  handleScrollAnimation();
});
// Initial check on page load
setTimeout(handleScrollAnimation, 500);

// Email form functionality using FormSubmit
function initEmailForm() {
  const sendMessageBtn = document.getElementById('sendMessageBtn');
  const form = document.getElementById('contactForm');
  
  if (sendMessageBtn && form) {
    // Set up form attributes for FormSubmit
    form.action = 'https://formsubmit.co/samfine278@gmail.com';
    form.method = 'POST';
    
    // Add hidden fields for FormSubmit
    const addHiddenField = (name, value) => {
      let field = document.querySelector(`input[name="${name}"]`);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        form.appendChild(field);
      }
      field.value = value;
    };
    
    addHiddenField('_subject', 'New Message from JonaTech Consult Website');
    addHiddenField('_template', 'table');
    addHiddenField('_captcha', 'false');
    addHiddenField('_next', window.location.href + '?message=success');
    
    sendMessageBtn.addEventListener('click', (e) => {
      // Get form values
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const subject = document.getElementById('subject').value;
      const message = document.getElementById('message').value;
      
      // Validate form
      if (!name || !email || !subject || !message) {
        showNotification('Please fill in all fields before sending the message.', 'error');
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address.', 'error');
        return;
      }
      
      // Show loading state
      const originalText = sendMessageBtn.innerHTML;
      sendMessageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      sendMessageBtn.disabled = true;
      
      // Submit the form
      form.submit();
    });
  }
}

// Notification function
function showNotification(message, type) {
  // Remove existing notifications
  const existingNotification = document.querySelector('.form-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `form-notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  
  if (type === 'success') {
    notification.style.background = '#4CAF50';
  } else {
    notification.style.background = '#F44336';
  }
  
  document.body.appendChild(notification);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Check for success message in URL
function checkForSuccessMessage() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('message') === 'success') {
    showNotification('Your message has been sent successfully! We will get back to you soon.', 'success');
    
    // Clean URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Call this function on page load
checkForSuccessMessage();

// Back to top button animation
const backToTopBtn = document.querySelector('.back-to-top');
if (backToTopBtn) {
  backToTopBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Parallax effect for hero background
window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  const shapes = document.querySelectorAll('.floating-shape');
  
  shapes.forEach((shape, index) => {
    const rate = scrolled * (0.3 + (index * 0.1));
    shape.style.transform = `translateY(${rate}px) rotate(${rate * 0.1}deg)`;
  });
});

// Hover effect for cards
const cards = document.querySelectorAll('.card');
cards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-10px)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
  });
});

// Loading screen for page transitions
document.addEventListener('DOMContentLoaded', function() {
  // Get all links that lead to other pages
  const pageLinks = document.querySelectorAll('a[href]:not([href^="#"]):not([href^="javascript:"]):not([target="_blank"])');
  
  pageLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // Don't interfere with external links or special cases
      if (this.hostname !== window.location.hostname || 
          this.getAttribute('download') || 
          this.getAttribute('target') === '_blank') {
        return;
      }
      
      e.preventDefault();
      const href = this.href;
      
      // Show loading animation
      const loading = document.querySelector('.loading-animation');
      if (loading) {
        loading.style.display = 'flex';
        loading.classList.remove('hide');
      }
      
      // Navigate after a brief delay to show the loading animation
      setTimeout(() => {
        window.location.href = href;
      }, 800);
    });
  });
  
  // Handle browser back/forward navigation
  window.addEventListener('pageshow', function(event) {
    // If page is loaded from cache (back/forward navigation), hide loading
    if (event.persisted) {
      const loading = document.querySelector('.loading-animation');
      if (loading) {
        loading.classList.add('hide');
        setTimeout(() => {
          loading.style.display = 'none';
        }, 500);
      }
    }
  });
});

// Hero Image Slider
function initHeroSlider() {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dots .dot');
  const prevBtn = document.querySelector('.slider-prev');
  const nextBtn = document.querySelector('.slider-next');
  
  if (!slides.length) {
    console.error('No slides found for hero slider');
    return;
  }
  
  let currentSlide = 0;
  let slideInterval;
  
  // Function to show a specific slide
  function showSlide(index) {
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Handle wrap-around for slide index
    if (index >= slides.length) {
      currentSlide = 0;
    } else if (index < 0) {
      currentSlide = slides.length - 1;
    } else {
      currentSlide = index;
    }
    
    // Add active class to current slide and dot
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) {
      dots[currentSlide].classList.add('active');
    }
  }
  
  // Function to move to next slide
  function nextSlide() {
    showSlide(currentSlide + 1);
  }
  
  // Function to start auto-sliding
  function startSlider() {
    if (!slideInterval) {
      slideInterval = setInterval(nextSlide, 5000); // Change slide every 5 seconds
    }
  }
  
  // Function to stop auto-sliding
  function stopSlider() {
    clearInterval(slideInterval);
    slideInterval = null;
  }
  
  // Event listeners for controls
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stopSlider();
      nextSlide();
      startSlider();
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stopSlider();
      showSlide(currentSlide - 1);
      startSlider();
    });
  }
  
  // Event listeners for dots
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      stopSlider();
      showSlide(index);
      startSlider();
    });
  });
  
  // Start the slider
  startSlider();
  
  // Pause slider when user hovers over it
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', stopSlider);
    heroSection.addEventListener('mouseleave', startSlider);
  }
  
  // Pause slider when window loses focus
  window.addEventListener('blur', stopSlider);
  window.addEventListener('focus', startSlider);
}
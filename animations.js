/**
 * ============================================================================
 * THE GADGET HUB STORE - ADVANCED ANIMATIONS ENGINE
 * Maximum Cognitive Allocation Protocol - Complete Implementation
 * ============================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION & STATE MANAGEMENT
  // ============================================================================

  const CONFIG = {
    observerThreshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    observerRootMargin: '0px 0px -10% 0px',
    scrollThreshold: 100,
    staggerDelay: 80,
    maxStaggerDelay: 600,
    particleCount: 50,
    mouseTrailLength: 20,
    performanceCheckInterval: 5000
  };

  const STATE = {
    observers: new Map(),
    animationFrames: new Set(),
    mousePosition: { x: 0, y: 0 },
    previousMousePosition: { x: 0, y: 0 },
    mouseVelocity: { x: 0, y: 0 },
    scrollPosition: 0,
    previousScrollPosition: 0,
    scrollVelocity: 0,
    isReducedMotion: false,
    performanceMode: 'high',
    mouseTrail: []
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Check if user prefers reduced motion
   * @returns {boolean}
   */
  function prefersReducedMotion() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery && mediaQuery.matches;
  }

  /**
   * Debounce function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function}
   */
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Request animation frame with fallback
   * @param {Function} callback
   * @returns {number}
   */
  function requestFrame(callback) {
    const frame = (window.requestAnimationFrame ||
                   window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame ||
                   function(cb) { return setTimeout(cb, 16); })(callback);
    STATE.animationFrames.add(frame);
    return frame;
  }

  /**
   * Cancel animation frame
   * @param {number} frame
   */
  function cancelFrame(frame) {
    (window.cancelAnimationFrame ||
     window.webkitCancelAnimationFrame ||
     window.mozCancelAnimationFrame ||
     clearTimeout)(frame);
    STATE.animationFrames.delete(frame);
  }

  /**
   * Linear interpolation
   * @param {number} start
   * @param {number} end
   * @param {number} amount
   * @returns {number}
   */
  function lerp(start, end, amount) {
    return (1 - amount) * start + amount * end;
  }

  /**
   * Clamp value between min and max
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  /**
   * Monitor performance and adjust animation quality
   */
  function monitorPerformance() {
    if (!window.performance || !window.performance.memory) {
      return;
    }

    const memory = window.performance.memory;
    const usedMemory = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    if (usedMemory > 0.9) {
      STATE.performanceMode = 'low';
      disableExpensiveAnimations();
    } else if (usedMemory > 0.7) {
      STATE.performanceMode = 'medium';
    } else {
      STATE.performanceMode = 'high';
    }
  }

  /**
   * Disable expensive animations in low performance mode
   */
  function disableExpensiveAnimations() {
    const particles = document.getElementById('particle-field');
    if (particles) {
      particles.style.display = 'none';
    }
  }

  // ============================================================================
  // INTERSECTION OBSERVER - REVEAL ANIMATIONS
  // ============================================================================

  /**
   * Initialize intersection observer for reveal animations
   */
  function initializeRevealObserver() {
    if (STATE.isReducedMotion) {
      revealAllElements();
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: CONFIG.observerRootMargin,
      threshold: CONFIG.observerThreshold
    };

    const revealCallback = (entries, observer) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
          const element = entry.target;
          const delay = calculateStaggerDelay(element, index);
          
          setTimeout(() => {
            element.classList.add('revealed');
            triggerRevealAnimation(element);
          }, delay);

          observer.unobserve(element);
        }
      });
    };

    const revealObserver = new IntersectionObserver(revealCallback, observerOptions);
    STATE.observers.set('reveal', revealObserver);

    const revealElements = document.querySelectorAll('[data-reveal]');
    revealElements.forEach(element => {
      revealObserver.observe(element);
    });
  }

  /**
   * Calculate stagger delay for element
   * @param {HTMLElement} element
   * @param {number} index
   * @returns {number}
   */
  function calculateStaggerDelay(element, index) {
    const customDelay = parseInt(element.getAttribute('data-delay')) || 0;
    const staggerDelay = index * CONFIG.staggerDelay;
    const totalDelay = customDelay + Math.min(staggerDelay, CONFIG.maxStaggerDelay);
    return STATE.performanceMode === 'low' ? 0 : totalDelay;
  }

  /**
   * Trigger reveal animation on element
   * @param {HTMLElement} element
   */
  function triggerRevealAnimation(element) {
    const animationType = element.getAttribute('data-reveal');
    
    switch (animationType) {
      case 'fade-up':
        element.style.animation = 'fadeUp 0.8s ease-out forwards';
        break;
      case 'fade-left':
        element.style.animation = 'fadeLeft 0.8s ease-out forwards';
        break;
      case 'fade-right':
        element.style.animation = 'fadeRight 0.8s ease-out forwards';
        break;
      case 'product':
        animateProductCard(element);
        break;
      case 'hero':
        animateHeroSection(element);
        break;
      default:
        element.style.animation = 'fadeUp 0.8s ease-out forwards';
    }
  }

  /**
   * Reveal all elements immediately (for reduced motion)
   */
  function revealAllElements() {
    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach(element => {
      element.classList.add('revealed');
      element.style.opacity = '1';
      element.style.transform = 'none';
    });
  }

  /**
   * Animate product card with special effects
   * @param {HTMLElement} card
   */
  function animateProductCard(card) {
    const image = card.querySelector('.product-image');
    const content = card.querySelector('.product-content');
    
    if (image) {
      image.style.animation = 'imageShimmer 3s ease-in-out infinite';
    }
    
    if (content) {
      const children = content.children;
      Array.from(children).forEach((child, index) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(10px)';
        setTimeout(() => {
          child.style.transition = 'all 0.4s ease-out';
          child.style.opacity = '1';
          child.style.transform = 'translateY(0)';
        }, index * 50);
      });
    }
  }

  /**
   * Animate hero section elements
   * @param {HTMLElement} hero
   */
  function animateHeroSection(hero) {
    const badge = hero.querySelector('.hero-badge');
    const title = hero.querySelector('.hero-title');
    const subtitle = hero.querySelector('.hero-subtitle');
    const cta = hero.querySelector('.hero-cta-group');

    const elements = [badge, title, subtitle, cta].filter(Boolean);
    
    elements.forEach((element, index) => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(30px)';
      setTimeout(() => {
        element.style.transition = 'all 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }, index * 150);
    });
  }

  // ============================================================================
  // SCROLL ANIMATIONS
  // ============================================================================

  /**
   * Initialize scroll-based animations
   */
  function initializeScrollAnimations() {
    const header = document.querySelector('.site-header');
    const scrollToTop = document.getElementById('scroll-to-top');

    let ticking = false;

    function updateScrollState() {
      STATE.previousScrollPosition = STATE.scrollPosition;
      STATE.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      STATE.scrollVelocity = STATE.scrollPosition - STATE.previousScrollPosition;

      if (header) {
        if (STATE.scrollPosition > CONFIG.scrollThreshold) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }

      if (scrollToTop) {
        if (STATE.scrollPosition > window.innerHeight) {
          scrollToTop.classList.add('visible');
        } else {
          scrollToTop.classList.remove('visible');
        }
      }

      updateParallaxElements();
      
      ticking = false;
    }

    function handleScroll() {
      if (!ticking) {
        requestFrame(updateScrollState);
        ticking = true;
      }
    }

    window.addEventListener('scroll', throttle(handleScroll, 16), { passive: true });

    if (scrollToTop) {
      scrollToTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  }

  /**
   * Update parallax elements based on scroll
   */
  function updateParallaxElements() {
    if (STATE.isReducedMotion || STATE.performanceMode === 'low') {
      return;
    }

    const parallaxElements = document.querySelectorAll('[data-parallax]');
    const scrollPercent = STATE.scrollPosition / (document.documentElement.scrollHeight - window.innerHeight);

    parallaxElements.forEach(element => {
      const speed = parseFloat(element.getAttribute('data-parallax')) || 0.5;
      const yPos = -(STATE.scrollPosition * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  // ============================================================================
  // MOUSE TRACKING & INTERACTIONS
  // ============================================================================

  /**
   * Initialize mouse tracking and interactions
   */
  function initializeMouseTracking() {
    if (STATE.isReducedMotion || STATE.performanceMode === 'low') {
      return;
    }

    let ticking = false;

    function updateMouseState(event) {
      STATE.previousMousePosition = { ...STATE.mousePosition };
      STATE.mousePosition = {
        x: event.clientX,
        y: event.clientY
      };
      STATE.mouseVelocity = {
        x: STATE.mousePosition.x - STATE.previousMousePosition.x,
        y: STATE.mousePosition.y - STATE.previousMousePosition.y
      };

      updateMouseTrail();
      updateMagneticElements();
      updateCursorFollowers();

      ticking = false;
    }

    function handleMouseMove(event) {
      if (!ticking) {
        requestFrame(() => updateMouseState(event));
        ticking = true;
      }
    }

    window.addEventListener('mousemove', throttle(handleMouseMove, 16), { passive: true });
  }

  /**
   * Update mouse trail effect
   */
  function updateMouseTrail() {
    STATE.mouseTrail.push({ ...STATE.mousePosition, timestamp: Date.now() });
    
    if (STATE.mouseTrail.length > CONFIG.mouseTrailLength) {
      STATE.mouseTrail.shift();
    }

    STATE.mouseTrail = STATE.mouseTrail.filter(point => {
      return Date.now() - point.timestamp < 1000;
    });
  }

  /**
   * Update magnetic elements (elements that follow cursor)
   */
  function updateMagneticElements() {
    const magneticElements = document.querySelectorAll('[data-magnetic]');
    
    magneticElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = STATE.mousePosition.x - centerX;
      const distanceY = STATE.mousePosition.y - centerY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      
      const strength = parseFloat(element.getAttribute('data-magnetic')) || 0.3;
      const maxDistance = 100;
      
      if (distance < maxDistance) {
        const factor = (1 - distance / maxDistance) * strength;
        const translateX = distanceX * factor;
        const translateY = distanceY * factor;
        
        element.style.transform = `translate(${translateX}px, ${translateY}px)`;
      } else {
        element.style.transform = 'translate(0, 0)';
      }
    });
  }

  /**
   * Update cursor follower elements
   */
  function updateCursorFollowers() {
    const followers = document.querySelectorAll('[data-cursor-follow]');
    
    followers.forEach((follower, index) => {
      const delay = (index + 1) * 0.1;
      const targetX = STATE.mousePosition.x;
      const targetY = STATE.mousePosition.y;
      
      const currentX = parseFloat(follower.style.left) || targetX;
      const currentY = parseFloat(follower.style.top) || targetY;
      
      const newX = lerp(currentX, targetX, delay);
      const newY = lerp(currentY, targetY, delay);
      
      follower.style.left = `${newX}px`;
      follower.style.top = `${newY}px`;
    });
  }

  // ============================================================================
  // HOVER INTERACTIONS
  // ============================================================================

  /**
   * Initialize hover interactions
   */
  function initializeHoverInteractions() {
    initializeCardHovers();
    initializeButtonHovers();
    initializeImageHovers();
  }

  /**
   * Initialize card hover effects
   */
  function initializeCardHovers() {
    const cards = document.querySelectorAll('.product-card, .feature-card, .hero-visual-card');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        if (!STATE.isReducedMotion) {
          this.classList.add('hovered');
          animateCardChildren(this);
        }
      });

      card.addEventListener('mouseleave', function() {
        this.classList.remove('hovered');
      });

      card.addEventListener('mousemove', function(event) {
        if (STATE.isReducedMotion || STATE.performanceMode === 'low') {
          return;
        }
        applyTiltEffect(this, event);
      });
    });
  }

  /**
   * Animate card children on hover
   * @param {HTMLElement} card
   */
  function animateCardChildren(card) {
    const image = card.querySelector('.product-image, .feature-icon');
    if (image) {
      image.style.transform = 'scale(1.05)';
    }
  }

  /**
   * Apply 3D tilt effect to card
   * @param {HTMLElement} card
   * @param {MouseEvent} event
   */
  function applyTiltEffect(card, event) {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const percentX = (x - centerX) / centerX;
    const percentY = (y - centerY) / centerY;
    
    const maxTilt = 10;
    const tiltX = percentY * maxTilt;
    const tiltY = -percentX * maxTilt;
    
    card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  /**
   * Initialize button hover effects
   */
  function initializeButtonHovers() {
    const buttons = document.querySelectorAll('.hero-cta, .shop-now-btn, .newsletter-submit');
    
    buttons.forEach(button => {
      button.addEventListener('mouseenter', function() {
        if (!STATE.isReducedMotion) {
          this.style.transform = 'translateY(-4px) scale(1.05)';
        }
      });

      button.addEventListener('mouseleave', function() {
        this.style.transform = '';
      });

      button.addEventListener('mousedown', function() {
        this.style.transform = 'translateY(-2px) scale(1.02)';
      });

      button.addEventListener('mouseup', function() {
        this.style.transform = 'translateY(-4px) scale(1.05)';
      });
    });
  }

  /**
   * Initialize image hover effects
   */
  function initializeImageHovers() {
    const images = document.querySelectorAll('.product-image');
    
    images.forEach(image => {
      image.addEventListener('mouseenter', function() {
        if (!STATE.isReducedMotion) {
          this.style.transform = 'scale(1.1)';
        }
      });

      image.addEventListener('mouseleave', function() {
        this.style.transform = '';
      });
    });
  }

  // ============================================================================
  // PARTICLE SYSTEM
  // ============================================================================

  /**
   * Initialize particle system
   */
  function initializeParticleSystem() {
    if (STATE.isReducedMotion || STATE.performanceMode === 'low') {
      return;
    }

    const particleField = document.getElementById('particle-field');
    if (!particleField) {
      return;
    }

    const particles = [];

    for (let i = 0; i < CONFIG.particleCount; i++) {
      const particle = createParticle();
      particles.push(particle);
      particleField.appendChild(particle.element);
    }

    function createParticle() {
      const element = document.createElement('div');
      element.className = 'particle';
      element.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: var(--color-accent);
        border-radius: 50%;
        pointer-events: none;
        opacity: ${Math.random() * 0.5 + 0.3};
      `;

      return {
        element,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: Math.random() * 100
      };
    }

    function updateParticles() {
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life += 0.1;

        if (particle.x < 0 || particle.x > window.innerWidth) {
          particle.vx *= -1;
        }
        if (particle.y < 0 || particle.y > window.innerHeight) {
          particle.vy *= -1;
        }

        const opacity = Math.sin(particle.life) * 0.5 + 0.5;
        particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px)`;
        particle.element.style.opacity = opacity * 0.3;
      });

      requestFrame(updateParticles);
    }

    updateParticles();
  }

  // ============================================================================
  // THEME TRANSITION ANIMATIONS
  // ============================================================================

  /**
   * Animate theme transitions
   */
  function initializeThemeTransitions() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          animateThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Animate theme change
   */
  function animateThemeChange() {
    if (STATE.isReducedMotion) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--color-accent);
      opacity: 0;
      pointer-events: none;
      z-index: 99999;
      transition: opacity 0.3s ease-out;
    `;

    document.body.appendChild(overlay);

    requestFrame(() => {
      overlay.style.opacity = '0.3';
    });

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 300);
    }, 150);
  }

  // ============================================================================
  // MOBILE MENU ANIMATIONS
  // ============================================================================

  /**
   * Initialize mobile menu animations
   */
  function initializeMobileMenuAnimations() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const overlay = document.getElementById('mobile-nav-overlay');

    if (!toggle || !overlay) {
      return;
    }

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !isExpanded);
      overlay.setAttribute('aria-hidden', isExpanded);

      if (!isExpanded) {
        overlay.classList.add('active');
        animateMobileMenuItems();
      } else {
        overlay.classList.remove('active');
      }
    });

    const menuLinks = overlay.querySelectorAll('.mobile-nav-link');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /**
   * Animate mobile menu items
   */
  function animateMobileMenuItems() {
    if (STATE.isReducedMotion) {
      return;
    }

    const items = document.querySelectorAll('.mobile-nav-link, .mobile-social-icon');
    
    items.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(-20px)';
      
      setTimeout(() => {
        item.style.transition = 'all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)';
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
      }, index * 50);
    });
  }

  // ============================================================================
  // REINITIALIZE ANIMATIONS
  // ============================================================================

  /**
   * Reinitialize animations for dynamically added content
   */
  function reinitializeAnimations() {
    const newElements = document.querySelectorAll('[data-reveal]:not(.revealed)');
    
    if (newElements.length > 0 && STATE.observers.has('reveal')) {
      const observer = STATE.observers.get('reveal');
      newElements.forEach(element => {
        observer.observe(element);
      });
    }

    initializeHoverInteractions();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup all animations and observers
   */
  function cleanup() {
    STATE.observers.forEach(observer => {
      observer.disconnect();
    });
    STATE.observers.clear();

    STATE.animationFrames.forEach(frame => {
      cancelFrame(frame);
    });
    STATE.animationFrames.clear();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize all animation systems
   */
  function initialize() {
    STATE.isReducedMotion = prefersReducedMotion();

    if (STATE.isReducedMotion) {
      console.log('Reduced motion preference detected - simplified animations enabled');
      revealAllElements();
      return;
    }

    initializeRevealObserver();
    initializeScrollAnimations();
    initializeMouseTracking();
    initializeHoverInteractions();
    initializeParticleSystem();
    initializeThemeTransitions();
    initializeMobileMenuAnimations();

    setInterval(monitorPerformance, CONFIG.performanceCheckInterval);

    console.log('Advanced animation engine initialized');
  }

  // ============================================================================
  // EXPOSE PUBLIC API
  // ============================================================================

  window.AnimationsEngine = {
    reinitialize: reinitializeAnimations,
    cleanup: cleanup,
    getState: () => ({ ...STATE }),
    getConfig: () => ({ ...CONFIG })
  };

  window.reinitializeAnimations = reinitializeAnimations;

  // ============================================================================
  // AUTO-INITIALIZE
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  window.addEventListener('beforeunload', cleanup);

})();

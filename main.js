/**
 * ============================================================================
 * THE GADGET HUB STORE - MAIN APPLICATION CONTROLLER
 * Maximum Cognitive Allocation Protocol - Complete Implementation
 * ============================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    THEME_STORAGE_KEY: 'gadget_hub_theme',
    SEARCH_DEBOUNCE_DELAY: 300,
    HERO_LINK_URL: 'https://s.click.aliexpress.com/e/_c3pULFKP',
    PRODUCTS_JSON_PATH: 'products.json',
    DEFAULT_THEME: 'cyber-neon',
    THEMES: ['cyber-neon', 'midnight-obsidian', 'royal-emerald', 'solar-gold']
  };

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const STATE = {
    allProducts: [],
    filteredProducts: [],
    currentTheme: CONFIG.DEFAULT_THEME,
    searchQuery: '',
    searchDebounceTimer: null,
    isLoading: false,
    hasError: false,
    analytics: {
      sessionStart: Date.now(),
      events: [],
      productViews: new Set(),
      searches: []
    }
  };

  // ============================================================================
  // THEME MANAGEMENT
  // ============================================================================

  /**
   * Initialize theme system
   */
  function initializeThemeSystem() {
    loadSavedTheme();
    setupThemeControls();
    listenToSystemThemeChanges();
  }

  /**
   * Load saved theme from localStorage
   */
  function loadSavedTheme() {
    const savedTheme = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
    
    if (savedTheme && CONFIG.THEMES.includes(savedTheme)) {
      STATE.currentTheme = savedTheme;
    } else {
      STATE.currentTheme = detectPreferredTheme();
    }

    applyTheme(STATE.currentTheme);
  }

  /**
   * Detect preferred theme based on system settings
   * @returns {string}
   */
  function detectPreferredTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'cyber-neon' : 'solar-gold';
  }

  /**
   * Apply theme to document
   * @param {string} themeName
   */
  function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    STATE.currentTheme = themeName;
    localStorage.setItem(CONFIG.THEME_STORAGE_KEY, themeName);
    
    updateThemeUI(themeName);
    
    logAnalyticsEvent('theme_changed', {
      theme: themeName,
      source: 'user_action'
    });
  }

  /**
   * Update theme UI controls
   * @param {string} themeName
   */
  function updateThemeUI(themeName) {
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
      const optionTheme = option.getAttribute('data-theme');
      if (optionTheme === themeName) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }

  /**
   * Setup theme control event listeners
   */
  function setupThemeControls() {
    const themeToggle = document.getElementById('theme-toggle-btn');
    const themeDropdown = document.getElementById('theme-dropdown');
    const themeOptions = document.querySelectorAll('.theme-option');

    if (themeToggle && themeDropdown) {
      themeToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isExpanded = themeToggle.getAttribute('aria-expanded') === 'true';
        themeToggle.setAttribute('aria-expanded', !isExpanded);
        themeDropdown.classList.toggle('active');
      });

      document.addEventListener('click', (event) => {
        if (!themeDropdown.contains(event.target) && !themeToggle.contains(event.target)) {
          themeToggle.setAttribute('aria-expanded', 'false');
          themeDropdown.classList.remove('active');
        }
      });
    }

    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const selectedTheme = option.getAttribute('data-theme');
        if (selectedTheme && CONFIG.THEMES.includes(selectedTheme)) {
          applyTheme(selectedTheme);
          if (themeToggle) {
            themeToggle.setAttribute('aria-expanded', 'false');
          }
          if (themeDropdown) {
            themeDropdown.classList.remove('active');
          }
        }
      });
    });
  }

  /**
   * Listen to system theme changes
   */
  function listenToSystemThemeChanges() {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    darkModeQuery.addEventListener('change', (event) => {
      const hasSavedTheme = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
      
      if (!hasSavedTheme) {
        const newTheme = event.matches ? 'cyber-neon' : 'solar-gold';
        applyTheme(newTheme);
        
        logAnalyticsEvent('theme_changed', {
          theme: newTheme,
          source: 'system_preference'
        });
      }
    });
  }

  // ============================================================================
  // PRODUCT DATA MANAGEMENT
  // ============================================================================

  /**
   * Fetch products from JSON file
   * @returns {Promise<Array>}
   */
  async function fetchProducts() {
    STATE.isLoading = true;
    updateLoadingState(true);

    try {
      const response = await fetch(CONFIG.PRODUCTS_JSON_PATH);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid content type - expected JSON');
      }

      const products = await response.json();

      if (!Array.isArray(products)) {
        throw new Error('Products data must be an array');
      }

      if (products.length === 0) {
        console.warn('Products array is empty');
      }

      products.forEach((product, index) => {
        validateProduct(product, index);
      });

      STATE.isLoading = false;
      STATE.hasError = false;
      updateLoadingState(false);

      logAnalyticsEvent('products_loaded', {
        count: products.length,
        success: true
      });

      return products;

    } catch (error) {
      console.error('Error fetching products:', error);
      STATE.isLoading = false;
      STATE.hasError = true;
      updateLoadingState(false);
      displayErrorMessage('Failed to load products. Please refresh the page or try again later.');
      
      logAnalyticsEvent('products_load_error', {
        error: error.message,
        stack: error.stack
      });

      return [];
    }
  }

  /**
   * Validate product data structure
   * @param {Object} product
   * @param {number} index
   */
  function validateProduct(product, index) {
    const requiredFields = ['id', 'name', 'price', 'priceDisplay', 'image', 'affiliate_link'];
    const missingFields = requiredFields.filter(field => !product.hasOwnProperty(field));

    if (missingFields.length > 0) {
      console.warn(`Product at index ${index} is missing fields:`, missingFields);
    }

    if (product.affiliate_link === CONFIG.HERO_LINK_URL) {
      console.error(`CRITICAL: Product "${product.name}" uses hero link URL - this violates link isolation!`);
      window.__linkIsolationViolated = true;
    }
  }

  /**
   * Update loading state UI
   * @param {boolean} isLoading
   */
  function updateLoadingState(isLoading) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (isLoading) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
          <div class="loading-spinner" style="
            width: 48px;
            height: 48px;
            border: 4px solid var(--color-border);
            border-top-color: var(--color-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          "></div>
          <p style="color: var(--color-text-secondary); font-size: 1.125rem;">Loading products...</p>
        </div>
      `;
    }
  }

  /**
   * Display error message to user
   * @param {string} message
   */
  function displayErrorMessage(message) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="
        grid-column: 1 / -1;
        text-align: center;
        padding: 4rem 2rem;
        color: var(--color-text-muted);
      ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="64" height="64" 
             style="margin: 0 auto 1.5rem; color: var(--color-error); opacity: 0.7;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 0.75rem;">
          Something Went Wrong
        </h3>
        <p style="font-size: 1.125rem; margin-bottom: 1.5rem;">${message}</p>
        <button onclick="location.reload()" style="
          padding: 0.75rem 2rem;
          background: var(--color-accent);
          color: var(--color-bg-primary);
          border: none;
          border-radius: 9999px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-2px)'" 
           onmouseout="this.style.transform='translateY(0)'">
          Retry
        </button>
      </div>
    `;
  }

  // ============================================================================
  // PRODUCT RENDERING
  // ============================================================================

  /**
   * Render product cards to the grid
   * @param {Array} products
   */
  function renderProductCards(products) {
    const grid = document.getElementById('products-grid');
    const template = document.getElementById('product-card-template');
    const noResults = document.getElementById('no-results');

    if (!grid || !template) {
      console.error('Required elements not found');
      return;
    }

    grid.innerHTML = '';

    if (products.length === 0) {
      if (noResults) {
        noResults.classList.add('visible');
      }
      return;
    }

    if (noResults) {
      noResults.classList.remove('visible');
    }

    const fragment = document.createDocumentFragment();

    products.forEach((product, index) => {
      const card = createProductCard(product, index, template);
      if (card) {
        fragment.appendChild(card);
      }
    });

    grid.appendChild(fragment);

    if (typeof window.reinitializeAnimations === 'function') {
      setTimeout(() => {
        window.reinitializeAnimations();
      }, 50);
    }

    logAnalyticsEvent('products_rendered', {
      count: products.length
    });
  }

  /**
   * Create a single product card
   * @param {Object} product
   * @param {number} index
   * @param {HTMLTemplateElement} template
   * @returns {DocumentFragment}
   */
  function createProductCard(product, index, template) {
    const clone = template.content.cloneNode(true);

    const card = clone.querySelector('.product-card');
    const image = clone.querySelector('.product-image');
    const name = clone.querySelector('.product-name');
    const price = clone.querySelector('.product-price');
    const link = clone.querySelector('.shop-now-btn');

    if (card) {
      card.setAttribute('data-product-id', product.id || `product-${index}`);
      card.style.transitionDelay = `${Math.min(index * 50, 500)}ms`;
    }

    if (image) {
      image.src = product.image || '';
      image.alt = product.name || 'Product image';
      image.loading = index < 6 ? 'eager' : 'lazy';
      
      image.addEventListener('error', function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect fill="%23' + '16161d" width="400" height="400"/%3E%3Ctext fill="%237a7a90" x="50%%" y="50%%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E';
      });
    }

    if (name) {
      name.textContent = product.name || 'Unnamed Product';
      name.title = product.name || 'Unnamed Product';
    }

    if (price) {
      price.textContent = product.priceDisplay || '';
    }

    if (link && product.affiliate_link) {
      link.href = product.affiliate_link;
      link.setAttribute('data-product-id', product.id);
      link.setAttribute('data-product-name', product.name);
      
      link.addEventListener('click', (event) => {
        handleProductClick(event, product);
      });
    }

    return clone;
  }

  /**
   * Handle product click event
   * @param {Event} event
   * @param {Object} product
   */
  function handleProductClick(event, product) {
    STATE.analytics.productViews.add(product.id);

    logAnalyticsEvent('product_cta_click', {
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      affiliate_link: product.affiliate_link,
      timestamp: Date.now()
    });

    if (typeof window.logToFirestore === 'function') {
      window.logToFirestore('product_clicks', {
        product_id: product.id,
        product_name: product.name,
        price: product.price
      });
    }
  }

  // ============================================================================
  // SEARCH FUNCTIONALITY
  // ============================================================================

  /**
   * Initialize search functionality
   */
  function initializeSearch() {
    const searchInput = document.getElementById('product-search');
    const searchClear = document.getElementById('search-clear');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    if (!searchInput) return;

    searchInput.addEventListener('input', (event) => {
      const query = event.target.value.trim();
      handleSearchInput(query, searchClear);
    });

    searchInput.addEventListener('search', () => {
      if (searchInput.value === '') {
        clearSearch(searchInput, searchClear);
      }
    });

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        clearSearch(searchInput, searchClear);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        clearSearch(searchInput, searchClear);
      });
    }

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        clearSearch(searchInput, searchClear);
      }
    });
  }

  /**
   * Handle search input changes
   * @param {string} query
   * @param {HTMLElement} clearButton
   */
  function handleSearchInput(query, clearButton) {
    if (clearButton) {
      if (query.length > 0) {
        clearButton.classList.add('visible');
      } else {
        clearButton.classList.remove('visible');
      }
    }

    if (STATE.searchDebounceTimer) {
      clearTimeout(STATE.searchDebounceTimer);
    }

    STATE.searchDebounceTimer = setTimeout(() => {
      performSearch(query);
    }, CONFIG.SEARCH_DEBOUNCE_DELAY);
  }

  /**
   * Perform search operation
   * @param {string} query
   */
  function performSearch(query) {
    STATE.searchQuery = query;

    if (!query || query.length === 0) {
      STATE.filteredProducts = STATE.allProducts;
      renderProductCards(STATE.filteredProducts);
      
      logAnalyticsEvent('search_cleared', {
        previous_query: query
      });
      return;
    }

    const lowerCaseQuery = query.toLowerCase();
    const searchTerms = lowerCaseQuery.split(' ').filter(term => term.length > 0);

    STATE.filteredProducts = STATE.allProducts.filter(product => {
      const searchableText = [
        product.name,
        product.priceDisplay,
        product.id,
        String(product.price)
      ].filter(Boolean).join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });

    renderProductCards(STATE.filteredProducts);

    STATE.analytics.searches.push({
      query: query,
      results_count: STATE.filteredProducts.length,
      timestamp: Date.now()
    });

    logAnalyticsEvent('search_performed', {
      query: query,
      results_count: STATE.filteredProducts.length,
      search_terms: searchTerms.length
    });
  }

  /**
   * Clear search
   * @param {HTMLInputElement} input
   * @param {HTMLElement} clearButton
   */
  function clearSearch(input, clearButton) {
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearButton) {
      clearButton.classList.remove('visible');
    }
    performSearch('');
  }

  // ============================================================================
  // LINK ISOLATION VALIDATION
  // ============================================================================

  /**
   * Validate link isolation - ensures hero link never appears in product links
   */
  function validateLinkIsolation() {
    const heroLinks = document.querySelectorAll(`a[href="${CONFIG.HERO_LINK_URL}"]`);
    
    const validationResults = {
      heroLinkCount: heroLinks.length,
      heroLinkInCorrectLocation: false,
      productLinksViolation: false,
      violatingProducts: []
    };

    if (heroLinks.length === 0) {
      console.error('Link Isolation CRITICAL ERROR: Hero link not found in DOM');
      window.__linkIsolationViolated = true;
      validationResults.error = 'Hero link not found';
      return validationResults;
    }

    if (heroLinks.length > 1) {
      console.error(`Link Isolation VIOLATION: Hero link appears ${heroLinks.length} times (expected: 1)`);
      window.__linkIsolationViolated = true;
      validationResults.error = `Hero link appears ${heroLinks.length} times`;
      return validationResults;
    }

    const heroLink = heroLinks[0];
    const isInHeroSection = heroLink.closest('.hero-section') !== null;
    const hasCorrectId = heroLink.id === 'hero-primary-cta';
    const hasHeroClass = heroLink.classList.contains('hero-cta') || heroLink.classList.contains('hero-cta-primary');

    if (!isInHeroSection) {
      console.error('Link Isolation VIOLATION: Hero link not in hero section');
      window.__linkIsolationViolated = true;
      validationResults.error = 'Hero link not in correct section';
      return validationResults;
    }

    validationResults.heroLinkInCorrectLocation = true;

    const productLinks = document.querySelectorAll('.shop-now-btn');
    let violationFound = false;

    productLinks.forEach((link, index) => {
      if (link.href === CONFIG.HERO_LINK_URL) {
        const productId = link.getAttribute('data-product-id');
        const productName = link.getAttribute('data-product-name');
        
        console.error('Link Isolation CRITICAL VIOLATION: Product link contains hero URL', {
          index,
          productId,
          productName,
          href: link.href
        });
        
        validationResults.violatingProducts.push({
          index,
          productId,
          productName
        });
        
        violationFound = true;
      }
    });

    if (violationFound) {
      window.__linkIsolationViolated = true;
      validationResults.productLinksViolation = true;
      console.error('Link Isolation FAILED - Violations detected:', validationResults);
      return validationResults;
    }

    const socialLinks = document.querySelectorAll('.social-icon, .footer-social-icon, .mobile-social-icon');
    const socialUrls = Array.from(socialLinks).map(link => link.href);
    
    if (socialUrls.includes(CONFIG.HERO_LINK_URL)) {
      console.error('Link Isolation VIOLATION: Hero link found in social links');
      window.__linkIsolationViolated = true;
      validationResults.error = 'Hero link in social links';
      return validationResults;
    }

    console.log('%cLink Isolation Check: ✅ PASSED', 'color: #00ff88; font-weight: bold; font-size: 14px;');
    console.log('Validation Results:', {
      heroLinkCount: validationResults.heroLinkCount,
      heroLinkInCorrectLocation: validationResults.heroLinkInCorrectLocation,
      productLinksChecked: productLinks.length,
      socialLinksChecked: socialLinks.length,
      status: 'PASSED'
    });

    return validationResults;
  }

  // ============================================================================
  // HERO CTA TRACKING
  // ============================================================================

  /**
   * Initialize hero CTA click tracking
   */
  function initializeHeroCTATracking() {
    const heroCTA = document.querySelector('.hero-cta-primary, #hero-primary-cta');

    if (!heroCTA) {
      console.warn('Hero CTA button not found');
      return;
    }

    heroCTA.addEventListener('click', (event) => {
      logAnalyticsEvent('hero_cta_click', {
        destination: heroCTA.href,
        text: heroCTA.textContent.trim(),
        timestamp: Date.now(),
        source: 'hero_section'
      });

      if (typeof window.logToFirestore === 'function') {
        window.logToFirestore('hero_clicks', {
          destination: heroCTA.href,
          session_duration: Date.now() - STATE.analytics.sessionStart
        });
      }
    });
  }

  // ============================================================================
  // ANALYTICS & EVENT LOGGING
  // ============================================================================

  /**
   * Log analytics event
   * @param {string} eventName
   * @param {Object} data
   */
  function logAnalyticsEvent(eventName, data = {}) {
    const eventData = {
      event: eventName,
      timestamp: new Date().toISOString(),
      session_id: getSessionId(),
      page: window.location.pathname,
      referrer: document.referrer || 'direct',
      theme: STATE.currentTheme,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      ...data
    };

    STATE.analytics.events.push(eventData);

    if (typeof window.logAnalyticsEvent === 'function') {
      window.logAnalyticsEvent(eventName, eventData);
    }

    console.log(`📊 Analytics: ${eventName}`, eventData);
  }

  /**
   * Get or create session ID
   * @returns {string}
   */
  function getSessionId() {
    let sessionId = sessionStorage.getItem('session_id');
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get analytics summary
   * @returns {Object}
   */
  function getAnalyticsSummary() {
    return {
      session_duration: Date.now() - STATE.analytics.sessionStart,
      total_events: STATE.analytics.events.length,
      unique_products_viewed: STATE.analytics.productViews.size,
      total_searches: STATE.analytics.searches.length,
      current_theme: STATE.currentTheme,
      products_loaded: STATE.allProducts.length,
      events: STATE.analytics.events
    };
  }

  // ============================================================================
  // NEWSLETTER FORM
  // ============================================================================

  /**
   * Initialize newsletter form
   */
  function initializeNewsletterForm() {
    const form = document.getElementById('newsletter-form');
    const emailInput = document.getElementById('newsletter-email');

    if (!form || !emailInput) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const email = emailInput.value.trim();

      if (!isValidEmail(email)) {
        showFormMessage(form, 'Please enter a valid email address', 'error');
        return;
      }

      logAnalyticsEvent('newsletter_signup', {
        email_domain: email.split('@')[1],
        source: 'newsletter_form'
      });

      if (typeof window.logToFirestore === 'function') {
        window.logToFirestore('newsletter_signups', {
          email_hash: hashEmail(email),
          timestamp: Date.now()
        });
      }

      showFormMessage(form, 'Thank you for subscribing! Check your email for confirmation.', 'success');
      
      setTimeout(() => {
        emailInput.value = '';
        hideFormMessage(form);
      }, 5000);
    });
  }

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Hash email for privacy
   * @param {string} email
   * @returns {string}
   */
  function hashEmail(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Show form message
   * @param {HTMLFormElement} form
   * @param {string} message
   * @param {string} type
   */
  function showFormMessage(form, message, type) {
    let messageEl = form.querySelector('.form-message');
    
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'form-message';
      form.appendChild(messageEl);
    }

    messageEl.textContent = message;
    messageEl.style.cssText = `
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 0.5rem;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 600;
      background: ${type === 'success' ? 'var(--color-success)' : 'var(--color-error)'};
      color: var(--color-bg-primary);
    `;
  }

  /**
   * Hide form message
   * @param {HTMLFormElement} form
   */
  function hideFormMessage(form) {
    const messageEl = form.querySelector('.form-message');
    if (messageEl) {
      messageEl.remove();
    }
  }

  // ============================================================================
  // SMOOTH SCROLL
  // ============================================================================

  /**
   * Initialize smooth scroll for anchor links
   */
  function initializeSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach(link => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        
        if (href === '#') {
          return;
        }

        const target = document.querySelector(href);
        
        if (target) {
          event.preventDefault();
          const headerHeight = document.querySelector('.site-header')?.offsetHeight || 80;
          const targetPosition = target.offsetTop - headerHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          logAnalyticsEvent('navigation_click', {
            href: href,
            text: link.textContent.trim()
          });
        }
      });
    });
  }

  // ============================================================================
  // KEYBOARD NAVIGATION
  // ============================================================================

  /**
   * Initialize keyboard navigation enhancements
   */
  function initializeKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        const searchInput = document.getElementById('product-search');
        const isInputFocused = document.activeElement.tagName === 'INPUT' || 
                               document.activeElement.tagName === 'TEXTAREA';
        
        if (searchInput && !isInputFocused) {
          event.preventDefault();
          searchInput.focus();
        }
      }

      if (event.key === 'Escape') {
        const searchInput = document.getElementById('product-search');
        const searchClear = document.getElementById('search-clear');
        
        if (document.activeElement === searchInput) {
          clearSearch(searchInput, searchClear);
          searchInput.blur();
        }
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the application
   */
  async function initializeApplication() {
    console.log('🚀 The Gadget Hub Store - Initializing Application...');

    initializeThemeSystem();
    initializeSearch();
    initializeHeroCTATracking();
    initializeNewsletterForm();
    initializeSmoothScroll();
    initializeKeyboardNavigation();

    STATE.allProducts = await fetchProducts();
    STATE.filteredProducts = STATE.allProducts;

    renderProductCards(STATE.filteredProducts);

    setTimeout(() => {
      const validationResults = validateLinkIsolation();
      
      if (typeof window.logAnalyticsEvent === 'function') {
        window.logAnalyticsEvent('link_isolation_validation', validationResults);
      }
    }, 1000);

    logAnalyticsEvent('app_initialized', {
      products_count: STATE.allProducts.length,
      theme: STATE.currentTheme,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      user_agent: navigator.userAgent
    });

    console.log('✅ Application Initialized Successfully');
    console.log('📦 Loaded Products:', STATE.allProducts.length);
    console.log('🎨 Active Theme:', STATE.currentTheme);
  }

  // ============================================================================
  // EXPOSE PUBLIC API
  // ============================================================================

  window.GadgetHubStore = {
    getState: () => ({ ...STATE }),
    getConfig: () => ({ ...CONFIG }),
    getAnalytics: getAnalyticsSummary,
    validateLinks: validateLinkIsolation,
    refreshProducts: async () => {
      STATE.allProducts = await fetchProducts();
      STATE.filteredProducts = STATE.allProducts;
      renderProductCards(STATE.filteredProducts);
    }
  };

  window.logEvent = logAnalyticsEvent;

  // ============================================================================
  // AUTO-INITIALIZE
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
  } else {
    initializeApplication();
  }

  window.addEventListener('beforeunload', () => {
    const summary = getAnalyticsSummary();
    logAnalyticsEvent('session_end', summary);
  });

})();

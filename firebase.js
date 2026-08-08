/**
 * ============================================================================
 * THE GADGET HUB STORE - FIREBASE INTEGRATION MODULE
 * Maximum Cognitive Allocation Protocol - Complete Implementation
 * ============================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // FIREBASE CONFIGURATION
  // ============================================================================

  const firebaseConfig = {
    apiKey: "AIzaSyBXAMPLE_REPLACE_WITH_YOUR_ACTUAL_CONFIG",
    authDomain: "gadget-hub-store.firebaseapp.com",
    projectId: "gadget-hub-store",
    storageBucket: "gadget-hub-store.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890",
    measurementId: "G-XXXXXXXXXX"
  };

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const STATE = {
    firebaseApp: null,
    analytics: null,
    firestore: null,
    isInitialized: false,
    initializationAttempted: false,
    errors: [],
    eventQueue: [],
    isOnline: navigator.onLine,
    retryCount: 0,
    maxRetries: 3
  };

  // ============================================================================
  // FIREBASE INITIALIZATION
  // ============================================================================

  /**
   * Initialize Firebase services
   * @returns {Promise<boolean>}
   */
  async function initializeFirebase() {
    if (STATE.initializationAttempted) {
      return STATE.isInitialized;
    }

    STATE.initializationAttempted = true;

    try {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded - check script tags in HTML');
      }

      if (!firebase.apps || firebase.apps.length === 0) {
        STATE.firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase App initialized');
      } else {
        STATE.firebaseApp = firebase.apps[0];
        console.log('✅ Firebase App already initialized');
      }

      await initializeAnalytics();
      await initializeFirestore();

      STATE.isInitialized = true;
      
      processEventQueue();
      
      setupConnectionMonitoring();
      
      console.log('✅ Firebase services fully initialized');
      return true;

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      STATE.errors.push({
        type: 'initialization',
        message: error.message,
        timestamp: Date.now()
      });
      STATE.isInitialized = false;
      return false;
    }
  }

  /**
   * Initialize Firebase Analytics
   * @returns {Promise<void>}
   */
  async function initializeAnalytics() {
    try {
      if (typeof firebase.analytics !== 'function') {
        console.warn('⚠️ Firebase Analytics not available in SDK');
        return;
      }

      STATE.analytics = firebase.analytics();
      
      STATE.analytics.setAnalyticsCollectionEnabled(true);
      
      STATE.analytics.setUserProperties({
        app_version: '1.0.0',
        platform: 'web',
        device_type: getDeviceType()
      });

      console.log('✅ Firebase Analytics initialized');

    } catch (error) {
      console.warn('⚠️ Firebase Analytics initialization failed:', error);
      STATE.errors.push({
        type: 'analytics_init',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Initialize Cloud Firestore
   * @returns {Promise<void>}
   */
  async function initializeFirestore() {
    try {
      if (typeof firebase.firestore !== 'function') {
        console.warn('⚠️ Cloud Firestore not available in SDK');
        return;
      }

      STATE.firestore = firebase.firestore();
      
      STATE.firestore.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
      });

      STATE.firestore.enablePersistence({ synchronizeTabs: true })
        .then(() => {
          console.log('✅ Firestore offline persistence enabled');
        })
        .catch((error) => {
          if (error.code === 'failed-precondition') {
            console.warn('⚠️ Multiple tabs open - persistence enabled in first tab only');
          } else if (error.code === 'unimplemented') {
            console.warn('⚠️ Browser does not support offline persistence');
          } else {
            console.error('❌ Persistence error:', error);
          }
        });

      console.log('✅ Cloud Firestore initialized');

    } catch (error) {
      console.warn('⚠️ Cloud Firestore initialization failed:', error);
      STATE.errors.push({
        type: 'firestore_init',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get device type
   * @returns {string}
   */
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  // ============================================================================
  // ANALYTICS EVENT LOGGING
  // ============================================================================

  /**
   * Log analytics event to Firebase Analytics
   * @param {string} eventName - Event name (max 40 characters)
   * @param {Object} eventParams - Event parameters
   * @returns {Promise<void>}
   */
  async function logAnalyticsEvent(eventName, eventParams = {}) {
    if (!STATE.isInitialized || !STATE.analytics) {
      queueEvent('analytics', eventName, eventParams);
      console.log(`📊 [Analytics - Queued] ${eventName}:`, eventParams);
      return;
    }

    try {
      const sanitizedEventName = sanitizeEventName(eventName);
      const sanitizedParams = sanitizeEventParams(eventParams);

      STATE.analytics.logEvent(sanitizedEventName, sanitizedParams);
      
      console.log(`📊 [Analytics] ${sanitizedEventName}:`, sanitizedParams);

    } catch (error) {
      console.error('❌ Analytics logging error:', error);
      STATE.errors.push({
        type: 'analytics_log',
        event: eventName,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Sanitize event name for Firebase Analytics
   * @param {string} eventName
   * @returns {string}
   */
  function sanitizeEventName(eventName) {
    let sanitized = eventName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 40);

    if (!/^[a-z]/.test(sanitized)) {
      sanitized = 'event_' + sanitized;
    }

    return sanitized;
  }

  /**
   * Sanitize event parameters for Firebase Analytics
   * @param {Object} params
   * @returns {Object}
   */
  function sanitizeEventParams(params) {
    const sanitized = {};
    let paramCount = 0;
    const maxParams = 25;

    for (const [key, value] of Object.entries(params)) {
      if (paramCount >= maxParams) {
        break;
      }

      const sanitizedKey = key
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);

      if (!sanitizedKey) {
        continue;
      }

      let sanitizedValue = value;

      if (typeof value === 'string') {
        sanitizedValue = value.substring(0, 100);
      } else if (typeof value === 'number') {
        sanitizedValue = value;
      } else if (typeof value === 'boolean') {
        sanitizedValue = value;
      } else if (value === null || value === undefined) {
        continue;
      } else {
        sanitizedValue = String(value).substring(0, 100);
      }

      sanitized[sanitizedKey] = sanitizedValue;
      paramCount++;
    }

    return sanitized;
  }

  // ============================================================================
  // AD IMPRESSION & CLICK TRACKING
  // ============================================================================

  /**
   * Log ad impression to Firestore
   * @param {string} slotId - Ad slot identifier
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async function logAdImpression(slotId, metadata = {}) {
    if (!STATE.isInitialized || !STATE.firestore) {
      queueEvent('impression', slotId, metadata);
      console.log(`📢 [Ad Impression - Queued] ${slotId}:`, metadata);
      return;
    }

    try {
      const impressionData = {
        slot_id: slotId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        page: window.location.pathname,
        page_url: window.location.href,
        referrer: document.referrer || 'direct',
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        device_type: getDeviceType(),
        user_agent: navigator.userAgent.substring(0, 500),
        online: navigator.onLine,
        session_id: getSessionId(),
        ...sanitizeMetadata(metadata)
      };

      const docRef = await STATE.firestore
        .collection('ad_impressions')
        .add(impressionData);

      console.log(`📢 [Ad Impression] Logged: ${slotId} (${docRef.id})`);

      if (STATE.analytics) {
        STATE.analytics.logEvent('ad_impression', {
          slot_id: slotId,
          visibility: metadata.visibility || 0
        });
      }

    } catch (error) {
      console.error('❌ Ad impression logging error:', error);
      STATE.errors.push({
        type: 'ad_impression',
        slotId: slotId,
        message: error.message,
        timestamp: Date.now()
      });

      if (STATE.retryCount < STATE.maxRetries) {
        STATE.retryCount++;
        setTimeout(() => {
          logAdImpression(slotId, metadata);
        }, 1000 * STATE.retryCount);
      }
    }
  }

  /**
   * Log ad click to Firestore
   * @param {string} slotId - Ad slot identifier
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async function logAdClick(slotId, metadata = {}) {
    if (!STATE.isInitialized || !STATE.firestore) {
      queueEvent('click', slotId, metadata);
      console.log(`🖱️ [Ad Click - Queued] ${slotId}:`, metadata);
      return;
    }

    try {
      const clickData = {
        slot_id: slotId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        page: window.location.pathname,
        page_url: window.location.href,
        referrer: document.referrer || 'direct',
        device_type: getDeviceType(),
        online: navigator.onLine,
        session_id: getSessionId(),
        ...sanitizeMetadata(metadata)
      };

      const docRef = await STATE.firestore
        .collection('ad_clicks')
        .add(clickData);

      console.log(`🖱️ [Ad Click] Logged: ${slotId} (${docRef.id})`);

      if (STATE.analytics) {
        STATE.analytics.logEvent('ad_click', {
          slot_id: slotId
        });
      }

    } catch (error) {
      console.error('❌ Ad click logging error:', error);
      STATE.errors.push({
        type: 'ad_click',
        slotId: slotId,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }

  // ============================================================================
  // GENERIC FIRESTORE LOGGING
  // ============================================================================

  /**
   * Log generic data to Firestore
   * @param {string} collection - Collection name
   * @param {Object} data - Data to log
   * @returns {Promise<string|null>}
   */
  async function logToFirestore(collection, data) {
    if (!STATE.isInitialized || !STATE.firestore) {
      queueEvent('firestore', collection, data);
      console.log(`💾 [Firestore - Queued] ${collection}:`, data);
      return null;
    }

    try {
      const documentData = {
        ...sanitizeMetadata(data),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        page: window.location.pathname,
        session_id: getSessionId()
      };

      const docRef = await STATE.firestore
        .collection(collection)
        .add(documentData);

      console.log(`💾 [Firestore] Logged to ${collection}: ${docRef.id}`);

      return docRef.id;

    } catch (error) {
      console.error(`❌ Firestore logging error (${collection}):`, error);
      STATE.errors.push({
        type: 'firestore_log',
        collection: collection,
        message: error.message,
        timestamp: Date.now()
      });

      return null;
    }
  }

  /**
   * Sanitize metadata object
   * @param {Object} metadata
   * @returns {Object}
   */
  function sanitizeMetadata(metadata) {
    const sanitized = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = value.substring(0, 1000);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizeMetadata(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 50);
      } else {
        sanitized[key] = String(value).substring(0, 1000);
      }
    }

    return sanitized;
  }

  // ============================================================================
  // EVENT QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Queue event for later processing
   * @param {string} type
   * @param {string} identifier
   * @param {Object} data
   */
  function queueEvent(type, identifier, data) {
    STATE.eventQueue.push({
      type: type,
      identifier: identifier,
      data: data,
      timestamp: Date.now()
    });

    if (STATE.eventQueue.length > 100) {
      STATE.eventQueue.shift();
    }
  }

  /**
   * Process queued events
   */
  async function processEventQueue() {
    if (STATE.eventQueue.length === 0) {
      return;
    }

    console.log(`📤 Processing ${STATE.eventQueue.length} queued events...`);

    const queue = [...STATE.eventQueue];
    STATE.eventQueue = [];

    for (const event of queue) {
      try {
        switch (event.type) {
          case 'analytics':
            await logAnalyticsEvent(event.identifier, event.data);
            break;
          case 'impression':
            await logAdImpression(event.identifier, event.data);
            break;
          case 'click':
            await logAdClick(event.identifier, event.data);
            break;
          case 'firestore':
            await logToFirestore(event.identifier, event.data);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error processing queued event:', error);
      }
    }

    console.log('✅ Queue processing complete');
  }

  // ============================================================================
  // CONNECTION MONITORING
  // ============================================================================

  /**
   * Setup online/offline monitoring
   */
  function setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored - processing queued events');
      STATE.isOnline = true;
      STATE.retryCount = 0;
      processEventQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Connection lost - events will be queued');
      STATE.isOnline = false;
    });
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get or create session ID
   * @returns {string}
   */
  function getSessionId() {
    let sessionId = sessionStorage.getItem('firebase_session_id');

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem('firebase_session_id', sessionId);
    }

    return sessionId;
  }

  // ============================================================================
  // ERROR REPORTING
  // ============================================================================

  /**
   * Get error summary
   * @returns {Object}
   */
  function getErrorSummary() {
    return {
      total_errors: STATE.errors.length,
      errors_by_type: STATE.errors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {}),
      recent_errors: STATE.errors.slice(-10)
    };
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Get Firebase health status
   * @returns {Object}
   */
  function getHealthStatus() {
    return {
      initialized: STATE.isInitialized,
      analytics_available: !!STATE.analytics,
      firestore_available: !!STATE.firestore,
      online: STATE.isOnline,
      queued_events: STATE.eventQueue.length,
      errors: STATE.errors.length,
      retry_count: STATE.retryCount
    };
  }

  // ============================================================================
  // EXPOSE PUBLIC API
  // ============================================================================

  window.logAnalyticsEvent = logAnalyticsEvent;
  window.logAdImpression = logAdImpression;
  window.logAdClick = logAdClick;
  window.logToFirestore = logToFirestore;

  window.FirebaseService = {
    getHealthStatus: getHealthStatus,
    getErrorSummary: getErrorSummary,
    processQueue: processEventQueue,
    getState: () => ({
      initialized: STATE.isInitialized,
      queueLength: STATE.eventQueue.length,
      errorCount: STATE.errors.length
    })
  };

  // ============================================================================
  // AUTO-INITIALIZE
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeFirebase, 500);
    });
  } else {
    setTimeout(initializeFirebase, 500);
  }

})();

/*
 * ============================================================================
 * FIRESTORE SECURITY RULES (Deploy to Firebase Console)
 * ============================================================================
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     
 *     // Analytics Events Collection
 *     match /analytics_events/{document} {
 *       allow read: if request.auth != null;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Ad Impressions Collection
 *     match /ad_impressions/{document} {
 *       allow read: if request.auth != null;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Ad Clicks Collection
 *     match /ad_clicks/{document} {
 *       allow read: if request.auth != null;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Hero Clicks Collection
 *     match /hero_clicks/{document} {
 *       allow read: if request.auth != null;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Product Clicks Collection
 *     match /product_clicks/{document} {
 *       allow read: if request.auth != null;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Newsletter Signups Collection
 *     match /newsletter_signups/{document} {
 *       allow read: if request.auth != null && 
 *                      request.auth.token.admin == true;
 *       allow create: if true;
 *       allow update, delete: if request.auth != null && 
 *                                request.auth.token.admin == true;
 *     }
 *     
 *     // Products Collection (Read-only for public, admin-write)
 *     match /products/{document} {
 *       allow read: if true;
 *       allow create, update, delete: if request.auth != null && 
 *                                         request.auth.token.admin == true;
 *     }
 *     
 *     // Admin Users Collection
 *     match /admin_users/{userId} {
 *       allow read, write: if request.auth != null && 
 *                             request.auth.uid == userId && 
 *                             request.auth.token.admin == true;
 *     }
 *     
 *     // Default deny all other collections
 *     match /{document=**} {
 *       allow read, write: if false;
 *     }
 *   }
 * }
 * 
 * ============================================================================
 * FIREBASE STORAGE RULES (if needed)
 * ============================================================================
 * 
 * rules_version = '2';
 * service firebase.storage {
 *   match /b/{bucket}/o {
 *     match /products/{allPaths=**} {
 *       allow read: if true;
 *       allow write: if request.auth != null && 
 *                       request.auth.token.admin == true;
 *     }
 *     
 *     match /{allPaths=**} {
 *       allow read, write: if request.auth != null && 
 *                             request.auth.token.admin == true;
 *     }
 *   }
 * }
 * 
 * ============================================================================
 */

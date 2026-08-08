/**
 * ============================================================================
 * THE GADGET HUB STORE - ADMIN AD MANAGEMENT DASHBOARD
 * Maximum Cognitive Allocation Protocol - Complete Implementation
 * 
 * ACTIVATION: This module is ONLY activated when the URL contains '?admin=true'
 * Example: https://yourdomain.com/?admin=true
 * 
 * PURPOSE: Provides comprehensive administrative interface for monitoring
 * ad slot visibility, fill status, impression tracking, click-through rates,
 * and real-time analytics for debugging and optimization purposes.
 * ============================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // ADMIN MODE DETECTION
  // ============================================================================

  const isAdminMode = window.location.search.includes('admin=true');

  if (!isAdminMode) {
    return;
  }

  console.log('%c🔧 ADMIN AD MANAGEMENT DASHBOARD ACTIVATED', 'color: #00f0ff; font-weight: bold; font-size: 16px; background: #0a0a0f; padding: 8px;');

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    updateInterval: 2000,
    visibilityThreshold: 50,
    observerThreshold: [0, 0.25, 0.5, 0.75, 1.0],
    maxHistoryLength: 50,
    autoRefresh: true,
    persistState: true,
    storageKey: 'admin_ads_state'
  };

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const STATE = {
    adSlots: [],
    observers: new Map(),
    updateTimer: null,
    sessionStart: Date.now(),
    totalImpressions: 0,
    totalClicks: 0,
    history: [],
    isDashboardVisible: true,
    isMinimized: false,
    selectedSlot: null
  };

  // ============================================================================
  // AD SLOT DATA STRUCTURE
  // ============================================================================

  /**
   * Ad Slot class to track individual slot data
   */
  class AdSlot {
    constructor(element, slotId) {
      this.element = element;
      this.id = slotId;
      this.visibility = 0;
      this.isFilled = false;
      this.isVisible = false;
      this.impressionLogged = false;
      this.clickLogged = false;
      this.impressionCount = 0;
      this.clickCount = 0;
      this.firstSeen = null;
      this.lastSeen = null;
      this.totalTimeVisible = 0;
      this.visibilityHistory = [];
      this.position = this.getPosition();
    }

    getPosition() {
      const rect = this.element.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      };
    }

    updateVisibility(ratio) {
      this.visibility = Math.round(ratio * 100);
      this.isVisible = this.visibility >= CONFIG.visibilityThreshold;

      if (this.isVisible && !this.firstSeen) {
        this.firstSeen = Date.now();
      }

      if (this.isVisible) {
        this.lastSeen = Date.now();
      }

      this.visibilityHistory.push({
        timestamp: Date.now(),
        visibility: this.visibility
      });

      if (this.visibilityHistory.length > 100) {
        this.visibilityHistory.shift();
      }
    }

    checkFillStatus() {
      const hasScript = this.element.querySelector('script') !== null;
      const hasIframe = this.element.querySelector('iframe') !== null;
      const hasCanvas = this.element.querySelector('canvas') !== null;
      const hasImage = this.element.querySelector('img') !== null;
      const hasChildren = this.element.children.length > 2;
      const hasFilledClass = this.element.classList.contains('ad-filled');
      const hasContent = this.element.querySelector('[data-ad-content]') !== null;

      this.isFilled = hasScript || hasIframe || hasCanvas || hasImage || 
                      hasChildren || hasFilledClass || hasContent;

      return this.isFilled;
    }

    logImpression() {
      this.impressionLogged = true;
      this.impressionCount++;
      STATE.totalImpressions++;

      STATE.history.push({
        type: 'impression',
        slotId: this.id,
        timestamp: Date.now(),
        visibility: this.visibility
      });

      if (STATE.history.length > CONFIG.maxHistoryLength) {
        STATE.history.shift();
      }
    }

    logClick() {
      this.clickLogged = true;
      this.clickCount++;
      STATE.totalClicks++;

      STATE.history.push({
        type: 'click',
        slotId: this.id,
        timestamp: Date.now()
      });

      if (STATE.history.length > CONFIG.maxHistoryLength) {
        STATE.history.shift();
      }
    }

    getMetrics() {
      const now = Date.now();
      const visibleTime = this.firstSeen ? now - this.firstSeen : 0;
      const ctr = this.impressionCount > 0 ? 
                  (this.clickCount / this.impressionCount * 100).toFixed(2) : 0;

      return {
        id: this.id,
        visibility: this.visibility,
        isFilled: this.isFilled,
        isVisible: this.isVisible,
        impressions: this.impressionCount,
        clicks: this.clickCount,
        ctr: ctr,
        visibleTime: visibleTime,
        position: this.position
      };
    }
  }

  // ============================================================================
  // DASHBOARD UI CREATION
  // ============================================================================

  /**
   * Create and inject admin dashboard into DOM
   */
  function createAdminDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'admin-ad-dashboard';
    dashboard.className = 'admin-dashboard';
    
    dashboard.innerHTML = `
      <div class="admin-dashboard-header">
        <div class="admin-header-left">
          <div class="admin-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div class="admin-title-group">
            <h3 class="admin-title">Ad Management Dashboard</h3>
            <span class="admin-subtitle">Real-time monitoring & analytics</span>
          </div>
        </div>
        <div class="admin-header-right">
          <button class="admin-header-btn" id="minimize-dashboard" aria-label="Minimize dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <polyline points="4 14 10 14 10 20"/>
              <polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button class="admin-header-btn" id="close-dashboard" aria-label="Close dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="admin-dashboard-body">
        
        <!-- Summary Statistics -->
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <div class="admin-stat-icon admin-stat-icon-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
              </svg>
            </div>
            <div class="admin-stat-content">
              <div class="admin-stat-value" id="stat-total-slots">0</div>
              <div class="admin-stat-label">Total Slots</div>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon admin-stat-icon-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div class="admin-stat-content">
              <div class="admin-stat-value" id="stat-visible-slots">0</div>
              <div class="admin-stat-label">Visible</div>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon admin-stat-icon-warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div class="admin-stat-content">
              <div class="admin-stat-value" id="stat-filled-slots">0</div>
              <div class="admin-stat-label">Filled</div>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon admin-stat-icon-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div class="admin-stat-content">
              <div class="admin-stat-value" id="stat-impressions">0</div>
              <div class="admin-stat-label">Impressions</div>
            </div>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="admin-tabs">
          <button class="admin-tab active" data-tab="slots">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span>Ad Slots</span>
          </button>
          <button class="admin-tab" data-tab="analytics">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <line x1="12" y1="20" x2="12" y2="10"/>
              <line x1="18" y1="20" x2="18" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="16"/>
            </svg>
            <span>Analytics</span>
          </button>
          <button class="admin-tab" data-tab="history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>History</span>
          </button>
        </div>

        <!-- Tab Content: Ad Slots -->
        <div class="admin-tab-content active" id="tab-slots">
          <div class="admin-slots-list" id="admin-slots-list">
            <!-- Slot cards will be dynamically inserted here -->
          </div>
        </div>

        <!-- Tab Content: Analytics -->
        <div class="admin-tab-content" id="tab-analytics">
          <div class="admin-analytics-container">
            <div class="admin-analytics-section">
              <h4 class="admin-section-title">Performance Metrics</h4>
              <div class="admin-metrics-grid">
                <div class="admin-metric">
                  <span class="admin-metric-label">Total Impressions</span>
                  <span class="admin-metric-value" id="metric-total-impressions">0</span>
                </div>
                <div class="admin-metric">
                  <span class="admin-metric-label">Total Clicks</span>
                  <span class="admin-metric-value" id="metric-total-clicks">0</span>
                </div>
                <div class="admin-metric">
                  <span class="admin-metric-label">Overall CTR</span>
                  <span class="admin-metric-value" id="metric-ctr">0%</span>
                </div>
                <div class="admin-metric">
                  <span class="admin-metric-label">Session Duration</span>
                  <span class="admin-metric-value" id="metric-session">0s</span>
                </div>
              </div>
            </div>
            <div class="admin-analytics-section">
              <h4 class="admin-section-title">Slot Performance</h4>
              <div id="slot-performance-list"></div>
            </div>
          </div>
        </div>

        <!-- Tab Content: History -->
        <div class="admin-tab-content" id="tab-history">
          <div class="admin-history-container">
            <div class="admin-history-header">
              <h4 class="admin-section-title">Event History</h4>
              <button class="admin-btn-small" id="clear-history">Clear History</button>
            </div>
            <div class="admin-history-list" id="admin-history-list">
              <div class="admin-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>No events recorded yet</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="admin-actions">
          <button class="admin-btn admin-btn-primary" id="log-all-impressions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Log All Impressions</span>
          </button>
          <button class="admin-btn admin-btn-secondary" id="refresh-data">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            <span>Refresh Data</span>
          </button>
          <button class="admin-btn admin-btn-secondary" id="export-data">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Export Data</span>
          </button>
        </div>

      </div>
    `;

    applyDashboardStyles();
    document.body.appendChild(dashboard);
    initializeDashboardEvents();
  }

  /**
   * Apply comprehensive styles to admin dashboard
   */
  function applyDashboardStyles() {
    if (document.getElementById('admin-dashboard-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'admin-dashboard-styles';
    style.textContent = `
      .admin-dashboard {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 480px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 40px);
        background: rgba(22, 22, 29, 0.98);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(0, 240, 255, 0.3);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 100px rgba(0, 240, 255, 0.2);
        z-index: 999999;
        font-family: 'Inter', -apple-system, sans-serif;
        color: #ffffff;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .admin-dashboard.minimized {
        width: 200px;
        height: 60px;
      }

      .admin-dashboard.minimized .admin-dashboard-body {
        display: none;
      }

      .admin-dashboard-header {
        padding: 16px 20px;
        background: rgba(0, 240, 255, 0.1);
        border-bottom: 1px solid rgba(0, 240, 255, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      .admin-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .admin-logo {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 240, 255, 0.2);
        border-radius: 8px;
        color: #00f0ff;
      }

      .admin-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .admin-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #ffffff;
      }

      .admin-subtitle {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 500;
      }

      .admin-header-right {
        display: flex;
        gap: 8px;
      }

      .admin-header-btn {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .admin-header-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: #00f0ff;
        color: #00f0ff;
        transform: scale(1.05);
      }

      .admin-dashboard-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .admin-stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .admin-stat-card {
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        display: flex;
        gap: 12px;
        align-items: center;
        transition: all 0.2s;
      }

      .admin-stat-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(0, 240, 255, 0.3);
        transform: translateY(-2px);
      }

      .admin-stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .admin-stat-icon-primary {
        background: rgba(0, 240, 255, 0.2);
        color: #00f0ff;
      }

      .admin-stat-icon-success {
        background: rgba(0, 255, 136, 0.2);
        color: #00ff88;
      }

      .admin-stat-icon-warning {
        background: rgba(255, 170, 0, 0.2);
        color: #ffaa00;
      }

      .admin-stat-icon-info {
        background: rgba(139, 92, 246, 0.2);
        color: #8b5cf6;
      }

      .admin-stat-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .admin-stat-value {
        font-size: 24px;
        font-weight: 800;
        line-height: 1;
        color: #ffffff;
      }

      .admin-stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
      }

      .admin-tabs {
        display: flex;
        gap: 8px;
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 0;
      }

      .admin-tab {
        flex: 1;
        padding: 12px 16px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: -2px;
      }

      .admin-tab:hover {
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.05);
      }

      .admin-tab.active {
        color: #00f0ff;
        border-bottom-color: #00f0ff;
      }

      .admin-tab-content {
        display: none;
        animation: fadeIn 0.3s ease-out;
      }

      .admin-tab-content.active {
        display: block;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .admin-slots-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .admin-slot-card {
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        transition: all 0.2s;
      }

      .admin-slot-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(0, 240, 255, 0.3);
        transform: translateX(4px);
      }

      .admin-slot-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .admin-slot-id {
        font-size: 14px;
        font-weight: 700;
        font-family: 'Courier New', monospace;
        color: #00f0ff;
      }

      .admin-slot-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .admin-slot-badge.visible {
        background: rgba(0, 255, 136, 0.2);
        color: #00ff88;
        border: 1px solid rgba(0, 255, 136, 0.3);
      }

      .admin-slot-badge.hidden {
        background: rgba(255, 100, 100, 0.2);
        color: #ff6464;
        border: 1px solid rgba(255, 100, 100, 0.3);
      }

      .admin-slot-info {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        font-size: 13px;
        margin-bottom: 12px;
      }

      .admin-slot-info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .admin-slot-info-label {
        color: rgba(255, 255, 255, 0.6);
        font-weight: 500;
      }

      .admin-slot-info-value {
        font-weight: 700;
        color: #ffffff;
      }

      .admin-slot-actions {
        display: flex;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .admin-btn-small {
        flex: 1;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 8px;
        background: rgba(0, 240, 255, 0.2);
        border: 1px solid rgba(0, 240, 255, 0.3);
        color: #00f0ff;
        cursor: pointer;
        transition: all 0.2s;
      }

      .admin-btn-small:hover {
        background: rgba(0, 240, 255, 0.3);
        transform: translateY(-2px);
      }

      .admin-actions {
        display: flex;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        flex-wrap: wrap;
      }

      .admin-btn {
        flex: 1;
        min-width: 140px;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
      }

      .admin-btn-primary {
        background: linear-gradient(135deg, #00f0ff, #00b8c4);
        color: #0a0a0f;
      }

      .admin-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 240, 255, 0.4);
      }

      .admin-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .admin-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(0, 240, 255, 0.5);
        transform: translateY(-2px);
      }

      .admin-analytics-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .admin-analytics-section {
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
      }

      .admin-section-title {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.8);
        margin-bottom: 16px;
      }

      .admin-metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .admin-metric {
        padding: 12px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .admin-metric-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .admin-metric-value {
        font-size: 20px;
        font-weight: 800;
        color: #00f0ff;
      }

      .admin-history-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .admin-history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .admin-history-list {
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .admin-history-item {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
      }

      .admin-history-item.impression {
        border-left: 3px solid #00f0ff;
      }

      .admin-history-item.click {
        border-left: 3px solid #00ff88;
      }

      .admin-empty-state {
        padding: 40px 20px;
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
      }

      .admin-empty-state svg {
        margin-bottom: 12px;
        opacity: 0.5;
      }

      @media (max-width: 768px) {
        .admin-dashboard {
          width: calc(100vw - 20px);
          right: 10px;
          bottom: 10px;
        }

        .admin-stats-grid {
          grid-template-columns: 1fr;
        }

        .admin-metrics-grid {
          grid-template-columns: 1fr;
        }

        .admin-slot-info {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Initialize all dashboard event listeners
   */
  function initializeDashboardEvents() {
    const closeBtn = document.getElementById('close-dashboard');
    const minimizeBtn = document.getElementById('minimize-dashboard');
    const logAllBtn = document.getElementById('log-all-impressions');
    const refreshBtn = document.getElementById('refresh-data');
    const exportBtn = document.getElementById('export-data');
    const clearHistoryBtn = document.getElementById('clear-history');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDashboard);
    }

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', toggleMinimize);
    }

    if (logAllBtn) {
      logAllBtn.addEventListener('click', logAllVisibleImpressions);
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', refreshAllData);
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportDashboardData);
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearHistory);
    }

    setupTabSwitching();
  }

  /**
   * Setup tab switching functionality
   */
  function setupTabSwitching() {
    const tabs = document.querySelectorAll('.admin-tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`tab-${targetTab}`).classList.add('active');
      });
    });
  }

  /**
   * Close dashboard
   */
  function closeDashboard() {
    const dashboard = document.getElementById('admin-ad-dashboard');
    if (dashboard) {
      dashboard.style.transform = 'translateX(520px)';
      dashboard.style.opacity = '0';
      setTimeout(() => {
        dashboard.style.display = 'none';
        STATE.isDashboardVisible = false;
      }, 300);
    }
  }

  /**
   * Toggle minimize state
   */
  function toggleMinimize() {
    const dashboard = document.getElementById('admin-ad-dashboard');
    if (dashboard) {
      STATE.isMinimized = !STATE.isMinimized;
      dashboard.classList.toggle('minimized');
    }
  }

  // ============================================================================
  // AD SLOT MANAGEMENT
  // ============================================================================

  /**
   * Collect all ad slots from DOM
   */
  function collectAdSlots() {
    const slots = document.querySelectorAll('.ad-slot');
    STATE.adSlots = [];

    slots.forEach(slot => {
      const slotId = slot.getAttribute('data-ad-slot-id') || 'unknown';
      const adSlot = new AdSlot(slot, slotId);
      STATE.adSlots.push(adSlot);

      slot.addEventListener('click', () => {
        handleAdSlotClick(adSlot);
      });
    });

    console.log(`✅ Collected ${STATE.adSlots.length} ad slots`);
    return STATE.adSlots;
  }

  /**
   * Handle ad slot click
   * @param {AdSlot} adSlot
   */
  function handleAdSlotClick(adSlot) {
    adSlot.logClick();
    
    if (typeof window.logAdClick === 'function') {
      window.logAdClick(adSlot.id, adSlot.getMetrics());
    }
    
    updateDashboard();
  }

  // ============================================================================
  // VISIBILITY TRACKING
  // ============================================================================

  /**
   * Initialize visibility tracking with IntersectionObserver
   */
  function initializeVisibilityTracking() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const adSlot = STATE.adSlots.find(slot => slot.element === entry.target);
        if (adSlot) {
          adSlot.updateVisibility(entry.intersectionRatio);
        }
      });
    }, {
      threshold: CONFIG.observerThreshold
    });

    STATE.observers.set('visibility', observer);

    STATE.adSlots.forEach(slot => {
      observer.observe(slot.element);
    });
  }

  // ============================================================================
  // DASHBOARD UPDATE
  // ============================================================================

  /**
   * Update dashboard display with current data
   */
  function updateDashboard() {
    updateStatistics();
    updateSlotsList();
    updateAnalytics();
    updateHistory();
  }

  /**
   * Update summary statistics
   */
  function updateStatistics() {
    STATE.adSlots.forEach(slot => slot.checkFillStatus());

    const totalSlots = STATE.adSlots.length;
    const visibleSlots = STATE.adSlots.filter(s => s.isVisible).length;
    const filledSlots = STATE.adSlots.filter(s => s.isFilled).length;

    document.getElementById('stat-total-slots').textContent = totalSlots;
    document.getElementById('stat-visible-slots').textContent = visibleSlots;
    document.getElementById('stat-filled-slots').textContent = filledSlots;
    document.getElementById('stat-impressions').textContent = STATE.totalImpressions;
  }

  /**
   * Update slots list display
   */
  function updateSlotsList() {
    const container = document.getElementById('admin-slots-list');
    if (!container) return;

    container.innerHTML = STATE.adSlots.map(slot => {
      const metrics = slot.getMetrics();
      return `
        <div class="admin-slot-card">
          <div class="admin-slot-header">
            <span class="admin-slot-id">${slot.id}</span>
            <span class="admin-slot-badge ${slot.isVisible ? 'visible' : 'hidden'}">
              ${slot.isVisible ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <div class="admin-slot-info">
            <div class="admin-slot-info-item">
              <span class="admin-slot-info-label">Visibility</span>
              <span class="admin-slot-info-value">${slot.visibility}%</span>
            </div>
            <div class="admin-slot-info-item">
              <span class="admin-slot-info-label">Fill Status</span>
              <span class="admin-slot-info-value">${slot.isFilled ? 'Filled' : 'Empty'}</span>
            </div>
            <div class="admin-slot-info-item">
              <span class="admin-slot-info-label">Impressions</span>
              <span class="admin-slot-info-value">${slot.impressionCount}</span>
            </div>
            <div class="admin-slot-info-item">
              <span class="admin-slot-info-label">Clicks</span>
              <span class="admin-slot-info-value">${slot.clickCount}</span>
            </div>
          </div>
          <div class="admin-slot-actions">
            <button class="admin-btn-small" onclick="window.logSlotImpression('${slot.id}')">
              Log Impression
            </button>
            <button class="admin-btn-small" onclick="window.scrollToSlot('${slot.id}')">
              Scroll To
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Update analytics display
   */
  function updateAnalytics() {
    const sessionDuration = Math.floor((Date.now() - STATE.sessionStart) / 1000);
    const overallCTR = STATE.totalImpressions > 0 ? 
                       ((STATE.totalClicks / STATE.totalImpressions) * 100).toFixed(2) : 0;

    document.getElementById('metric-total-impressions').textContent = STATE.totalImpressions;
    document.getElementById('metric-total-clicks').textContent = STATE.totalClicks;
    document.getElementById('metric-ctr').textContent = `${overallCTR}%`;
    document.getElementById('metric-session').textContent = `${sessionDuration}s`;

    const performanceContainer = document.getElementById('slot-performance-list');
    if (performanceContainer) {
      performanceContainer.innerHTML = STATE.adSlots.map(slot => {
        const metrics = slot.getMetrics();
        return `
          <div class="admin-metric">
            <span class="admin-metric-label">${slot.id}</span>
            <span class="admin-metric-value">CTR: ${metrics.ctr}%</span>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Update history display
   */
  function updateHistory() {
    const container = document.getElementById('admin-history-list');
    if (!container) return;

    if (STATE.history.length === 0) {
      container.innerHTML = `
        <div class="admin-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="48" height="48">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No events recorded yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = STATE.history.slice().reverse().map(event => {
      const date = new Date(event.timestamp);
      const timeStr = date.toLocaleTimeString();
      return `
        <div class="admin-history-item ${event.type}">
          <div>
            <strong>${event.type.toUpperCase()}</strong>: ${event.slotId}
            ${event.visibility ? ` (${event.visibility}% visible)` : ''}
          </div>
          <div>${timeStr}</div>
        </div>
      `;
    }).join('');
  }

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  /**
   * Log impression for specific slot
   * @param {string} slotId
   */
  function logSlotImpression(slotId) {
    const slot = STATE.adSlots.find(s => s.id === slotId);
    if (!slot) return;

    slot.logImpression();

    if (typeof window.logAdImpression === 'function') {
      window.logAdImpression(slotId, slot.getMetrics());
    }

    updateDashboard();
    console.log(`✅ Logged impression for: ${slotId}`);
  }

  /**
   * Log impressions for all visible slots
   */
  function logAllVisibleImpressions() {
    const visibleSlots = STATE.adSlots.filter(s => s.isVisible);

    if (visibleSlots.length === 0) {
      alert('No visible ad slots to log');
      return;
    }

    visibleSlots.forEach(slot => {
      logSlotImpression(slot.id);
    });

    alert(`✅ Logged impressions for ${visibleSlots.length} visible slot(s)`);
  }

  /**
   * Scroll to specific ad slot
   * @param {string} slotId
   */
  function scrollToSlot(slotId) {
    const slot = STATE.adSlots.find(s => s.id === slotId);
    if (!slot) return;

    slot.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    slot.element.style.outline = '3px solid #00f0ff';
    slot.element.style.outlineOffset = '4px';

    setTimeout(() => {
      slot.element.style.outline = '';
      slot.element.style.outlineOffset = '';
    }, 2000);
  }

  /**
   * Refresh all dashboard data
   */
  function refreshAllData() {
    collectAdSlots();
    initializeVisibilityTracking();
    updateDashboard();
    console.log('✅ Dashboard data refreshed');
  }

  /**
   * Export dashboard data as JSON
   */
  function exportDashboardData() {
    const exportData = {
      timestamp: new Date().toISOString(),
      session_duration: Date.now() - STATE.sessionStart,
      total_impressions: STATE.totalImpressions,
      total_clicks: STATE.totalClicks,
      slots: STATE.adSlots.map(slot => slot.getMetrics()),
      history: STATE.history
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ad-dashboard-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('✅ Dashboard data exported');
  }

  /**
   * Clear event history
   */
  function clearHistory() {
    if (confirm('Are you sure you want to clear the event history?')) {
      STATE.history = [];
      updateHistory();
      console.log('✅ History cleared');
    }
  }

  // ============================================================================
  // AUTO-UPDATE
  // ============================================================================

  /**
   * Start automatic dashboard updates
   */
  function startAutoUpdate() {
    if (!CONFIG.autoRefresh) return;

    STATE.updateTimer = setInterval(() => {
      updateDashboard();
    }, CONFIG.updateInterval);
  }

  /**
   * Stop automatic updates
   */
  function stopAutoUpdate() {
    if (STATE.updateTimer) {
      clearInterval(STATE.updateTimer);
      STATE.updateTimer = null;
    }
  }

  // ============================================================================
  // EXPOSE PUBLIC API
  // ============================================================================

  window.logSlotImpression = logSlotImpression;
  window.scrollToSlot = scrollToSlot;

  window.AdminDashboard = {
    getState: () => ({ ...STATE }),
    getConfig: () => ({ ...CONFIG }),
    refresh: refreshAllData,
    export: exportDashboardData,
    logAll: logAllVisibleImpressions
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize admin dashboard
   */
  function initialize() {
    console.log('🔧 Initializing Admin Ad Management Dashboard...');

    createAdminDashboard();
    collectAdSlots();
    initializeVisibilityTracking();
    updateDashboard();
    startAutoUpdate();

    console.log('✅ Admin Dashboard Ready');
    console.log(`📊 Monitoring ${STATE.adSlots.length} ad slots`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initialize, 1000);
    });
  } else {
    setTimeout(initialize, 1000);
  }

  window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    STATE.observers.forEach(observer => observer.disconnect());
  });

})();

/**
 * EthanOS — Shared UI & Helpers
 *
 * Loaded on every page. Handles:
 *  - Sidebar navigation injection (buildNav)
 *  - Live clock
 *  - Modal system
 *  - Toast system
 *  - Helper functions (generateId, formatDate, formatTime, timeAgo, debounce)
 *  - Category helpers
 *  - UI builders (progress bar, star rating, category badge)
 *  - XP system
 *  - Default data initializer
 *  - Keyboard shortcuts
 *  - Mobile sidebar toggle
 */

(function () {
  'use strict';

  /* ========================================================================
     NAV CONFIG — all 17 pages
     ======================================================================== */
  var NAV_ITEMS = [
    { section: 'Core' },
    { label: 'Command Center', icon: '\uD83D\uDCCA', href: 'index.html' },
    { label: 'Academic Brain',  icon: '\uD83D\uDCDA', href: 'academic.html' },
    { label: 'Schedule',        icon: '\uD83D\uDCC5', href: 'schedule.html' },
    { label: 'Goals',           icon: '\uD83C\uDFAF', href: 'goals.html' },
    { label: 'Analytics',       icon: '\uD83D\uDCC8', href: 'analytics.html' },
    { section: 'Focus & Health' },
    { label: 'Focus Mode',      icon: '\uD83D\uDD25', href: 'focus.html' },
    { label: 'Energy & Mood',   icon: '\uD83D\uDC9A', href: 'energy.html' },
    { label: 'Burnout Monitor', icon: '\uD83D\uDEE1\uFE0F', href: 'burnout.html' },
    { label: 'Procrastination', icon: '\u23F3',       href: 'procrastination.html' },
    { section: 'Planning' },
    { label: 'Roadmap',         icon: '\uD83D\uDDFA\uFE0F', href: 'roadmap.html' },
    { label: 'Decisions',       icon: '\u2696\uFE0F', href: 'decisions.html' },
    { label: 'Life Balance',    icon: '\u26A1',       href: 'balance.html' },
    { label: 'Big Picture',     icon: '\uD83D\uDC41\uFE0F', href: 'bigpicture.html' },
    { section: 'Growth' },
    { label: 'Identity',        icon: '\uD83E\uDDEC', href: 'identity.html' },
    { label: 'Knowledge Vault', icon: '\uD83D\uDCDD', href: 'vault.html' },
    { label: 'XP & Score',      icon: '\uD83C\uDFC6', href: 'xp.html' },
    { section: 'System' },
    { label: 'Settings',        icon: '\u2699\uFE0F', href: 'settings.html' }
  ];

  /* ========================================================================
     DEFAULT CATEGORIES
     ======================================================================== */
  var DEFAULT_CATEGORIES = [
    { id: 'cat_school',   name: 'School',   icon: '\uD83D\uDCDA', color: 'blue',   weeklyHoursTarget: 15 },
    { id: 'cat_coding',   name: 'Coding',   icon: '\uD83D\uDCBB', color: 'purple', weeklyHoursTarget: 10 },
    { id: 'cat_fitness',  name: 'Fitness',  icon: '\uD83D\uDCAA', color: 'green',  weeklyHoursTarget: 5 },
    { id: 'cat_projects', name: 'Projects', icon: '\uD83D\uDD28', color: 'orange', weeklyHoursTarget: 8 },
    { id: 'cat_personal', name: 'Personal', icon: '\uD83C\uDF1F', color: 'pink',   weeklyHoursTarget: 5 }
  ];

  /* ========================================================================
     LEVEL THRESHOLDS
     ======================================================================== */
  var LEVEL_THRESHOLDS = [
    { xp: 0,     name: 'Beginner' },
    { xp: 500,   name: 'Novice' },
    { xp: 1500,  name: 'Apprentice' },
    { xp: 3000,  name: 'Journeyman' },
    { xp: 5000,  name: 'Expert' },
    { xp: 8000,  name: 'Master' },
    { xp: 12000, name: 'Legend' }
  ];

  /* ========================================================================
     CATEGORY COLOR MAP
     ======================================================================== */
  var COLOR_MAP = {
    blue:   'var(--cat-blue)',
    purple: 'var(--cat-purple)',
    green:  'var(--cat-green)',
    orange: 'var(--cat-orange)',
    pink:   'var(--cat-pink)'
  };

  var BADGE_CLASS_MAP = {
    blue:   'badge-cat-blue',
    purple: 'badge-cat-purple',
    green:  'badge-cat-green',
    orange: 'badge-cat-orange',
    pink:   'badge-cat-pink'
  };

  /* ========================================================================
     HELPER: detect current page
     ======================================================================== */
  function getCurrentPage() {
    var path = window.location.pathname;
    var filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return filename;
  }

  /* ========================================================================
     BUILD NAV — inject sidebar + topbar into #app-shell
     ======================================================================== */
  function buildNav() {
    var shell = document.getElementById('app-shell');
    if (!shell) return;

    var currentPage = getCurrentPage();

    // ---- TOPBAR ----
    var topbarHTML = '<header class="topbar">' +
      '<div class="topbar-left">' +
        '<button class="hamburger" id="hamburger-btn" aria-label="Toggle navigation">&#9776;</button>' +
        '<a href="index.html" class="logo" style="text-decoration:none">EthanOS</a>' +
      '</div>' +
      '<div class="topbar-center">' +
        '<span id="clock"></span>' +
      '</div>' +
      '<div class="topbar-right">' +
      '</div>' +
    '</header>';

    // ---- SIDEBAR ----
    var sidebarHTML = '<div class="sidebar-overlay" id="sidebar-overlay"></div>' +
      '<nav class="sidebar" id="sidebar">';

    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      if (item.section) {
        sidebarHTML += '<div class="nav-section-label">' + item.section + '</div>';
      } else {
        var isActive = (currentPage === item.href) ? ' active' : '';
        sidebarHTML += '<a class="nav-item' + isActive + '" href="' + item.href + '">' +
          '<span class="nav-icon">' + item.icon + '</span>' +
          '<span class="nav-label">' + item.label + '</span>' +
        '</a>';
      }
    }

    sidebarHTML += '<div class="sidebar-footer"><div class="sidebar-version">EthanOS v1.0</div></div></nav>';

    shell.innerHTML = topbarHTML + sidebarHTML;

    // Wire up hamburger + overlay
    initSidebarToggle();
  }

  /* ========================================================================
     SIDEBAR TOGGLE (mobile hamburger)
     ======================================================================== */
  function initSidebarToggle() {
    var hamburger = document.getElementById('hamburger-btn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (!hamburger || !sidebar || !overlay) return;

    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      overlay.style.display = 'block';
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      setTimeout(function () {
        if (!overlay.classList.contains('visible')) {
          overlay.style.display = '';
        }
      }, 300);
    }

    hamburger.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    // Expose globally
    window.closeSidebar = closeSidebar;
    window.openSidebar = openSidebar;
  }

  /* ========================================================================
     LIVE CLOCK
     ======================================================================== */
  function initClock() {
    var el = document.getElementById('clock');
    if (!el) return;

    function tick() {
      var now = new Date();
      var options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      el.textContent = now.toLocaleDateString('en-US', options);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ========================================================================
     MODAL SYSTEM
     ======================================================================== */
  function openModal(title, contentHTML) {
    var root = document.getElementById('modal-root');
    if (!root) return;

    root.innerHTML = '<div class="modal-overlay visible" id="modal-overlay">' +
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title">' + (title || '') + '</h2>' +
          '<button class="modal-close" id="modal-close-x" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' + (contentHTML || '') + '</div>' +
      '</div>' +
    '</div>';

    var overlay = document.getElementById('modal-overlay');
    var closeX = document.getElementById('modal-close-x');

    if (closeX) {
      closeX.addEventListener('click', closeModal);
    }

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }
  }

  function closeModal() {
    var root = document.getElementById('modal-root');
    if (!root) return;
    var overlay = root.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(function () { root.innerHTML = ''; }, 300);
    } else {
      root.innerHTML = '';
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  /* ========================================================================
     TOAST SYSTEM
     ======================================================================== */
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;

    var icons = { success: '\u2705', warning: '\u26A0\uFE0F', error: '\u274C', info: '\u2139\uFE0F' };
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML =
      '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
      '<button class="toast-close" aria-label="Dismiss">&times;</button>';

    container.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('visible'); });

    toast.querySelector('.toast-close').addEventListener('click', function () { removeToast(toast); });
    setTimeout(function () { removeToast(toast); }, 3000);
  }

  function removeToast(toast) {
    toast.classList.remove('visible');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }

  window.showToast = showToast;

  /* ========================================================================
     HELPER FUNCTIONS
     ======================================================================== */
  function generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  function formatDate(date) {
    if (!date) return '';
    var d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(date) {
    if (!date) return '';
    var d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function timeAgo(date) {
    if (!date) return '';
    var d = (date instanceof Date) ? date : new Date(date);
    var seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';
    var weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'w ago';
    return formatDate(d);
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  window.generateId = generateId;
  window.formatDate = formatDate;
  window.formatTime = formatTime;
  window.timeAgo = timeAgo;
  window.debounce = debounce;

  /* ========================================================================
     CATEGORY HELPERS
     ======================================================================== */
  function _getCategories() {
    try {
      var raw = localStorage.getItem('ethanos_cache_categories');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_CATEGORIES;
  }

  function getAllCategories() {
    return _getCategories();
  }

  function getCategoryById(id) {
    var cats = _getCategories();
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === id) return cats[i];
    }
    return null;
  }

  function getCategoryColor(id) {
    var cat = getCategoryById(id);
    if (!cat) return 'var(--text-muted)';
    return COLOR_MAP[cat.color] || 'var(--text-muted)';
  }

  function getCategoryIcon(id) {
    var cat = getCategoryById(id);
    return cat ? cat.icon : '';
  }

  function getCategoryBadgeHTML(categoryId) {
    var cat = getCategoryById(categoryId);
    if (!cat) return '<span class="badge badge-muted">Unknown</span>';
    var cls = BADGE_CLASS_MAP[cat.color] || '';
    return '<span class="badge ' + cls + '">' + cat.icon + ' ' + cat.name + '</span>';
  }

  window.getAllCategories = getAllCategories;
  window.getCategoryById = getCategoryById;
  window.getCategoryColor = getCategoryColor;
  window.getCategoryIcon = getCategoryIcon;
  window.getCategoryBadgeHTML = getCategoryBadgeHTML;

  /* ========================================================================
     UI BUILDERS
     ======================================================================== */
  function createProgressBar(percent, color) {
    percent = Math.max(0, Math.min(100, percent || 0));
    var colorClass = '';
    if (color === 'success' || color === 'green') colorClass = ' success';
    else if (color === 'warning' || color === 'orange') colorClass = ' warning';
    else if (color === 'danger' || color === 'red') colorClass = ' danger';

    return '<div class="progress-bar">' +
      '<div class="progress-bar-fill' + colorClass + '" style="width:' + percent + '%"></div>' +
    '</div>';
  }

  function createStarRating(rating, max) {
    max = max || 5;
    rating = Math.max(0, Math.min(max, rating || 0));
    var html = '<div class="star-rating">';
    for (var i = 1; i <= max; i++) {
      var filled = i <= rating ? ' filled' : '';
      html += '<span class="star' + filled + '">\u2605</span>';
    }
    html += '</div>';
    return html;
  }

  function createCategoryBadge(categoryId) {
    return getCategoryBadgeHTML(categoryId);
  }

  window.createProgressBar = createProgressBar;
  window.createStarRating = createStarRating;
  window.createCategoryBadge = createCategoryBadge;

  /* ========================================================================
     XP SYSTEM
     ======================================================================== */
  function getLevelInfo(totalXp) {
    var level = LEVEL_THRESHOLDS[0];
    var nextLevel = LEVEL_THRESHOLDS[1] || null;
    for (var i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVEL_THRESHOLDS[i].xp) {
        level = LEVEL_THRESHOLDS[i];
        nextLevel = LEVEL_THRESHOLDS[i + 1] || null;
        break;
      }
    }
    return { level: level, nextLevel: nextLevel };
  }
  window.getLevelInfo = getLevelInfo;

  async function awardXP(amount, reason) {
    try {
      var xpData = await window.EthanOSData.loadData('xp', {
        totalXp: 0,
        level: 'Beginner',
        weeklyScores: [],
        streaks: {},
        achievements: []
      });

      var oldLevel = getLevelInfo(xpData.totalXp).level.name;
      xpData.totalXp = (xpData.totalXp || 0) + amount;
      var newInfo = getLevelInfo(xpData.totalXp);
      xpData.level = newInfo.level.name;

      await window.EthanOSData.saveData('xp', xpData);

      showToast('+' + amount + ' XP' + (reason ? ' — ' + reason : ''), 'success');

      if (newInfo.level.name !== oldLevel) {
        showToast('Level up! You are now ' + newInfo.level.name + '!', 'success');
      }
    } catch (err) {
      console.error('[shared.js] awardXP failed:', err);
    }
  }
  window.awardXP = awardXP;

  /* ========================================================================
     DEFAULT DATA INITIALIZER
     ======================================================================== */
  async function initDefaultData() {
    try {
      var categories = await window.EthanOSData.loadData('categories', null);
      if (!categories) {
        await window.EthanOSData.saveData('categories', DEFAULT_CATEGORIES);
        await window.EthanOSData.saveData('tasks', []);
        await window.EthanOSData.saveData('goals', []);
        await window.EthanOSData.saveData('schedule', []);
        await window.EthanOSData.saveData('focusSessions', []);
        await window.EthanOSData.saveData('moodEntries', []);
        await window.EthanOSData.saveData('notes', []);
        await window.EthanOSData.saveData('identity', []);
        await window.EthanOSData.saveData('roadmapEvents', []);
        await window.EthanOSData.saveData('xp', {
          totalXp: 0,
          level: 'Beginner',
          weeklyScores: [],
          streaks: {},
          achievements: []
        });
        await window.EthanOSData.saveData('settings', {
          userName: 'Ethan',
          theme: 'dark',
          focusDuration: 25,
          breakDuration: 5
        });
        console.log('[shared.js] Default data initialized.');
      }
    } catch (err) {
      console.error('[shared.js] initDefaultData failed:', err);
    }
  }

  /* ========================================================================
     KEYBOARD SHORTCUTS
     ======================================================================== */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      if (window.closeSidebar) window.closeSidebar();
    }
  });

  /* ========================================================================
     BOOT SEQUENCE
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', async function () {
    // 1. Build the nav / topbar
    buildNav();

    // 2. Start clock
    initClock();

    // 3. Initialize data layer
    try {
      await window.EthanOSData.init();
    } catch (err) {
      console.warn('[shared.js] Data init failed:', err);
    }

    // 4. Create default data on first visit
    await initDefaultData();

    console.log('[shared.js] Boot sequence complete.');
  });

})();

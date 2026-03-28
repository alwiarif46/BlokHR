/**
 * shared/router.js — Navigation with Lazy Module Loading
 *
 * Extracted from the monolith's navigateToModule() and sidebar event handling.
 *
 * Responsibilities:
 *  - Sidebar click handling
 *  - **Lazy module loading**: on first navigate, dynamically imports
 *    modules/{name}/{name}.js (which calls registerModule()) and injects
 *    modules/{name}/{name}.css via <link> tag
 *  - Module activation/deactivation
 *  - View switching (personal pgMy vs. team pgTeam for attendance)
 *  - Feature flag-based sidebar item visibility
 *  - Mobile sidebar collapse/expand
 */

import { api } from './api.js';

let _activeModule = 'attendance';
let _currentView = 'me';
let _featureFlags = {};
let _sbCollapsed = false;
let _moduleRenderers = {};
let _loadedCSS = {};
let _loadingModules = {};

/* ── Module Registration ── */

/**
 * Register module renderers. Called from each module's JS file on import.
 * @param {string} name
 * @param {function(container: HTMLElement): void} renderFn
 */
export function registerModule(name, renderFn) {
  _moduleRenderers[name] = renderFn;
}

/**
 * Get the currently active module name.
 * @returns {string}
 */
export function getActiveModule() {
  return _activeModule;
}

/**
 * Get the current view mode (me or team).
 * @returns {'me'|'team'}
 */
export function getCurrentView() {
  return _currentView;
}

/* ── CSS Loader ── */

/**
 * Inject a module's CSS file via <link> tag if not already loaded.
 * @param {string} mod — module key
 */
function _loadModuleCSS(mod) {
  if (_loadedCSS[mod]) return;
  _loadedCSS[mod] = true;

  /* Don't inject CSS in test environments (no real DOM head) */
  if (typeof document === 'undefined' || !document.head) return;

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'modules/' + mod + '/' + mod + '.css';
  link.dataset.module = mod;
  document.head.appendChild(link);
}

/* ── Dynamic Module Loader ── */

/**
 * Dynamically import a module's JS file.
 * The import triggers the module's registerModule() call at file bottom,
 * which populates _moduleRenderers[mod].
 *
 * @param {string} mod — module key
 * @returns {Promise<boolean>} true if renderer was registered
 */
async function _loadModuleJS(mod) {
  /* Already registered (pre-imported or previously loaded) */
  if (_moduleRenderers[mod]) return true;

  /* Already loading — wait for it */
  if (_loadingModules[mod]) {
    return _loadingModules[mod];
  }

  var promise = _doImport(mod);
  _loadingModules[mod] = promise;

  try {
    await promise;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[router] Failed to load module: ' + mod, err);
    }
  } finally {
    delete _loadingModules[mod];
  }

  return !!_moduleRenderers[mod];
}

async function _doImport(mod) {
  /* Dynamic import path is relative to the HTML page serving these modules.
     shell.html sits at the root, so the path is modules/{mod}/{mod}.js */
  try {
    await import('../modules/' + mod + '/' + mod + '.js');
  } catch (_e1) {
    /* Fallback: some environments resolve relative to this file (shared/router.js) */
    try {
      await import('./modules/' + mod + '/' + mod + '.js');
    } catch (_e2) {
      /* In test environments, modules are imported directly — this is expected to fail.
         The module renderer may already be registered via direct test imports. */
    }
  }
}

/* ── Module Name Map (for loading placeholder) ── */

var _modNames = {
  attendance: 'Attendance',
  leaves: 'Leaves',
  timesheets: 'Timesheets',
  regularizations: 'Regularizations',
  dashboard: 'Dashboard',
  profile: 'Profile',
  settings: 'Settings',
  org_chart: 'Org Chart',
  documents: 'Documents',
  training: 'Training & LMS',
  workflows: 'Workflows',
  surveys: 'Surveys',
  assets: 'Asset Management',
  visitors: 'Visitor Management',
  iris_scan: 'Iris Scan',
  face_recognition: 'Face Recognition',
  expenses: 'Expenses & Approvals',
  analytics: 'Analytics',
  time_tracking: 'Time Tracking',
  overtime: 'Overtime Management',
  leave_policies: 'Leave Policies',
  holidays: 'Holiday Calendar',
  geo_fencing: 'Geo-Fencing',
  ai_chatbot: 'AI Chatbot',
  audit_trail: 'Audit Trail',
  feature_flags: 'Feature Flags',
  webhooks: 'Webhooks',
};

/* ── Navigate ── */

/**
 * Navigate to a module by name.
 * On first visit: injects CSS, dynamically imports JS, shows loading state,
 * then calls the renderer once registered.
 *
 * @param {string} mod — module key (e.g. 'attendance', 'leaves', 'settings')
 */
export function navigateToModule(mod) {
  _activeModule = mod;

  /* Update sidebar active state */
  document.querySelectorAll('.sb-item[data-module]').forEach(function (item) {
    item.classList.toggle('active', item.dataset.module === mod);
  });

  /* Deactivate all existing pages (pgMy, pgTeam, and any mod_ pages) */
  var pgMy = document.getElementById('pgMy');
  var pgTeam = document.getElementById('pgTeam');
  if (pgMy) pgMy.classList.remove('active');
  if (pgTeam) pgTeam.classList.remove('active');
  document.querySelectorAll('.mod-page').forEach(function (p) {
    p.classList.remove('active');
  });

  /* Show view switch only for attendance + dashboard (Me/Team toggle) */
  var vs = document.getElementById('viewSwitch');
  if (vs) vs.style.display = (mod === 'attendance' || mod === 'dashboard') ? '' : 'none';

  /* Create/activate the module page and lazy-load */
  var page = _getOrCreatePage(mod);
  page.classList.add('active');
  _ensureModuleLoaded(mod);

  /* On mobile, collapse sidebar after selection */
  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
    var sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('expanded');
  }
}

/**
 * Get or create the module's page container.
 * @param {string} mod
 * @returns {HTMLElement}
 */
function _getOrCreatePage(mod) {
  var page = document.getElementById('mod_' + mod);
  if (!page) {
    page = document.createElement('div');
    page.id = 'mod_' + mod;
    page.className = 'mod-page';
    var content = document.getElementById('appContent');
    if (content) content.appendChild(page);
  }
  return page;
}

/**
 * Ensure a module is loaded and rendered.
 * If already registered, renders immediately.
 * If not, shows loading state, dynamically imports, then renders.
 *
 * @param {string} mod
 */
async function _ensureModuleLoaded(mod) {
  /* Inject CSS on first load */
  _loadModuleCSS(mod);

  var page = _getOrCreatePage(mod);

  /* Already registered — render immediately */
  if (_moduleRenderers[mod]) {
    /* Only render if page is empty (first time) */
    if (!page.dataset.rendered) {
      page.dataset.rendered = '1';
      _moduleRenderers[mod](page);
    }
    return;
  }

  /* Show loading placeholder */
  page.innerHTML =
    '<div class="mod-coming">' +
      '<div class="mod-coming-icon" style="animation:spin 1s linear infinite">&#9881;</div>' +
      '<div class="mod-coming-title df">' + (_modNames[mod] || mod) + '</div>' +
      '<div class="mod-coming-sub mf">Loading module…</div>' +
    '</div>';

  /* Dynamically import the module JS */
  var loaded = await _loadModuleJS(mod);

  /* If this module is no longer active (user navigated away during load), skip render */
  if (_activeModule !== mod) return;

  if (loaded && _moduleRenderers[mod]) {
    page.innerHTML = '';
    page.dataset.rendered = '1';
    _moduleRenderers[mod](page);
  } else {
    page.innerHTML =
      '<div class="mod-coming">' +
        '<div class="mod-coming-icon">&#128679;</div>' +
        '<div class="mod-coming-title df">' + (_modNames[mod] || mod) + '</div>' +
        '<div class="mod-coming-sub mf">Module not available</div>' +
      '</div>';
  }
}

/* ── View Switch ── */

/**
 * Switch between personal (me) and team views.
 * "Me" navigates to dashboard module, "Team" navigates to attendance module.
 * @param {'me'|'team'} view
 */
export function switchAppView(view) {
  _currentView = view;

  var vsMe = document.getElementById('vsMe');
  var vsTeam = document.getElementById('vsTeam');
  if (vsMe) vsMe.classList.toggle('active', view === 'me');
  if (vsTeam) vsTeam.classList.toggle('active', view === 'team');

  /* Navigate to the corresponding module */
  if (view === 'me' && _activeModule !== 'dashboard') {
    navigateToModule('dashboard');
  } else if (view === 'team' && _activeModule !== 'attendance') {
    navigateToModule('attendance');
  }

  document.dispatchEvent(new CustomEvent('blokhr:viewSwitch', { detail: { view: view } }));
}

/* ── Feature Flags ── */

/**
 * Load feature flags from the server and apply sidebar visibility.
 */
export async function loadFeatureFlags() {
  var data = await api.get('/api/features');
  if (!data || data._error) {
    _featureFlags = {};
    return;
  }
  /* Handle both array and object shapes */
  if (Array.isArray(data.features)) {
    _featureFlags = {};
    data.features.forEach(function (f) {
      _featureFlags[f.key || f.feature_key] = f.enabled;
    });
  } else {
    _featureFlags = data.features || data || {};
  }
  applyFeatureFlags();
}

/**
 * Get current feature flags object.
 * @returns {object}
 */
export function getFeatureFlags() {
  return _featureFlags;
}

/**
 * Apply feature flags to sidebar items.
 * Items with data-flag attribute are hidden if the flag is disabled.
 */
export function applyFeatureFlags() {
  document.querySelectorAll('.sb-item[data-flag]').forEach(function (item) {
    var flag = item.dataset.flag;
    var enabled = _featureFlags[flag] !== false && _featureFlags[flag] !== 0;
    item.classList.toggle('hidden', !enabled);
  });
}

/* ── Sidebar ── */

/**
 * Toggle sidebar collapsed state.
 */
export function toggleSidebar() {
  _sbCollapsed = !_sbCollapsed;
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('collapsed', _sbCollapsed);
}

/* ── Init ── */

/**
 * Initialise router: bind sidebar click, view switch, mobile toggle.
 * Called once from shell.html after DOM ready.
 */
export function initRouter() {
  /* Sidebar clicks */
  var sbNav = document.getElementById('sbNav');
  if (sbNav) {
    sbNav.addEventListener('click', function (e) {
      var item = e.target.closest('.sb-item');
      if (!item || !item.dataset.module || item.classList.contains('sb-collapse')) return;
      navigateToModule(item.dataset.module);
    });
  }

  /* Sidebar collapse button */
  var collapseBtn = document.getElementById('sbCollapseBtn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar);
  }

  /* View switch buttons */
  var vsMe = document.getElementById('vsMe');
  var vsTeam = document.getElementById('vsTeam');
  if (vsMe)
    vsMe.addEventListener('click', function () {
      switchAppView('me');
    });
  if (vsTeam)
    vsTeam.addEventListener('click', function () {
      switchAppView('team');
    });

  /* Mobile sidebar toggle via logo click */
  var hdrLogo = document.getElementById('hdrLogo');
  if (hdrLogo) {
    hdrLogo.addEventListener('click', function () {
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        var sb = document.getElementById('sidebar');
        if (sb) sb.classList.toggle('expanded');
      }
    });
  }
}

/* ── Test helpers ── */

export function _getRenderers() { return _moduleRenderers; }
export function _resetRouterState() {
  _activeModule = 'attendance';
  _currentView = 'me';
  _featureFlags = {};
  _sbCollapsed = false;
  _moduleRenderers = {};
  _loadedCSS = {};
  _loadingModules = {};
}

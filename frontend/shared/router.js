/**
 * shared/router.js — Navigation
 *
 * Extracted from the monolith's navigateToModule() and sidebar event handling.
 *
 * Responsibilities:
 *  - Sidebar click handling
 *  - Lazy module loading (CSS + JS + HTML template)
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

/**
 * Register module renderers. Called from each module during import.
 *
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

/**
 * Navigate to a module by name.
 * Creates the module page container if it doesn't exist, calls the renderer.
 *
 * @param {string} mod — module key (e.g. 'attendance', 'leaves', 'org_chart')
 */
export function navigateToModule(mod) {
  _activeModule = mod;

  /* Update sidebar active state */
  document.querySelectorAll('.sb-item[data-module]').forEach(function (item) {
    item.classList.toggle('active', item.dataset.module === mod);
  });

  if (mod === 'attendance') {
    const pgMy = document.getElementById('pgMy');
    const pgTeam = document.getElementById('pgTeam');
    if (pgMy) pgMy.classList.toggle('active', _currentView === 'me');
    if (pgTeam) pgTeam.classList.toggle('active', _currentView === 'team');
    document.querySelectorAll('.mod-page').forEach(function (p) {
      p.classList.remove('active');
    });
    const vs = document.getElementById('viewSwitch');
    if (vs) vs.style.display = '';
  } else {
    const pgMy = document.getElementById('pgMy');
    const pgTeam = document.getElementById('pgTeam');
    if (pgMy) pgMy.classList.remove('active');
    if (pgTeam) pgTeam.classList.remove('active');
    const vs = document.getElementById('viewSwitch');
    if (vs) vs.style.display = 'none';

    document.querySelectorAll('.mod-page').forEach(function (p) {
      p.classList.remove('active');
    });

    let page = document.getElementById('mod_' + mod);
    if (!page) {
      page = document.createElement('div');
      page.id = 'mod_' + mod;
      page.className = 'mod-page';
      const content = document.getElementById('appContent');
      if (content) content.appendChild(page);

      if (_moduleRenderers[mod]) {
        _moduleRenderers[mod](page);
      } else {
        const modNames = {
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
          leaves: 'Leaves',
          timesheets: 'Timesheets',
          time_tracking: 'Time Tracking',
          overtime: 'Overtime Management',
          leave_policies: 'Leave Policies',
          holidays: 'Holiday Calendar',
          geo_fencing: 'Geo-Fencing',
          ai_chatbot: 'AI Chatbot',
          audit_trail: 'Audit Trail',
          feature_flags: 'Feature Flags',
          webhooks: 'Webhooks',
          settings: 'Settings',
          profile: 'Profile',
          dashboard: 'Dashboard',
        };
        page.innerHTML =
          '<div class="mod-coming">' +
          '<div class="mod-coming-icon">&#128640;</div>' +
          '<div class="mod-coming-title df">' +
          (modNames[mod] || mod) +
          '</div>' +
          '<div class="mod-coming-sub mf">Module loading…</div>' +
          '</div>';
      }
    }
    page.classList.add('active');
  }

  /* On mobile, collapse sidebar after selection */
  if (window.innerWidth <= 900) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('expanded');
  }
}

/**
 * Switch between personal (me) and team views.
 * Only meaningful for the attendance module.
 *
 * @param {'me'|'team'} view
 */
export function switchAppView(view) {
  _currentView = view;

  const vsMe = document.getElementById('vsMe');
  const vsTeam = document.getElementById('vsTeam');
  if (vsMe) vsMe.classList.toggle('active', view === 'me');
  if (vsTeam) vsTeam.classList.toggle('active', view === 'team');

  document.dispatchEvent(new CustomEvent('blokhr:viewSwitch', { detail: { view: view } }));
}

/**
 * Load feature flags from the server and apply sidebar visibility.
 */
export async function loadFeatureFlags() {
  const data = await api.get('/api/features');
  if (!data || data._error) {
    _featureFlags = {};
    return;
  }
  _featureFlags = data.features || data || {};
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
    const flag = item.dataset.flag;
    const enabled = _featureFlags[flag] !== false && _featureFlags[flag] !== 0;
    item.classList.toggle('hidden', !enabled);
  });
}

/**
 * Toggle sidebar collapsed state.
 */
export function toggleSidebar() {
  _sbCollapsed = !_sbCollapsed;
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('collapsed', _sbCollapsed);
}

/**
 * Initialise router: bind sidebar click, view switch, mobile toggle.
 * Called once from shell.html after DOM ready.
 */
export function initRouter() {
  /* Sidebar clicks */
  const sbNav = document.getElementById('sbNav');
  if (sbNav) {
    sbNav.addEventListener('click', function (e) {
      const item = e.target.closest('.sb-item');
      if (!item || !item.dataset.module || item.classList.contains('sb-collapse')) return;
      navigateToModule(item.dataset.module);
    });
  }

  /* Sidebar collapse button */
  const collapseBtn = document.getElementById('sbCollapseBtn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar);
  }

  /* View switch buttons */
  const vsMe = document.getElementById('vsMe');
  const vsTeam = document.getElementById('vsTeam');
  if (vsMe)
    vsMe.addEventListener('click', function () {
      switchAppView('me');
    });
  if (vsTeam)
    vsTeam.addEventListener('click', function () {
      switchAppView('team');
    });

  /* Mobile sidebar toggle via logo click */
  const hdrLogo = document.getElementById('hdrLogo');
  if (hdrLogo) {
    hdrLogo.addEventListener('click', function () {
      if (window.innerWidth <= 900) {
        const sb = document.getElementById('sidebar');
        if (sb) sb.classList.toggle('expanded');
      }
    });
  }
}

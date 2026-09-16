/**
 * modules/feature_flags/feature_flags.js
 * Feature Flags admin — list and toggle tenant module switches.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { loadSession } from '../../shared/session.js';
import { loadFeatureFlags, registerModule } from '../../shared/router.js';

/** Flags that cannot be toggled off from this UI (lockout / derived). */
const PROTECTED_KEYS = new Set(['feature_flags', 'school_vertical']);

let _container = null;
let _data = [];
let _toggling = false;

export function renderFeatureFlagsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ff-wrap" id="ffWrap">' +
      '<div class="ff-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px">' +
          '<span>&#127988;</span> Feature Flags' +
        '</div>' +
        '<div class="ff-spacer"></div>' +
        '<button type="button" class="ff-btn ghost" data-action="refresh">Refresh</button>' +
      '</div>' +
      '<div id="ffStats"></div>' +
      '<div id="ffContent"></div>' +
    '</div>';
  _bindEvents(container);
  ffLoadData();
}

export async function ffLoadData() {
  const d = await api.get('/api/features?all=true');
  _data = _parseFeatures(d);
  ffRenderStats();
  ffRender();
}

function _parseFeatures(d) {
  if (!d || d._error) return [];
  if (Array.isArray(d.features)) return d.features;
  if (Array.isArray(d.flags)) return d.flags;
  return [];
}

export function ffRenderStats() {
  const el = _container && _container.querySelector('#ffStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML =
    '<div class="ff-stats">' +
      '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--accent)">' + stats.total + '</div>' +
        '<div class="ff-stat-label">Total Flags</div></div>' +
      '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--status-in)">' + stats.enabled + '</div>' +
        '<div class="ff-stat-label">Enabled</div></div>' +
      '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--tx3)">' + stats.disabled + '</div>' +
        '<div class="ff-stat-label">Disabled</div></div>' +
    '</div>';
}

function _computeStats() {
  var enabled = 0;
  _data.forEach(function (f) {
    if (f.enabled) enabled += 1;
  });
  return { total: _data.length, enabled: enabled, disabled: _data.length - enabled };
}

export function ffRender() {
  const el = _container && _container.querySelector('#ffContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML =
      '<div class="ff-empty"><div class="ff-empty-icon">&#127988;</div>' +
      '<div class="ff-empty-text">No feature flags data</div></div>';
    return;
  }

  const grouped = _groupByCategory(_data);
  const categories = Object.keys(grouped).sort();
  let html = '';

  categories.forEach(function (cat) {
    html += '<div class="ff-category">';
    html += '<div class="ff-category-title">' + _esc(_formatCategory(cat)) + '</div>';
    html += '<div class="ff-grid">';
    grouped[cat].forEach(function (item, i) {
      html += _renderCard(item, i);
    });
    html += '</div></div>';
  });

  el.innerHTML = html;
}

function _groupByCategory(items) {
  const out = {};
  items.forEach(function (item) {
    const cat = item.category || 'general';
    if (!out[cat]) out[cat] = [];
    out[cat].push(item);
  });
  Object.keys(out).forEach(function (cat) {
    out[cat].sort(function (a, b) {
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    });
  });
  return out;
}

function _formatCategory(cat) {
  return String(cat).replace(/_/g, ' ');
}

function _renderCard(item, i) {
  const key = item.key || item.feature_key || '';
  const enabled = !!item.enabled;
  const protectedFlag = PROTECTED_KEYS.has(key);
  const statusClass = enabled ? 'on' : 'off';
  const statusLabel = enabled ? 'Enabled' : 'Disabled';

  let html =
    '<div class="ff-card" style="animation-delay:' + i * 0.04 + 's" data-key="' + _esc(key) + '">' +
      '<div class="ff-card-head">' +
        '<div class="ff-card-title">' + _esc(item.label || key) + '</div>' +
        '<span class="ff-card-badge ff-badge-' + statusClass + '">' + statusLabel + '</span>' +
      '</div>';

  if (item.description) {
    html += '<div class="ff-card-desc">' + _esc(item.description) + '</div>';
  }

  html += '<div class="ff-card-meta">' + _esc(key);
  if (item.adminOnly) html += ' · Admin only';
  html += '</div>';

  html += '<div class="ff-card-actions">';
  if (protectedFlag) {
    html +=
      '<label class="ff-toggle ff-toggle-locked" title="Cannot disable the flags admin itself">' +
        '<input type="checkbox" checked disabled />' +
        '<span class="ff-toggle-track"></span>' +
      '</label>';
  } else {
    html +=
      '<label class="ff-toggle">' +
        '<input type="checkbox" data-action="toggle" data-key="' + _esc(key) + '"' +
          (enabled ? ' checked' : '') +
          (_toggling ? ' disabled' : '') +
        ' />' +
        '<span class="ff-toggle-track"></span>' +
      '</label>';
  }
  html += '</div></div>';

  return html;
}

export async function ffToggle(key, enabled) {
  if (PROTECTED_KEYS.has(key)) {
    toast('This flag cannot be toggled here', 'warn');
    return;
  }

  const session = loadSession();
  const email = session && session.email ? session.email : '';
  if (!email) {
    toast('Sign in as admin to toggle flags', 'error');
    return;
  }

  _toggling = true;
  ffRender();

  const res = await api.put('/api/features/' + encodeURIComponent(key), {
    enabled: enabled,
    email: email,
  });

  _toggling = false;

  if (!res || res._error) {
    toast((res && res.error) || 'Failed to toggle flag', 'error');
    ffLoadData();
    return;
  }

  toast((enabled ? 'Enabled' : 'Disabled') + ': ' + key, 'success');
  await ffLoadData();
  await loadFeatureFlags();
}

function _bindEvents(container) {
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="refresh"]')) {
      ffLoadData();
      return;
    }
  });

  container.addEventListener('change', function (e) {
    const input = e.target.closest('input[data-action="toggle"]');
    if (!input) return;
    const key = input.dataset.key;
    ffToggle(key, input.checked);
  });
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; _toggling = false; }

registerModule('feature_flags', renderFeatureFlagsPage);

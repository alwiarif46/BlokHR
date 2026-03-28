/**
 * modules/feature_flags/feature_flags.js
 * Feature Flags — standard CRUD module.
 * Pattern: renderFeatureFlagsPage() → ffLoadData() → ffRenderStats()
 *          → ffRender() → CRUD → ffCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "key": "org_chart",
    "label": "Org Chart",
    "enabled": true,
    "admin_only": false
  },
  {
    "key": "document_mgmt",
    "label": "Documents",
    "enabled": true,
    "admin_only": false
  },
  {
    "key": "analytics",
    "label": "Analytics",
    "enabled": true,
    "admin_only": true
  },
  {
    "key": "face_recognition",
    "label": "Face Recognition",
    "enabled": false,
    "admin_only": true
  },
  {
    "key": "iris_scan",
    "label": "Iris Scan",
    "enabled": false,
    "admin_only": true
  }
];

export function renderFeatureFlagsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ff-wrap" id="ffWrap">' +
      '<div class="ff-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127988;</span> Feature Flags</div>' +
        '<div class="ff-spacer"></div>' +
        
      '</div>' +
      '<div class="ff-stats" id="ffStats"></div>' +
      '<div id="ffContent"></div>' +
      '<div class="ff-modal" id="ffModal"><div class="ff-modal-box" id="ffModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ffLoadData();
}

export async function ffLoadData() {
  const d = await api.get('/api/features');
  _data = (d && !d._error) ? (d.flags || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  ffRenderStats();
  ffRender();
}

export function ffRenderStats() {
  const el = _container && _container.querySelector('#ffStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="ff-stats">' +
    '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="ff-stat-label">Total Flags</div></div>' +
    '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="ff-stat-label">Enabled</div></div>' +
    '<div class="ff-stat"><div class="ff-stat-num" style="color:var(--tx3)">' + stats[2] + '</div><div class="ff-stat-label">Disabled</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function ffRender() {
  const el = _container && _container.querySelector('#ffContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="ff-empty"><div class="ff-empty-icon">&#127988;</div><div class="ff-empty-text">No feature flags data</div></div>';
    return;
  }
  let html = '<div class="ff-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="ff-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="ff-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="ff-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="ff-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function ffShowForm() { /* read-only module */ }
export function ffDelete() { /* read-only module */ }

export function ffCloseModal() {
  const modal = _container && _container.querySelector('#ffModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#ffModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) ffCloseModal(); });
  const content = container.querySelector('#ffContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') ffShowForm(_data[idx]);
    else if (action === 'delete') ffDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) ffCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('feature_flags', renderFeatureFlagsPage);

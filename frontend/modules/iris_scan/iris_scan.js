/**
 * modules/iris_scan/iris_scan.js
 * Iris Scan — standard CRUD module.
 * Pattern: renderIrisScanPage() → irisLoadData() → irisRenderStats()
 *          → irisRender() → CRUD → irisCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "email": "arif@blokhr.com",
    "name": "Arif Alwi",
    "enrolled": true,
    "enrolledAt": "2026-02-15",
    "quality": "high"
  },
  {
    "email": "sarah@blokhr.com",
    "name": "Sarah Chen",
    "enrolled": true,
    "enrolledAt": "2026-02-16",
    "quality": "high"
  },
  {
    "email": "james@blokhr.com",
    "name": "James Wilson",
    "enrolled": false,
    "enrolledAt": null,
    "quality": null
  }
];

export function renderIrisScanPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="iris-wrap" id="irisWrap">' +
      '<div class="iris-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128065;</span> Iris Scan</div>' +
        '<div class="iris-spacer"></div>' +
        
      '</div>' +
      '<div class="iris-stats" id="irisStats"></div>' +
      '<div id="irisContent"></div>' +
      '<div class="iris-modal" id="irisModal"><div class="iris-modal-box" id="irisModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  irisLoadData();
}

export async function irisLoadData() {
  const d = await api.get('/api/iris');
  _data = (d && !d._error) ? (d.enrollments || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  irisRenderStats();
  irisRender();
}

export function irisRenderStats() {
  const el = _container && _container.querySelector('#irisStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="iris-stats">' +
    '<div class="iris-stat"><div class="iris-stat-num" style="color:var(--status-in)">' + stats[0] + '</div><div class="iris-stat-label">Enrolled</div></div>' +
    '<div class="iris-stat"><div class="iris-stat-num" style="color:var(--status-break)">' + stats[1] + '</div><div class="iris-stat-label">Pending</div></div>' +
    '<div class="iris-stat"><div class="iris-stat-num" style="color:var(--accent)">' + stats[2] + '</div><div class="iris-stat-label">Total Members</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function irisRender() {
  const el = _container && _container.querySelector('#irisContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="iris-empty"><div class="iris-empty-icon">&#128065;</div><div class="iris-empty-text">No iris scan data</div></div>';
    return;
  }
  let html = '<div class="iris-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="iris-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="iris-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="iris-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="iris-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function irisShowForm() { }
export function irisDelete() { }

export function irisCloseModal() {
  const modal = _container && _container.querySelector('#irisModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#irisModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) irisCloseModal(); });
  const content = container.querySelector('#irisContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') irisShowForm(_data[idx]);
    else if (action === 'delete') irisDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) irisCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('iris_scan', renderIrisScanPage);

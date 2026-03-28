/**
 * modules/analytics/analytics.js
 * Analytics & Reports — standard CRUD module.
 * Pattern: renderAnalyticsPage() → anlLoadData() → anlRenderStats()
 *          → anlRender() → CRUD → anlCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "dept": "Engineering",
    "attendance": 94,
    "avgHours": 8.5,
    "late": 3,
    "absent": 2
  },
  {
    "dept": "Design",
    "attendance": 91,
    "avgHours": 8.2,
    "late": 5,
    "absent": 1
  },
  {
    "dept": "Product",
    "attendance": 96,
    "avgHours": 8.7,
    "late": 1,
    "absent": 0
  }
];

export function renderAnalyticsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="anl-wrap" id="anlWrap">' +
      '<div class="anl-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128200;</span> Analytics & Reports</div>' +
        '<div class="anl-spacer"></div>' +
        
      '</div>' +
      '<div class="anl-stats" id="anlStats"></div>' +
      '<div id="anlContent"></div>' +
      '<div class="anl-modal" id="anlModal"><div class="anl-modal-box" id="anlModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  anlLoadData();
}

export async function anlLoadData() {
  const d = await api.get('/api/analytics/attendance');
  _data = (d && !d._error) ? (d.data || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  anlRenderStats();
  anlRender();
}

export function anlRenderStats() {
  const el = _container && _container.querySelector('#anlStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="anl-stats">' +
    '<div class="anl-stat"><div class="anl-stat-num" style="color:var(--status-in)">' + stats[0] + '</div><div class="anl-stat-label">Avg Attendance %</div></div>' +
    '<div class="anl-stat"><div class="anl-stat-num" style="color:var(--accent)">' + stats[1] + '</div><div class="anl-stat-label">Avg Hours/Day</div></div>' +
    '<div class="anl-stat"><div class="anl-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="anl-stat-label">Late Arrivals</div></div>' +
    '<div class="anl-stat"><div class="anl-stat-num" style="color:var(--status-absent)">' + stats[3] + '</div><div class="anl-stat-label">Absences</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length, _data.length];
}

export function anlRender() {
  const el = _container && _container.querySelector('#anlContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="anl-empty"><div class="anl-empty-icon">&#128200;</div><div class="anl-empty-text">No analytics & reports data</div></div>';
    return;
  }
  let html = '<div class="anl-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="anl-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="anl-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="anl-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="anl-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function anlShowForm() { /* read-only module */ }
export function anlDelete() { /* read-only module */ }

export function anlCloseModal() {
  const modal = _container && _container.querySelector('#anlModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#anlModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) anlCloseModal(); });
  const content = container.querySelector('#anlContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') anlShowForm(_data[idx]);
    else if (action === 'delete') anlDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) anlCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('analytics', renderAnalyticsPage);

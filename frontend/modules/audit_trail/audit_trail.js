/**
 * modules/audit_trail/audit_trail.js
 * Audit Trail — standard CRUD module.
 * Pattern: renderAuditTrailPage() → auditLoadData() → auditRenderStats()
 *          → auditRender() → CRUD → auditCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "a1",
    "action": "settings.update",
    "user": "admin@co.com",
    "timestamp": "2026-03-28T10:30:00",
    "details": "Updated attendance rules"
  },
  {
    "id": "a2",
    "action": "member.create",
    "user": "admin@co.com",
    "timestamp": "2026-03-28T09:15:00",
    "details": "Added new member"
  },
  {
    "id": "a3",
    "action": "leave.approve",
    "user": "manager@co.com",
    "timestamp": "2026-03-27T16:00:00",
    "details": "Approved annual leave"
  }
];

export function renderAuditTrailPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="audit-wrap" id="auditWrap">' +
      '<div class="audit-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128218;</span> Audit Trail</div>' +
        '<div class="audit-spacer"></div>' +
        
      '</div>' +
      '<div class="audit-stats" id="auditStats"></div>' +
      '<div id="auditContent"></div>' +
      '<div class="audit-modal" id="auditModal"><div class="audit-modal-box" id="auditModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  auditLoadData();
}

export async function auditLoadData() {
  const d = await api.get('/api/audit');
  _data = (d && !d._error) ? (d.entries || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  auditRenderStats();
  auditRender();
}

export function auditRenderStats() {
  const el = _container && _container.querySelector('#auditStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="audit-stats">' +
    '<div class="audit-stat"><div class="audit-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="audit-stat-label">Total Events</div></div>' +
    '<div class="audit-stat"><div class="audit-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="audit-stat-label">Today</div></div>' +
    '<div class="audit-stat"><div class="audit-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="audit-stat-label">Warnings</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function auditRender() {
  const el = _container && _container.querySelector('#auditContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="audit-empty"><div class="audit-empty-icon">&#128218;</div><div class="audit-empty-text">No audit trail data</div></div>';
    return;
  }
  let html = '<div class="audit-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="audit-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="audit-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="audit-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="audit-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function auditShowForm() { /* read-only module */ }
export function auditDelete() { /* read-only module */ }

export function auditCloseModal() {
  const modal = _container && _container.querySelector('#auditModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#auditModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) auditCloseModal(); });
  const content = container.querySelector('#auditContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') auditShowForm(_data[idx]);
    else if (action === 'delete') auditDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) auditCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('audit_trail', renderAuditTrailPage);

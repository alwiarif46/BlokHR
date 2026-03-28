/**
 * modules/time_tracking/time_tracking.js
 * Time Tracking — standard CRUD module.
 * Pattern: renderTimeTrackingPage() → ttLoadData() → ttRenderStats()
 *          → ttRender() → CRUD → ttCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "tt1",
    "project": "BlokHR Frontend",
    "task": "Module decomposition",
    "hours": 4.5,
    "date": "2026-03-28",
    "status": "completed"
  },
  {
    "id": "tt2",
    "project": "BlokHR Frontend",
    "task": "Test writing",
    "hours": 2,
    "date": "2026-03-28",
    "status": "active"
  },
  {
    "id": "tt3",
    "project": "Client Portal",
    "task": "API integration",
    "hours": 3,
    "date": "2026-03-27",
    "status": "completed"
  }
];

export function renderTimeTrackingPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="tt-wrap" id="ttWrap">' +
      '<div class="tt-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#9201;</span> Time Tracking</div>' +
        '<div class="tt-spacer"></div>' +
        '<button class="tt-btn" id="ttAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="tt-stats" id="ttStats"></div>' +
      '<div id="ttContent"></div>' +
      '<div class="tt-modal" id="ttModal"><div class="tt-modal-box" id="ttModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ttLoadData();
}

export async function ttLoadData() {
  const d = await api.get('/api/time-tracking');
  _data = (d && !d._error) ? (d.entries || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  ttRenderStats();
  ttRender();
}

export function ttRenderStats() {
  const el = _container && _container.querySelector('#ttStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="tt-stats">' +
    '<div class="tt-stat"><div class="tt-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="tt-stat-label">Total Entries</div></div>' +
    '<div class="tt-stat"><div class="tt-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="tt-stat-label">Active Timers</div></div>' +
    '<div class="tt-stat"><div class="tt-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="tt-stat-label">Projects</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function ttRender() {
  const el = _container && _container.querySelector('#ttContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="tt-empty"><div class="tt-empty-icon">&#9201;</div><div class="tt-empty-text">No time tracking data</div></div>';
    return;
  }
  let html = '<div class="tt-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="tt-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="tt-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="tt-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="tt-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="tt-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function ttShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#ttModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="tt-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Time</div>' +
    '<div class="tt-field"><label>Project *</label><input type="text" id="ttF_project" value="' + _esc((item && item.project) || '') + '"></div>' +
    '<div class="tt-field"><label>Task</label><input type="text" id="ttF_task" value="' + _esc((item && item.task) || '') + '"></div>' +
    '<div class="tt-field"><label>Hours</label><input type="number" id="ttF_hours" value="' + _esc((item && item.hours) || '') + '"></div>' +
    '<div class="tt-form-actions"><button class="tt-btn ghost" data-action="close-modal">Cancel</button><button class="tt-btn" id="ttSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#ttModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#ttSaveBtn').addEventListener('click', function () {
    toast('Time ' + (isEdit ? 'updated' : 'created') + ' (demo)', 'success');
    ttCloseModal();
    ttRender();
  });
}

export async function ttDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/time-tracking/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); ttLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  ttRenderStats();
  ttRender();
}

export function ttCloseModal() {
  const modal = _container && _container.querySelector('#ttModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#ttAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { ttShowForm(null); });
  const modal = container.querySelector('#ttModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) ttCloseModal(); });
  const content = container.querySelector('#ttContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') ttShowForm(_data[idx]);
    else if (action === 'delete') ttDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) ttCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('time_tracking', renderTimeTrackingPage);

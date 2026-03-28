/**
 * modules/leave_policies/leave_policies.js
 * Leave Policies — standard CRUD module.
 * Pattern: renderLeavePoliciesPage() → lpLoadData() → lpRenderStats()
 *          → lpRender() → CRUD → lpCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "lp1",
    "name": "Annual Leave",
    "maxPerYear": 18,
    "paid": true,
    "canAccrue": true,
    "active": true
  },
  {
    "id": "lp2",
    "name": "Sick Leave",
    "maxPerYear": 12,
    "paid": true,
    "canAccrue": false,
    "active": true
  },
  {
    "id": "lp3",
    "name": "Casual Leave",
    "maxPerYear": 7,
    "paid": true,
    "canAccrue": false,
    "active": true
  },
  {
    "id": "lp4",
    "name": "Unpaid Leave",
    "maxPerYear": 30,
    "paid": false,
    "canAccrue": false,
    "active": true
  }
];

export function renderLeavePoliciesPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="lp-wrap" id="lpWrap">' +
      '<div class="lp-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128220;</span> Leave Policies</div>' +
        '<div class="lp-spacer"></div>' +
        '<button class="lp-btn" id="lpAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="lp-stats" id="lpStats"></div>' +
      '<div id="lpContent"></div>' +
      '<div class="lp-modal" id="lpModal"><div class="lp-modal-box" id="lpModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  lpLoadData();
}

export async function lpLoadData() {
  const d = await api.get('/api/leave-policies');
  _data = (d && !d._error) ? (d.policies || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  lpRenderStats();
  lpRender();
}

export function lpRenderStats() {
  const el = _container && _container.querySelector('#lpStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="lp-stats">' +
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="lp-stat-label">Total Policies</div></div>' +
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="lp-stat-label">Active</div></div>' +
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--tx3)">' + stats[2] + '</div><div class="lp-stat-label">Inactive</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function lpRender() {
  const el = _container && _container.querySelector('#lpContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="lp-empty"><div class="lp-empty-icon">&#128220;</div><div class="lp-empty-text">No leave policies data</div></div>';
    return;
  }
  let html = '<div class="lp-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="lp-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="lp-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="lp-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="lp-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="lp-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function lpShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#lpModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="lp-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Leave</div>' +
    '<div class="lp-field"><label>Policy Name *</label><input type="text" id="lpF_name" value="' + _esc((item && item.name) || '') + '"></div>' +
    '<div class="lp-field"><label>Max Per Year</label><input type="number" id="lpF_maxPerYear" value="' + _esc((item && item.maxPerYear) || '') + '"></div>' +
    '<div class="lp-field"><label>Paid</label><input type="toggle" id="lpF_paid" value="' + _esc((item && item.paid) || '') + '"></div>' +
    '<div class="lp-field"><label>Can Accrue</label><input type="toggle" id="lpF_canAccrue" value="' + _esc((item && item.canAccrue) || '') + '"></div>' +
    '<div class="lp-form-actions"><button class="lp-btn ghost" data-action="close-modal">Cancel</button><button class="lp-btn" id="lpSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#lpModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#lpSaveBtn').addEventListener('click', function () {
    toast('Leave ' + (isEdit ? 'updated' : 'created') + ' (demo)', 'success');
    lpCloseModal();
    lpRender();
  });
}

export async function lpDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/leave-policies/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); lpLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  lpRenderStats();
  lpRender();
}

export function lpCloseModal() {
  const modal = _container && _container.querySelector('#lpModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#lpAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { lpShowForm(null); });
  const modal = container.querySelector('#lpModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) lpCloseModal(); });
  const content = container.querySelector('#lpContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') lpShowForm(_data[idx]);
    else if (action === 'delete') lpDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) lpCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('leave_policies', renderLeavePoliciesPage);

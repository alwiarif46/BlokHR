/**
 * modules/workflows/workflows.js
 * Workflows — standard CRUD module.
 * Pattern: renderWorkflowsPage() → wfLoadData() → wfRenderStats()
 *          → wfRender() → CRUD → wfCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "wf1",
    "name": "Employee Onboarding",
    "steps": 5,
    "instances": 3,
    "status": "active",
    "lastRun": "2026-03-27"
  },
  {
    "id": "wf2",
    "name": "Leave Approval",
    "steps": 2,
    "instances": 8,
    "status": "active",
    "lastRun": "2026-03-28"
  },
  {
    "id": "wf3",
    "name": "Expense Reimbursement",
    "steps": 3,
    "instances": 4,
    "status": "active",
    "lastRun": "2026-03-26"
  },
  {
    "id": "wf4",
    "name": "Asset Requisition",
    "steps": 4,
    "instances": 1,
    "status": "active",
    "lastRun": "2026-03-20"
  }
];

export function renderWorkflowsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="wf-wrap" id="wfWrap">' +
      '<div class="wf-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#9881;</span> Workflows</div>' +
        '<div class="wf-spacer"></div>' +
        '<button class="wf-btn" id="wfAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="wf-stats" id="wfStats"></div>' +
      '<div id="wfContent"></div>' +
      '<div class="wf-modal" id="wfModal"><div class="wf-modal-box" id="wfModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  wfLoadData();
}

export async function wfLoadData() {
  const d = await api.get('/api/workflows');
  _data = (d && !d._error) ? (d.workflows || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  wfRenderStats();
  wfRender();
}

export function wfRenderStats() {
  const el = _container && _container.querySelector('#wfStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="wf-stats">' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="wf-stat-label">Workflows</div></div>' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="wf-stat-label">Active Instances</div></div>' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="wf-stat-label">Completed</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function wfRender() {
  const el = _container && _container.querySelector('#wfContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="wf-empty"><div class="wf-empty-icon">&#9881;</div><div class="wf-empty-text">No workflows data</div></div>';
    return;
  }
  let html = '<div class="wf-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="wf-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="wf-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="wf-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="wf-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="wf-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function wfShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="wf-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="wf-field"><label>Workflow Name *</label><input type="text" id="wfF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="wf-field"><label>Number of Steps</label><input type="number" id="wfF_steps" value="' + _esc(String((item && item.steps) || '')) + '"></div>' +
    '<div class="wf-form-actions"><button class="wf-btn ghost" data-action="close-modal">Cancel</button><button class="wf-btn" id="wfSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#wfModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#wfSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    wfCloseModal();
    wfRender();
  });
}

export async function wfDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/workflows/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); wfLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  wfRenderStats();
  wfRender();
}

export function wfCloseModal() {
  const modal = _container && _container.querySelector('#wfModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#wfAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { wfShowForm(null); });
  const modal = container.querySelector('#wfModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) wfCloseModal(); });
  const content = container.querySelector('#wfContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') wfShowForm(_data[idx]);
    else if (action === 'delete') wfDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) wfCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('workflows', renderWorkflowsPage);

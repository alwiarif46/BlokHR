/**
 * modules/org_chart/org_chart.js
 * Org Chart — standard CRUD module.
 * Pattern: renderOrgChartPage() → ocLoadData() → ocRenderStats()
 *          → ocRender() → CRUD → ocCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "d1",
    "name": "Engineering",
    "head": "Arif Alwi",
    "members": 12,
    "positions": 5
  },
  {
    "id": "d2",
    "name": "Design",
    "head": "Priya Sharma",
    "members": 4,
    "positions": 3
  },
  {
    "id": "d3",
    "name": "Product",
    "head": "Sarah Chen",
    "members": 3,
    "positions": 2
  },
  {
    "id": "d4",
    "name": "HR",
    "head": "Maya Patel",
    "members": 2,
    "positions": 2
  }
];

export function renderOrgChartPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="oc-wrap" id="ocWrap">' +
      '<div class="oc-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127963;</span> Org Chart</div>' +
        '<div class="oc-spacer"></div>' +
        '<button class="oc-btn" id="ocAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="oc-stats" id="ocStats"></div>' +
      '<div id="ocContent"></div>' +
      '<div class="oc-modal" id="ocModal"><div class="oc-modal-box" id="ocModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ocLoadData();
}

export async function ocLoadData() {
  const d = await api.get('/api/org');
  _data = (d && !d._error) ? (d.departments || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  ocRenderStats();
  ocRender();
}

export function ocRenderStats() {
  const el = _container && _container.querySelector('#ocStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="oc-stats">' +
    '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="oc-stat-label">Departments</div></div>' +
    '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="oc-stat-label">Positions</div></div>' +
    '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="oc-stat-label">Members</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function ocRender() {
  const el = _container && _container.querySelector('#ocContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="oc-empty"><div class="oc-empty-icon">&#127963;</div><div class="oc-empty-text">No org chart data</div></div>';
    return;
  }
  let html = '<div class="oc-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="oc-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="oc-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="oc-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="oc-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="oc-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function ocShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="oc-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="oc-field"><label>Department Name *</label><input type="text" id="ocF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="oc-field"><label>Department Head</label><input type="text" id="ocF_head" value="' + _esc(String((item && item.head) || '')) + '"></div>' +
    '<div class="oc-form-actions"><button class="oc-btn ghost" data-action="close-modal">Cancel</button><button class="oc-btn" id="ocSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#ocModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#ocSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    ocCloseModal();
    ocRender();
  });
}

export async function ocDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/org/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); ocLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  ocRenderStats();
  ocRender();
}

export function ocCloseModal() {
  const modal = _container && _container.querySelector('#ocModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#ocAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { ocShowForm(null); });
  const modal = container.querySelector('#ocModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) ocCloseModal(); });
  const content = container.querySelector('#ocContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') ocShowForm(_data[idx]);
    else if (action === 'delete') ocDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) ocCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('org_chart', renderOrgChartPage);

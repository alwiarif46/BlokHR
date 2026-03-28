/**
 * modules/training/training.js
 * Training & LMS — standard CRUD module.
 * Pattern: renderTrainingPage() → trnLoadData() → trnRenderStats()
 *          → trnRender() → CRUD → trnCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "t1",
    "name": "Workplace Safety",
    "modules": 5,
    "enrolled": 45,
    "completed": 38,
    "status": "active",
    "mandatory": true
  },
  {
    "id": "t2",
    "name": "Data Privacy & GDPR",
    "modules": 3,
    "enrolled": 45,
    "completed": 42,
    "status": "active",
    "mandatory": true
  },
  {
    "id": "t3",
    "name": "Leadership Essentials",
    "modules": 8,
    "enrolled": 12,
    "completed": 5,
    "status": "active",
    "mandatory": false
  },
  {
    "id": "t4",
    "name": "Advanced Excel",
    "modules": 6,
    "enrolled": 20,
    "completed": 15,
    "status": "active",
    "mandatory": false
  }
];

export function renderTrainingPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="trn-wrap" id="trnWrap">' +
      '<div class="trn-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127891;</span> Training & LMS</div>' +
        '<div class="trn-spacer"></div>' +
        '<button class="trn-btn" id="trnAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="trn-stats" id="trnStats"></div>' +
      '<div id="trnContent"></div>' +
      '<div class="trn-modal" id="trnModal"><div class="trn-modal-box" id="trnModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  trnLoadData();
}

export async function trnLoadData() {
  const d = await api.get('/api/training');
  _data = (d && !d._error) ? (d.courses || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  trnRenderStats();
  trnRender();
}

export function trnRenderStats() {
  const el = _container && _container.querySelector('#trnStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="trn-stats">' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="trn-stat-label">Courses</div></div>' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="trn-stat-label">Enrolled</div></div>' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="trn-stat-label">Completed</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function trnRender() {
  const el = _container && _container.querySelector('#trnContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="trn-empty"><div class="trn-empty-icon">&#127891;</div><div class="trn-empty-text">No training & lms data</div></div>';
    return;
  }
  let html = '<div class="trn-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="trn-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="trn-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="trn-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="trn-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="trn-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function trnShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#trnModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="trn-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="trn-field"><label>Course Name *</label><input type="text" id="trnF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="trn-field"><label>Number of Modules</label><input type="number" id="trnF_modules" value="' + _esc(String((item && item.modules) || '')) + '"></div>' +
    '<div class="trn-field"><label><input type="checkbox" id="trnF_mandatory"' + (item && item.mandatory ? ' checked' : '') + '> Mandatory</label></div>' +
    '<div class="trn-form-actions"><button class="trn-btn ghost" data-action="close-modal">Cancel</button><button class="trn-btn" id="trnSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#trnModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#trnSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    trnCloseModal();
    trnRender();
  });
}

export async function trnDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/training/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); trnLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  trnRenderStats();
  trnRender();
}

export function trnCloseModal() {
  const modal = _container && _container.querySelector('#trnModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#trnAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { trnShowForm(null); });
  const modal = container.querySelector('#trnModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) trnCloseModal(); });
  const content = container.querySelector('#trnContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') trnShowForm(_data[idx]);
    else if (action === 'delete') trnDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) trnCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('training', renderTrainingPage);

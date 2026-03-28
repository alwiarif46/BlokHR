/**
 * modules/overtime/overtime.js
 * Overtime — standard CRUD module.
 * Pattern: renderOvertimePage() → otLoadData() → otRenderStats()
 *          → otRender() → CRUD → otCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "ot1",
    "name": "Arif Alwi",
    "date": "2026-03-27",
    "hours": 2.5,
    "reason": "Sprint deadline",
    "status": "pending"
  },
  {
    "id": "ot2",
    "name": "Sarah Chen",
    "date": "2026-03-26",
    "hours": 1.5,
    "reason": "Client demo prep",
    "status": "approved"
  },
  {
    "id": "ot3",
    "name": "Dev Krishnan",
    "date": "2026-03-25",
    "hours": 3,
    "reason": "Production hotfix",
    "status": "approved"
  }
];

export function renderOvertimePage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ot-wrap" id="otWrap">' +
      '<div class="ot-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#9203;</span> Overtime</div>' +
        '<div class="ot-spacer"></div>' +
        '<button class="ot-btn" id="otAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="ot-stats" id="otStats"></div>' +
      '<div id="otContent"></div>' +
      '<div class="ot-modal" id="otModal"><div class="ot-modal-box" id="otModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  otLoadData();
}

export async function otLoadData() {
  const d = await api.get('/api/overtime');
  _data = (d && !d._error) ? (d.requests || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  otRenderStats();
  otRender();
}

export function otRenderStats() {
  const el = _container && _container.querySelector('#otStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="ot-stats">' +
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--status-break)">' + stats[0] + '</div><div class="ot-stat-label">Pending</div></div>' +
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="ot-stat-label">Approved</div></div>' +
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--accent)">' + stats[2] + '</div><div class="ot-stat-label">Total Hours</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function otRender() {
  const el = _container && _container.querySelector('#otContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="ot-empty"><div class="ot-empty-icon">&#9203;</div><div class="ot-empty-text">No overtime data</div></div>';
    return;
  }
  let html = '<div class="ot-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="ot-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="ot-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="ot-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="ot-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="ot-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function otShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#otModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ot-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Overtime</div>' +
    '<div class="ot-field"><label>Date *</label><input type="date" id="otF_date" value="' + _esc((item && item.date) || '') + '"></div>' +
    '<div class="ot-field"><label>Hours *</label><input type="number" id="otF_hours" value="' + _esc((item && item.hours) || '') + '"></div>' +
    '<div class="ot-field"><label>Reason *</label><textarea id="otF_reason">' + _esc((item && item.reason) || '') + '</textarea></div>' +
    '<div class="ot-form-actions"><button class="ot-btn ghost" data-action="close-modal">Cancel</button><button class="ot-btn" id="otSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#otModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#otSaveBtn').addEventListener('click', function () {
    toast('Overtime ' + (isEdit ? 'updated' : 'created') + ' (demo)', 'success');
    otCloseModal();
    otRender();
  });
}

export async function otDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/overtime/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); otLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  otRenderStats();
  otRender();
}

export function otCloseModal() {
  const modal = _container && _container.querySelector('#otModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#otAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { otShowForm(null); });
  const modal = container.querySelector('#otModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) otCloseModal(); });
  const content = container.querySelector('#otContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') otShowForm(_data[idx]);
    else if (action === 'delete') otDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) otCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('overtime', renderOvertimePage);

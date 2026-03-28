/**
 * modules/visitors/visitors.js
 * Visitor Management — standard CRUD module.
 * Pattern: renderVisitorsPage() → visLoadData() → visRenderStats()
 *          → visRender() → CRUD → visCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "v1",
    "name": "Rahul Verma",
    "company": "TechCorp",
    "host": "Arif Alwi",
    "purpose": "Client meeting",
    "checkIn": "2026-03-28T10:00:00",
    "checkOut": null,
    "status": "checked_in"
  },
  {
    "id": "v2",
    "name": "Lisa Wong",
    "company": "DesignStudio",
    "host": "Priya Sharma",
    "purpose": "Portfolio review",
    "checkIn": "2026-03-28T14:00:00",
    "checkOut": null,
    "status": "expected"
  },
  {
    "id": "v3",
    "name": "Mike Johnson",
    "company": "AuditFirm",
    "host": "Maya Patel",
    "purpose": "Annual audit",
    "checkIn": "2026-03-27T09:30:00",
    "checkOut": "2026-03-27T17:00:00",
    "status": "checked_out"
  }
];

export function renderVisitorsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="vis-wrap" id="visWrap">' +
      '<div class="vis-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128100;</span> Visitor Management</div>' +
        '<div class="vis-spacer"></div>' +
        '<button class="vis-btn" id="visAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="vis-stats" id="visStats"></div>' +
      '<div id="visContent"></div>' +
      '<div class="vis-modal" id="visModal"><div class="vis-modal-box" id="visModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  visLoadData();
}

export async function visLoadData() {
  const d = await api.get('/api/visitors');
  _data = (d && !d._error) ? (d.visitors || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  visRenderStats();
  visRender();
}

export function visRenderStats() {
  const el = _container && _container.querySelector('#visStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="vis-stats">' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="vis-stat-label">Today</div></div>' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="vis-stat-label">Checked In</div></div>' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="vis-stat-label">Upcoming</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function visRender() {
  const el = _container && _container.querySelector('#visContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="vis-empty"><div class="vis-empty-icon">&#128100;</div><div class="vis-empty-text">No visitor management data</div></div>';
    return;
  }
  let html = '<div class="vis-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="vis-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="vis-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="vis-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="vis-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="vis-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function visShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="vis-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="vis-field"><label>Visitor Name *</label><input type="text" id="visF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="vis-field"><label>Company</label><input type="text" id="visF_company" value="' + _esc(String((item && item.company) || '')) + '"></div>' +
    '<div class="vis-field"><label>Host *</label><input type="text" id="visF_host" value="' + _esc(String((item && item.host) || '')) + '"></div>' +
    '<div class="vis-field"><label>Purpose</label><textarea id="visF_purpose">' + _esc((item && item.purpose) || '') + '</textarea></div>' +
    '<div class="vis-form-actions"><button class="vis-btn ghost" data-action="close-modal">Cancel</button><button class="vis-btn" id="visSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#visModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#visSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    visCloseModal();
    visRender();
  });
}

export async function visDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/visitors/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); visLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  visRenderStats();
  visRender();
}

export function visCloseModal() {
  const modal = _container && _container.querySelector('#visModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#visAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { visShowForm(null); });
  const modal = container.querySelector('#visModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) visCloseModal(); });
  const content = container.querySelector('#visContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') visShowForm(_data[idx]);
    else if (action === 'delete') visDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) visCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('visitors', renderVisitorsPage);

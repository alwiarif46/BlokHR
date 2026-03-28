/**
 * modules/holidays/holidays.js
 * Holiday Calendar — standard CRUD module.
 * Pattern: renderHolidaysPage() → holLoadData() → holRenderStats()
 *          → holRender() → CRUD → holCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "h1",
    "name": "Republic Day",
    "date": "2026-01-26",
    "type": "gazetted",
    "day": "Monday"
  },
  {
    "id": "h2",
    "name": "Holi",
    "date": "2026-03-17",
    "type": "gazetted",
    "day": "Tuesday"
  },
  {
    "id": "h3",
    "name": "Good Friday",
    "date": "2026-04-03",
    "type": "restricted",
    "day": "Friday"
  },
  {
    "id": "h4",
    "name": "Independence Day",
    "date": "2026-08-15",
    "type": "gazetted",
    "day": "Saturday"
  },
  {
    "id": "h5",
    "name": "Diwali",
    "date": "2026-11-08",
    "type": "gazetted",
    "day": "Sunday"
  }
];

export function renderHolidaysPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="hol-wrap" id="holWrap">' +
      '<div class="hol-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127882;</span> Holiday Calendar</div>' +
        '<div class="hol-spacer"></div>' +
        '<button class="hol-btn" id="holAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="hol-stats" id="holStats"></div>' +
      '<div id="holContent"></div>' +
      '<div class="hol-modal" id="holModal"><div class="hol-modal-box" id="holModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  holLoadData();
}

export async function holLoadData() {
  const d = await api.get('/api/holidays');
  _data = (d && !d._error) ? (d.holidays || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  holRenderStats();
  holRender();
}

export function holRenderStats() {
  const el = _container && _container.querySelector('#holStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="hol-stats">' +
    '<div class="hol-stat"><div class="hol-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="hol-stat-label">Total Holidays</div></div>' +
    '<div class="hol-stat"><div class="hol-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="hol-stat-label">Upcoming</div></div>' +
    '<div class="hol-stat"><div class="hol-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="hol-stat-label">Restricted</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function holRender() {
  const el = _container && _container.querySelector('#holContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="hol-empty"><div class="hol-empty-icon">&#127882;</div><div class="hol-empty-text">No holiday calendar data</div></div>';
    return;
  }
  let html = '<div class="hol-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="hol-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="hol-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="hol-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="hol-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="hol-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function holShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#holModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="hol-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Holiday</div>' +
    '<div class="hol-field"><label>Holiday Name *</label><input type="text" id="holF_name" value="' + _esc((item && item.name) || '') + '"></div>' +
    '<div class="hol-field"><label>Date *</label><input type="date" id="holF_date" value="' + _esc((item && item.date) || '') + '"></div>' +
    '<div class="hol-field"><label>Type</label><select id="holF_type"><option value="gazetted">gazetted</option><option value="restricted">restricted</option><option value="optional">optional</option></select></div>' +
    '<div class="hol-form-actions"><button class="hol-btn ghost" data-action="close-modal">Cancel</button><button class="hol-btn" id="holSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#holModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#holSaveBtn').addEventListener('click', function () {
    toast('Holiday ' + (isEdit ? 'updated' : 'created') + ' (demo)', 'success');
    holCloseModal();
    holRender();
  });
}

export async function holDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/holidays/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); holLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  holRenderStats();
  holRender();
}

export function holCloseModal() {
  const modal = _container && _container.querySelector('#holModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#holAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { holShowForm(null); });
  const modal = container.querySelector('#holModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) holCloseModal(); });
  const content = container.querySelector('#holContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') holShowForm(_data[idx]);
    else if (action === 'delete') holDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) holCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('holidays', renderHolidaysPage);

/**
 * modules/holidays/holidays.js
 * Holiday Calendar — standard CRUD module.
 * Pattern: renderHolidaysPage() → holLoadData() → holRenderStats()
 *          → holRender() → CRUD → holCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];


export function renderHolidaysPage(container) {
  _container = container;
  const isAdmin = _isAdmin();
  container.innerHTML =
    '<div class="hol-wrap" id="holWrap">' +
      '<div class="hol-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127882;</span> Holiday Calendar</div>' +
        '<div class="hol-spacer"></div>' +
        (isAdmin
          ? '<button class="hol-btn ghost" type="button" id="holImportBtn">Import Excel</button>' +
            '<input type="file" id="holImportFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>'
          : '') +
        (isAdmin ? '<button class="hol-btn" id="holAddBtn">+ Add</button>' : '') +
      '</div>' +
      '<div class="hol-stats" id="holStats"></div>' +
      '<div id="holContent"></div>' +
      '<div class="hol-modal" id="holModal"><div class="hol-modal-box" id="holModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  holLoadData();
}

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

export async function holLoadData() {
  const year = new Date().getFullYear();
  const d = await api.get('/api/holidays?year=' + year);
  _data = (d && !d._error) ? (d.holidays || d || []) : [];
  if (!Array.isArray(_data)) _data = [];
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
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = _data.filter(function (h) { return h.date && h.date >= today; }).length;
  const restricted = _data.filter(function (h) { return h.type === 'restricted'; }).length;
  return [_data.length, upcoming, restricted];
}

export function holRender() {
  const el = _container && _container.querySelector('#holContent');
  if (!el) return;
  const isAdmin = _isAdmin();
  if (!_data.length) {
    el.innerHTML = '<div class="hol-empty"><div class="hol-empty-icon">&#127882;</div><div class="hol-empty-text">No holiday calendar data</div></div>';
    return;
  }
  let html = '<div class="hol-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="hol-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="hol-card-title">' + _esc(item.name || item.label || 'Item ' + (i + 1)) + '</div>';
    html += '<div class="hol-card-sub">' + _esc((item.date || '') + (item.type ? ' · ' + item.type : '')) + '</div>';
    if (item.type) html += '<span class="hol-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.type) + '</span>';
    if (isAdmin) {
      html += '<div class="hol-card-actions">';
      html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
      html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function holShowForm(item) {
  if (!_isAdmin()) return;
  const isEdit = !!item;
  const box = _container && _container.querySelector('#holModalBox');
  if (!box) return;
  const type = (item && item.type) || 'mandatory';
  const mapped = type === 'mandatory' ? 'gazetted' : type;
  box.innerHTML =
    '<div class="hol-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Holiday</div>' +
    '<div class="hol-field"><label>Holiday Name *</label><input type="text" id="holF_name" value="' + _esc((item && item.name) || '') + '"></div>' +
    '<div class="hol-field"><label>Date *</label><input type="date" id="holF_date" value="' + _esc((item && item.date) || '') + '"></div>' +
    '<div class="hol-field"><label>Type</label><select id="holF_type">' +
      '<option value="gazetted"' + (mapped === 'gazetted' ? ' selected' : '') + '>gazetted</option>' +
      '<option value="restricted"' + (mapped === 'restricted' ? ' selected' : '') + '>restricted</option>' +
      '<option value="optional"' + (mapped === 'optional' ? ' selected' : '') + '>optional</option>' +
    '</select></div>' +
    '<div class="hol-form-actions"><button class="hol-btn ghost" data-action="close-modal">Cancel</button><button class="hol-btn" id="holSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#holModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#holSaveBtn').addEventListener('click', function () {
    holSave(item);
  });
}

async function holSave(item) {
  const name = (_container.querySelector('#holF_name') || {}).value || '';
  const date = (_container.querySelector('#holF_date') || {}).value || '';
  let type = (_container.querySelector('#holF_type') || {}).value || 'gazetted';
  if (type === 'gazetted') type = 'mandatory';
  if (!name.trim() || !date) {
    toast('Name and date are required', 'error');
    return;
  }
  let result;
  if (item && item.id) {
    result = await api.put('/api/holidays/' + item.id, { name: name.trim(), date, type });
  } else {
    result = await api.post('/api/holidays', { name: name.trim(), date, type });
  }
  if (result && !result._error && (result.success !== false)) {
    toast(item ? 'Updated' : 'Created', 'success');
    holCloseModal();
    holLoadData();
    return;
  }
  toast((result && (result.message || result.error)) || 'Failed to save', 'error');
}

export async function holDelete(idx) {
  if (!_isAdmin()) return;
  if (!confirm('Delete this holiday?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/holidays/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); holLoadData(); return; }
  toast((result && result.message) || 'Failed', 'error');
}

export function holCloseModal() {
  const modal = _container && _container.querySelector('#holModal');
  if (modal) modal.classList.remove('open');
}

function _readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = function () { reject(new Error('Could not read file')); };
    reader.readAsDataURL(file);
  });
}

export async function holImportFile(file) {
  if (!_isAdmin()) {
    toast('Admin access required', 'error');
    return;
  }
  if (!file) return;
  const name = (file.name || '').toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(name)) {
    toast('Use an .xlsx, .xls, or .csv file', 'error');
    return;
  }
  try {
    const contentBase64 = await _readFileAsBase64(file);
    const result = await api.post('/api/holidays/import', {
      filename: file.name,
      contentBase64: contentBase64,
    });
    if (result && !result._error && result.success) {
      const parts = [];
      if (result.created) parts.push(result.created + ' created');
      if (result.skipped) parts.push(result.skipped + ' skipped');
      if (result.errors && result.errors.length) parts.push(result.errors.length + ' errors');
      toast(parts.length ? 'Import: ' + parts.join(', ') : 'Import complete', 'success');
      holLoadData();
      return;
    }
    toast((result && (result.message || result.error)) || 'Import failed', 'error');
  } catch (err) {
    toast((err && err.message) || 'Import failed', 'error');
  }
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#holAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { holShowForm(null); });

  const importBtn = container.querySelector('#holImportBtn');
  const importFile = container.querySelector('#holImportFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function () {
      const file = importFile.files && importFile.files[0];
      importFile.value = '';
      if (file) holImportFile(file);
    });
  }

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

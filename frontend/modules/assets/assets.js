/**
 * modules/assets/assets.js
 * Asset Management — standard CRUD module.
 * Pattern: renderAssetsPage() → astLoadData() → astRenderStats()
 *          → astRender() → CRUD → astCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];


export function renderAssetsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ast-wrap" id="astWrap">' +
      '<div class="ast-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128187;</span> Asset Management</div>' +
        '<div class="ast-spacer"></div>' +
        '<button class="ast-btn" id="astAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="ast-stats" id="astStats"></div>' +
      '<div id="astContent"></div>' +
      '<div class="ast-modal" id="astModal"><div class="ast-modal-box" id="astModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  astLoadData();
}

export async function astLoadData() {
  const d = await api.get('/api/assets');
  _data = (d && !d._error) ? (d.assets || d || []) : [];
  if (!Array.isArray(_data)) _data = [];
  astRenderStats();
  astRender();
}

export function astRenderStats() {
  const el = _container && _container.querySelector('#astStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="ast-stats">' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="ast-stat-label">Total Assets</div></div>' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="ast-stat-label">Assigned</div></div>' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="ast-stat-label">In Maintenance</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function astRender() {
  const el = _container && _container.querySelector('#astContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="ast-empty"><div class="ast-empty-icon">&#128187;</div><div class="ast-empty-text">No asset management data</div></div>';
    return;
  }
  let html = '<div class="ast-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="ast-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="ast-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="ast-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="ast-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="ast-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function astShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ast-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="ast-field"><label>Asset Name *</label><input type="text" id="astF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="ast-field"><label>Type</label><select id="astF_type"><option value="Laptop">Laptop</option><option value="Monitor">Monitor</option><option value="Mobile">Mobile</option><option value="Furniture">Furniture</option><option value="Other">Other</option></select></div>' +
    '<div class="ast-field"><label>Serial Number</label><input type="text" id="astF_serial" value="' + _esc(String((item && item.serial) || '')) + '"></div>' +
    '<div class="ast-form-actions"><button class="ast-btn ghost" data-action="close-modal">Cancel</button><button class="ast-btn" id="astSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#astModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#astSaveBtn').addEventListener('click', function () {
    toast('Failed to save', 'error');
  });
}

export async function astDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/assets/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); astLoadData(); return; }
  toast((result && result.message) || 'Failed', 'error');
}

export function astCloseModal() {
  const modal = _container && _container.querySelector('#astModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#astAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { astShowForm(null); });
  const modal = container.querySelector('#astModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) astCloseModal(); });
  const content = container.querySelector('#astContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') astShowForm(_data[idx]);
    else if (action === 'delete') astDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) astCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('assets', renderAssetsPage);

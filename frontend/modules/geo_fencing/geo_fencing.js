/**
 * modules/geo_fencing/geo_fencing.js
 * Geo-Fencing — standard CRUD module.
 * Pattern: renderGeoFencingPage() → geoLoadData() → geoRenderStats()
 *          → geoRender() → CRUD → geoCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];


export function renderGeoFencingPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="geo-wrap" id="geoWrap">' +
      '<div class="geo-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128205;</span> Geo-Fencing</div>' +
        '<div class="geo-spacer"></div>' +
        '<button class="geo-btn" id="geoAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="geo-stats" id="geoStats"></div>' +
      '<div id="geoContent"></div>' +
      '<div class="geo-modal" id="geoModal"><div class="geo-modal-box" id="geoModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  geoLoadData();
}

export async function geoLoadData() {
  const d = await api.get('/api/geo');
  _data = (d && !d._error) ? (d.zones || d || []) : [];
  if (!Array.isArray(_data)) _data = [];
  geoRenderStats();
  geoRender();
}

export function geoRenderStats() {
  const el = _container && _container.querySelector('#geoStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="geo-stats">' +
    '<div class="geo-stat"><div class="geo-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="geo-stat-label">Zones</div></div>' +
    '<div class="geo-stat"><div class="geo-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="geo-stat-label">Active</div></div>' +
    '<div class="geo-stat"><div class="geo-stat-num" style="color:var(--status-absent)">' + stats[2] + '</div><div class="geo-stat-label">Violations Today</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function geoRender() {
  const el = _container && _container.querySelector('#geoContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="geo-empty"><div class="geo-empty-icon">&#128205;</div><div class="geo-empty-text">No geo-fencing data</div></div>';
    return;
  }
  let html = '<div class="geo-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="geo-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="geo-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="geo-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="geo-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="geo-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function geoShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#geoModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="geo-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="geo-field"><label>Zone Name *</label><input type="text" id="geoF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="geo-field"><label>Latitude</label><input type="number" id="geoF_lat" value="' + _esc(String((item && item.lat) || '')) + '"></div>' +
    '<div class="geo-field"><label>Longitude</label><input type="number" id="geoF_lng" value="' + _esc(String((item && item.lng) || '')) + '"></div>' +
    '<div class="geo-field"><label>Radius (meters)</label><input type="number" id="geoF_radius" value="' + _esc(String((item && item.radius) || '')) + '"></div>' +
    '<div class="geo-form-actions"><button class="geo-btn ghost" data-action="close-modal">Cancel</button><button class="geo-btn" id="geoSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#geoModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#geoSaveBtn').addEventListener('click', function () {
    toast('Failed to save', 'error');
  });
}

export async function geoDelete(idx) {
  if (!(await confirmDialog({ message: 'Delete this item?', confirmLabel: 'Delete', danger: true }))) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/geo/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); geoLoadData(); return; }
  toast((result && result.message) || 'Failed', 'error');
}

export function geoCloseModal() {
  const modal = _container && _container.querySelector('#geoModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#geoAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { geoShowForm(null); });
  const modal = container.querySelector('#geoModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) geoCloseModal(); });
  const content = container.querySelector('#geoContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') geoShowForm(_data[idx]);
    else if (action === 'delete') geoDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) geoCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('geo_fencing', renderGeoFencingPage);

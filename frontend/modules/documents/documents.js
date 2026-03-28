/**
 * modules/documents/documents.js
 * Document Management — standard CRUD module.
 * Pattern: renderDocumentsPage() → docLoadData() → docRenderStats()
 *          → docRender() → CRUD → docCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "doc1",
    "name": "Employee Handbook 2026",
    "type": "policy",
    "category": "HR",
    "uploadedBy": "Admin",
    "date": "2026-01-15",
    "size": "2.4 MB"
  },
  {
    "id": "doc2",
    "name": "Leave Policy",
    "type": "policy",
    "category": "HR",
    "uploadedBy": "Admin",
    "date": "2026-02-01",
    "size": "840 KB"
  },
  {
    "id": "doc3",
    "name": "Offer Letter Template",
    "type": "template",
    "category": "Recruitment",
    "uploadedBy": "Admin",
    "date": "2026-01-10",
    "size": "120 KB"
  },
  {
    "id": "doc4",
    "name": "NDA Template",
    "type": "template",
    "category": "Legal",
    "uploadedBy": "Admin",
    "date": "2026-01-05",
    "size": "95 KB"
  }
];

export function renderDocumentsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="doc-wrap" id="docWrap">' +
      '<div class="doc-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128196;</span> Document Management</div>' +
        '<div class="doc-spacer"></div>' +
        '<button class="doc-btn" id="docAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="doc-stats" id="docStats"></div>' +
      '<div id="docContent"></div>' +
      '<div class="doc-modal" id="docModal"><div class="doc-modal-box" id="docModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  docLoadData();
}

export async function docLoadData() {
  const d = await api.get('/api/documents');
  _data = (d && !d._error) ? (d.documents || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  docRenderStats();
  docRender();
}

export function docRenderStats() {
  const el = _container && _container.querySelector('#docStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="doc-stats">' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="doc-stat-label">Total Docs</div></div>' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="doc-stat-label">Templates</div></div>' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="doc-stat-label">Generated</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function docRender() {
  const el = _container && _container.querySelector('#docContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="doc-empty"><div class="doc-empty-icon">&#128196;</div><div class="doc-empty-text">No document management data</div></div>';
    return;
  }
  let html = '<div class="doc-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="doc-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="doc-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="doc-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="doc-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="doc-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function docShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#docModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="doc-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="doc-field"><label>Document Name *</label><input type="text" id="docF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="doc-field"><label>Category</label><input type="text" id="docF_category" value="' + _esc(String((item && item.category) || '')) + '"></div>' +
    '<div class="doc-field"><label>Type</label><select id="docF_type"><option value="policy">policy</option><option value="template">template</option><option value="form">form</option><option value="other">other</option></select></div>' +
    '<div class="doc-form-actions"><button class="doc-btn ghost" data-action="close-modal">Cancel</button><button class="doc-btn" id="docSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#docModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#docSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    docCloseModal();
    docRender();
  });
}

export async function docDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/documents/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); docLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  docRenderStats();
  docRender();
}

export function docCloseModal() {
  const modal = _container && _container.querySelector('#docModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#docAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { docShowForm(null); });
  const modal = container.querySelector('#docModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) docCloseModal(); });
  const content = container.querySelector('#docContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') docShowForm(_data[idx]);
    else if (action === 'delete') docDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) docCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('documents', renderDocumentsPage);

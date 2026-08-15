/**
 * modules/expenses/expenses.js
 * Expenses — standard CRUD module.
 * Pattern: renderExpensesPage() → expLoadData() → expRenderStats()
 *          → expRender() → CRUD → expCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];


export function renderExpensesPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="exp-wrap" id="expWrap">' +
      '<div class="exp-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128176;</span> Expenses</div>' +
        '<div class="exp-spacer"></div>' +
        '<button class="exp-btn" id="expAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="exp-stats" id="expStats"></div>' +
      '<div id="expContent"></div>' +
      '<div class="exp-modal" id="expModal"><div class="exp-modal-box" id="expModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  expLoadData();
}

export async function expLoadData() {
  const d = await api.get('/api/expenses');
  _data = (d && !d._error) ? (d.expenses || d || []) : [];
  if (!Array.isArray(_data)) _data = [];
  expRenderStats();
  expRender();
}

export function expRenderStats() {
  const el = _container && _container.querySelector('#expStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="exp-stats">' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--status-break)">' + stats[0] + '</div><div class="exp-stat-label">Pending</div></div>' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="exp-stat-label">Approved</div></div>' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--accent)">' + stats[2] + '</div><div class="exp-stat-label">Total Amount</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function expRender() {
  const el = _container && _container.querySelector('#expContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="exp-empty"><div class="exp-empty-icon">&#128176;</div><div class="exp-empty-text">No expenses data</div></div>';
    return;
  }
  let html = '<div class="exp-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="exp-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="exp-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="exp-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="exp-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="exp-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function expShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="exp-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Expenses</div>' +
    '<div class="exp-field"><label>Category *</label><input type="text" id="expF_category" value="' + _esc((item && item.category) || '') + '"></div>' +
    '<div class="exp-field"><label>Amount *</label><input type="number" id="expF_amount" value="' + _esc((item && item.amount) || '') + '"></div>' +
    '<div class="exp-field"><label>Description</label><textarea id="expF_description">' + _esc((item && item.description) || '') + '</textarea></div>' +
    '<div class="exp-form-actions"><button class="exp-btn ghost" data-action="close-modal">Cancel</button><button class="exp-btn" id="expSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#expModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#expSaveBtn').addEventListener('click', function () {
    toast('Failed to save', 'error');
  });
}

export async function expDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/expenses/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); expLoadData(); return; }
  toast((result && result.message) || 'Failed', 'error');
}

export function expCloseModal() {
  const modal = _container && _container.querySelector('#expModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#expAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { expShowForm(null); });
  const modal = container.querySelector('#expModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) expCloseModal(); });
  const content = container.querySelector('#expContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') expShowForm(_data[idx]);
    else if (action === 'delete') expDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) expCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('expenses', renderExpensesPage);

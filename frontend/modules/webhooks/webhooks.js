/**
 * modules/webhooks/webhooks.js
 * Webhooks — standard CRUD module.
 * Pattern: renderWebhooksPage() → whLoadData() → whRenderStats()
 *          → whRender() → CRUD → whCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "wh1",
    "url": "https://hooks.slack.com/abc",
    "events": [
      "attendance",
      "leave"
    ],
    "active": true,
    "lastStatus": 200
  },
  {
    "id": "wh2",
    "url": "https://api.zapier.com/xyz",
    "events": [
      "attendance"
    ],
    "active": true,
    "lastStatus": 200
  }
];

export function renderWebhooksPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="wh-wrap" id="whWrap">' +
      '<div class="wh-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128279;</span> Webhooks</div>' +
        '<div class="wh-spacer"></div>' +
        '<button class="wh-btn" id="whAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="wh-stats" id="whStats"></div>' +
      '<div id="whContent"></div>' +
      '<div class="wh-modal" id="whModal"><div class="wh-modal-box" id="whModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  whLoadData();
}

export async function whLoadData() {
  const d = await api.get('/api/webhooks');
  _data = (d && !d._error) ? (d.webhooks || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  whRenderStats();
  whRender();
}

export function whRenderStats() {
  const el = _container && _container.querySelector('#whStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="wh-stats">' +
    '<div class="wh-stat"><div class="wh-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="wh-stat-label">Total</div></div>' +
    '<div class="wh-stat"><div class="wh-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="wh-stat-label">Active</div></div>' +
    '<div class="wh-stat"><div class="wh-stat-num" style="color:var(--status-absent)">' + stats[2] + '</div><div class="wh-stat-label">Failed</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function whRender() {
  const el = _container && _container.querySelector('#whContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="wh-empty"><div class="wh-empty-icon">&#128279;</div><div class="wh-empty-text">No webhooks data</div></div>';
    return;
  }
  let html = '<div class="wh-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="wh-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || i) + '">';
    html += '<div class="wh-card-title">' + _esc(item.name || item.label || item.project || item.action || item.url || item.dept || 'Item ' + (i+1)) + '</div>';
    html += '<div class="wh-card-sub">' + _esc(item.date || item.type || item.category || item.timestamp || item.status || '') + '</div>';
    if (item.status) html += '<span class="wh-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="wh-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function whShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#whModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="wh-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Webhooks</div>' +
    '<div class="wh-field"><label>Webhook URL *</label><input type="text" id="whF_url" value="' + _esc((item && item.url) || '') + '"></div>' +
    '<div class="wh-field"><label>Events (comma-separated)</label><input type="text" id="whF_events" value="' + _esc((item && item.events) || '') + '"></div>' +
    '<div class="wh-form-actions"><button class="wh-btn ghost" data-action="close-modal">Cancel</button><button class="wh-btn" id="whSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#whModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#whSaveBtn').addEventListener('click', function () {
    toast('Webhooks ' + (isEdit ? 'updated' : 'created') + ' (demo)', 'success');
    whCloseModal();
    whRender();
  });
}

export async function whDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/webhooks/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); whLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  whRenderStats();
  whRender();
}

export function whCloseModal() {
  const modal = _container && _container.querySelector('#whModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#whAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { whShowForm(null); });
  const modal = container.querySelector('#whModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) whCloseModal(); });
  const content = container.querySelector('#whContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') whShowForm(_data[idx]);
    else if (action === 'delete') whDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) whCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('webhooks', renderWebhooksPage);

/**
 * modules/surveys/surveys.js
 * Surveys — standard CRUD module.
 * Pattern: renderSurveysPage() → svLoadData() → svRenderStats()
 *          → svRender() → CRUD → svCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "sv1",
    "name": "Q1 Employee Satisfaction",
    "questions": 15,
    "responses": 38,
    "total": 45,
    "status": "active",
    "deadline": "2026-04-15",
    "anonymous": true
  },
  {
    "id": "sv2",
    "name": "WFH Policy Feedback",
    "questions": 8,
    "responses": 42,
    "total": 45,
    "status": "closed",
    "deadline": "2026-03-15",
    "anonymous": false
  },
  {
    "id": "sv3",
    "name": "Training Effectiveness",
    "questions": 10,
    "responses": 5,
    "total": 45,
    "status": "draft",
    "deadline": null,
    "anonymous": true
  }
];

export function renderSurveysPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="sv-wrap" id="svWrap">' +
      '<div class="sv-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128202;</span> Surveys</div>' +
        '<div class="sv-spacer"></div>' +
        '<button class="sv-btn" id="svAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="sv-stats" id="svStats"></div>' +
      '<div id="svContent"></div>' +
      '<div class="sv-modal" id="svModal"><div class="sv-modal-box" id="svModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  svLoadData();
}

export async function svLoadData() {
  const d = await api.get('/api/surveys');
  _data = (d && !d._error) ? (d.surveys || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  svRenderStats();
  svRender();
}

export function svRenderStats() {
  const el = _container && _container.querySelector('#svStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="sv-stats">' +
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="sv-stat-label">Total Surveys</div></div>' +
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="sv-stat-label">Active</div></div>' +
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="sv-stat-label">Responses</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function svRender() {
  const el = _container && _container.querySelector('#svContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="sv-empty"><div class="sv-empty-icon">&#128202;</div><div class="sv-empty-text">No surveys data</div></div>';
    return;
  }
  let html = '<div class="sv-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="sv-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="sv-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="sv-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="sv-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    html += '<div class="sv-card-actions">';
    html += '<button data-action="edit" data-idx="' + i + '">Edit</button>';
    html += '<button class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function svShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#svModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="sv-modal-title">' + (isEdit ? 'Edit' : 'Add') + '</div>' +
    '<div class="sv-field"><label>Survey Title *</label><input type="text" id="svF_name" value="' + _esc(String((item && item.name) || '')) + '"></div>' +
    '<div class="sv-field"><label><input type="checkbox" id="svF_anonymous"' + (item && item.anonymous ? ' checked' : '') + '> Anonymous</label></div>' +
    '<div class="sv-field"><label>Deadline</label><input type="date" id="svF_deadline" value="' + _esc(String((item && item.deadline) || '')) + '"></div>' +
    '<div class="sv-form-actions"><button class="sv-btn ghost" data-action="close-modal">Cancel</button><button class="sv-btn" id="svSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  const modal = _container.querySelector('#svModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#svSaveBtn').addEventListener('click', function () {
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    svCloseModal();
    svRender();
  });
}

export async function svDelete(idx) {
  if (!confirm('Delete this item?')) return;
  const item = _data[idx];
  if (!item) return;
  const result = await api.delete('/api/surveys/' + (item.id || idx));
  if (result && !result._error) { toast('Deleted', 'success'); svLoadData(); return; }
  _data.splice(idx, 1);
  toast('Deleted (demo)', 'success');
  svRenderStats();
  svRender();
}

export function svCloseModal() {
  const modal = _container && _container.querySelector('#svModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#svAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { svShowForm(null); });
  const modal = container.querySelector('#svModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) svCloseModal(); });
  const content = container.querySelector('#svContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') svShowForm(_data[idx]);
    else if (action === 'delete') svDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) svCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('surveys', renderSurveysPage);

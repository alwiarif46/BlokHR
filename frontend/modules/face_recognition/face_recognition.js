/**
 * modules/face_recognition/face_recognition.js
 * Face Recognition — standard CRUD module.
 * Pattern: renderFaceRecognitionPage() → frLoadData() → frRenderStats()
 *          → frRender() → CRUD → frCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "email": "arif@blokhr.com",
    "name": "Arif Alwi",
    "enrolled": true,
    "enrolledAt": "2026-02-10",
    "photos": 3
  },
  {
    "email": "priya@blokhr.com",
    "name": "Priya Sharma",
    "enrolled": true,
    "enrolledAt": "2026-02-12",
    "photos": 3
  },
  {
    "email": "omar@blokhr.com",
    "name": "Omar Hassan",
    "enrolled": false,
    "enrolledAt": null,
    "photos": 0
  }
];

export function renderFaceRecognitionPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="fr-wrap" id="frWrap">' +
      '<div class="fr-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#129504;</span> Face Recognition</div>' +
        '<div class="fr-spacer"></div>' +
        
      '</div>' +
      '<div class="fr-stats" id="frStats"></div>' +
      '<div id="frContent"></div>' +
      '<div class="fr-modal" id="frModal"><div class="fr-modal-box" id="frModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  frLoadData();
}

export async function frLoadData() {
  const d = await api.get('/api/face');
  _data = (d && !d._error) ? (d.enrollments || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  frRenderStats();
  frRender();
}

export function frRenderStats() {
  const el = _container && _container.querySelector('#frStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="fr-stats">' +
    '<div class="fr-stat"><div class="fr-stat-num" style="color:var(--status-in)">' + stats[0] + '</div><div class="fr-stat-label">Enrolled</div></div>' +
    '<div class="fr-stat"><div class="fr-stat-num" style="color:var(--status-break)">' + stats[1] + '</div><div class="fr-stat-label">Pending</div></div>' +
    '<div class="fr-stat"><div class="fr-stat-num" style="color:var(--accent)">' + stats[2] + '</div><div class="fr-stat-label">Total Members</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function frRender() {
  const el = _container && _container.querySelector('#frContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="fr-empty"><div class="fr-empty-icon">&#129504;</div><div class="fr-empty-text">No face recognition data</div></div>';
    return;
  }
  let html = '<div class="fr-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="fr-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="fr-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="fr-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="fr-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function frShowForm() { }
export function frDelete() { }

export function frCloseModal() {
  const modal = _container && _container.querySelector('#frModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#frModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) frCloseModal(); });
  const content = container.querySelector('#frContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') frShowForm(_data[idx]);
    else if (action === 'delete') frDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) frCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('face_recognition', renderFaceRecognitionPage);

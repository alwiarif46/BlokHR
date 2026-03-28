/**
 * modules/ai_chatbot/ai_chatbot.js
 * AI Chatbot — standard CRUD module.
 * Pattern: renderAiChatbotPage() → chatLoadData() → chatRenderStats()
 *          → chatRender() → CRUD → chatCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];

const _mockData = [
  {
    "id": "s1",
    "user": "arif@blokhr.com",
    "userName": "Arif Alwi",
    "messages": 12,
    "startedAt": "2026-03-28T09:15:00",
    "lastMessage": "Show me my attendance this week"
  },
  {
    "id": "s2",
    "user": "sarah@blokhr.com",
    "userName": "Sarah Chen",
    "messages": 5,
    "startedAt": "2026-03-28T10:30:00",
    "lastMessage": "How many leaves do I have left?"
  },
  {
    "id": "s3",
    "user": "maya@blokhr.com",
    "userName": "Maya Patel",
    "messages": 8,
    "startedAt": "2026-03-28T11:00:00",
    "lastMessage": "Generate attendance report for March"
  }
];

export function renderAiChatbotPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="chat-wrap" id="chatWrap">' +
      '<div class="chat-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#129302;</span> AI Chatbot</div>' +
        '<div class="chat-spacer"></div>' +
        
      '</div>' +
      '<div class="chat-stats" id="chatStats"></div>' +
      '<div id="chatContent"></div>' +
      '<div class="chat-modal" id="chatModal"><div class="chat-modal-box" id="chatModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  chatLoadData();
}

export async function chatLoadData() {
  const d = await api.get('/api/chat');
  _data = (d && !d._error) ? (d.sessions || d || []) : _mockData;
  if (!Array.isArray(_data)) _data = _mockData;
  chatRenderStats();
  chatRender();
}

export function chatRenderStats() {
  const el = _container && _container.querySelector('#chatStats');
  if (!el) return;
  const stats = _computeStats();
  el.innerHTML = '<div class="chat-stats">' +
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--accent)">' + stats[0] + '</div><div class="chat-stat-label">Sessions Today</div></div>' +
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--status-in)">' + stats[1] + '</div><div class="chat-stat-label">Messages</div></div>' +
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--status-break)">' + stats[2] + '</div><div class="chat-stat-label">Tools Available</div></div>' +
  '</div>';
}

function _computeStats() {
  return [_data.length, _data.length, _data.length];
}

export function chatRender() {
  const el = _container && _container.querySelector('#chatContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">&#129302;</div><div class="chat-empty-text">No ai chatbot data</div></div>';
    return;
  }
  let html = '<div class="chat-grid">';
  _data.forEach(function (item, i) {
    html += '<div class="chat-card" style="animation-delay:' + i * 0.04 + 's" data-id="' + _esc(item.id || item.key || item.email || i) + '">';
    html += '<div class="chat-card-title">' + _esc(item.name || item.userName || item.label || 'Item ' + (i+1)) + '</div>';
    html += '<div class="chat-card-sub">' + _esc(item.type || item.company || item.category || item.status || item.quality || item.lastMessage || '') + '</div>';
    if (item.status) html += '<span class="chat-card-badge" style="background:var(--accent-dim);color:var(--accent)">' + _esc(item.status) + '</span>';
    
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function chatShowForm() { }
export function chatDelete() { }

export function chatCloseModal() {
  const modal = _container && _container.querySelector('#chatModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  
  const modal = container.querySelector('#chatModal');
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) chatCloseModal(); });
  const content = container.querySelector('#chatContent');
  if (content) content.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'edit') chatShowForm(_data[idx]);
    else if (action === 'delete') chatDelete(idx);
  });
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) chatCloseModal();
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; }

registerModule('ai_chatbot', renderAiChatbotPage);

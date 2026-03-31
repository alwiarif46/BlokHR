/**
 * modules/ai_chatbot/ai_chatbot.js
 * AI chatbot: 87-tool chat interface for employee & admin queries.
 * Pattern: renderAIChatbotPage() → chatLoadHistory() → chatRenderMessages()
 *          → chatSendMessage() (no modal)
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _messages = [];
let _sending = false;
let _sessionId = null;

const _suggestions = [
  'How many days of leave do I have left?',
  'Show me my attendance for this month',
  'What are my pending approvals?',
  'How do I submit an expense?',
  'Who is the head of the Engineering department?',
  'What is the overtime policy?',
];

const _mockHistory = [
  { role: 'assistant', content: 'Hi! I\'m your BlokHR AI assistant. I can help you with attendance, leaves, policies, expenses, and much more. What would you like to know?', timestamp: new Date(Date.now() - 60000).toISOString() },
];

export function renderAIChatbotPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="chat-wrap">' +
      '<div class="chat-header">' +
        '<div class="chat-avatar">&#129302;</div>' +
        '<div class="chat-header-info">' +
          '<div class="chat-title">BlokHR Assistant</div>' +
          '<div class="chat-subtitle">Powered by AI &middot; 87 tools</div>' +
        '</div>' +
        '<button class="chat-clear-btn" id="chatClearBtn" title="New conversation">&#128465;</button>' +
      '</div>' +
      '<div class="chat-messages" id="chatMessages"></div>' +
      '<div class="chat-suggestions" id="chatSuggestions"></div>' +
      '<div class="chat-input-row">' +
        '<textarea class="chat-input" id="chatInput" placeholder="Ask anything about HR…" rows="1"></textarea>' +
        '<button class="chat-send-btn" id="chatSendBtn" disabled>&#9658;</button>' +
      '</div>' +
    '</div>';
  _bindEvents(container);
  chatLoadHistory();
}

export async function chatLoadHistory() {
  const d = await api.get('/api/chat/sessions');
  if (d && !d._error && Array.isArray(d.messages)) {
    _messages = d.messages;
    _sessionId = d.session_id || null;
  } else {
    _messages = [..._mockHistory];
  }
  chatRenderMessages();
  chatRenderSuggestions();
}

export function chatRenderMessages() {
  const el = _container && _container.querySelector('#chatMessages');
  if (!el) return;
  if (!_messages.length) {
    el.innerHTML = '<div class="chat-empty"><div style="font-size:3rem">&#129302;</div><div>Start a conversation</div></div>';
    return;
  }
  let html = '';
  _messages.forEach(function (m) {
    const isUser = m.role === 'user';
    html +=
      '<div class="chat-msg ' + (isUser ? 'chat-user' : 'chat-bot') + '">' +
        (!isUser ? '<div class="chat-msg-av">&#129302;</div>' : '') +
        '<div class="chat-msg-body">' +
          '<div class="chat-msg-text">' + _renderText(m.content || '') + '</div>' +
          (m.timestamp ? '<div class="chat-msg-time">' + _fmtTime(m.timestamp) + '</div>' : '') +
        '</div>' +
      '</div>';
  });
  if (_sending) {
    html += '<div class="chat-msg chat-bot"><div class="chat-msg-av">&#129302;</div><div class="chat-msg-body"><div class="chat-typing"><span></span><span></span><span></span></div></div></div>';
  }
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

export function chatRenderSuggestions() {
  const el = _container && _container.querySelector('#chatSuggestions');
  if (!el) return;
  if (_messages.length > 1) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="chat-sugg-label">Try asking:</div>' +
    _suggestions.map(s =>
      '<button class="chat-sugg" data-sugg="' + _esc(s) + '">' + _esc(s) + '</button>'
    ).join('');
}

export async function chatSendMessage(text) {
  const msg = (text || '').trim();
  if (!msg || _sending) return;
  _messages.push({ role: 'user', content: msg, timestamp: new Date().toISOString() });
  _sending = true;
  chatRenderMessages();
  chatRenderSuggestions();

  const result = await api.post('/api/chat', { message: msg, session_id: _sessionId });
  _sending = false;

  if (result && !result._error) {
    const reply = result.response || result.content || result.message || 'Got it!';
    _sessionId = result.session_id || _sessionId;
    _messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
  } else {
    _messages.push({
      role: 'assistant',
      content: _mockReply(msg),
      timestamp: new Date().toISOString(),
    });
  }
  chatRenderMessages();
}

function _mockReply(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('leave')) return 'You have 12 days of Annual leave remaining, 10 Sick leave, and 5 Casual leave.';
  if (lower.includes('attendance')) return 'Your attendance this month: 18 present, 1 late, 0 absent. Attendance rate: 94.7%.';
  if (lower.includes('overtime') || lower.includes('ot')) return 'The overtime policy requires minimum 9 hours work to qualify. Multiplier is 2x on weekdays, 3x on holidays.';
  if (lower.includes('expense')) return 'To submit an expense: go to Expenses module → click "Submit Expense" → fill in the details and attach a receipt.';
  if (lower.includes('department') || lower.includes('head')) return 'The Engineering department is headed by Arif Alwi. Product is headed by Sarah Chen.';
  return 'I understand your question. Let me look into that for you. Based on your HR records, everything appears to be in order. Is there anything specific you\'d like me to check?';
}

function _bindEvents(container) {
  const input = container.querySelector('#chatInput');
  const sendBtn = container.querySelector('#chatSendBtn');

  if (input) {
    input.addEventListener('input', function () {
      sendBtn.disabled = !this.value.trim();
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) _send();
      }
    });
  }

  if (sendBtn) sendBtn.addEventListener('click', _send);

  const clearBtn = container.querySelector('#chatClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    _messages = [..._mockHistory];
    _sessionId = null;
    chatRenderMessages();
    chatRenderSuggestions();
  });

  container.addEventListener('click', function (e) {
    const sugg = e.target.closest('[data-sugg]');
    if (!sugg) return;
    const text = sugg.dataset.sugg;
    const input = container.querySelector('#chatInput');
    if (input) { input.value = text; input.dispatchEvent(new Event('input')); }
    chatSendMessage(text);
    if (input) input.value = '';
  });
}

function _send() {
  const input = _container && _container.querySelector('#chatInput');
  const sendBtn = _container && _container.querySelector('#chatSendBtn');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  chatSendMessage(text);
  input.value = '';
  input.style.height = 'auto';
  if (sendBtn) sendBtn.disabled = true;
}

function _renderText(text) {
  const d = document.createElement('div');
  d.textContent = String(text || '');
  return d.innerHTML.replace(/\n/g, '<br>');
}
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getMessages() { return _messages; }
export function _setMessages(list) { _messages = list; }
export function _resetState() { _container = null; _messages = []; _sending = false; _sessionId = null; }

registerModule('ai_chatbot', renderAIChatbotPage);

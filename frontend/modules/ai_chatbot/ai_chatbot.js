/**
 * modules/ai_chatbot/ai_chatbot.js
 * AI Chatbot — session list, message thread, and composer wired to POST /api/chat.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const SUGGESTIONS = [
  "What's my shift?",
  'Any pending leaves?',
  'How many hours have I worked today?',
  'Upcoming holidays',
];

let _container = null;
/** @type {Array<{id:string,title?:string,updated_at?:string,email?:string}>} */
let _sessions = [];
/** @type {string|null} */
let _activeSessionId = null;
/** @type {Array<{id?:number,role:string,content:string,toolsCalled?:Array<{tool:string}>}>} */
let _messages = [];
let _toolCount = 0;
let _sending = false;
let _llmUnavailable = false;
let _loading = false;

export function renderAiChatbotPage(container) {
  _container = container;
  _activeSessionId = null;
  _messages = [];
  _sessions = [];
  _llmUnavailable = false;

  const session = getSession() || {};
  const displayName = session.name || session.email || 'You';

  container.innerHTML =
    '<div class="chat-wrap" id="chatWrap">' +
      '<div class="chat-toolbar">' +
        '<div class="chat-title"><span class="chat-title-icon" aria-hidden="true">&#129302;</span> HR AI Chatbot</div>' +
        '<div class="chat-spacer"></div>' +
        '<span class="chat-user-hint">' + _esc(displayName) + '</span>' +
      '</div>' +
      '<div class="chat-stats" id="chatStats"></div>' +
      '<div class="chat-layout" id="chatLayout">' +
        '<aside class="chat-sidebar" id="chatSidebar"></aside>' +
        '<section class="chat-main">' +
          '<div class="chat-thread" id="chatThread"></div>' +
          '<div class="chat-suggestions" id="chatSuggestions"></div>' +
          '<form class="chat-composer" id="chatComposer">' +
            '<textarea id="chatInput" rows="2" placeholder="Ask about attendance, leaves, shifts…" disabled></textarea>' +
            '<button type="submit" class="chat-btn" id="chatSendBtn" disabled>Send</button>' +
          '</form>' +
        '</section>' +
      '</div>' +
    '</div>';

  _bindEvents(container);
  chatLoadData();
}

export async function chatLoadData() {
  if (!_container) return;
  _loading = true;
  chatRenderAll();

  const [sessionsRes, toolsRes] = await Promise.all([
    api.get('/api/chat/sessions'),
    api.get('/api/chat/tools'),
  ]);

  if (sessionsRes && sessionsRes._error) {
    if (sessionsRes.status === 503) {
      _llmUnavailable = true;
      _sessions = [];
    } else {
      toast(sessionsRes.message || 'Failed to load sessions', 'error');
      _sessions = [];
    }
  } else {
    _sessions = (sessionsRes && sessionsRes.sessions) || [];
    if (!_llmUnavailable) _llmUnavailable = false;
  }

  if (toolsRes && !toolsRes._error) {
    _toolCount = toolsRes.total || (toolsRes.tools && toolsRes.tools.length) || 0;
  } else {
    _toolCount = 0;
  }

  if (_activeSessionId) {
    const still = _sessions.find(function (s) { return s.id === _activeSessionId; });
    if (!still) {
      _activeSessionId = null;
      _messages = [];
    } else {
      await chatLoadThread(_activeSessionId, false);
    }
  }

  _loading = false;
  chatRenderAll();
}

export async function chatLoadThread(sessionId, render) {
  if (render === undefined) render = true;
  const res = await api.get('/api/chat/sessions/' + encodeURIComponent(sessionId));
  if (res && res._error) {
    if (res.status === 404) {
      toast('Session not found', 'error');
      _activeSessionId = null;
      _messages = [];
    } else if (res.status === 503) {
      _llmUnavailable = true;
    } else {
      toast(res.message || 'Failed to load conversation', 'error');
    }
  } else {
    _activeSessionId = sessionId;
    _messages = (res && res.messages) || [];
  }
  if (render) chatRenderAll();
}

export function chatRenderStats() {
  const el = _container && _container.querySelector('#chatStats');
  if (!el) return;
  const msgCount = _messages.length;
  el.innerHTML =
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--accent)">' + _sessions.length + '</div><div class="chat-stat-label">Sessions</div></div>' +
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--status-in)">' + msgCount + '</div><div class="chat-stat-label">Messages</div></div>' +
    '<div class="chat-stat"><div class="chat-stat-num" style="color:var(--status-break)">' + _toolCount + '</div><div class="chat-stat-label">Tools</div></div>';
}

export function chatRenderSidebar() {
  const el = _container && _container.querySelector('#chatSidebar');
  if (!el) return;

  let html = '<div class="chat-sidebar-head">' +
    '<button type="button" class="chat-btn" data-action="new-chat"' + (_llmUnavailable || _sending ? ' disabled' : '') + '>New chat</button>' +
    '</div><div class="chat-session-list">';

  if (_loading && !_sessions.length) {
    html += '<div class="chat-sidebar-empty">Loading…</div>';
  } else if (!_sessions.length) {
    html += '<div class="chat-sidebar-empty">No conversations yet</div>';
  } else {
    _sessions.forEach(function (s) {
      const active = s.id === _activeSessionId ? ' active' : '';
      html += '<div class="chat-session-item' + active + '" data-action="select-session" data-id="' + _esc(s.id) + '">' +
        '<div class="chat-session-title">' + _esc(s.title || 'Untitled chat') + '</div>' +
        '<button type="button" class="chat-session-del" data-action="delete-session" data-id="' + _esc(s.id) + '" title="Delete">×</button>' +
        '</div>';
    });
  }
  html += '</div>';
  el.innerHTML = html;
}

export function chatRenderThread() {
  const el = _container && _container.querySelector('#chatThread');
  if (!el) return;

  if (_llmUnavailable) {
    el.innerHTML =
      '<div class="chat-empty">' +
        '<div class="chat-empty-icon">&#9888;</div>' +
        '<div class="chat-empty-text">LLM not configured</div>' +
        '<div class="chat-empty-sub">Chat replies need an LLM provider. Direct tools may still work for admins via configuration.</div>' +
      '</div>';
    return;
  }

  if (!_activeSessionId && !_messages.length) {
    el.innerHTML =
      '<div class="chat-empty">' +
        '<div class="chat-empty-icon">&#129302;</div>' +
        '<div class="chat-empty-text">Start a conversation</div>' +
        '<div class="chat-empty-sub">Ask about your shift, leaves, attendance, or pick a suggestion below.</div>' +
      '</div>';
    return;
  }

  if (!_messages.length) {
    el.innerHTML = '<div class="chat-empty"><div class="chat-empty-text">No messages in this chat</div></div>';
    return;
  }

  let html = '<div class="chat-bubbles">';
  _messages.forEach(function (m) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    html += '<div class="chat-bubble chat-bubble-' + role + '">' +
      '<div class="chat-bubble-body">' + _esc(m.content) + '</div>';
    if (role === 'assistant' && m.toolsCalled && m.toolsCalled.length) {
      html += '<div class="chat-tool-chips">';
      m.toolsCalled.forEach(function (t) {
        html += '<span class="chat-tool-chip">' + _esc(t.tool || t.name || 'tool') + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
  });
  if (_sending) {
    html += '<div class="chat-bubble chat-bubble-assistant chat-bubble-pending"><div class="chat-bubble-body">Thinking…</div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

export function chatRenderSuggestions() {
  const el = _container && _container.querySelector('#chatSuggestions');
  if (!el) return;
  if (_llmUnavailable) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = SUGGESTIONS.map(function (s) {
    return '<button type="button" class="chat-chip" data-action="suggest" data-text="' + _esc(s) + '"' +
      (_sending ? ' disabled' : '') + '>' + _esc(s) + '</button>';
  }).join('');
}

export function chatRenderComposer() {
  const input = _container && _container.querySelector('#chatInput');
  const btn = _container && _container.querySelector('#chatSendBtn');
  if (!input || !btn) return;
  const disabled = _sending || _llmUnavailable;
  input.disabled = disabled;
  btn.disabled = disabled;
}

export function chatRenderAll() {
  chatRenderStats();
  chatRenderSidebar();
  chatRenderThread();
  chatRenderSuggestions();
  chatRenderComposer();
}

export async function chatNewSession() {
  _activeSessionId = null;
  _messages = [];
  chatRenderAll();
  const input = _container && _container.querySelector('#chatInput');
  if (input) input.focus();
}

export async function chatSend(message) {
  const text = (message || '').trim();
  if (!text || _sending || _llmUnavailable) return;

  _sending = true;
  _messages = _messages.concat([{ role: 'user', content: text }]);
  chatRenderAll();

  const body = { message: text };
  if (_activeSessionId) body.sessionId = _activeSessionId;

  const res = await api.post('/api/chat', body);

  if (res && res._error) {
    _messages = _messages.slice(0, -1);
    if (res.status === 503) {
      _llmUnavailable = true;
      toast('LLM not configured', 'error');
    } else {
      toast(res.message || 'Failed to send message', 'error');
    }
    _sending = false;
    chatRenderAll();
    return;
  }

  _activeSessionId = res.sessionId || _activeSessionId;
  const toolsCalled = res.toolsCalled || [];
  _messages = _messages.concat([{
    role: 'assistant',
    content: res.reply || '',
    toolsCalled: toolsCalled,
  }]);

  _sending = false;

  const sessionsRes = await api.get('/api/chat/sessions');
  if (sessionsRes && !sessionsRes._error) {
    _sessions = sessionsRes.sessions || [];
  }

  chatRenderAll();
}

export async function chatDeleteSession(sessionId) {
  if (!sessionId) return;
  if (!(await confirmDialog({ message: 'Delete this conversation?', confirmLabel: 'Delete', danger: true }))) return;

  const res = await api.delete('/api/chat/sessions/' + encodeURIComponent(sessionId));
  if (res && res._error) {
    toast(res.message || 'Failed to delete', 'error');
    return;
  }
  if (_activeSessionId === sessionId) {
    _activeSessionId = null;
    _messages = [];
  }
  toast('Conversation deleted');
  await chatLoadData();
}

function _bindEvents(container) {
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !container.contains(btn)) return;
    const action = btn.dataset.action;

    if (action === 'new-chat') {
      chatNewSession();
      return;
    }
    if (action === 'select-session') {
      const id = btn.dataset.id;
      if (id && id !== _activeSessionId) chatLoadThread(id);
      return;
    }
    if (action === 'delete-session') {
      e.stopPropagation();
      chatDeleteSession(btn.dataset.id);
      return;
    }
    if (action === 'suggest') {
      const text = btn.dataset.text || '';
      const input = container.querySelector('#chatInput');
      if (input) input.value = text;
      chatSend(text);
    }
  });

  const form = container.querySelector('#chatComposer');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = container.querySelector('#chatInput');
      const text = input ? input.value : '';
      if (input) input.value = '';
      chatSend(text);
    });
  }

  const input = container.querySelector('#chatInput');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form && form.requestSubmit();
      }
    });
  }
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function _getData() {
  return { sessions: _sessions, messages: _messages, activeSessionId: _activeSessionId, toolCount: _toolCount, llmUnavailable: _llmUnavailable };
}
export function _setData(d) {
  if (!d) return;
  if (d.sessions) _sessions = d.sessions;
  if (d.messages) _messages = d.messages;
  if (d.activeSessionId !== undefined) _activeSessionId = d.activeSessionId;
  if (d.toolCount !== undefined) _toolCount = d.toolCount;
  if (d.llmUnavailable !== undefined) _llmUnavailable = d.llmUnavailable;
}
export function _resetState() {
  _container = null;
  _sessions = [];
  _activeSessionId = null;
  _messages = [];
  _toolCount = 0;
  _sending = false;
  _llmUnavailable = false;
  _loading = false;
}

registerModule('ai_chatbot', renderAiChatbotPage);

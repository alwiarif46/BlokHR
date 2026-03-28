/**
 * sseClient.js — SSE connection to /api/sse with exponential backoff reconnect.
 */

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

let _eventSource = null;
let _retryCount = 0;
let _retryTimer = null;
const _handlers = {};

export function connectSSE(path = '/api/sse') {
  _disconnect();
  _retryCount = 0;
  _connect(path);
}

export function onSSE(eventType, handler) {
  if (!_handlers[eventType]) _handlers[eventType] = [];
  _handlers[eventType].push(handler);
}

export function offSSE(eventType, handler) {
  if (!_handlers[eventType]) return;
  _handlers[eventType] = _handlers[eventType].filter(h => h !== handler);
}

export function disconnectSSE() {
  _disconnect();
  _retryCount = MAX_RETRIES;
}

function _connect(path) {
  _eventSource = new EventSource(path);

  _eventSource.onopen = () => {
    _retryCount = 0;
  };

  _eventSource.onmessage = (event) => {
    _dispatch('message', event);
  };

  const eventTypes = [
    'attendance-update',
    'settings-update',
    'leave-update',
    'notification',
    'approval-update',
  ];

  eventTypes.forEach(type => {
    _eventSource.addEventListener(type, (event) => {
      _dispatch(type, event);
    });
  });

  _eventSource.onerror = () => {
    _eventSource.close();
    _scheduleReconnect(path);
  };
}

function _disconnect() {
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
  if (_eventSource) {
    _eventSource.close();
    _eventSource = null;
  }
}

function _scheduleReconnect(path) {
  if (_retryCount >= MAX_RETRIES) {
    _dispatch('max-retries', null);
    return;
  }
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, _retryCount), MAX_DELAY_MS);
  _retryCount++;
  _retryTimer = setTimeout(() => _connect(path), delay);
}

function _dispatch(type, event) {
  const handlers = _handlers[type] || [];
  handlers.forEach(h => {
    try {
      h(event);
    } catch (e) {
      console.error(`SSE handler error for ${type}:`, e);
    }
  });
}

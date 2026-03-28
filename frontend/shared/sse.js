/**
 * shared/sse.js — Server-Sent Events
 *
 * Extracted from the monolith's connectSSE() function.
 *
 * Responsibilities:
 *  - Establish SSE connection to GET /api/sse/stream
 *  - Automatic reconnection with backoff on disconnect
 *  - Event dispatch to registered listeners
 *  - Sync status indicator (live/offline dot + label in header)
 *
 * Events:
 *  - attendance-update  — reload attendance grid
 *  - settings-update    — reload tenant settings, re-apply branding/flags
 *  - leave-update       — reload leave data
 *  - meeting-update     — reload meeting data
 *  - chat-message       — new live chat message
 *  - chat-dm            — new direct message
 *  - chat-channel-update— channel created/updated
 */

import { getSession } from './session.js';
import { isMockMode } from './api.js';

let _source = null;
let _reconnectTimer = null;
let _reconnectDelay = 2000;
const MAX_RECONNECT_DELAY = 30000;
const _listeners = {};

/**
 * Connect to the SSE stream.
 * If already connected, closes the old connection first.
 */
export function connectSSE() {
  if (isMockMode()) {
    setSyncStatus('offline');
    return;
  }

  disconnectSSE();

  const session = getSession();
  const email = (session && session.email) || '';
  const base = location.origin || '';

  try {
    _source = new EventSource(base + '/api/sse/stream?email=' + encodeURIComponent(email));

    _source.onopen = function () {
      setSyncStatus('live');
      _reconnectDelay = 2000;
    };

    _source.onerror = function () {
      setSyncStatus('offline');
      if (_source) {
        _source.close();
        _source = null;
      }
      scheduleReconnect();
    };

    /* Standard BlokHR events */
    const events = [
      'attendance',
      'notification',
      'settings-update',
      'leave-update',
      'meeting-update',
      'chat-message',
      'chat-dm',
      'chat-channel-update',
    ];

    events.forEach(function (eventName) {
      _source.addEventListener(eventName, function (e) {
        let detail = null;
        try {
          detail = JSON.parse(e.data);
        } catch (_ex) {
          detail = { raw: e.data };
        }

        /* Dispatch as a DOM event for loose coupling */
        document.dispatchEvent(new CustomEvent('blokhr:sse:' + eventName, { detail: detail }));

        /* Dispatch to direct listeners registered via onSSE() */
        const fns = _listeners[eventName];
        if (fns) {
          fns.forEach(function (fn) {
            try {
              fn(detail);
            } catch (_err) {
              /* swallow listener errors */
            }
          });
        }
      });
    });
  } catch (_e) {
    setSyncStatus('offline');
  }
}

/**
 * Close the SSE connection.
 */
export function disconnectSSE() {
  if (_source) {
    try {
      _source.close();
    } catch (_e) {
      /* noop */
    }
    _source = null;
  }
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

/**
 * Register a listener for a specific SSE event type.
 *
 * @param {string} eventName
 * @param {function(detail: any): void} callback
 * @returns {function} unsubscribe function
 */
export function onSSE(eventName, callback) {
  if (!_listeners[eventName]) _listeners[eventName] = [];
  _listeners[eventName].push(callback);
  return function unsubscribe() {
    const arr = _listeners[eventName];
    if (arr) {
      const idx = arr.indexOf(callback);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };
}

/**
 * Remove all registered listeners.
 */
export function clearSSEListeners() {
  Object.keys(_listeners).forEach(function (key) {
    delete _listeners[key];
  });
}

/**
 * Update the sync status indicator in the header.
 * @param {'live'|'offline'} status
 */
function setSyncStatus(status) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (!dot || !label) return;

  if (status === 'live') {
    dot.classList.remove('offline');
    label.classList.add('live');
    label.textContent = 'LIVE';
  } else {
    dot.classList.add('offline');
    label.classList.remove('live');
    label.textContent = 'OFFLINE';
  }
}

/**
 * Schedule a reconnect with exponential backoff.
 */
function scheduleReconnect() {
  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  _reconnectTimer = setTimeout(function () {
    connectSSE();
  }, _reconnectDelay);
  _reconnectDelay = Math.min(_reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
}

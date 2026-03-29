/**
 * shared/api.js — HTTP Client
 *
 * Extracted from the monolith's api(path, opts) function.
 * All modules import this instead of calling fetch() directly.
 *
 * Responsibilities:
 *  - Base URL resolution from location.origin
 *  - MOCK_MODE detection (file:// or sandboxed origin)
 *  - Auth headers injection (x-user-email, x-user-name from session)
 *  - 401 response handling → clear session → redirect to login
 *  - JSON request/response handling
 *  - Error wrapping: returns { _error: true, status, message } on failure
 */

import { getSession, clearSession } from './session.js';

let _base = '';
let _mockMode = false;

/**
 * Initialise the API client. Called once from shell.html boot sequence.
 * @param {{ base?: string, mockMode?: boolean }} opts
 */
export function initApi(opts) {
  if (opts && typeof opts.base === 'string') {
    _base = opts.base;
  } else if (typeof location !== 'undefined') {
    _base = location.origin || '';
  }

  if (opts && typeof opts.mockMode === 'boolean') {
    _mockMode = opts.mockMode;
  } else {
    _mockMode =
      !_base || _base === 'null' || _base === 'file://' || (_base && _base.indexOf('http') !== 0);
  }
}

/** @returns {boolean} */
export function isMockMode() {
  return _mockMode;
}

/**
 * General-purpose HTTP request.
 *
 * @param {string} path    — server-relative path, e.g. '/api/clock'
 * @param {RequestInit} [opts] — standard fetch options; body may be an object
 *                                (will be JSON-stringified automatically)
 * @returns {Promise<any>}  Resolved JSON on success, or { _error, status, message } on failure.
 *                           Returns null when in MOCK_MODE with no mock handler.
 */
export async function api(path, opts) {
  if (_mockMode) return null;

  const session = getSession();
  const headers = Object.assign({}, (opts && opts.headers) || {});

  if (opts && opts.method && opts.method !== 'GET') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (session && session.email) {
    headers['X-User-Email'] = session.email;
  }
  if (session && session.name) {
    headers['X-User-Name'] = session.name;
  }
  if (session && session.sessionToken) {
    headers['Authorization'] = 'Bearer ' + session.sessionToken;
  }

  const fetchOpts = Object.assign({}, opts || {}, { headers: headers });

  /* Auto-stringify object bodies */
  if (
    fetchOpts.body &&
    typeof fetchOpts.body === 'object' &&
    !(fetchOpts.body instanceof FormData) &&
    !(fetchOpts.body instanceof Blob) &&
    !(fetchOpts.body instanceof ArrayBuffer)
  ) {
    fetchOpts.body = JSON.stringify(fetchOpts.body);
  }

  try {
    const response = await fetch(_base + path, fetchOpts);

    if (response.status === 401) {
      /*
       * For auth endpoints (/api/auth/*), a 401 means "wrong credentials" —
       * NOT "session expired". Skip session clear, and use a sensible default
       * message in case the response body can't be parsed (nginx proxy may
       * replace the JSON body with its own HTML error page).
       */
      var isAuthEndpoint = path.indexOf('/api/auth/') === 0;
      if (!isAuthEndpoint) {
        clearSession();
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('blokhr:auth:expired', { detail: { path: path } }));
        }
      }

      var authMessage = isAuthEndpoint ? 'Invalid email or password' : 'Session expired';
      try {
        var text401 = await response.text();
        if (text401 && text401.charAt(0) === '{') {
          var parsed401 = JSON.parse(text401);
          authMessage = parsed401.error || parsed401.message || authMessage;
        }
      } catch (_e) {
        /* leave default — nginx may have replaced body with HTML */
      }
      return { _error: true, status: 401, message: authMessage };
    }

    if (!response.ok) {
      let message = 'Request failed';
      try {
        const text = await response.text();
        const parsed = JSON.parse(text);
        message = parsed.error || parsed.message || text;
      } catch (_e) {
        /* leave default message */
      }
      return { _error: true, status: response.status, message: message };
    }

    /* 204 No Content */
    if (response.status === 204) return {};

    return await response.json();
  } catch (err) {
    _mockMode = true;
    return null;
  }
}

/* ── Shorthand methods ── */

/**
 * GET helper
 * @param {string} path
 * @returns {Promise<any>}
 */
api.get = function apiGet(path) {
  return api(path, { method: 'GET' });
};

/**
 * POST helper
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
api.post = function apiPost(path, body) {
  return api(path, { method: 'POST', body: body });
};

/**
 * PUT helper
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
api.put = function apiPut(path, body) {
  return api(path, { method: 'PUT', body: body });
};

/**
 * DELETE helper
 * @param {string} path
 * @returns {Promise<any>}
 */
api.delete = function apiDelete(path) {
  return api(path, { method: 'DELETE' });
};

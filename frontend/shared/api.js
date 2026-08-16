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

import { getSession, clearSession, getGuardianSession, clearGuardianSession } from './session.js';

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
    /* Network/CORS failures should not permanently flip mock mode —
       that skips auth flags like mustChangePassword on later calls. */
    return { _error: true, status: 0, message: (err && err.message) || 'Network error' };
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

/**
 * PATCH helper
 * @param {string} path
 * @param {any} body
 * @returns {Promise<any>}
 */
api.patch = function apiPatch(path, body) {
  return api(path, { method: 'PATCH', body: body });
};

/**
 * School service map — gateway `/svc/<name>` → default dev port.
 * Single source of truth shared with services/gateway SERVICE_MAP.
 */
export const SCHOOL_SERVICES = {
  'school-identity': 3011,
  'school-timetable': 3012,
  'school-attendance': 3013,
  'school-academics': 3014,
  'school-assessment': 3015,
  'school-engagement': 3016,
  'school-fees': 3017,
  'school-transport': 3018,
  'school-compliance': 3019,
  'school-library': 3020,
  'school-surveys': 3022,
};

let _schoolTenantId = 'default';

/**
 * Set tenant id used by `api.school(..., tenantScoped=true)`.
 * @param {string} tenantId
 */
export function setSchoolTenantId(tenantId) {
  _schoolTenantId = (tenantId && String(tenantId).trim()) || 'default';
}

/** @returns {string} */
export function getSchoolTenantId() {
  return _schoolTenantId;
}

/**
 * Domain path segment for a school service (`school-attendance` → `attendance`).
 * @param {string} service
 * @returns {string}
 */
export function schoolServiceDomain(service) {
  return String(service || '').replace(/^school-/, '');
}

/**
 * Scoped client for a school microservice via the gateway `/svc/` prefix.
 * Reuses `api()` auth headers and 401 handling — no separate fetch stack.
 *
 * @param {keyof typeof SCHOOL_SERVICES | string} service
 * @param {boolean} [tenantScoped=true]
 * @returns {{ get: Function, post: Function, put: Function, patch: Function, del: Function, prefix: Function }}
 */
api.school = function apiSchool(service, tenantScoped) {
  const scoped = tenantScoped !== false;
  if (!Object.prototype.hasOwnProperty.call(SCHOOL_SERVICES, service)) {
    throw new Error('Unknown school service: ' + service);
  }
  const domain = schoolServiceDomain(service);

  function prefix(path) {
    const rel = !path || path === '/' ? '' : path.startsWith('/') ? path : '/' + path;
    if (scoped) {
      return (
        '/svc/' +
        service +
        '/api/' +
        domain +
        '/' +
        encodeURIComponent(_schoolTenantId) +
        rel
      );
    }
    return '/svc/' + service + '/api/' + domain + rel;
  }

  return {
    prefix: prefix,
    get: function (path) {
      return api.get(prefix(path));
    },
    post: function (path, body) {
      return api.post(prefix(path), body);
    },
    put: function (path, body) {
      return api.put(prefix(path), body);
    },
    patch: function (path, body) {
      return api.patch(prefix(path), body);
    },
    del: function (path) {
      return api.delete(prefix(path));
    },
  };
};

/**
 * Guardian parent-portal HTTP helper — uses `guardian_session` Bearer token.
 * Paths are gateway `/guardian/*` routes (never call school services directly).
 *
 * @param {string} path
 * @param {RequestInit} [opts]
 * @returns {Promise<any>}
 */
export async function guardianApi(path, opts) {
  if (_mockMode) return null;

  const session = getGuardianSession();
  const headers = Object.assign({}, (opts && opts.headers) || {});

  if (opts && opts.method && opts.method !== 'GET') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const isLogin = path.indexOf('/guardian/login') === 0;
  if (!isLogin && session && session.token) {
    headers['Authorization'] = 'Bearer ' + session.token;
  }

  const fetchOpts = Object.assign({}, opts || {}, { headers: headers });
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
      if (!isLogin) {
        clearGuardianSession();
        if (typeof document !== 'undefined') {
          document.dispatchEvent(
            new CustomEvent('blokhr:guardian:auth:expired', { detail: { path: path } }),
          );
        }
      }
      var authMessage = isLogin ? 'Invalid phone or password' : 'Session expired';
      try {
        var text401 = await response.text();
        if (text401 && text401.charAt(0) === '{') {
          var parsed401 = JSON.parse(text401);
          authMessage = parsed401.error || parsed401.message || authMessage;
        }
      } catch (_e) {
        /* leave default */
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
        /* leave default */
      }
      return { _error: true, status: response.status, message: message };
    }

    if (response.status === 204) return {};
    return await response.json();
  } catch (err) {
    return { _error: true, status: 0, message: (err && err.message) || 'Network error' };
  }
}

guardianApi.get = function (path) {
  return guardianApi(path, { method: 'GET' });
};
guardianApi.post = function (path, body) {
  return guardianApi(path, { method: 'POST', body: body });
};

/**
 * shared/session.js — Session Management
 *
 * THE ONE piece of data that stays in localStorage.
 * Every other preference goes to the database via shared/prefs.js.
 *
 * Storage key: session_{tenantId}  (default: session_default)
 *
 * Session shape:
 *   { name, email, source, sessionToken, mustChangePassword }
 */

let _storageKey = 'session_default';
let _session = null;

/**
 * Change the storage key prefix (for multi-tenant environments).
 * Must be called BEFORE loadSession().
 * @param {string} tenantId
 */
export function setTenantId(tenantId) {
  const newKey = 'session_' + (tenantId || 'default');
  if (_storageKey !== newKey) {
    try {
      const old = localStorage.getItem(_storageKey);
      if (old) {
        localStorage.setItem(newKey, old);
        localStorage.removeItem(_storageKey);
      }
    } catch (_e) {
      /* noop */
    }
    _storageKey = newKey;
  }
}

/**
 * Save session to memory + localStorage.
 * @param {{ name?: string, email: string, source?: string,
 *           sessionToken?: string, mustChangePassword?: boolean }} user
 */
export function saveSession(user) {
  _session = {
    name: user.name || user.email || '',
    email: user.email || '',
    source: user.source || 'local',
    sessionToken: user.sessionToken || '',
    mustChangePassword: user.mustChangePassword || false,
    is_admin: user.is_admin || false,
    role: user.role || 'employee',
  };
  try {
    localStorage.setItem(_storageKey, JSON.stringify(_session));
  } catch (_e) {
    /* storage full or unavailable — session lives in memory only */
  }
}

/**
 * Load session from localStorage into memory.
 * @returns {{ name: string, email: string, source: string,
 *             sessionToken: string, mustChangePassword: boolean } | null}
 */
export function loadSession() {
  if (_session && _session.email) return _session;
  try {
    const raw = localStorage.getItem(_storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) {
        _session = parsed;
        return _session;
      }
    }
  } catch (_e) {
    /* corrupted data */
  }
  return null;
}

/**
 * Clear session from memory + localStorage.
 */
export function clearSession() {
  _session = null;
  try {
    localStorage.removeItem(_storageKey);
  } catch (_e) {
    /* noop */
  }
}

/**
 * Get current in-memory session without touching localStorage.
 * @returns {{ name: string, email: string, source: string,
 *             sessionToken: string, mustChangePassword: boolean } | null}
 */
export function getSession() {
  return _session;
}

/**
 * Update a single field on the in-memory session and persist.
 * @param {string} key
 * @param {any} value
 */
export function updateSession(key, value) {
  if (!_session) return;
  _session[key] = value;
  try {
    localStorage.setItem(_storageKey, JSON.stringify(_session));
  } catch (_e) {
    /* noop */
  }
}

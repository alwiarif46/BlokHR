/**
 * shared/labels.js — Tenant terminology labels (W-05)
 *
 * Three-level fallback for UI nouns: tenant settings_json.terminology →
 * vertical defaults (HR / school) → the key string itself.
 *
 * New school modules will consume t() (F pack). Do NOT retrofit existing
 * HR modules to use t() in this prompt — leave them on hardcoded English.
 *
 * No DOM access in this module.
 */

import { api } from './api.js';
import { onSSE } from './sse.js';

/** @type {Record<string, string>} */
const HR_TERMINOLOGY_DEFAULTS = {
  person: 'Employee',
  person_plural: 'Employees',
  group: 'Department',
  subgroup: 'Team',
  interval: 'Shift',
  supervisor: 'Manager',
};

/** @type {Record<string, string>} */
const SCHOOL_TERMINOLOGY_DEFAULTS = {
  person: 'Student',
  person_plural: 'Students',
  group: 'Class',
  subgroup: 'Section',
  interval: 'Period',
  supervisor: 'Class Teacher',
};

/** @type {Record<string, string>} */
let _tenantMap = {};
/** @type {'hr'|'school'} */
let _vertical = 'hr';
/** @type {Array<() => void>} */
let _changeListeners = [];
let _sseBound = false;

/**
 * @param {unknown} settingsSnapshot — GET /api/settings body, tenant_settings row, or { terminology }
 * @param {string|null|undefined} vertical
 */
export function initLabels(settingsSnapshot, vertical) {
  _vertical = vertical === 'school' ? 'school' : 'hr';
  _tenantMap = _extractTerminology(settingsSnapshot);
  _ensureSse();
  _notify();
}

/**
 * Resolve a terminology key.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  if (!key) return '';
  if (_tenantMap[key]) return _tenantMap[key];
  const defaults = _vertical === 'school' ? SCHOOL_TERMINOLOGY_DEFAULTS : HR_TERMINOLOGY_DEFAULTS;
  if (defaults[key]) return defaults[key];
  return key;
}

/**
 * Subscribe to label map changes (SSE refresh or re-init).
 * @param {() => void} cb
 * @returns {() => void} unsubscribe
 */
export function onLabelsChanged(cb) {
  if (typeof cb !== 'function') return function () {};
  _changeListeners.push(cb);
  return function unsubscribe() {
    const idx = _changeListeners.indexOf(cb);
    if (idx >= 0) _changeListeners.splice(idx, 1);
  };
}

/** @returns {'hr'|'school'} */
export function getLabelsVertical() {
  return _vertical;
}

/**
 * Apply a fresh snapshot without re-binding SSE (used by tests + internal refresh).
 * @param {unknown} settingsSnapshot
 * @param {string|null|undefined} [vertical]
 */
export function applyLabelsSnapshot(settingsSnapshot, vertical) {
  if (vertical === 'school' || vertical === 'hr') {
    _vertical = vertical;
  } else {
    const fromSnap = _extractVertical(settingsSnapshot);
    if (fromSnap) _vertical = fromSnap;
  }
  _tenantMap = _extractTerminology(settingsSnapshot);
  _notify();
}

function _ensureSse() {
  if (_sseBound) return;
  _sseBound = true;
  onSSE('settings-update', function () {
    _refreshFromApi();
  });
}

async function _refreshFromApi() {
  const data = await api.get('/api/settings');
  if (!data || data._error) return;
  const sj =
    (data.tenant_settings && data.tenant_settings.settings_json) ||
    data.settings_json ||
    {};
  if (sj.vertical === 'school' || sj.vertical === 'hr') {
    _vertical = sj.vertical;
  }
  applyLabelsSnapshot({ settings_json: sj, terminology: sj.terminology }, _vertical);
}

/**
 * @param {unknown} snapshot
 * @returns {Record<string, string>}
 */
function _extractTerminology(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const root = /** @type {Record<string, unknown>} */ (snapshot);
  let term = root.terminology;
  if (!term && root.settings_json && typeof root.settings_json === 'object') {
    term = /** @type {Record<string, unknown>} */ (root.settings_json).terminology;
  }
  if (
    !term &&
    root.tenant_settings &&
    typeof root.tenant_settings === 'object' &&
    /** @type {Record<string, unknown>} */ (root.tenant_settings).settings_json &&
    typeof /** @type {Record<string, unknown>} */ (root.tenant_settings).settings_json === 'object'
  ) {
    term = /** @type {Record<string, unknown>} */ (
      /** @type {Record<string, unknown>} */ (root.tenant_settings).settings_json
    ).terminology;
  }
  if (!term || typeof term !== 'object' || Array.isArray(term)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  Object.keys(/** @type {object} */ (term)).forEach(function (k) {
    const v = /** @type {Record<string, unknown>} */ (term)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  });
  return out;
}

/**
 * @param {unknown} snapshot
 * @returns {'hr'|'school'|null}
 */
function _extractVertical(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const root = /** @type {Record<string, unknown>} */ (snapshot);
  if (root.vertical === 'school' || root.vertical === 'hr') return root.vertical;
  const sj = root.settings_json;
  if (sj && typeof sj === 'object') {
    const v = /** @type {Record<string, unknown>} */ (sj).vertical;
    if (v === 'school' || v === 'hr') return v;
  }
  return null;
}

function _notify() {
  _changeListeners.forEach(function (cb) {
    try {
      cb();
    } catch (_e) {
      /* swallow */
    }
  });
}

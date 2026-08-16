/**
 * school_roll_call/queue.js
 *
 * Durable offline queue for unsent roll-call submissions (F-03 approved IndexedDB exception).
 *
 * Store contract — ONLY `pending_marks` records live here. Never write rosters, photos,
 * prefs, or any other domain data into this database.
 *
 * DB: blokhr_rollcall_{tenantId} v1, object store `pending_marks`, keyPath `idempotency_key`.
 * Flush uses shared/api.js; 2xx (incl. P2-03 idempotent replay) deletes the record.
 * Multi-tab: navigator.locks.request('rollcall-flush-{tenantId}') exclusive — server
 * idempotency (P2-03) remains the backstop if a lock is unavailable.
 */

import { api, getSchoolTenantId } from '../../shared/api.js';

const STORE = 'pending_marks';
const DB_VERSION = 1;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_CAP_MS = 10 * 60 * 1000;

/** @type {Map<string, IDBDatabase>} */
const _dbCache = new Map();

/**
 * @param {number} attempts
 * @returns {number}
 */
export function backoffMs(attempts) {
  const n = Math.max(0, Number(attempts) || 0);
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, n), BACKOFF_CAP_MS);
}

/**
 * @param {string} tenantId
 * @returns {string}
 */
export function dbNameForTenant(tenantId) {
  return 'blokhr_rollcall_' + (tenantId || 'default');
}

/**
 * @param {string} [iso]
 * @returns {boolean}
 */
export function isStaleRecord(createdAt, nowMs) {
  const t = Date.parse(createdAt || '');
  if (!Number.isFinite(t)) return false;
  const now = nowMs != null ? nowMs : Date.now();
  return now - t > STALE_MS;
}

/**
 * Open (or reuse) the per-tenant roll-call queue DB.
 * @param {string} tenantId
 * @returns {Promise<IDBDatabase>}
 */
export function openQueueDb(tenantId) {
  const name = dbNameForTenant(tenantId);
  if (_dbCache.has(name)) return Promise.resolve(_dbCache.get(name));

  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(name, DB_VERSION);
    req.onerror = function () {
      reject(req.error || new Error('indexedDB open failed'));
    };
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'idempotency_key' });
      }
    };
    req.onsuccess = function () {
      const db = req.result;
      _dbCache.set(name, db);
      db.onversionchange = function () {
        db.close();
        _dbCache.delete(name);
      };
      resolve(db);
    };
  });
}

/** @param {string} tenantId */
export function closeQueueDb(tenantId) {
  const name = dbNameForTenant(tenantId);
  const db = _dbCache.get(name);
  if (db) {
    db.close();
    _dbCache.delete(name);
  }
}

/**
 * @param {IDBDatabase} db
 * @param {IDBTransactionMode} mode
 * @returns {IDBObjectStore}
 */
function store(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * @param {string} tenantId
 * @param {object} record
 * @returns {Promise<object>}
 */
export async function putPending(tenantId, record) {
  assertPendingShape(record);
  const db = await openQueueDb(tenantId);
  return new Promise(function (resolve, reject) {
    const req = store(db, 'readwrite').put(record);
    req.onsuccess = function () {
      resolve(record);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

/**
 * @param {string} tenantId
 * @param {string} key
 * @returns {Promise<object|undefined>}
 */
export async function getPending(tenantId, key) {
  const db = await openQueueDb(tenantId);
  return new Promise(function (resolve, reject) {
    const req = store(db, 'readonly').get(key);
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

/**
 * @param {string} tenantId
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deletePending(tenantId, key) {
  const db = await openQueueDb(tenantId);
  return new Promise(function (resolve, reject) {
    const req = store(db, 'readwrite').delete(key);
    req.onsuccess = function () {
      resolve();
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

/**
 * Oldest-first by created_at.
 * @param {string} tenantId
 * @returns {Promise<object[]>}
 */
export async function listPending(tenantId) {
  const db = await openQueueDb(tenantId);
  return new Promise(function (resolve, reject) {
    const req = store(db, 'readonly').getAll();
    req.onsuccess = function () {
      const rows = Array.isArray(req.result) ? req.result.slice() : [];
      rows.sort(function (a, b) {
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
      resolve(rows);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

/**
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
export async function countPending(tenantId) {
  const rows = await listPending(tenantId);
  return rows.length;
}

/**
 * Reject writes that are not pending_marks shaped (hygiene guard).
 * @param {object} record
 */
export function assertPendingShape(record) {
  if (!record || typeof record !== 'object') throw new Error('invalid pending record');
  const required = [
    'idempotency_key',
    'tenant_id',
    'context',
    'marks',
    'marked_by',
    'created_at',
    'attempts',
    'last_error',
  ];
  for (let i = 0; i < required.length; i++) {
    if (!(required[i] in record)) {
      throw new Error('pending_marks record missing ' + required[i]);
    }
  }
  const forbidden = ['roster', 'photos', 'photo_ref', 'prefs', 'students'];
  for (let i = 0; i < forbidden.length; i++) {
    if (forbidden[i] in record) {
      throw new Error('pending_marks must not store ' + forbidden[i]);
    }
  }
}

/**
 * @param {string} tenantId
 * @param {() => Promise<any>} fn
 */
async function withFlushLock(tenantId, fn) {
  const lockName = 'rollcall-flush-' + tenantId;
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request(lockName, { mode: 'exclusive' }, function () {
      return fn();
    });
  }
  return fn();
}

/**
 * POST one pending record to school-attendance /mark.
 * @param {object} record
 * @returns {Promise<{ ok: boolean, status?: number, message?: string, replayed?: boolean }>}
 */
export async function postMarkRecord(record) {
  const client = api.school('school-attendance');
  const body = {
    context: record.context,
    marks: record.marks,
    marked_by: record.marked_by,
    idempotency_key: record.idempotency_key,
  };
  const res = await client.post('/mark', body);
  if (res && !res._error) {
    return { ok: true, replayed: res.replayed === true };
  }
  return {
    ok: false,
    status: res && res.status,
    message: (res && res.message) || 'mark failed',
  };
}

/**
 * Flush pending marks oldest-first.
 * @param {string} tenantId
 * @param {{ allowStaleKeys?: Set<string>|string[], forceAll?: boolean, nowMs?: number }} [opts]
 * @returns {Promise<{ flushed: number, remaining: number, errors: string[] }>}
 */
export async function flushPending(tenantId, opts) {
  const options = opts || {};
  const allowStale = new Set(
    Array.isArray(options.allowStaleKeys)
      ? options.allowStaleKeys
      : options.allowStaleKeys
        ? Array.from(options.allowStaleKeys)
        : [],
  );
  const forceAll = options.forceAll === true;
  const nowMs = options.nowMs != null ? options.nowMs : Date.now();

  return withFlushLock(tenantId, async function () {
    const rows = await listPending(tenantId);
    let flushed = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const stale = isStaleRecord(row.created_at, nowMs);
      if (stale && !forceAll && !allowStale.has(row.idempotency_key)) {
        continue;
      }

      const nextAt = row.next_attempt_at ? Date.parse(row.next_attempt_at) : 0;
      if (!forceAll && !allowStale.has(row.idempotency_key) && nextAt && nextAt > nowMs) {
        continue;
      }

      const result = await postMarkRecord(row);
      if (result.ok) {
        await deletePending(tenantId, row.idempotency_key);
        flushed++;
        continue;
      }

      const attempts = (Number(row.attempts) || 0) + 1;
      const wait = backoffMs(attempts);
      const updated = Object.assign({}, row, {
        attempts: attempts,
        last_error: result.message || 'flush failed',
        next_attempt_at: new Date(nowMs + wait).toISOString(),
      });
      await putPending(tenantId, updated);
      errors.push(updated.last_error);
    }

    const remaining = await countPending(tenantId);
    return { flushed: flushed, remaining: remaining, errors: errors };
  });
}

/**
 * Build a pending record (does not write).
 * @param {{ tenantId: string, context: object, marks: object[], markedBy: string, idempotencyKey: string, createdAt?: string }} input
 */
export function buildPendingRecord(input) {
  return {
    idempotency_key: input.idempotencyKey,
    tenant_id: input.tenantId,
    context: input.context,
    marks: input.marks,
    marked_by: input.markedBy,
    created_at: input.createdAt || new Date().toISOString(),
    attempts: 0,
    last_error: null,
  };
}

/**
 * Write → optimistic path helper used by the UI submit flow.
 * @param {string} tenantId
 * @param {object} record
 * @returns {Promise<{ record: object, flush: { flushed: number, remaining: number, errors: string[] } }>}
 */
export async function enqueueAndFlush(tenantId, record) {
  await putPending(tenantId, record);
  const flush = await flushPending(tenantId, {
    allowStaleKeys: [record.idempotency_key],
  });
  return { record: record, flush: flush };
}

/**
 * Logout hook: one final flush; return how many remain (caller warns; do not delete).
 * @param {string} [tenantId]
 * @returns {Promise<number>} remaining count
 */
export async function handleRollCallLogout(tenantId) {
  const tid = tenantId || getSchoolTenantId();
  try {
    await flushPending(tid, { forceAll: false });
  } catch (_e) {
    /* still report remaining */
  }
  try {
    return await countPending(tid);
  } catch (_e2) {
    return 0;
  }
}

/**
 * @returns {string}
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'rc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Minimal in-memory IndexedDB shim for F-03 tests (no npm dependency).
 * Covers open/upgrade + objectStore put/get/getAll/delete used by queue.js.
 */
function installMemoryIndexedDB() {
  /** @type {Map<string, Map<string, any>>} */
  const databases = new Map();

  class MemRequest {
    constructor() {
      this.result = undefined;
      this.error = null;
      this.onsuccess = null;
      this.onerror = null;
      this.onupgradeneeded = null;
    }
    _ok(result) {
      this.result = result;
      if (this.onsuccess) this.onsuccess({ target: this });
    }
    _fail(err) {
      this.error = err;
      if (this.onerror) this.onerror({ target: this });
    }
  }

  class MemStore {
    constructor(map) {
      this._map = map;
    }
    put(value) {
      const req = new MemRequest();
      queueMicrotask(() => {
        this._map.set(value.idempotency_key, JSON.parse(JSON.stringify(value)));
        req._ok(value.idempotency_key);
      });
      return req;
    }
    get(key) {
      const req = new MemRequest();
      queueMicrotask(() => {
        req._ok(this._map.has(key) ? JSON.parse(JSON.stringify(this._map.get(key))) : undefined);
      });
      return req;
    }
    getAll() {
      const req = new MemRequest();
      queueMicrotask(() => {
        req._ok(Array.from(this._map.values()).map((v) => JSON.parse(JSON.stringify(v))));
      });
      return req;
    }
    delete(key) {
      const req = new MemRequest();
      queueMicrotask(() => {
        this._map.delete(key);
        req._ok(undefined);
      });
      return req;
    }
  }

  class MemTx {
    constructor(map) {
      this._map = map;
    }
    objectStore() {
      return new MemStore(this._map);
    }
  }

  class MemDb {
    constructor(name, map) {
      this.name = name;
      this._map = map;
      this.objectStoreNames = {
        contains: (n) => n === 'pending_marks',
      };
      this.onversionchange = null;
    }
    transaction() {
      return new MemTx(this._map);
    }
    createObjectStore() {
      return new MemStore(this._map);
    }
    close() {}
  }

  globalThis.indexedDB = {
    open(name) {
      const req = new MemRequest();
      queueMicrotask(() => {
        const isNew = !databases.has(name);
        if (isNew) databases.set(name, new Map());
        const db = new MemDb(name, databases.get(name));
        if (isNew && req.onupgradeneeded) {
          req.result = db;
          req.onupgradeneeded({ target: req });
        }
        req._ok(db);
      });
      return req;
    },
  };

  return {
    reset() {
      databases.clear();
    },
  };
}

describe('school_roll_call (F-03)', () => {
  /** @type {ReturnType<typeof installMemoryIndexedDB>} */
  let idb;
  /** @type {typeof import('../../modules/school_roll_call/school_roll_call.js')} */
  let mod;
  /** @type {typeof import('../../modules/school_roll_call/queue.js')} */
  let queue;
  let schoolPost;
  let schoolPatch;
  let savePrefs;
  let toastFn;
  let markFail = false;

  beforeEach(async () => {
    vi.resetModules();
    idb = installMemoryIndexedDB();
    idb.reset();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    markFail = false;

    const schoolGet = vi.fn(async (path) => {
      if (path.includes('/reason-codes')) {
        return {
          reasonCodes: [
            { id: 'rc-sick', code: 'SICK', label: 'Sick', isActive: true },
            { id: 'rc-leave', code: 'LEAVE', label: 'Leave', isActive: true },
          ],
        };
      }
      if (path.includes('/teachers/') && path.endsWith('/slots')) {
        return {
          slots: [
            {
              sectionId: 'sec-1',
              allocationId: 'alloc-1',
              periodIndex: 0,
            },
          ],
        };
      }
      if (path === '/sections/sec-1') {
        return { id: 'sec-1', classLabel: '5', section: 'A' };
      }
      if (path.includes('/instances')) {
        return {
          instances: [
            {
              id: 'inst-1',
              sectionId: 'sec-1',
              periodIndex: 0,
              status: 'scheduled',
              allocationId: 'alloc-1',
              date: '2026-08-15',
              subjectLabel: 'Math',
            },
          ],
        };
      }
      if (path.startsWith('/students?')) {
        return {
          items: [
            { id: 's1', firstName: 'Asha', lastName: 'Rao', photoRef: null },
            { id: 's2', firstName: 'Arun', lastName: 'Rao', photoRef: null },
            { id: 's3', firstName: 'Isha', lastName: 'Nair', photoRef: null },
          ],
          total: 3,
        };
      }
      return {};
    });

    schoolPost = vi.fn(async (path) => {
      if (path === '/mark') {
        if (markFail) return { _error: true, status: 500, message: 'upstream down' };
        return { records: [], replayed: false };
      }
      return {};
    });

    schoolPatch = vi.fn(async () => ({ id: 'inst-1', status: 'held' }));
    savePrefs = vi.fn(async () => true);
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      const school = () => ({
        get: (p) => schoolGet(p),
        post: (p, b) => schoolPost(p, b),
        put: vi.fn(),
        patch: (p, b) => schoolPatch(p, b),
        del: vi.fn(),
      });
      return {
        ...actual,
        getSchoolTenantId: () => 'tenant-t',
        api: Object.assign(async () => null, {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          school,
        }),
      };
    });

    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));

    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => ({ email: 'teacher@school.test', name: 'Teacher' }),
      };
    });

    vi.doMock('../../shared/prefs.js', () => ({
      loadPrefs: async () => ({}),
      getPrefs: () => ({}),
      savePrefs,
      applyPrefsToDOM: () => {},
    }));

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
    }));

    queue = await import('../../modules/school_roll_call/queue.js');
    mod = await import('../../modules/school_roll_call/school_roll_call.js');
    mod.renderSchoolRollCallPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.rc-tile').length).toBeGreaterThan(0);
    });
  });

  afterEach(() => {
    if (mod && mod.rcTeardown) mod.rcTeardown();
    if (queue) queue.closeQueueDb('tenant-t');
    vi.restoreAllMocks();
    idb.reset();
  });

  it('defaults all tiles to present and counter math', () => {
    const state = mod.rcGetState();
    expect(state.students.length).toBe(3);
    Object.values(state.marks).forEach((m) => {
      expect(m.status).toBe('present');
    });
    const c = mod.computeCounter(state.marks);
    expect(c.label).toBe('3 present · 0 absent');
    expect(document.getElementById('rcCounter').textContent).toMatch(/3 present/);
  });

  it('cycles Present → Absent → Late and opens reason / late UI', async () => {
    expect(mod.cycleStatus('present')).toBe('absent');
    expect(mod.cycleStatus('absent')).toBe('late');
    expect(mod.cycleStatus('late')).toBe('present');

    mod.rcCycleStudent('s1');
    expect(mod.rcGetState().marks.s1.status).toBe('absent');
    expect(document.querySelector('[data-inline="absent"]')).toBeTruthy();
    expect(document.getElementById('rcReason')).toBeTruthy();

    document.querySelector('[data-rc-reason-ok="s1"]').click();
    expect(mod.rcGetState().marks.s1.status).toBe('absent');

    mod.rcCycleStudent('s1');
    expect(mod.rcGetState().marks.s1.status).toBe('late');
    expect(document.querySelector('[data-inline="late"]')).toBeTruthy();
    expect(document.getElementById('rcLateMin').value).toBe('10');
  });

  it('requires late minutes', () => {
    expect(mod.validateMark({ status: 'late', lateMinutes: null })).toMatch(/late_minutes/);
    expect(mod.validateMark({ status: 'late', lateMinutes: 5 })).toBeNull();
  });

  it('keeps idempotency key stable across retries', async () => {
    const key = queue.newIdempotencyKey();
    const record = queue.buildPendingRecord({
      tenantId: 'tenant-t',
      idempotencyKey: key,
      markedBy: 'teacher@school.test',
      context: { date: '2026-08-15', period_instance_id: 'inst-1' },
      marks: [{ student_id: 's1', status: 'present' }],
    });
    markFail = true;
    await queue.enqueueAndFlush('tenant-t', record);
    const again = await queue.getPending('tenant-t', key);
    expect(again.idempotency_key).toBe(key);
    expect(again.attempts).toBe(1);
    expect(again.last_error).toMatch(/upstream/);

    markFail = false;
    await queue.flushPending('tenant-t', { allowStaleKeys: [key], forceAll: true });
    expect(await queue.getPending('tenant-t', key)).toBeUndefined();
  });

  it('queue write → flush → delete on 2xx', async () => {
    const key = 'idem-ok-1';
    await queue.putPending(
      'tenant-t',
      queue.buildPendingRecord({
        tenantId: 'tenant-t',
        idempotencyKey: key,
        markedBy: 't',
        context: { date: '2026-08-15', period_instance_id: 'inst-1' },
        marks: [{ student_id: 's1', status: 'present' }],
      }),
    );
    expect(await queue.countPending('tenant-t')).toBe(1);
    const result = await queue.flushPending('tenant-t');
    expect(result.flushed).toBe(1);
    expect(await queue.countPending('tenant-t')).toBe(0);
    expect(schoolPost).toHaveBeenCalledWith(
      '/mark',
      expect.objectContaining({ idempotency_key: key }),
    );
  });

  it('retry/backoff on failure', () => {
    expect(queue.backoffMs(0)).toBe(30000);
    expect(queue.backoffMs(1)).toBe(60000);
    expect(queue.backoffMs(10)).toBe(10 * 60 * 1000);
  });

  it('startup recovery resumes pending (flush on load)', async () => {
    await queue.putPending(
      'tenant-t',
      queue.buildPendingRecord({
        tenantId: 'tenant-t',
        idempotencyKey: 'startup-1',
        markedBy: 't',
        context: { date: '2026-08-15', period_instance_id: 'inst-1' },
        marks: [{ student_id: 's1', status: 'present' }],
      }),
    );
    await queue.flushPending('tenant-t');
    expect(await queue.countPending('tenant-t')).toBe(0);
  });

  it('stale-record gate skips auto flush until explicit allow', async () => {
    const old = queue.buildPendingRecord({
      tenantId: 'tenant-t',
      idempotencyKey: 'stale-1',
      markedBy: 't',
      context: { date: '2026-01-01', period_instance_id: 'inst-1' },
      marks: [{ student_id: 's1', status: 'present' }],
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await queue.putPending('tenant-t', old);
    expect(queue.isStaleRecord(old.created_at)).toBe(true);
    const blocked = await queue.flushPending('tenant-t');
    expect(blocked.flushed).toBe(0);
    expect(await queue.countPending('tenant-t')).toBe(1);
    const forced = await queue.flushPending('tenant-t', { allowStaleKeys: ['stale-1'] });
    expect(forced.flushed).toBe(1);
  });

  it('logout warning path returns remaining count without deleting', async () => {
    markFail = true;
    await queue.putPending(
      'tenant-t',
      queue.buildPendingRecord({
        tenantId: 'tenant-t',
        idempotencyKey: 'logout-1',
        markedBy: 't',
        context: { date: '2026-08-15', period_instance_id: 'inst-1' },
        marks: [{ student_id: 's1', status: 'present' }],
      }),
    );
    const remaining = await queue.handleRollCallLogout('tenant-t');
    expect(remaining).toBe(1);
    expect(await queue.getPending('tenant-t', 'logout-1')).toBeTruthy();
  });

  it('seating order persistence calls savePrefs', async () => {
    mod.rcSetState({
      view: 'seating',
      students: [
        { id: 's1', name: 'Asha Rao' },
        { id: 's2', name: 'Arun Rao' },
        { id: 's3', name: 'Isha Nair' },
      ],
      marks: mod.defaultPresentMarks([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
      ]),
    });
    const from = document.querySelector('[data-student-id="s1"]');
    const to = document.querySelector('[data-student-id="s3"]');
    from.dispatchEvent(new Event('dragstart', { bubbles: true }));
    to.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(savePrefs).toHaveBeenCalled();
    });
    expect(savePrefs.mock.calls[0][0].notification_prefs).toMatch(/rollcall_seat_orders/);
  });

  it('rejects non pending_marks payloads', () => {
    expect(() =>
      queue.assertPendingShape({
        idempotency_key: 'x',
        tenant_id: 't',
        context: {},
        marks: [],
        marked_by: 'a',
        created_at: 'now',
        attempts: 0,
        last_error: null,
        roster: [],
      }),
    ).toThrow(/roster/);
  });

  it('submit uses queue and patches instance to held', async () => {
    await mod.rcSubmit();
    expect(schoolPost).toHaveBeenCalledWith(
      '/mark',
      expect.objectContaining({
        idempotency_key: expect.any(String),
        marked_by: 'teacher@school.test',
      }),
    );
    expect(schoolPatch).toHaveBeenCalledWith(
      '/instances/inst-1',
      expect.objectContaining({ status: 'held' }),
    );
    expect(toastFn).toHaveBeenCalledWith('Saved ✓', 'success');
  });
});

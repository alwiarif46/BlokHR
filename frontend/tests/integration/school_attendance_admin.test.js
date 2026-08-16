import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_attendance_admin (F-04)', () => {
  /** @type {typeof import('../../modules/school_attendance_admin/school_attendance_admin.js')} */
  let mod;
  let attGet;
  let attPatch;
  let attPost;
  let idGet;
  let engPost;
  let toastFn;
  let navigateToModule;
  let patchClosed = false;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionStorage.clear();
    patchClosed = false;

    attGet = vi.fn(async (path) => {
      if (path.startsWith('/register')) {
        return {
          date: '2026-08-15',
          register: {
            s1: { id: 'rec-1', status: 'present', studentId: 's1' },
            s2: { status: 'unmarked' },
            s3: { id: 'rec-3', status: 'absent', studentId: 's3' },
          },
        };
      }
      if (path.startsWith('/unexplained')) {
        return {
          date: '2026-08-15',
          unexplained: [
            {
              id: 'rec-3',
              studentId: 's3',
              date: '2026-08-15',
              status: 'absent',
              explained: false,
              attachment_ref: null,
            },
          ],
        };
      }
      if (path === '/reason-codes') {
        return { reasonCodes: [{ id: 'rc1', code: 'FIX', label: 'Correction' }] };
      }
      return {};
    });

    attPatch = vi.fn(async () => {
      if (patchClosed) {
        return {
          _error: true,
          status: 409,
          message: 'window_closed',
          regularization_required: true,
        };
      }
      return { id: 'rec-1', status: 'late' };
    });

    attPost = vi.fn(async (path) => {
      if (path.includes('/regularize')) return { id: 'rec-1', status: 'present', source: 'regularization' };
      return {};
    });

    idGet = vi.fn(async (path) => {
      if (path.startsWith('/students')) {
        return {
          items: [
            { id: 's1', firstName: 'Asha', lastName: 'Rao' },
            { id: 's2', firstName: 'Arun', lastName: 'Rao' },
            { id: 's3', firstName: 'Isha', lastName: 'Nair' },
          ],
          total: 3,
        };
      }
      return {};
    });

    engPost = vi.fn(async () => ({ thread: { id: 'th1' } }));
    toastFn = vi.fn();
    navigateToModule = vi.fn();

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(async () => null, {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          school: (name) => {
            if (name === 'school-attendance') {
              return {
                get: attGet,
                put: vi.fn(),
                patch: attPatch,
                post: attPost,
                del: vi.fn(),
              };
            }
            if (name === 'school-identity') {
              return { get: idGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            if (name === 'school-engagement') {
              return { get: vi.fn(), post: engPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
          },
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
        getSession: () => ({
          email: 'office@school.test',
          name: 'Office',
          schoolRole: 'school_admin',
          is_admin: false,
        }),
      };
    });

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule,
    }));

    mod = await import('../../modules/school_attendance_admin/school_attendance_admin.js');
    mod.renderSchoolAttendanceAdminPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.aa-table, .aa-empty')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders registers tab with unmarked cells and stats', () => {
    expect(mod.aaGetState().tab).toBe('registers');
    expect(document.body.textContent).toMatch(/Unmarked/);
    expect(document.querySelector('.aa-badge.unmarked')).toBeTruthy();
    expect(document.querySelector('[data-aa-edit="rec-1"]')).toBeTruthy();
  });

  it('switches to unexplained and renders', async () => {
    mod.aaSwitchTab('unexplained');
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/unexplained|Ack|Details/i);
    });
  });

  it('only exposes registers and unexplained tabs', () => {
    const tabs = [...document.querySelectorAll('.aa-tab')].map((el) => el.dataset.tab);
    expect(tabs).toEqual(['registers', 'unexplained']);
  });

  it('policy pointer sets scs_open_tab and navigates to school_settings', () => {
    document.getElementById('aaPolicyLink').click();
    expect(sessionStorage.getItem('scs_open_tab')).toBe('attendance_policy');
    expect(navigateToModule).toHaveBeenCalledWith('school_settings');
  });

  it('eligibility pointer opens eligibility tab in school settings', () => {
    document.getElementById('aaEligLink').click();
    expect(sessionStorage.getItem('scs_open_tab')).toBe('eligibility');
    expect(navigateToModule).toHaveBeenCalledWith('school_settings');
  });

  it('window-closed 409 opens regularize path', async () => {
    patchClosed = true;
    mod.aaSetState({
      reasonCodes: [{ id: 'rc1', code: 'FIX', label: 'Correction' }],
    });
    mod.aaOpenEditRecord('rec-1', 'present');
    document.getElementById('aaEditSave').click();
    await vi.waitFor(() => {
      expect(document.getElementById('aaRegHelp')).toBeTruthy();
    });
    expect(document.getElementById('aaRegHelp').textContent).toMatch(/window/);
    expect(toastFn).toHaveBeenCalledWith('window_closed', 'error');

    document.getElementById('aaRegStatus').value = 'present';
    document.getElementById('aaRegExcuse').value = 'excused';
    document.getElementById('aaRegReason').value = 'rc1';
    document.getElementById('aaRegSave').click();
    await vi.waitFor(() => {
      expect(attPost).toHaveBeenCalledWith(
        '/records/rec-1/regularize',
        expect.objectContaining({ reason_code_id: 'rc1' }),
      );
    });
  });
});

describe('school_attendance_admin L6 role gates (P12-06)', () => {
  /** @type {typeof import('../../modules/school_attendance_admin/school_attendance_admin.js')} */
  let mod;
  let attGet;
  let idGet;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionStorage.clear();

    attGet = vi.fn(async (path) => {
      if (path.startsWith('/register')) {
        return {
          date: '2026-08-15',
          register: { s1: { id: 'rec-1', status: 'present', studentId: 's1' } },
        };
      }
      if (path === '/reason-codes') return { reasonCodes: [] };
      if (path.startsWith('/unexplained')) return { date: '2026-08-15', unexplained: [] };
      return {};
    });
    idGet = vi.fn(async () => ({
      items: [{ id: 's1', firstName: 'Asha', lastName: 'Rao' }],
      total: 1,
    }));

    vi.doMock('../../shared/api.js', async () => {
      const actual = await vi.importActual('../../shared/api.js');
      return {
        ...actual,
        api: Object.assign(async () => null, {
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          school: (name) => {
            if (name === 'school-attendance') {
              return {
                get: attGet,
                put: vi.fn(),
                patch: vi.fn(),
                post: vi.fn(),
                del: vi.fn(),
              };
            }
            if (name === 'school-identity') {
              return { get: idGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
            }
            return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() };
          },
        }),
      };
    });
    vi.doMock('../../shared/toast.js', () => ({ toast: vi.fn(), setToastDuration: () => {} }));
    vi.doMock('../../shared/session.js', async () => {
      const actual = await vi.importActual('../../shared/session.js');
      return {
        ...actual,
        getSession: () => ({ email: 'office@school.test', schoolRole: 'office' }),
      };
    });
    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
      navigateToModule: vi.fn(),
    }));

    mod = await import('../../modules/school_attendance_admin/school_attendance_admin.js');
    mod.renderSchoolAttendanceAdminPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.aa-table, .aa-empty')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('hides Settings/Nudge policy links for office', () => {
    /* L6 cosmetic — enforced server-side by P12-04 */
    expect(document.getElementById('aaPolicyLink')).toBeNull();
    expect(document.getElementById('aaNudgeLink')).toBeNull();
  });

  it('blocks regularize dialog for office', () => {
    mod.aaOpenRegularizeDialog('rec-1', 'present', 'window_closed');
    expect(document.getElementById('aaRegHelp')).toBeNull();
  });
});

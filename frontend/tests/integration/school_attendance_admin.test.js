import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school_attendance_admin (F-04)', () => {
  /** @type {typeof import('../../modules/school_attendance_admin/school_attendance_admin.js')} */
  let mod;
  let attGet;
  let attPut;
  let attPatch;
  let attPost;
  let idGet;
  let engPost;
  let toastFn;
  let patchClosed = false;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
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
      if (path === '/settings') {
        return {
          granularity: 'day',
          editWindowMinutes: 120,
          lateThresholdMinutes: 15,
          halfDayMinMinutes: 180,
          dayDerivation: 'majority',
        };
      }
      if (path.includes('/eligibility')) {
        return {
          pct: 82,
          threshold: 75,
          eligible: true,
          projected_pct_if_no_more_absences: 84,
        };
      }
      if (path === '/nudge/config') {
        return {
          enabled: true,
          atRiskPct: 10,
          chronicDays: 18,
          holdoutPct: 10,
          maxMessagesPerTerm: 6,
        };
      }
      if (path === '/nudge/report') {
        return {
          treatment: { mean_absence_pct: 8.5, message_count: 12, student_count: 40 },
          holdout: { mean_absence_pct: 11.2, message_count: 0, student_count: 5 },
        };
      }
      if (path === '/reason-codes') {
        return { reasonCodes: [{ id: 'rc1', code: 'FIX', label: 'Correction' }] };
      }
      return {};
    });

    attPut = vi.fn(async (path, body) => {
      if (path === '/settings') {
        if (body.late_threshold_minutes < 5) {
          return { _error: true, status: 400, message: 'late_threshold_minutes must be an integer between 5 and 120' };
        }
        return { settings: { ...body, granularity: body.granularity } };
      }
      if (path === '/nudge/config') return { config: body };
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
      if (path === '/nudge/run') return { sent: 3, skipped: 1 };
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
                put: attPut,
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
        getSession: () => ({ email: 'office@school.test', name: 'Office' }),
      };
    });

    vi.doMock('../../shared/router.js', () => ({
      registerModule: () => {},
    }));

    mod = await import('../../modules/school_attendance_admin/school_attendance_admin.js');
    mod.renderSchoolAttendanceAdminPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.querySelector('.aa-table, .aa-empty')).toBeTruthy();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders registers tab with unmarked cells and stats', () => {
    expect(mod.aaGetState().tab).toBe('registers');
    expect(document.body.textContent).toMatch(/Unmarked/);
    expect(document.querySelector('.aa-badge.unmarked')).toBeTruthy();
    expect(document.querySelector('[data-aa-edit="rec-1"]')).toBeTruthy();
  });

  it('switches to each tab and renders', async () => {
    mod.aaSwitchTab('unexplained');
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/unexplained|Ack|Details/i);
    });

    mod.aaSwitchTab('settings');
    await vi.waitFor(() => {
      expect(document.getElementById('aaSettingsForm')).toBeTruthy();
      expect(document.getElementById('aaGranHelp').textContent.length).toBeGreaterThan(10);
    });

    mod.aaSwitchTab('eligibility');
    await vi.waitFor(() => {
      expect(document.getElementById('aaElTable')).toBeTruthy();
      expect(document.body.textContent).toMatch(/82%/);
      expect(document.querySelector('.aa-badge.eligible')).toBeTruthy();
    });

    mod.aaSwitchTab('nudge');
    await vi.waitFor(() => {
      expect(document.getElementById('aaNudgeReport')).toBeTruthy();
      expect(document.getElementById('aaTreatMean').textContent).toMatch(/8\.5/);
      expect(document.getElementById('aaHoldMean').textContent).toMatch(/11\.2/);
      expect(document.getElementById('aaTreatMsg').textContent).toBe('12');
      expect(document.getElementById('aaHoldMsg').textContent).toBe('0');
    });
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

  it('settings validation blocks bad late threshold', async () => {
    expect(
      mod.validateSettingsFields({
        granularity: 'day',
        day_derivation: 'majority',
        edit_window_minutes: 60,
        late_threshold_minutes: 2,
        half_day_min_minutes: 180,
      }),
    ).toMatch(/late_threshold/);

    mod.aaSwitchTab('settings');
    await vi.waitFor(() => {
      expect(document.getElementById('aaLateThr')).toBeTruthy();
    });
    document.getElementById('aaLateThr').value = '2';
    await mod.aaSaveSettings();
    expect(toastFn).toHaveBeenCalledWith(
      expect.stringMatching(/late_threshold/),
      'error',
    );
    expect(attPut).not.toHaveBeenCalled();
  });

  it('eligibility rendering shows pct, projection, eligible flag', async () => {
    mod.aaSwitchTab('eligibility');
    await vi.waitFor(() => {
      expect(document.getElementById('aaElTable')).toBeTruthy();
      expect(document.querySelector('#aaElTable tbody tr')).toBeTruthy();
    });
    const row = document.querySelector('#aaElTable tbody tr');
    expect(row.textContent).toMatch(/82%/);
    expect(row.textContent).toMatch(/84%/);
    expect(row.textContent).toMatch(/yes/);
  });

  it('nudge report numbers render plainly', async () => {
    mod.aaSetState({
      tab: 'nudge',
      nudgeConfig: { enabled: true, atRiskPct: 10, chronicDays: 18, holdoutPct: 10, maxMessagesPerTerm: 6 },
      nudgeReport: {
        treatment: { mean_absence_pct: 8.5, message_count: 12, student_count: 40 },
        holdout: { mean_absence_pct: 11.2, message_count: 0, student_count: 5 },
      },
    });
    expect(document.getElementById('aaTreatMean').textContent).toBe('8.5%');
    expect(document.getElementById('aaHoldN').textContent).toBe('5');
  });
});

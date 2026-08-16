import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Build seven daily entries starting at the given Monday. */
function buildEntries(startDate, minutesPerDay) {
  const [y, m, d] = startDate.split('-').map(Number);
  const entries = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(y, m - 1, d + i);
    const key =
      day.getFullYear() +
      '-' +
      String(day.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(day.getDate()).padStart(2, '0');
    const weekend = i >= 5;
    entries.push({
      date: key,
      day_type: weekend ? 'weekend' : 'workday',
      attendance_status: weekend ? '' : 'out',
      worked_minutes: weekend ? 0 : minutesPerDay,
      break_minutes: 0,
      is_late: 0,
      late_minutes: 0,
      ot_minutes: 0,
      ot_pay: 0,
      leave_type: '',
      leave_days: 0,
      billable_hours: 0,
      non_billable_hours: 0,
      adjusted_minutes: null,
      adjustment_reason: '',
      adjusted_by: '',
      adjusted_at: null,
    });
  }
  return entries;
}

function startDateFrom(path) {
  const match = /startDate=([\d-]+)/.exec(path);
  return match ? match[1] : '';
}

describe('timesheets module', () => {
  /** @type {typeof import('../../modules/timesheets/timesheets.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path.startsWith('/api/timesheets/week')) {
        const startDate = startDateFrom(path);
        const alice = {
          id: 'ts-alice',
          email: 'alice@test.com',
          name: 'Alice',
          period_type: 'weekly',
          start_date: startDate,
          total_worked_minutes: 2400,
          total_ot_minutes: 0,
          status: 'draft',
          entries: buildEntries(startDate, 480),
        };
        if (path.includes('scope=mine')) {
          return { startDate, timesheets: [alice] };
        }
        return {
          startDate,
          timesheets: [
            alice,
            {
              id: 'ts-bob',
              email: 'bob@test.com',
              name: 'Bob',
              period_type: 'weekly',
              start_date: startDate,
              total_worked_minutes: 1800,
              status: 'submitted',
              entries: buildEntries(startDate, 360),
            },
          ],
        };
      }
      if (path === '/api/timesheets/pending-approvals') {
        return {
          timesheets: [
            {
              id: 'ts-carol',
              email: 'carol@test.com',
              name: 'Carol',
              start_date: '2026-08-17',
              end_date: '2026-08-23',
              total_worked_minutes: 2280,
              status: 'submitted',
            },
          ],
        };
      }
      if (path.startsWith('/api/timesheets/ts-alice')) {
        return {
          timesheet: {
            id: 'ts-alice',
            email: 'alice@test.com',
            name: 'Alice',
            total_worked_minutes: 2400,
            status: 'draft',
          },
          entries: buildEntries('2026-08-17', 480),
          adjustments: [],
        };
      }
      return {};
    });

    apiPost = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'alice@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: { get: apiGet, post: apiPost, put: vi.fn(), delete: vi.fn() },
    }));

    mod = await import('../../modules/timesheets/timesheets.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads the team week, my week, and pending approvals in parallel', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Alice');
    });

    const startDate = mod.weekStartKey(0);
    expect(apiGet).toHaveBeenCalledWith('/api/timesheets/week?startDate=' + startDate);
    expect(apiGet).toHaveBeenCalledWith('/api/timesheets/week?startDate=' + startDate + '&scope=mine');
    expect(apiGet).toHaveBeenCalledWith('/api/timesheets/pending-approvals');

    expect(mod._getTeam()).toHaveLength(2);
    expect(mod._getMine()).toHaveLength(1);
    expect(mod._getPending()[0].name).toBe('Carol');
    // 5 workdays x 8h
    expect(document.body.textContent).toContain('40.0h');
  });

  it('starts the week on Monday and moves a full week per step', async () => {
    const days = mod.getWeekDates(0);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);

    const thisWeek = mod.weekStartKey(0);
    const lastWeek = mod.weekStartKey(-1);
    const diffDays = (new Date(thisWeek) - new Date(lastWeek)) / 86400000;
    expect(diffDays).toBe(7);
  });

  it('requests the previous week when navigating back', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getTeam().length).toBe(2));

    document.getElementById('tsPrev').click();
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/timesheets/week?startDate=' + mod.weekStartKey(-1));
    });
    expect(mod._getWeekOffset()).toBe(-1);
  });

  it('normalizes snake_case rows and treats an override as the effective value', () => {
    const entry = mod._normalizeEntry({
      date: '2026-08-18',
      day_type: 'workday',
      worked_minutes: 300,
      adjusted_minutes: 480,
      adjustment_reason: 'Forgot to clock out',
      adjusted_by: 'admin@test.com',
    });
    expect(entry.workedMinutes).toBe(300);
    expect(entry.isAdjusted).toBe(true);
    expect(entry.effectiveMinutes).toBe(480);
    expect(entry.adjustmentReason).toBe('Forgot to clock out');

    const plain = mod._normalizeEntry({ date: '2026-08-19', worked_minutes: 420 });
    expect(plain.isAdjusted).toBe(false);
    expect(plain.effectiveMinutes).toBe(420);

    const ts = mod._normalizeTimesheet({
      id: 't1',
      email: 'a@b.com',
      period_type: 'weekly',
      start_date: '2026-08-17',
      total_worked_minutes: 2400,
      total_ot_minutes: 120,
      rejection_reason: 'Missing hours',
      entries: [{ date: '2026-08-17', worked_minutes: 480 }],
    });
    expect(ts.periodType).toBe('weekly');
    expect(ts.startDate).toBe('2026-08-17');
    expect(ts.totalWorkedMinutes).toBe(2400);
    expect(ts.rejectionReason).toBe('Missing hours');
    expect(ts.entries[0].effectiveMinutes).toBe(480);
  });

  it('adjusts a day with hours and a reason', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getTeam().length).toBe(2));

    const startDate = mod.weekStartKey(0);
    document.querySelector('[data-action="adjust"][data-date="' + startDate + '"]').click();
    await vi.waitFor(() => expect(document.getElementById('tsF_hours')).toBeTruthy());

    document.getElementById('tsF_hours').value = '6';
    document.getElementById('tsF_reason').value = 'Left early, approved';
    document.getElementById('tsAdjustBtn').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/timesheets/ts-alice/adjust', {
        date: startDate,
        hours: 6,
        reason: 'Left early, approved',
      });
    });
  });

  it('refuses an adjustment with no reason', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getTeam().length).toBe(2));

    const startDate = mod.weekStartKey(0);
    document.querySelector('[data-action="adjust"][data-date="' + startDate + '"]').click();
    await vi.waitFor(() => expect(document.getElementById('tsF_hours')).toBeTruthy());

    document.getElementById('tsF_hours').value = '6';
    document.getElementById('tsAdjustBtn').click();

    await vi.waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith('A reason is required', 'error');
    });
    expect(apiPost).not.toHaveBeenCalledWith(
      '/api/timesheets/ts-alice/adjust',
      expect.anything(),
    );
  });

  it('submits my draft week', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getMine().length).toBe(1));

    document.querySelector('[data-tab="mine"]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-action="submit"]')).toBeTruthy());

    document.querySelector('[data-action="submit"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/timesheets/ts-alice/submit', {});
    });
  });

  it('approves from the Approvals tab', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getPending().length).toBe(1));

    document.querySelector('[data-tab="approvals"]').click();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Carol'));

    document.querySelector('[data-action="approve"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/timesheets/ts-carol/approve', {});
    });
  });

  it('generates the team week for an admin', async () => {
    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getTeam().length).toBe(2));

    expect(document.getElementById('tsGenerate').textContent).toBe('Generate Team Week');
    document.getElementById('tsGenerate').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/timesheets/generate-team', {
        periodType: 'weekly',
        startDate: mod.weekStartKey(0),
      });
    });
  });

  it('shows a feature-off message when the timesheets API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path.startsWith('/api/timesheets/week')) {
        return { _error: true, status: 404, message: 'Not found' };
      }
      return { timesheets: [] };
    });

    mod.renderTimesheetsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled/i);
    });
  });
});

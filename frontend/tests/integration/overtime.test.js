import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('overtime module', () => {
  /** @type {typeof import('../../modules/overtime/overtime.js')} */
  let mod;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrPut;
  /** @type {ReturnType<typeof vi.fn>} */
  let toastFn;
  let sessionRole;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';
    sessionRole = 'manager';

    hrGet = vi.fn(async (path) => {
      if (path.startsWith('/records/mine')) {
        return {
          items: [
            {
              id: 1,
              email: 'alice@test.com',
              date: '2026-03-01',
              otMinutes: 90,
              otType: 'weekday',
              otPay: 500,
              source: 'manual',
              status: 'pending',
            },
          ],
        };
      }
      if (path.startsWith('/summary/mine')) {
        return { totalOtMinutes: 90, totalOtHours: 1.5, pendingCount: 1 };
      }
      if (path.startsWith('/requests/mine')) return { items: [] };
      if (path.startsWith('/policy')) {
        return {
          otEnabled: true,
          dailyThresholdMinutes: 540,
          multiplier: 2,
          holidayMultiplier: 3,
          requiresPriorApproval: true,
          requiresApproval: true,
        };
      }
      if (path.startsWith('/records/pending')) {
        return {
          items: [
            {
              id: 2,
              email: 'bob@test.com',
              date: '2026-03-02',
              otMinutes: 60,
              otType: 'weekday',
              status: 'pending',
            },
          ],
        };
      }
      if (path.startsWith('/requests')) {
        return {
          items: [
            {
              id: 'req1',
              email: 'bob@test.com',
              date: '2026-03-03',
              plannedHours: 2,
              reason: 'Release',
              status: 'pending',
            },
          ],
        };
      }
      return { _error: true, message: 'unexpected ' + path };
    });
    hrPost = vi.fn(async (path) => {
      if (path.includes('/approve')) return { id: 2, status: 'approved' };
      if (path.includes('/reject')) return { id: 2, status: 'rejected' };
      if (path === '/records') return { id: 3, status: 'pending' };
      if (path === '/requests') return { id: 'req2', status: 'pending' };
      if (path === '/detect') return { created: 1 };
      return {};
    });
    hrPut = vi.fn(async () => ({ otEnabled: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', () => ({
      api: {
        hr: () => ({
          get: hrGet,
          post: hrPost,
          put: hrPut,
          del: vi.fn(),
        }),
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/modal.js', () => ({
      confirmDialog: async () => true,
      promptDialog: async () => 'not enough notice',
    }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({
        email: 'mgr@test.com',
        name: 'Manager',
        role: sessionRole,
      }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: () => {} }));

    mod = await import('../../modules/overtime/overtime.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pending/approved/hour metrics from service data', async () => {
    mod.renderOvertimePage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/1\.5h/);
    });
    expect(document.body.textContent).toMatch(/Pending/);
    expect(document.body.textContent).not.toMatch(/No overtime data/);
  });

  it('approves pending records with manager actions', async () => {
    mod.renderOvertimePage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.querySelector('[data-tab="pending"]')).toBeTruthy());
    document.querySelector('[data-tab="pending"]').click();
    await vi.waitFor(() => expect(document.body.textContent).toMatch(/bob@test.com/));
    document.querySelector('[data-action="approve-record"]').click();
    await vi.waitFor(() => expect(hrPost).toHaveBeenCalled());
    expect(hrPost.mock.calls.some((c) => String(c[0]).includes('/records/2/approve'))).toBe(
      true,
    );
  });

  it('requires rejection reason', async () => {
    mod.renderOvertimePage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.querySelector('[data-tab="pending"]')).toBeTruthy());
    document.querySelector('[data-tab="pending"]').click();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-action="reject-record"]')).toBeTruthy(),
    );
    document.querySelector('[data-action="reject-record"]').click();
    await vi.waitFor(() =>
      expect(hrPost.mock.calls.some((c) => String(c[0]).includes('/reject'))).toBe(true),
    );
    const rejectCall = hrPost.mock.calls.find((c) => String(c[0]).includes('/reject'));
    expect(rejectCall[1].reason).toBe('not enough notice');
  });

  it('shows unavailable with retry, not empty', async () => {
    hrGet.mockImplementation(async () => ({
      _error: true,
      status: 502,
      error: 'upstream_unavailable',
      message: 'Overtime service is unavailable',
      service: 'overtime',
    }));
    mod.renderOvertimePage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.body.textContent).toMatch(/Service unavailable/));
    expect(document.body.textContent).toMatch(/Retry/);
    expect(document.body.textContent).not.toMatch(/No overtime records/);
  });
});

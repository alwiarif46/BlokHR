import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('time_tracking module', () => {
  /** @type {typeof import('../../modules/time_tracking/time_tracking.js')} */
  let mod;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrGet;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrPost;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrPut;
  /** @type {ReturnType<typeof vi.fn>} */
  let hrDel;
  /** @type {ReturnType<typeof vi.fn>} */
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    hrGet = vi.fn(async (path) => {
      if (path.startsWith('/time-entries')) {
        return {
          entries: [
            {
              id: 1,
              email: 'alice@test.com',
              projectId: 'p1',
              projectName: 'Alpha',
              clientName: 'Acme',
              date: '2026-03-01',
              hours: 2,
              description: 'Work',
              billable: true,
              approved: false,
            },
          ],
        };
      }
      if (path.startsWith('/projects')) {
        return { projects: [{ id: 'p1', name: 'Alpha', clientId: 'c1', billable: true, status: 'active' }] };
      }
      if (path.startsWith('/clients')) {
        return { clients: [{ id: 'c1', name: 'Acme', code: 'ACM', active: true }] };
      }
      if (path.startsWith('/time-summary')) {
        return { totalHours: 2, billableHours: 2, nonBillableHours: 0, entries: 1 };
      }
      return { _error: true, message: 'unexpected ' + path };
    });
    hrPost = vi.fn(async () => ({ id: 2, hours: 1, approved: false }));
    hrPut = vi.fn(async () => ({ id: 1, hours: 3, approved: false }));
    hrDel = vi.fn(async () => ({ ok: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/api.js', () => ({
      api: {
        hr: () => ({
          get: hrGet,
          post: hrPost,
          put: hrPut,
          del: hrDel,
        }),
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/modal.js', () => ({
      confirmDialog: async () => true,
      promptDialog: async () => 'reason',
    }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'alice@test.com', name: 'Alice', role: 'employee' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: () => {} }));

    mod = await import('../../modules/time_tracking/time_tracking.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders real metrics and entries from api.hr', async () => {
    mod.renderTimeTrackingPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/Alpha/);
    });
    expect(document.body.textContent).toMatch(/2\.0h/);
    expect(document.body.textContent).toMatch(/Billable/);
    expect(document.body.textContent).not.toMatch(/No time tracking data/);
  });

  it('distinguishes unavailable from empty', async () => {
    hrGet.mockImplementation(async () => ({
      _error: true,
      status: 502,
      error: 'upstream_unavailable',
      message: 'Time tracking service is unavailable. Start the stack (dev:school) and retry.',
      service: 'time-tracking',
    }));
    mod.renderTimeTrackingPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/Service unavailable/);
    });
    expect(document.body.textContent).toMatch(/Retry/);
    expect(document.body.textContent).not.toMatch(/No time entries yet/);
  });

  it('retries after unavailable recovery', async () => {
    let fail = true;
    hrGet.mockImplementation(async (path) => {
      if (fail) {
        return {
          _error: true,
          status: 502,
          error: 'upstream_unavailable',
          message: 'down',
          service: 'time-tracking',
        };
      }
      if (path.startsWith('/time-entries')) return { entries: [] };
      if (path.startsWith('/projects')) return { projects: [] };
      if (path.startsWith('/clients')) return { clients: [] };
      if (path.startsWith('/time-summary')) {
        return { totalHours: 0, billableHours: 0, nonBillableHours: 0, entries: 0 };
      }
      return {};
    });
    mod.renderTimeTrackingPage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.body.textContent).toMatch(/Retry/));
    fail = false;
    document.querySelector('[data-action="retry"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/No time entries yet/);
    });
  });

  it('creates an entry via POST', async () => {
    mod.renderTimeTrackingPage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.body.textContent).toMatch(/Alpha/));
    document.getElementById('ttAddBtn').click();
    await vi.waitFor(() => expect(document.getElementById('ttProject')).toBeTruthy());
    expect(document.getElementById('ttProject').value).toBe('p1');
    document.getElementById('ttHours').value = '1.5';
    document.querySelector('[data-action="save-entry"]').click();
    await vi.waitFor(() => expect(hrPost).toHaveBeenCalled());
    expect(hrPost.mock.calls[0][0]).toBe('/time-entries');
    expect(hrPost.mock.calls[0][1].hours).toBe(1.5);
  });
});

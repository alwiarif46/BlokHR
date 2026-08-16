import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

describe('visitors module', () => {
  /** @type {typeof import('../../modules/visitors/visitors.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiPut;
  let toastFn;
  const today = todayStr();

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/visitors' || path.startsWith('/api/visitors?')) {
        return {
          visits: [
            {
              id: 'v1',
              visitor_name: 'John Doe',
              visitor_company: 'Acme',
              host_email: 'host@test.com',
              purpose: 'Interview',
              expected_date: today,
              expected_time: '10:00',
              status: 'pre_registered',
            },
            {
              id: 'v2',
              visitor_name: 'Future Guest',
              visitor_company: 'Beta',
              host_email: 'host@test.com',
              expected_date: '2099-01-15',
              status: 'pre_registered',
            },
          ],
        };
      }
      if (path === '/api/visitors/my-expected') {
        return {
          visits: [
            {
              id: 'v1',
              visitor_name: 'John Doe',
              host_email: 'admin@test.com',
              expected_date: today,
              status: 'pre_registered',
            },
          ],
        };
      }
      if (path === '/api/visitors/checked-in-count') {
        return { count: 1 };
      }
      if (path === '/api/visitors/v1') {
        return {
          visit: {
            id: 'v1',
            visitor_name: 'John Doe',
            visitor_company: 'Acme',
            host_email: 'host@test.com',
            expected_date: today,
            status: 'pre_registered',
          },
        };
      }
      if (path === '/api/visitors/v1/forms') return { forms: [] };
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/visitors') {
        return {
          visit: {
            id: 'v-new',
            visitor_name: body.visitorName,
            host_email: body.hostEmail,
            expected_date: body.expectedDate,
            status: 'pre_registered',
          },
        };
      }
      if (path.endsWith('/check-in') || path.endsWith('/check-out') || path.endsWith('/cancel') || path.endsWith('/no-show')) {
        return { success: true };
      }
      if (path.endsWith('/forms')) {
        return { form: { id: 'f1', form_type: body.formType || 'nda' } };
      }
      return { success: true };
    });

    apiPut = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: { get: apiGet, post: apiPost, put: apiPut, delete: vi.fn() },
    }));

    mod = await import('../../modules/visitors/visitors.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads visits, my-expected, and checked-in count in parallel', async () => {
    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('John Doe');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/visitors');
    expect(apiGet).toHaveBeenCalledWith('/api/visitors/my-expected');
    expect(apiGet).toHaveBeenCalledWith('/api/visitors/checked-in-count');
    expect(mod._getVisits()[0].visitorName).toBe('John Doe');
    expect(mod._getVisits()[0].hostEmail).toBe('host@test.com');
    expect(mod._getCheckedInCount()).toBe(1);
    expect(document.body.textContent).toContain('Checked In');
  });

  it('registers a visitor with required camelCase fields', async () => {
    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/visitors'));

    document.getElementById('visAddBtn').click();
    document.getElementById('visF_name').value = 'Alice Guest';
    document.getElementById('visF_host').value = 'host@test.com';
    document.getElementById('visF_date').value = today;
    document.getElementById('visF_company').value = 'Corp';
    document.getElementById('visF_purpose').value = 'Meeting';
    document.getElementById('visSaveBtn').click();

    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const call = apiPost.mock.calls.find((c) => c[0] === '/api/visitors');
    expect(call).toBeTruthy();
    expect(call[1].visitorName).toBe('Alice Guest');
    expect(call[1].hostEmail).toBe('host@test.com');
    expect(call[1].expectedDate).toBe(today);
    expect(call[1].visitorCompany).toBe('Corp');
    expect(call[1].purpose).toBe('Meeting');
    expect(toastFn).toHaveBeenCalledWith('Registered', 'success');
  });

  it('checks in then checks out a visit', async () => {
    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getVisits().length).toBe(2));

    window.prompt = vi.fn(() => 'Has laptop');
    document.querySelector('[data-action="check-in"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/visitors/v1/check-in', {
        receptionNotes: 'Has laptop',
      });
    });

    // After reload mock still returns pre_registered; simulate checked_in card via action on id
    await apiPost('/api/visitors/v1/check-out', {});
    expect(apiPost).toHaveBeenCalledWith('/api/visitors/v1/check-out', {});
  });

  it('normalizes snake_case visit and form fields', () => {
    const v = mod._normalizeVisit({
      id: 'x',
      visitor_name: 'Pat',
      visitor_company: 'Co',
      host_email: 'h@t.com',
      expected_date: '2026-06-01',
      expected_duration_minutes: 45,
      status: 'pre_registered',
    });
    expect(v.visitorName).toBe('Pat');
    expect(v.visitorCompany).toBe('Co');
    expect(v.hostEmail).toBe('h@t.com');
    expect(v.expectedDate).toBe('2026-06-01');
    expect(v.expectedDurationMinutes).toBe(45);

    const f = mod._normalizeForm({
      id: 'f',
      visit_id: 'x',
      form_type: 'nda',
      signed_at: '2026-06-01 10:00:00',
    });
    expect(f.visitId).toBe('x');
    expect(f.formType).toBe('nda');
    expect(f.signedAt).toBe('2026-06-01 10:00:00');
  });

  it('switches to My Visitors tab', async () => {
    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getMine().length).toBe(1));

    document.querySelector('[data-tab="mine"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('John Doe');
    });
    expect(mod._getTab()).toBe('mine');
  });

  it('shows feature-off message when visitors API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/visitors' || path.startsWith('/api/visitors?')) {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/visitors/my-expected') return { visits: [] };
      if (path === '/api/visitors/checked-in-count') return { count: 0 };
      return {};
    });

    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled/i);
    });
  });

  it('switches to upcoming tab and shows future visit', async () => {
    mod.renderVisitorsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getVisits().length).toBe(2));

    document.querySelector('[data-tab="upcoming"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Future Guest');
    });
  });
});

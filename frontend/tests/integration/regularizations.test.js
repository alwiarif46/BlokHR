import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { answerPrompt } from '../helpers/dialog.js';

describe('regularizations module', () => {
  /** @type {typeof import('../../modules/regularizations/regularizations.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiPut;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path.startsWith('/api/regularizations?email=')) {
        return {
          regularizations: [
            {
              id: 'r1',
              email: 'alice@test.com',
              name: 'Alice',
              date: '2026-08-10',
              correction_type: 'both',
              in_time: '09:15',
              out_time: '18:00',
              reason: 'Forgot to clock in',
              status: 'pending',
              created_at: '2026-08-11 10:00:00',
              rejection_comments: '',
              manager_approver_email: '',
              hr_approver_email: '',
            },
          ],
        };
      }
      if (path === '/api/pending-actions-detail') {
        return {
          leaves: [],
          regularizations: [
            {
              id: 'r1',
              email: 'alice@test.com',
              name: 'Alice',
              date: '2026-08-10',
              correction_type: 'both',
              in_time: '09:15',
              out_time: '18:00',
              reason: 'Forgot to clock in',
              status: 'pending',
              created_at: '2026-08-11 10:00:00',
            },
            {
              id: 'r2',
              email: 'bob@test.com',
              name: 'Bob',
              date: '2026-08-09',
              status: 'manager_approved',
              in_time: '10:00',
              out_time: '',
              reason: 'Late bus',
              created_at: '2026-08-09 12:00:00',
            },
          ],
          meetings: [],
          profiles: [],
        };
      }
      return {};
    });

    apiPost = vi.fn(async () => ({
      success: true,
      regularization: { id: 'r-new', status: 'pending' },
    }));
    apiPut = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'alice@test.com', name: 'Alice' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: { get: apiGet, post: apiPost, put: apiPut },
    }));

    mod = await import('../../modules/regularizations/regularizations.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads mine with ?email= and pending-actions-detail', async () => {
    mod.renderRegularizationsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/regularizations?email=alice%40test.com');
      expect(apiGet).toHaveBeenCalledWith('/api/pending-actions-detail');
    });
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Correction for 2026-08-10');
      expect(document.body.textContent).toContain('09:15');
    });
  });

  it('submits with inTime, outTime, and correctionType', async () => {
    mod.renderRegularizationsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled());

    document.getElementById('regSubmitBtn').click();
    document.getElementById('regDate').value = '2026-08-12';
    document.getElementById('regClockIn').value = '09:00';
    document.getElementById('regClockOut').value = '17:30';
    document.getElementById('regReason').value = 'Missed punch';
    document.getElementById('regSaveBtn').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/regularizations', {
        date: '2026-08-12',
        inTime: '09:00',
        outTime: '17:30',
        correctionType: 'both',
        reason: 'Missed punch',
        email: 'alice@test.com',
        name: 'Alice',
      });
    });
  });

  it('approve sends role manager for pending items', async () => {
    mod.renderRegularizationsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled());

    document.querySelector('[data-regt="pending"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Manager approve');
    });

    document.querySelector('[data-reg-action="approve"][data-reg-id="r1"]').click();
    await vi.waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/api/regularizations/r1/approve', { role: 'manager' });
    });
  });

  it('approve sends role hr for manager_approved items', async () => {
    mod.renderRegularizationsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled());

    document.querySelector('[data-regt="pending"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('HR approve');
    });

    document.querySelector('[data-reg-action="approve"][data-reg-id="r2"]').click();
    await vi.waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/api/regularizations/r2/approve', { role: 'hr' });
    });
  });

  it('reject sends comments not reason', async () => {
    mod.renderRegularizationsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled());

    document.querySelector('[data-regt="pending"]').click();
    await vi.waitFor(() => expect(document.querySelector('[data-reg-action="reject"]')).toBeTruthy());

    document.querySelector('[data-reg-action="reject"][data-reg-id="r1"]').click();
    await answerPrompt('Incomplete evidence');
    await vi.waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/api/regularizations/r1/reject', {
        comments: 'Incomplete evidence',
      });
    });
  });
});

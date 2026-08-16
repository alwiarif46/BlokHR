import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('expenses module', () => {
  /** @type {typeof import('../../modules/expenses/expenses.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiPut;
  let apiDelete;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/expenses/mine') {
        return {
          expenses: [
            {
              id: 'e1',
              email: 'admin@test.com',
              vendor: 'Uber',
              amount: 350,
              currency: 'INR',
              category: 'travel',
              receipt_date: '2026-08-01',
              status: 'draft',
              current_level: 1,
            },
            {
              id: 'e2',
              email: 'admin@test.com',
              vendor: 'Hotel',
              amount: 5000,
              currency: 'INR',
              category: 'accommodation',
              status: 'submitted',
              current_level: 1,
            },
          ],
        };
      }
      if (path === '/api/expenses/pending-approvals') {
        return {
          expenses: [
            {
              id: 'e3',
              email: 'alice@test.com',
              vendor: 'Client lunch',
              amount: 1200,
              category: 'client',
              status: 'submitted',
              current_level: 1,
            },
          ],
        };
      }
      if (path === '/api/expense-policies') {
        return {
          policies: [
            {
              category: 'travel',
              max_amount_per_claim: 0,
              monthly_cap: 0,
              requires_receipt: 0,
              active: 1,
            },
          ],
        };
      }
      if (path === '/api/expenses/e1') {
        return {
          expense: {
            id: 'e1',
            email: 'admin@test.com',
            vendor: 'Uber',
            amount: 350,
            category: 'travel',
            status: 'draft',
            current_level: 1,
          },
          approvals: [],
        };
      }
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/expenses') {
        return {
          expense: {
            id: 'e-new',
            vendor: body.vendor,
            amount: body.amount,
            category: body.category,
            status: 'draft',
          },
        };
      }
      if (path.endsWith('/submit') || path.endsWith('/approve') || path.endsWith('/reject') || path.endsWith('/reimburse')) {
        return { success: true };
      }
      if (path === '/api/storage/upload') {
        return { fileId: 'file-1' };
      }
      return { success: true };
    });

    apiPut = vi.fn(async () => ({ success: true }));
    apiDelete = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete },
    }));

    mod = await import('../../modules/expenses/expenses.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads mine, pending approvals, and policies in parallel', async () => {
    mod.renderExpensesPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Uber');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/expenses/mine');
    expect(apiGet).toHaveBeenCalledWith('/api/expenses/pending-approvals');
    expect(apiGet).toHaveBeenCalledWith('/api/expense-policies');
    expect(mod._getMine()[0].vendor).toBe('Uber');
    expect(mod._getMine()[0].amount).toBe(350);
    expect(mod._getPending()[0].vendor).toBe('Client lunch');
  });

  it('creates an expense with camelCase body', async () => {
    mod.renderExpensesPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/expenses/mine'));

    document.getElementById('expAddBtn').click();
    document.getElementById('expF_vendor').value = 'Train';
    document.getElementById('expF_amount').value = '800';
    document.getElementById('expF_category').value = 'travel';
    document.getElementById('expF_currency').value = 'INR';
    document.getElementById('expF_description').value = 'Commute';
    document.getElementById('expSaveBtn').click();

    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const call = apiPost.mock.calls.find((c) => c[0] === '/api/expenses');
    expect(call).toBeTruthy();
    expect(call[1].vendor).toBe('Train');
    expect(call[1].amount).toBe(800);
    expect(call[1].category).toBe('travel');
    expect(toastFn).toHaveBeenCalledWith('Created', 'success');
  });

  it('submits a draft expense', async () => {
    mod.renderExpensesPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getMine().length).toBe(2));

    document.querySelector('[data-action="submit"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/expenses/e1/submit', {});
    });
  });

  it('approves from Approvals tab', async () => {
    mod.renderExpensesPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getPending().length).toBe(1));

    document.querySelector('[data-tab="approvals"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Client lunch');
    });
    document.querySelector('[data-action="approve"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/expenses/e3/approve', {});
    });
  });

  it('normalizes snake_case expense and policy fields', () => {
    const e = mod._normalizeExpense({
      id: 'x',
      vendor: 'X',
      amount: 99,
      receipt_date: '2026-01-01',
      file_id: 'f1',
      current_level: 2,
      status: 'submitted',
      rejection_reason: '',
    });
    expect(e.receiptDate).toBe('2026-01-01');
    expect(e.fileId).toBe('f1');
    expect(e.currentLevel).toBe(2);

    const p = mod._normalizePolicy({
      category: 'meals',
      max_amount_per_claim: 500,
      monthly_cap: 2000,
      requires_receipt: 1,
      active: 1,
    });
    expect(p.maxAmountPerClaim).toBe(500);
    expect(p.requiresReceipt).toBe(true);
  });

  it('shows feature-off message when expenses API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/expenses/mine') {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/expenses/pending-approvals') return { expenses: [] };
      if (path === '/api/expense-policies') return { policies: [] };
      return {};
    });

    mod.renderExpensesPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled/i);
    });
  });
});

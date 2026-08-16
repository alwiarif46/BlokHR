import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = path.resolve(__dirname, '../../modules/school_library');

describe('school_library (P10-04)', () => {
  /** @type {typeof import('../../modules/school_library/school_library.js')} */
  let mod;
  let libGet;
  let libPost;
  let libPut;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    libGet = vi.fn(async (p) => {
      if (p.startsWith('/titles')) {
        return {
          titles: [
            {
              id: 't1',
              title: 'Concrete Mathematics',
              authors: ['Graham'],
              isbn13: '9780306406157',
            },
          ],
        };
      }
      if (p.startsWith('/copies')) {
        return {
          copies: [{ id: 'c1', barcode: 'BK-1', status: 'available', condition: 'good' }],
        };
      }
      if (p.startsWith('/loans')) {
        return {
          loans: [
            {
              id: 'loan-1',
              studentRef: 'stu-1',
              copyId: 'c1',
              dueOn: '2026-01-29',
              status: 'open',
            },
          ],
        };
      }
      if (p.startsWith('/holds')) return { holds: [] };
      if (p.startsWith('/fines')) return { fines: [] };
      if (p === '/settings') {
        return {
          loanDays: 14,
          renewLimit: 1,
          maxOpenLoans: 3,
          holdDays: 3,
          finePaisePerDay: 500,
          fineCapPaise: 20000,
          graceDays: 0,
        };
      }
      return {};
    });
    libPost = vi.fn(async (p, body) => {
      if (p === '/loans') {
        if (body && body.student_ref === 'fined') {
          return {
            _error: true,
            error: 'fines_outstanding',
            open_fines_paise: 3500,
            status: 409,
          };
        }
        return { id: 'loan-new', dueOn: '2026-01-29', studentRef: body.student_ref };
      }
      if (p === '/fines/assess') return { assessed: 0, total_paise: 0 };
      return { ok: true };
    });
    libPut = vi.fn(async (p, body) => {
      if (p === '/settings') {
        return {
          loanDays: body.loan_days,
          renewLimit: body.renew_limit,
          maxOpenLoans: body.max_open_loans,
          holdDays: body.hold_days,
          finePaisePerDay: body.fine_paise_per_day,
          fineCapPaise: body.fine_cap_paise,
          graceDays: body.grace_days,
        };
      }
      return {};
    });

    toastFn = vi.fn();
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/modal.js', () => ({
      openModal: vi.fn(),
      closeModal: vi.fn(),
      confirmDialog: vi.fn(async () => true),
    }));
    vi.doMock('../../shared/api.js', () => ({
      api: {
        school: () => ({
          get: libGet,
          post: libPost,
          put: libPut,
          patch: vi.fn(),
          del: vi.fn(),
        }),
      },
    }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: vi.fn(),
    }));

    mod = await import('../../modules/school_library/school_library.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders catalogue titles from api.school', async () => {
    await mod.renderSchoolLibraryPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Concrete Mathematics');
    });
    expect(libGet).toHaveBeenCalledWith('/titles');
    expect(libGet).toHaveBeenCalledWith('/settings');
  });

  it('isbnLengthHint only for non-10/13 digit lengths', () => {
    expect(mod.isbnLengthHint('')).toBeNull();
    expect(mod.isbnLengthHint('9780306406157')).toBeNull();
    expect(mod.isbnLengthHint('0306406152')).toBeNull();
    expect(mod.isbnLengthHint('123')).toMatch(/10 or 13/);
  });

  it('issue posts barcode + student_ref; fines_outstanding toasts', async () => {
    mod.libSetState({ view: 'circulate', loans: [], settings: { loanDays: 14 } });
    await mod.renderSchoolLibraryPage(document.getElementById('root'));
    // switch to circulate via state + reload
    mod.libSetState({ view: 'circulate' });
    const tabs = document.querySelector('[data-view="circulate"]');
    tabs.click();
    await vi.waitFor(() => expect(document.querySelector('#libIssueBtn')).toBeTruthy());

    document.getElementById('libIssueBarcode').value = 'BK-1';
    document.getElementById('libIssueStudent').value = 'fined';
    document.getElementById('libIssueBtn').click();

    await vi.waitFor(() => expect(libPost).toHaveBeenCalled());
    expect(libPost.mock.calls[0][0]).toBe('/loans');
    expect(libPost.mock.calls[0][1]).toEqual({
      barcode: 'BK-1',
      student_ref: 'fined',
    });
    await vi.waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith(
        expect.stringMatching(/Fines outstanding/i),
        'error',
      ),
    );
  });

  it('saves settings via PUT', async () => {
    await mod.renderSchoolLibraryPage(document.getElementById('root'));
    document.querySelector('[data-view="fines"]').click();
    await vi.waitFor(() => expect(document.querySelector('#libSaveSettings')).toBeTruthy());

    document.getElementById('libLoanDays').value = '10';
    document.getElementById('libRenewLimit').value = '2';
    document.getElementById('libMaxLoans').value = '4';
    document.getElementById('libFineDay').value = '100';
    document.getElementById('libFineCap').value = '5000';
    document.getElementById('libGrace').value = '1';
    document.getElementById('libSaveSettings').click();

    await vi.waitFor(() => expect(libPut).toHaveBeenCalled());
    expect(libPut.mock.calls[0][0]).toBe('/settings');
    expect(libPut.mock.calls[0][1].loan_days).toBe(10);
    expect(libPut.mock.calls[0][1].fine_paise_per_day).toBe(100);
    await vi.waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith('Settings saved', 'success'),
    );
  });

  it('module has zero localStorage and zero raw fetch', () => {
    const js = fs.readFileSync(path.join(MODULE_DIR, 'school_library.js'), 'utf8');
    expect(js).not.toMatch(/\blocalStorage\b/);
    expect(js).not.toMatch(/\bfetch\s*\(/);
  });
});

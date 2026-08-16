import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { acceptConfirm } from '../helpers/dialog.js';

describe('capture_admin module', () => {
  /** @type {typeof import('../../modules/capture_admin/capture_admin.js')} */
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
      if (path.startsWith('/api/capture/session-token?subject_type=staff')) {
        return {
          available_modalities: ['qr', 'fingerprint'],
          roll_call: true,
          jurisdiction: {
            country: 'IN',
            vertical: 'hr',
            face_adults_enabled: false,
            face_students_dpia_ref: '',
            retention_days: 365,
          },
        };
      }
      if (path.startsWith('/api/capture/session-token?subject_type=student')) {
        return { available_modalities: ['qr'], roll_call: false };
      }
      if (path === '/api/capture/enrolments') {
        return {
          enrolments: [
            {
              id: 'en1',
              subject_ref: 'emp_42',
              subject_type: 'staff',
              modality: 'qr',
              algo: 'sha256',
              consent_ref: null,
            },
          ],
        };
      }
      return { _error: true, message: 'unexpected get ' + path };
    });

    apiPost = vi.fn(async () => ({ success: true, purged: 2 }));
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

    mod = await import('../../modules/capture_admin/capture_admin.js');
    mod._resetState();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function mount() {
    const root = document.getElementById('root');
    mod.renderCaptureAdminPage(root);
    await vi.waitFor(() => {
      expect(document.querySelector('#caStats')).toBeTruthy();
      expect(document.querySelector('#caStats').textContent).toMatch(/Staff Modalities/i);
    });
  }

  it('renders stats from session-token responses', async () => {
    await mount();
    const stats = document.getElementById('caStats').textContent;
    expect(stats).toContain('qr, fingerprint');
    expect(stats).toContain('qr');
    expect(stats).toMatch(/yes/i);
  });

  it('switches tabs and shows the matching panel', async () => {
    await mount();
    expect(document.querySelector('#caSubj')).toBeTruthy();

    document.querySelector('[data-tab="devices"]').click();
    expect(document.querySelector('#devId')).toBeTruthy();
    expect(document.querySelector('[data-tab="devices"]').classList.contains('active')).toBe(true);

    document.querySelector('[data-tab="consent"]').click();
    expect(document.querySelector('#cnsSubj')).toBeTruthy();

    document.querySelector('[data-tab="jurisdiction"]').click();
    expect(document.querySelector('#caCountry')).toBeTruthy();
    expect(document.querySelector('#caCountry').value).toBe('IN');
  });

  it('renders enrolments table when data is present', async () => {
    await mount();
    const table = document.querySelector('.ca-table');
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('emp_42');
    expect(table.textContent).toContain('qr');
  });

  it('shows empty state when there are no enrolments', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path.startsWith('/api/capture/session-token?subject_type=staff')) {
        return {
          available_modalities: [],
          roll_call: false,
          jurisdiction: { country: 'IN', vertical: 'hr', retention_days: 365 },
        };
      }
      if (path.startsWith('/api/capture/session-token?subject_type=student')) {
        return { available_modalities: [] };
      }
      if (path === '/api/capture/enrolments') return { enrolments: [] };
      return { _error: true };
    });

    await mount();
    expect(document.querySelector('.ca-empty-text').textContent).toMatch(/No enrolments/i);
  });

  it('posts the expected QR enrol body', async () => {
    await mount();
    document.getElementById('caSubj').value = 'emp_99';
    document.getElementById('caSubjType').value = 'staff';
    document.getElementById('caQr').value = 'CARD-99';
    document.querySelector('[data-action="enrol-qr"]').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalled();
    });

    const call = apiPost.mock.calls.find((c) => c[0] === '/api/capture/enrolments');
    expect(call).toBeTruthy();
    expect(call[1]).toMatchObject({
      subject_ref: 'emp_99',
      subject_type: 'staff',
      modality: 'qr',
    });
    expect(call[1].payload_b64).toBeTruthy();
  });

  it('saves jurisdiction with the form payload', async () => {
    await mount();
    document.querySelector('[data-tab="jurisdiction"]').click();
    document.getElementById('caCountry').value = 'IN';
    document.getElementById('caVertical').value = 'school';
    document.getElementById('caDpia').value = 'dpia_school_1';
    document.getElementById('caRetention').value = '180';
    document.getElementById('caFaceAdults').checked = true;
    document.querySelector('[data-action="save-juris"]').click();

    await vi.waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
    });

    expect(apiPut).toHaveBeenCalledWith('/api/capture/jurisdiction', {
      country: 'IN',
      vertical: 'school',
      face_adults_enabled: true,
      face_students_dpia_ref: 'dpia_school_1',
      retention_days: 180,
    });
  });

  it('revokes an enrolment only after confirmDialog', async () => {
    await mount();
    document.querySelector('[data-action="revoke"]').click();

    await vi.waitFor(() => {
      expect(document.getElementById('crudModalOverlay')).toBeTruthy();
    });
    expect(apiDelete).not.toHaveBeenCalled();

    await acceptConfirm();

    await vi.waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/api/capture/enrolments/en1');
    });
    expect(toastFn).toHaveBeenCalledWith('Revoked', 'success');
  });
});

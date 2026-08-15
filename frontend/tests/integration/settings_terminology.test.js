import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();
const toastMock = vi.fn();

vi.mock('../../shared/api.js', () => ({
  api: {
    get: (...args) => apiGet(...args),
    post: (...args) => apiPost(...args),
  },
}));

vi.mock('../../shared/toast.js', () => ({
  toast: (...args) => toastMock(...args),
}));

vi.mock('../../shared/session.js', () => ({
  getSession: () => ({ email: 'admin@test.com', is_admin: true, name: 'Admin' }),
}));

vi.mock('../../shared/sse.js', () => ({
  onSSE: () => () => {},
}));

vi.mock('../../shared/router.js', () => ({
  registerModule: () => {},
  navigateToModule: () => {},
}));

vi.mock('../leave_policies/leave_policy_manager.js', () => ({
  renderLeavePolicyManager: () => {},
}));

describe('Settings terminology section', () => {
  /** @type {typeof import('../../modules/settings/settings.js')} */
  let settings;
  let root;

  beforeEach(async () => {
    vi.resetModules();
    toastMock.mockReset();
    apiGet.mockReset();
    apiPost.mockReset();
    root = document.createElement('div');
    document.body.appendChild(root);

    apiGet.mockResolvedValue({
      tenant_settings: {
        settings_json: {
          terminology: {
            person: 'Employee',
            person_plural: 'Employees',
            group: 'Department',
            subgroup: 'Team',
            interval: 'Shift',
            supervisor: 'Manager',
          },
        },
      },
      admins: ['admin@test.com'],
    });
    apiPost.mockResolvedValue({
      settings_json: {
        terminology: {
          person: 'Teammate',
          person_plural: 'Teammates',
          group: 'Department',
          subgroup: 'Team',
          interval: 'Shift',
          supervisor: 'Manager',
        },
      },
    });

    settings = await import('../../modules/settings/settings.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the Terminology section with six inputs', async () => {
    settings.renderSettingsPage(root);
    await vi.waitFor(() => {
      expect(root.querySelector('[data-sec-key="terminology"]')).toBeTruthy();
    });
    const sec = root.querySelector('[data-sec-key="terminology"]');
    expect(sec.querySelector('.set-section-name').textContent).toBe('Terminology');
    expect(sec.querySelectorAll('input[data-path^="terminology."]')).toHaveLength(6);
  });

  it('saves terminology via POST /api/settings', async () => {
    settings.renderSettingsPage(root);
    await vi.waitFor(() => root.querySelector('[data-sec-key="terminology"]'));

    const sec = root.querySelector('[data-sec-key="terminology"]');
    sec.classList.add('open');
    sec.querySelector('[data-path="terminology.person"]').value = 'Teammate';
    sec.querySelector('[data-path="terminology.person_plural"]').value = 'Teammates';

    sec.querySelector('.set-section-save').click();
    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());

    const body = apiPost.mock.calls[0][1];
    expect(apiPost.mock.calls[0][0]).toBe('/api/settings');
    expect(body.settings_json.terminology.person).toBe('Teammate');
    expect(toastMock).toHaveBeenCalledWith('Terminology saved', 'success');
  });

  it('surfaces validation errors via toast', async () => {
    settings.renderSettingsPage(root);
    await vi.waitFor(() => root.querySelector('[data-sec-key="terminology"]'));

    const sec = root.querySelector('[data-sec-key="terminology"]');
    sec.querySelector('[data-path="terminology.person"]').value = '';
    sec.querySelector('.set-section-save').click();

    await vi.waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      expect.stringMatching(/terminology\.person/i),
      'error',
    );
    expect(apiPost).not.toHaveBeenCalled();
  });
});

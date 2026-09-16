import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SAMPLE_FEATURES = {
  features: [
    {
      key: 'overtime',
      enabled: true,
      label: 'Overtime Management',
      description: 'OT detection and approval',
      category: 'attendance',
      adminOnly: false,
    },
    {
      key: 'analytics',
      enabled: false,
      label: 'Analytics & Reports',
      description: 'Reports dashboard',
      category: 'intelligence',
      adminOnly: true,
    },
    {
      key: 'feature_flags',
      enabled: true,
      label: 'Feature Flags Admin',
      description: 'This module',
      category: 'admin',
      adminOnly: true,
    },
    {
      key: 'school_vertical',
      enabled: true,
      label: 'School vertical',
      description: 'Derived',
      category: 'vertical',
      adminOnly: false,
    },
  ],
};

describe('feature_flags module', () => {
  /** @type {typeof import('../../modules/feature_flags/feature_flags.js')} */
  let mod;
  let apiGet;
  let apiPut;
  let toastFn;
  let loadFeatureFlagsFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/features?all=true') return SAMPLE_FEATURES;
      return null;
    });
    apiPut = vi.fn(async () => ({ success: true, feature: 'overtime', enabled: false }));
    toastFn = vi.fn();
    loadFeatureFlagsFn = vi.fn(async () => {});

    vi.doMock('../../shared/api.js', () => ({
      api: {
        get: apiGet,
        put: apiPut,
      },
    }));
    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      loadSession: () => ({ email: 'admin@test.com', is_admin: true }),
    }));
    vi.doMock('../../shared/router.js', () => ({
      registerModule: vi.fn(),
      loadFeatureFlags: loadFeatureFlagsFn,
    }));

    mod = await import('../../modules/feature_flags/feature_flags.js');
  });

  afterEach(() => {
    mod._resetState();
    vi.restoreAllMocks();
  });

  it('parses features array from GET /api/features?all=true', async () => {
    const root = document.getElementById('root');
    mod.renderFeatureFlagsPage(root);
    await new Promise((r) => setTimeout(r, 0));

    expect(apiGet).toHaveBeenCalledWith('/api/features?all=true');
    expect(mod._getData().length).toBe(4);
    expect(root.querySelector('.ff-empty')).toBeNull();
    expect(root.textContent).toContain('Overtime Management');
    expect(root.textContent).toContain('Total Flags');
    expect(root.textContent).toContain('4');
    expect(root.textContent).toContain('Enabled');
    expect(root.textContent).toContain('Disabled');
  });

  it('ffToggle calls PUT and refreshes sidebar flags', async () => {
    await mod.ffToggle('overtime', false);

    expect(apiPut).toHaveBeenCalledWith('/api/features/overtime', {
      enabled: false,
      email: 'admin@test.com',
    });
    expect(toastFn).toHaveBeenCalled();
    expect(loadFeatureFlagsFn).toHaveBeenCalled();
  });

  it('does not toggle protected feature_flags key', async () => {
    await mod.ffToggle('feature_flags', false);
    expect(apiPut).not.toHaveBeenCalled();
    expect(toastFn).toHaveBeenCalledWith(
      'This flag cannot be toggled here',
      'warn',
    );
  });
});

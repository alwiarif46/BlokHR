import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prefsClient
vi.mock('../js/prefsClient.js', () => ({
  applyPrefsToDOM: vi.fn(),
}));

const { applyPrefsToDOM } = await import('../js/prefsClient.js');
const {
  setOnContextReady,
  getSettingsCache,
  getCurrentUser,
  getIsAdmin,
  getMemberRecord,
  getMemberPrefs,
  __handleMessageForTest,
} = await import('../js/context.js');

describe('context.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fireMessage(data, origin) {
    __handleMessageForTest({ origin: origin || window.location.origin, data });
  }

  it('rejects CONTEXT with wrong origin', () => {
    const handler = vi.fn();
    setOnContextReady(handler);
    fireMessage(JSON.stringify({ v: 1, settings: {}, user: {} }), 'https://evil.com');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects CONTEXT with v !== 1', () => {
    const handler = vi.fn();
    setOnContextReady(handler);
    fireMessage(JSON.stringify({ v: 2, settings: {}, user: {} }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts valid CONTEXT v:1 from same origin', () => {
    const handler = vi.fn();
    setOnContextReady(handler);
    const ctx = {
      v: 1,
      settings: { tenant: { platformName: 'Test' } },
      user: { email: 'a@b.com', name: 'A' },
      isAdmin: true,
      member: { email: 'a@b.com' },
      prefs: { theme: 'neural' },
    };
    fireMessage(JSON.stringify(ctx));
    expect(handler).toHaveBeenCalledWith(ctx);
    expect(getSettingsCache()).toEqual(ctx.settings);
    expect(getCurrentUser()).toEqual(ctx.user);
    expect(getIsAdmin()).toBe(true);
    expect(getMemberRecord()).toEqual(ctx.member);
    expect(getMemberPrefs()).toEqual(ctx.prefs);
  });

  it('applies prefs from CONTEXT without localStorage read', () => {
    const ctx = {
      v: 1,
      settings: {},
      user: { email: 'a@b.com' },
      isAdmin: false,
      member: {},
      prefs: { theme: 'clean', color_accent: '#ff0000' },
    };
    fireMessage(JSON.stringify(ctx));
    expect(applyPrefsToDOM).toHaveBeenCalledWith(ctx.prefs);
  });

  it('handles object data (not just string)', () => {
    const handler = vi.fn();
    setOnContextReady(handler);
    const ctx = { v: 1, settings: {}, user: {}, isAdmin: false, member: {}, prefs: {} };
    fireMessage(ctx);
    expect(handler).toHaveBeenCalled();
  });
});

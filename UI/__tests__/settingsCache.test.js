import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/httpClient.js', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

const { httpClient } = await import('../js/httpClient.js');
const { loadSettings, getSettings, updateSettings, getNestedValue, dotPathToObject } = await import(
  '../js/settingsCache.js'
);

describe('settingsCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSettings(null);
  });

  it('loadSettings fetches from /api/settings', async () => {
    httpClient.get.mockResolvedValue({ settings: { tenant: { id: 't1' } } });
    const s = await loadSettings();
    expect(httpClient.get).toHaveBeenCalledWith('/api/settings');
    expect(s.tenant.id).toBe('t1');
  });

  it('getSettings returns cached settings', async () => {
    httpClient.get.mockResolvedValue({ settings: { tenant: { id: 't2' } } });
    await loadSettings();
    expect(getSettings().tenant.id).toBe('t2');
  });

  it('updateSettings replaces cache', () => {
    updateSettings({ tenant: { id: 't3' } });
    expect(getSettings().tenant.id).toBe('t3');
  });

  it('getNestedValue reads dot paths', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getNestedValue(obj, 'a.b.c')).toBe(42);
    expect(getNestedValue(obj, 'a.b.d')).toBeUndefined();
    expect(getNestedValue(null, 'a')).toBeUndefined();
  });

  it('dotPathToObject builds nested object', () => {
    expect(dotPathToObject('a.b.c', 42)).toEqual({ a: { b: { c: 42 } } });
    expect(dotPathToObject('x', 'hello')).toEqual({ x: 'hello' });
  });
});

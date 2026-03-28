import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sessionStorage
const mockSessionStorage = {
  store: {},
  getItem(key) { return this.store[key] || ''; },
  setItem(key, val) { this.store[key] = val; },
  clear() { this.store = {}; },
};
Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, writable: true });

const { httpClient } = await import('../js/httpClient.js');

describe('httpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  it('sends X-User-Email header', async () => {
    mockSessionStorage.setItem('blokhr_email', 'test@example.com');
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.get('/api/settings');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-User-Email']).toBe('test@example.com');
  });

  it('sends X-User-Name header', async () => {
    mockSessionStorage.setItem('blokhr_name', 'Test User');
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.get('/api/settings');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-User-Name']).toBe('Test User');
  });

  it('does NOT send Authorization header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.get('/api/settings');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Bearer']).toBeUndefined();
  });

  it('rejects absolute URLs', async () => {
    await expect(httpClient.get('https://server.com/api/settings')).rejects.toThrow(
      'Absolute URLs are forbidden'
    );
  });

  it('all paths are relative', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.get('/api/clock');

    expect(mockFetch.mock.calls[0][0]).toBe('/api/clock');
  });

  it('POST sends JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.post('/api/clock', { action: 'in' });

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe('{"action":"in"}');
  });

  it('PUT sends JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await httpClient.put('/api/profiles/me/prefs', { theme: 'neural' });

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.method).toBe('PUT');
    expect(opts.body).toBe('{"theme":"neural"}');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const err = await httpClient.get('/api/nonexistent').catch(e => e);
    expect(err.status).toBe(404);
  });

  it('handles empty response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const result = await httpClient.delete('/api/something');
    expect(result).toEqual({});
  });
});

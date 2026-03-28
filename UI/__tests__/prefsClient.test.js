import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock httpClient
vi.mock('../js/httpClient.js', () => ({
  httpClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

// Mock themeManager
vi.mock('../js/themeManager.js', () => ({
  setTheme: vi.fn(),
  setDarkMode: vi.fn(),
}));

const { httpClient } = await import('../js/httpClient.js');
const { loadPrefs, savePref, getPrefs, applyPrefsToDOM } = await import('../js/prefsClient.js');
const { setTheme, setDarkMode } = await import('../js/themeManager.js');

describe('prefsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.cssText = '';
  });

  it('savePref calls PUT /api/profiles/me/prefs', async () => {
    httpClient.put.mockResolvedValue({});
    await savePref('theme', 'neural');
    expect(httpClient.put).toHaveBeenCalledWith('/api/profiles/me/prefs', { theme: 'neural' });
  });

  it('savePref does NOT write to localStorage', async () => {
    httpClient.put.mockResolvedValue({});
    await savePref('theme', 'neural');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(localStorage.getItem('blokhr_theme')).toBeNull();
  });

  it('loadPrefs fetches from server and applies', async () => {
    httpClient.get.mockResolvedValue({ prefs: { theme: 'clean', dark_mode: 'dark' } });
    const prefs = await loadPrefs();
    expect(httpClient.get).toHaveBeenCalledWith('/api/profiles/me/prefs');
    expect(prefs.theme).toBe('clean');
    expect(setTheme).toHaveBeenCalledWith('clean');
    expect(setDarkMode).toHaveBeenCalledWith('dark');
  });

  it('getPrefs returns a copy', async () => {
    httpClient.get.mockResolvedValue({ prefs: { theme: 'neural' } });
    await loadPrefs();
    const copy = getPrefs();
    copy.theme = 'modified';
    expect(getPrefs().theme).toBe('neural');
  });

  it('applyPrefsToDOM sets CSS variables for color overrides', () => {
    applyPrefsToDOM({ color_accent: '#6366f1', color_bg0: '#111111' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--bg0')).toBe('#111111');
  });

  it('applyPrefsToDOM sets background image properties', () => {
    applyPrefsToDOM({
      bg_image_url: 'https://example.com/bg.jpg',
      bg_opacity: 80,
      bg_blur: 5,
      bg_darken: 40,
    });
    expect(document.documentElement.style.getPropertyValue('--bg-image')).toBe(
      'url(https://example.com/bg.jpg)'
    );
    expect(document.documentElement.style.getPropertyValue('--bg-opacity')).toBe('0.8');
    expect(document.documentElement.style.getPropertyValue('--bg-blur')).toBe('5px');
    expect(document.documentElement.style.getPropertyValue('--bg-darken')).toBe('0.4');
  });
});

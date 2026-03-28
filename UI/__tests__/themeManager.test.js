import { describe, it, expect, beforeEach } from 'vitest';
import { setTheme, getTheme, setDarkMode, getDarkMode, getAvailableThemes } from '../js/themeManager.js';

describe('themeManager', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('setTheme applies CSS class', () => {
    setTheme('neural');
    expect(document.body.classList.contains('theme-neural')).toBe(true);
    expect(getTheme()).toBe('neural');
  });

  it('setTheme removes previous theme class', () => {
    setTheme('neural');
    setTheme('holodeck');
    expect(document.body.classList.contains('theme-neural')).toBe(false);
    expect(document.body.classList.contains('theme-holodeck')).toBe(true);
  });

  it('setTheme rejects invalid theme', () => {
    setTheme('chromium');
    setTheme('invalid-theme');
    expect(getTheme()).toBe('chromium');
  });

  it('setDarkMode applies dark-mode class', () => {
    setDarkMode('dark');
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    expect(getDarkMode()).toBe('dark');
  });

  it('setDarkMode applies light-mode class', () => {
    setDarkMode('light');
    expect(document.body.classList.contains('light-mode')).toBe(true);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  it('setDarkMode rejects invalid mode', () => {
    setDarkMode('dark');
    setDarkMode('invalid');
    expect(getDarkMode()).toBe('dark');
  });

  it('getAvailableThemes returns all four themes', () => {
    const themes = getAvailableThemes();
    expect(themes).toEqual(['chromium', 'neural', 'holodeck', 'clean']);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setTheme,
  getTheme,
  getValidThemes,
  getThemeLabel,
  normalizeTheme,
} from '../../shared/themes.js';
import { setTenantLogoOverride } from '../../shared/brand.js';

describe('themes catalog and setTheme', () => {
  beforeEach(() => {
    setTenantLogoOverride(false);
    document.body.className = 'guardian-body on-login-screen';
    document.body.innerHTML = '<img id="hdrLogoImg" /><img id="loginLogoImg" />';
  });

  afterEach(() => {
    setTenantLogoOverride(false);
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('exposes exactly the two product themes', () => {
    expect(getValidThemes()).toEqual(['light', 'dark']);
    expect(getThemeLabel('light')).toBe('Light');
    expect(getThemeLabel('dark')).toBe('Dark');
  });

  it('normalizes legacy theme ids', () => {
    expect(normalizeTheme('chromium')).toBe('dark');
    expect(normalizeTheme('clean')).toBe('dark');
    expect(normalizeTheme('neural')).toBe('light');
    expect(normalizeTheme('holodeck')).toBe('light');
    expect(normalizeTheme('not-a-theme')).toBe('dark');
  });

  it('falls back to dark for unknown theme ids', () => {
    setTheme('not-a-theme');
    expect(getTheme()).toBe('dark');
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });

  it('preserves structural body classes when switching themes', () => {
    setTheme('light');
    expect(document.body.className.split(/\s+/).sort()).toEqual(
      ['guardian-body', 'on-login-screen', 'theme-light'].sort(),
    );

    setTheme('dark');
    expect(document.body.classList.contains('guardian-body')).toBe(true);
    expect(document.body.classList.contains('on-login-screen')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });

  it('replaces only theme-* classes and keeps a single theme class', () => {
    document.body.className = 'theme-dark theme-stale guardian-body';
    setTheme('dark');
    const themes = Array.from(document.body.classList).filter((c) => /^theme-/.test(c));
    expect(themes).toEqual(['theme-dark']);
    expect(document.body.classList.contains('guardian-body')).toBe(true);
  });

  it('maps legacy prefs through setTheme', () => {
    setTheme('neural');
    expect(getTheme()).toBe('light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    setTheme('chromium');
    expect(getTheme()).toBe('dark');
  });

  it('swaps mono logos when theme changes between dark and light surfaces', () => {
    setTheme('dark');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toContain(
      'blok-mono-white.png',
    );
    setTheme('light');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toContain(
      'blok-mono-ink.png',
    );
    expect(document.getElementById('loginLogoImg').getAttribute('src')).toContain(
      'blok-mono-ink.png',
    );
  });
});

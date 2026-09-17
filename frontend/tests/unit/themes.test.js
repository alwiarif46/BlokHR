import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setTheme,
  getTheme,
  getValidThemes,
  getThemeLabel,
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

  it('exposes exactly the four product themes', () => {
    expect(getValidThemes()).toEqual(['chromium', 'neural', 'holodeck', 'clean']);
    expect(getThemeLabel('chromium')).toBe('Chromium Forge');
    expect(getThemeLabel('neural')).toBe('Neural Circuit');
    expect(getThemeLabel('holodeck')).toBe('Holodeck HUD');
    expect(getThemeLabel('clean')).toBe('Electric Blue');
  });

  it('falls back to chromium for unknown theme ids', () => {
    setTheme('not-a-theme');
    expect(getTheme()).toBe('chromium');
    expect(document.body.classList.contains('theme-chromium')).toBe(true);
  });

  it('preserves structural body classes when switching themes', () => {
    setTheme('neural');
    expect(document.body.className.split(/\s+/).sort()).toEqual(
      ['guardian-body', 'on-login-screen', 'theme-neural'].sort(),
    );

    setTheme('holodeck');
    expect(document.body.classList.contains('guardian-body')).toBe(true);
    expect(document.body.classList.contains('on-login-screen')).toBe(true);
    expect(document.body.classList.contains('theme-holodeck')).toBe(true);
    expect(document.body.classList.contains('theme-neural')).toBe(false);

    setTheme('clean');
    expect(document.body.classList.contains('theme-clean')).toBe(true);
    expect(document.body.classList.contains('guardian-body')).toBe(true);
  });

  it('replaces only theme-* classes and keeps a single theme class', () => {
    document.body.className = 'theme-chromium theme-stale guardian-body';
    setTheme('chromium');
    const themes = Array.from(document.body.classList).filter((c) => /^theme-/.test(c));
    expect(themes).toEqual(['theme-chromium']);
    expect(document.body.classList.contains('guardian-body')).toBe(true);
  });

  it('swaps mono logos when theme changes between dark and light surfaces', () => {
    setTheme('chromium');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toContain(
      'blok-mono-white.png',
    );
    setTheme('neural');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toContain(
      'blok-mono-ink.png',
    );
    expect(document.getElementById('loginLogoImg').getAttribute('src')).toContain(
      'blok-mono-ink.png',
    );
    setTheme('clean');
    expect(document.getElementById('loginLogoImg').getAttribute('src')).toContain(
      'blok-mono-white.png',
    );
  });
});

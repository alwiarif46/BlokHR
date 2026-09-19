import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getBrand,
  applyBrand,
  resolveBrandLogoPath,
  isLightBrandSurface,
  syncBrandLogos,
  setTenantLogoOverride,
  PLATFORM_WORDMARK,
} from '../../shared/brand.js';

describe('getBrand', () => {
  it('returns BlokHR brand for hr vertical', () => {
    const b = getBrand('hr');
    expect(b.name).toBe('BlokHR');
    expect(b.wordmark).toBe(PLATFORM_WORDMARK);
    expect(b.colourPresetKey).toBe('blokhr');
    expect(b.wordmarkPath).toContain('blokhr-wordmark.svg');
    expect(b.faviconPath).toContain('favicon-13.svg');
    expect(b.tagline).toBeTruthy();
    expect(b.loginHeading).toBeTruthy();
  });

  it('returns BlokSchool brand for school session', () => {
    const b = getBrand('school');
    expect(b.name).toBe('BlokSchool');
    expect(b.wordmark).toBe('13lok');
    expect(b.colourPresetKey).toBe('blokschool');
    expect(b.wordmarkPath).toContain('blokschool-wordmark.svg');
    expect(b.loginLogoIncludesName).toBe(true);
    expect(b.faviconPath).toContain('favicon-13.svg');
  });

  it('defaults unknown vertical to hr', () => {
    expect(getBrand(undefined).name).toBe('BlokHR');
    expect(getBrand('other').name).toBe('BlokHR');
  });
});

describe('resolveBrandLogoPath', () => {
  it('keeps light-surface detection for theme chrome', () => {
    expect(isLightBrandSurface('neural')).toBe(true);
    expect(isLightBrandSurface('holodeck')).toBe(true);
    expect(isLightBrandSurface('light')).toBe(true);
    expect(isLightBrandSurface('chromium')).toBe(false);
    expect(isLightBrandSurface('clean')).toBe(false);
  });

  it('returns empty path — chrome uses text wordmark', () => {
    expect(resolveBrandLogoPath('neural')).toBe('');
    expect(resolveBrandLogoPath('dark')).toBe('');
  });
});

describe('applyBrand', () => {
  beforeEach(() => {
    setTenantLogoOverride(false);
    document.head.innerHTML = '';
    document.body.className = 'theme-dark';
    document.body.innerHTML = `
      <div id="hdrLogo" class="hdr-logo">
        <div id="hdrLogoLetter">B</div>
        <img id="hdrLogoImg" style="display:none" />
        <span id="hdrBrandWordmark" class="brand-wordmark"></span>
      </div>
      <div id="hdrTitle"></div>
      <div class="login-logo" id="loginLogo">
        <span id="loginLogoLetter">B</span>
        <img id="loginLogoImg" style="display:none" />
        <span id="loginBrandWordmark" class="brand-wordmark"></span>
      </div>
      <div id="loginTitle"></div>
      <div id="loginTagline"></div>
      <div id="loginFooter"></div>
      <div id="loginSub"></div>
    `;
    document.title = '';
  });

  afterEach(() => {
    setTenantLogoOverride(false);
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.body.className = '';
  });

  it('swaps title, favicon, and text wordmark for a school session', () => {
    applyBrand('school');
    expect(document.title).toBe('BlokSchool');
    const icon = document.querySelector("link[rel='icon']");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('href')).toContain('favicon-13.svg');
    expect(document.getElementById('hdrBrandWordmark').textContent).toBe('13lok');
    expect(document.getElementById('hdrLogoImg').style.display).toBe('none');
    expect(document.getElementById('hdrTitle').textContent).toBe('BlokSchool');
    expect(document.getElementById('loginBrandWordmark').textContent).toBe('13lok');
    expect(document.getElementById('loginTitle').hidden).toBe(true);
    expect(document.getElementById('loginFooter').textContent).toBe('Powered by 13lok');
  });

  it('applies text wordmark on light and dark themes', () => {
    document.body.className = 'theme-light';
    applyBrand('hr', 'light');
    expect(document.getElementById('hdrBrandWordmark').textContent).toBe('13lok');
    expect(document.getElementById('loginBrandWordmark').textContent).toBe('13lok');

    document.body.className = 'theme-dark';
    applyBrand('hr', 'dark');
    expect(document.getElementById('hdrBrandWordmark').textContent).toBe('13lok');
  });

  it('applies hr brand chrome', () => {
    applyBrand('hr');
    expect(document.title).toBe('BlokHR');
    expect(document.querySelector("link[rel='icon']").getAttribute('href')).toContain(
      'favicon-13.svg',
    );
  });

  it('skips wordmark sync when tenant logo override is active', () => {
    setTenantLogoOverride(true);
    document.getElementById('hdrLogoImg').setAttribute('src', 'tenant://logo');
    document.getElementById('hdrBrandWordmark').textContent = 'stale';
    syncBrandLogos('dark');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toBe('tenant://logo');
    expect(document.getElementById('hdrBrandWordmark').textContent).toBe('stale');
  });
});

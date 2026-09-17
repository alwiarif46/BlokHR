import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getBrand,
  applyBrand,
  resolveBrandLogoPath,
  isLightBrandSurface,
  syncBrandLogos,
  setTenantLogoOverride,
  MONO_LOGO_DARK,
  MONO_LOGO_LIGHT,
} from '../../shared/brand.js';

describe('getBrand', () => {
  it('returns BlokHR brand for hr vertical', () => {
    const b = getBrand('hr');
    expect(b.name).toBe('BlokHR');
    expect(b.colourPresetKey).toBe('blokhr');
    expect(b.wordmarkPath).toContain('blokhr-wordmark.svg');
    expect(b.headerLogoDarkPath).toContain('blok-mono-white.png');
    expect(b.headerLogoLightPath).toContain('blok-mono-ink.png');
    expect(b.headerLogoPath).toContain('blok-mono-white.png');
    expect(b.faviconPath).toContain('favicon-13.svg');
    expect(b.tagline).toBeTruthy();
    expect(b.loginHeading).toBeTruthy();
  });

  it('returns BlokSchool brand for school vertical', () => {
    const b = getBrand('school');
    expect(b.name).toBe('BlokSchool');
    expect(b.colourPresetKey).toBe('blokschool');
    expect(b.wordmarkPath).toContain('blokschool-wordmark.svg');
    expect(b.headerLogoPath).toContain('blok-mono-white.png');
    expect(b.loginLogoPath).toContain('blok-mono-white.png');
    expect(b.loginLogoIncludesName).toBe(true);
    expect(b.faviconPath).toContain('favicon-13.svg');
  });

  it('defaults unknown vertical to hr', () => {
    expect(getBrand(undefined).name).toBe('BlokHR');
    expect(getBrand('other').name).toBe('BlokHR');
  });
});

describe('resolveBrandLogoPath', () => {
  it('uses ink mark for clean / light surfaces', () => {
    expect(isLightBrandSurface('clean')).toBe(true);
    expect(isLightBrandSurface('light')).toBe(true);
    expect(resolveBrandLogoPath('clean')).toBe(MONO_LOGO_LIGHT);
    expect(resolveBrandLogoPath('light')).toBe(MONO_LOGO_LIGHT);
  });

  it('uses white mark for dark themes', () => {
    expect(isLightBrandSurface('chromium')).toBe(false);
    expect(resolveBrandLogoPath('chromium')).toBe(MONO_LOGO_DARK);
    expect(resolveBrandLogoPath('neural')).toBe(MONO_LOGO_DARK);
    expect(resolveBrandLogoPath('holodeck')).toBe(MONO_LOGO_DARK);
    expect(resolveBrandLogoPath('dark')).toBe(MONO_LOGO_DARK);
  });
});

describe('applyBrand', () => {
  beforeEach(() => {
    setTenantLogoOverride(false);
    document.head.innerHTML = '';
    document.body.className = 'theme-chromium';
    document.body.innerHTML = `
      <div id="hdrLogoLetter">B</div>
      <img id="hdrLogoImg" style="display:none" />
      <div id="hdrTitle"></div>
      <div class="login-logo" id="loginLogo">
        <span id="loginLogoLetter">B</span>
        <img id="loginLogoImg" style="display:none" />
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

  it('swaps title, favicon, and mono wordmark for a school session', () => {
    applyBrand('school');
    expect(document.title).toBe('BlokSchool');
    const icon = document.querySelector("link[rel='icon']");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('href')).toContain('favicon-13.svg');
    const img = document.getElementById('hdrLogoImg');
    expect(img.getAttribute('src')).toContain('blok-mono-white.png');
    expect(img.style.display).toBe('block');
    expect(document.getElementById('hdrTitle').textContent).toBe('BlokSchool');
    expect(document.getElementById('loginLogoImg').getAttribute('src')).toContain(
      'blok-mono-white.png',
    );
    expect(document.getElementById('loginTitle').hidden).toBe(true);
  });

  it('applies ink mono when theme is clean', () => {
    document.body.className = 'theme-clean';
    applyBrand('hr', 'clean');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toContain(
      'blok-mono-ink.png',
    );
  });

  it('applies hr brand chrome', () => {
    applyBrand('hr');
    expect(document.title).toBe('BlokHR');
    expect(document.querySelector("link[rel='icon']").getAttribute('href')).toContain(
      'favicon-13.svg',
    );
  });

  it('skips mono sync when tenant logo override is active', () => {
    setTenantLogoOverride(true);
    document.getElementById('hdrLogoImg').setAttribute('src', 'tenant://logo');
    syncBrandLogos('clean');
    expect(document.getElementById('hdrLogoImg').getAttribute('src')).toBe('tenant://logo');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBrand, applyBrand } from '../../shared/brand.js';

describe('getBrand', () => {
  it('returns BlokHR brand for hr vertical', () => {
    const b = getBrand('hr');
    expect(b.name).toBe('BlokHR');
    expect(b.colourPresetKey).toBe('blokhr');
    expect(b.wordmarkPath).toContain('blokhr-wordmark.svg');
    expect(b.faviconPath).toContain('blokhr-favicon.svg');
    expect(b.tagline).toBeTruthy();
    expect(b.loginHeading).toBeTruthy();
  });

  it('returns BlokSchool brand for school vertical', () => {
    const b = getBrand('school');
    expect(b.name).toBe('BlokSchool');
    expect(b.colourPresetKey).toBe('blokschool');
    expect(b.wordmarkPath).toContain('blokschool-wordmark.svg');
    expect(b.faviconPath).toContain('blokschool-favicon.svg');
  });

  it('defaults unknown vertical to hr', () => {
    expect(getBrand(undefined).name).toBe('BlokHR');
    expect(getBrand('other').name).toBe('BlokHR');
  });
});

describe('applyBrand', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <div id="hdrLogoLetter">B</div>
      <img id="hdrLogoImg" style="display:none" />
      <div id="hdrTitle"></div>
      <div id="loginTitle"></div>
      <div id="loginTagline"></div>
      <div id="loginFooter"></div>
      <div id="loginSub"></div>
      <span id="loginLogoLetter">B</span>
      <img id="loginLogoImg" style="display:none" />
    `;
    document.title = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('swaps title, favicon, and wordmark for a school session', () => {
    applyBrand('school');
    expect(document.title).toBe('BlokSchool');
    const icon = document.querySelector("link[rel='icon']");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('href')).toContain('blokschool-favicon.svg');
    const img = document.getElementById('hdrLogoImg');
    expect(img.getAttribute('src')).toContain('blokschool-wordmark.svg');
    expect(img.style.display).toBe('block');
    expect(document.getElementById('hdrTitle').textContent).toBe('BlokSchool');
    expect(document.getElementById('loginTitle').textContent).toBe('BlokSchool');
  });

  it('applies hr brand chrome', () => {
    applyBrand('hr');
    expect(document.title).toBe('BlokHR');
    expect(document.querySelector("link[rel='icon']").getAttribute('href')).toContain(
      'blokhr-favicon.svg',
    );
  });
});

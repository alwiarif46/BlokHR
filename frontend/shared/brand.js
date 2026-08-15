/**
 * shared/brand.js — Vertical brand identity (W-03)
 *
 * Pure brand table + DOM apply for title / favicon / header wordmark.
 * Login and other surfaces read getBrand() when they need copy.
 */

const ASSET_BASE = 'assets/brand/';

/** @typedef {'hr'|'school'} BrandVertical */

/**
 * @typedef {{
 *   name: string,
 *   wordmarkPath: string,
 *   faviconPath: string,
 *   tagline: string,
 *   loginHeading: string,
 *   colourPresetKey: string,
 * }} BrandInfo
 */

/** @type {Record<BrandVertical, BrandInfo>} */
const BRANDS = {
  hr: {
    name: 'BlokHR',
    wordmarkPath: ASSET_BASE + 'blokhr-wordmark.svg',
    faviconPath: ASSET_BASE + 'blokhr-favicon.svg',
    tagline: 'Your Modular HRMS',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokhr',
  },
  school: {
    name: 'BlokSchool',
    wordmarkPath: ASSET_BASE + 'blokschool-wordmark.svg',
    faviconPath: ASSET_BASE + 'blokschool-favicon.svg',
    tagline: 'Attendance, timetable & learning ops',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokschool',
  },
};

/**
 * @param {string|null|undefined} vertical
 * @returns {BrandInfo}
 */
export function getBrand(vertical) {
  const key = vertical === 'school' ? 'school' : 'hr';
  return { ...BRANDS[key] };
}

/**
 * Apply brand chrome: document title, favicon link, header wordmark.
 * Does not touch storage or network.
 *
 * @param {string|null|undefined} vertical
 */
export function applyBrand(vertical) {
  const brand = getBrand(vertical);

  document.title = brand.name;

  let icon = document.querySelector("link[rel='icon']");
  if (!icon) {
    icon = document.createElement('link');
    icon.setAttribute('rel', 'icon');
    document.head.appendChild(icon);
  }
  icon.setAttribute('type', 'image/svg+xml');
  icon.setAttribute('href', brand.faviconPath);

  const hdrImg = document.getElementById('hdrLogoImg');
  const hdrLetter = document.getElementById('hdrLogoLetter');
  const hdrWordmark = document.getElementById('hdrWordmark');
  if (hdrImg) {
    hdrImg.setAttribute('src', brand.wordmarkPath);
    hdrImg.setAttribute('alt', brand.name);
    hdrImg.style.display = 'block';
  }
  if (hdrLetter) hdrLetter.style.display = 'none';
  if (hdrWordmark) {
    hdrWordmark.setAttribute('src', brand.wordmarkPath);
    hdrWordmark.setAttribute('alt', brand.name);
    hdrWordmark.style.display = 'block';
  }

  // Login / header text that formerly hard-coded product name (still brand.js–owned).
  const loginTitle = document.getElementById('loginTitle');
  const loginTagline = document.getElementById('loginTagline');
  const loginFooter = document.getElementById('loginFooter');
  const loginSub = document.getElementById('loginSub');
  const loginImg = document.getElementById('loginLogoImg');
  const loginLetter = document.getElementById('loginLogoLetter');
  const hdrTitle = document.getElementById('hdrTitle');

  if (loginTitle) loginTitle.textContent = brand.name;
  if (loginTagline) loginTagline.textContent = brand.tagline;
  if (loginFooter) loginFooter.textContent = 'Powered by ' + brand.name;
  if (loginSub) loginSub.textContent = brand.loginHeading;
  if (hdrTitle) hdrTitle.textContent = brand.name;
  if (loginImg) {
    loginImg.setAttribute('src', brand.wordmarkPath);
    loginImg.setAttribute('alt', brand.name);
    loginImg.style.display = 'block';
  }
  if (loginLetter) loginLetter.style.display = 'none';
}

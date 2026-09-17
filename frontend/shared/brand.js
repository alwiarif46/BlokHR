/**
 * shared/brand.js — Vertical brand identity (W-03)
 *
 * Pure brand table + DOM apply for title / favicon / header wordmark.
 * Login and other surfaces read getBrand() when they need copy.
 *
 * Product chrome uses theme-aware [blok] mono marks:
 *  - dark themes (chromium / neural / holodeck) → white
 *  - light theme (clean) / wizard light → ink
 */

const ASSET_BASE = 'assets/brand/';

/** Shared mono wordmarks for product chrome (both verticals). */
export const MONO_LOGO_DARK = ASSET_BASE + 'blok-mono-white.png';
export const MONO_LOGO_LIGHT = ASSET_BASE + 'blok-mono-ink.png';

/** @typedef {'hr'|'school'} BrandVertical */

/**
 * @typedef {{
 *   name: string,
 *   wordmarkPath: string,
 *   headerLogoPath: string,
 *   loginLogoPath: string,
 *   headerLogoDarkPath: string,
 *   headerLogoLightPath: string,
 *   faviconPath: string,
 *   tagline: string,
 *   loginHeading: string,
 *   colourPresetKey: string,
 *   loginLogoIncludesName?: boolean,
 * }} BrandInfo
 */

/** @type {Record<BrandVertical, BrandInfo>} */
const BRANDS = {
  hr: {
    name: 'BlokHR',
    wordmarkPath: ASSET_BASE + 'blokhr-wordmark.svg',
    headerLogoPath: MONO_LOGO_DARK,
    loginLogoPath: MONO_LOGO_DARK,
    headerLogoDarkPath: MONO_LOGO_DARK,
    headerLogoLightPath: MONO_LOGO_LIGHT,
    faviconPath: ASSET_BASE + 'blokhr-favicon.svg',
    tagline: 'Your Modular HRMS',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokhr',
    loginLogoIncludesName: true,
  },
  school: {
    name: 'BlokSchool',
    wordmarkPath: ASSET_BASE + 'blokschool-wordmark.svg',
    headerLogoPath: MONO_LOGO_DARK,
    loginLogoPath: MONO_LOGO_DARK,
    headerLogoDarkPath: MONO_LOGO_DARK,
    headerLogoLightPath: MONO_LOGO_LIGHT,
    faviconPath: ASSET_BASE + 'blokschool-favicon.svg',
    tagline: 'Attendance, timetable & learning ops',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokschool',
    loginLogoIncludesName: true,
  },
};

/** @type {BrandVertical} */
let _currentVertical = 'hr';

/** When true, tenant logo_data_url owns header/login imgs — skip mono sync. */
let _tenantLogoOverride = false;

/**
 * @param {string|null|undefined} vertical
 * @returns {BrandInfo}
 */
export function getBrand(vertical) {
  const key = vertical === 'school' ? 'school' : 'hr';
  return { ...BRANDS[key] };
}

/**
 * Whether a shell theme (or wizard light/dark) should use the ink (light-bg) mark.
 * @param {string|null|undefined} themeOrWz — theme name, or 'light' | 'dark' for wizard
 * @returns {boolean}
 */
export function isLightBrandSurface(themeOrWz) {
  const t = String(themeOrWz || '').toLowerCase();
  return t === 'clean' || t === 'light';
}

/**
 * Resolve mono logo path for the current surface.
 * @param {string|null|undefined} themeOrWz
 * @param {string|null|undefined} [vertical]
 * @returns {string}
 */
export function resolveBrandLogoPath(themeOrWz, vertical) {
  const brand = getBrand(vertical != null ? vertical : _currentVertical);
  return isLightBrandSurface(themeOrWz)
    ? brand.headerLogoLightPath
    : brand.headerLogoDarkPath;
}

/**
 * @param {boolean} active
 */
export function setTenantLogoOverride(active) {
  _tenantLogoOverride = !!active;
}

/** @returns {boolean} */
export function hasTenantLogoOverride() {
  return _tenantLogoOverride;
}

/**
 * Swap header / login / wizard / guardian wordmark imgs to the mono mark for theme.
 * No-ops when a tenant logo override is active.
 *
 * @param {string|null|undefined} themeOrWz
 * @param {string|null|undefined} [vertical]
 */
export function syncBrandLogos(themeOrWz, vertical) {
  if (_tenantLogoOverride) return;
  const brand = getBrand(vertical != null ? vertical : _currentVertical);
  const path = resolveBrandLogoPath(themeOrWz, vertical != null ? vertical : _currentVertical);
  const ids = ['hdrLogoImg', 'loginLogoImg', 'hdrWordmark', 'wzLogoImg'];
  for (let i = 0; i < ids.length; i++) {
    const el = document.getElementById(ids[i]);
    if (!el) continue;
    el.setAttribute('src', path);
    el.setAttribute('alt', brand.name);
    el.style.display = 'block';
  }
  const hdrLetter = document.getElementById('hdrLogoLetter');
  if (hdrLetter) hdrLetter.style.display = 'none';
  const loginLetter = document.getElementById('loginLogoLetter');
  if (loginLetter) loginLetter.style.display = 'none';
  const wzLetter = document.getElementById('wzLogoLetter');
  if (wzLetter) wzLetter.style.display = 'none';
  const wzLogo = document.getElementById('wzLogo');
  if (wzLogo) wzLogo.classList.add('wz-logo--mark');
  const loginLogo = document.getElementById('loginLogo');
  if (loginLogo) loginLogo.classList.add('login-logo--mark');
}

/**
 * Apply brand chrome: document title, favicon link, header wordmark.
 * Does not touch storage or network.
 *
 * @param {string|null|undefined} vertical
 * @param {string|null|undefined} [themeOrWz] — optional; defaults to body theme / chromium
 */
export function applyBrand(vertical, themeOrWz) {
  _currentVertical = vertical === 'school' ? 'school' : 'hr';
  const brand = getBrand(_currentVertical);

  document.title = brand.name;

  let icon = document.querySelector("link[rel='icon']");
  if (!icon) {
    icon = document.createElement('link');
    icon.setAttribute('rel', 'icon');
    document.head.appendChild(icon);
  }
  icon.setAttribute('type', 'image/svg+xml');
  icon.setAttribute('href', brand.faviconPath);

  let theme = themeOrWz;
  if (theme == null || theme === '') {
    const bodyTheme = (document.body && document.body.className.match(/theme-(\w+)/)) || null;
    theme = bodyTheme ? bodyTheme[1] : 'chromium';
  }

  if (!_tenantLogoOverride) {
    syncBrandLogos(theme, _currentVertical);
  }

  // Login / header text that formerly hard-coded product name (still brand.js–owned).
  const loginTitle = document.getElementById('loginTitle');
  const loginTagline = document.getElementById('loginTagline');
  const loginFooter = document.getElementById('loginFooter');
  const loginSub = document.getElementById('loginSub');
  const loginLogo = document.getElementById('loginLogo');
  const hdrTitle = document.getElementById('hdrTitle');

  if (loginTagline) loginTagline.textContent = brand.tagline;
  if (loginFooter) loginFooter.textContent = 'Powered by ' + brand.name;
  if (loginSub) loginSub.textContent = brand.loginHeading;
  if (hdrTitle) hdrTitle.textContent = brand.name;
  if (loginTitle) {
    loginTitle.textContent = brand.name;
    if (brand.loginLogoIncludesName) {
      loginTitle.hidden = true;
      loginTitle.classList.add('visually-hidden');
      if (loginLogo) loginLogo.classList.add('login-logo--mark');
    } else {
      loginTitle.hidden = false;
      loginTitle.classList.remove('visually-hidden');
      if (loginLogo) loginLogo.classList.remove('login-logo--mark');
    }
  }
}

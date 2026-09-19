/**
 * shared/brand.js — Vertical brand identity (W-03)
 *
 * Pure brand table + DOM apply for title / favicon / chrome wordmark.
 * Login and other surfaces read getBrand() when they need copy.
 *
 * Product chrome uses the same extrabold text wordmark as Apex (`13lok`).
 * Favicon stays the 13 mark. Tenant logo_data_url still overrides chrome.
 */

const ASSET_BASE = 'assets/brand/';

/** Platform lockup shown in header / login / wizard / guardian (matches Apex BRAND). */
export const PLATFORM_WORDMARK = '13lok';

/** @deprecated Mono PNGs retired; kept for any leftover path checks. */
export const MONO_LOGO_DARK = ASSET_BASE + 'blok-mono-white.png';
/** @deprecated Mono PNGs retired; kept for any leftover path checks. */
export const MONO_LOGO_LIGHT = ASSET_BASE + 'blok-mono-ink.png';

/** @typedef {'hr'|'school'} BrandVertical */

/**
 * @typedef {{
 *   name: string,
 *   wordmark: string,
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
    wordmark: PLATFORM_WORDMARK,
    wordmarkPath: ASSET_BASE + 'blokhr-wordmark.svg',
    headerLogoPath: '',
    loginLogoPath: '',
    headerLogoDarkPath: '',
    headerLogoLightPath: '',
    faviconPath: ASSET_BASE + 'favicon-13.svg',
    tagline: 'Your Modular HRMS',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokhr',
    loginLogoIncludesName: true,
  },
  school: {
    name: 'BlokSchool',
    wordmark: PLATFORM_WORDMARK,
    wordmarkPath: ASSET_BASE + 'blokschool-wordmark.svg',
    headerLogoPath: '',
    loginLogoPath: '',
    headerLogoDarkPath: '',
    headerLogoLightPath: '',
    faviconPath: ASSET_BASE + 'favicon-13.svg',
    tagline: 'Attendance, timetable & learning ops',
    loginHeading: 'Sign in to continue',
    colourPresetKey: 'blokschool',
    loginLogoIncludesName: true,
  },
};

/** Chrome slots: hide img/letter, show text wordmark (unless tenant override). */
const WORDMARK_SLOTS = [
  {
    img: 'hdrLogoImg',
    letter: 'hdrLogoLetter',
    text: 'hdrBrandWordmark',
    wrap: 'hdrLogo',
    wrapClass: 'hdr-logo--wordmark',
  },
  {
    img: 'loginLogoImg',
    letter: 'loginLogoLetter',
    text: 'loginBrandWordmark',
    wrap: 'loginLogo',
    wrapClass: 'login-logo--mark login-logo--wordmark',
  },
  {
    img: 'wzLogoImg',
    letter: 'wzLogoLetter',
    text: 'wzBrandWordmark',
    wrap: 'wzLogo',
    wrapClass: 'wz-logo--mark wz-logo--wordmark',
  },
  {
    img: 'hdrWordmark',
    letter: null,
    text: 'gpBrandWordmark',
    wrap: null,
    wrapClass: null,
  },
];

/** @type {BrandVertical} */
let _currentVertical = 'hr';

/** When true, tenant logo_data_url owns header/login imgs — skip wordmark sync. */
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
 * Neural/Holodeck use white login cards + headers; Clean/Chromium are dark.
 * @param {string|null|undefined} themeOrWz — theme name, or 'light' | 'dark' for wizard
 * @returns {boolean}
 */
export function isLightBrandSurface(themeOrWz) {
  const t = String(themeOrWz || '').toLowerCase();
  return t === 'neural' || t === 'holodeck' || t === 'light';
}

/**
 * @deprecated Mono paths retired; returns empty string. Prefer PLATFORM_WORDMARK.
 * @param {string|null|undefined} _themeOrWz
 * @param {string|null|undefined} [_vertical]
 * @returns {string}
 */
export function resolveBrandLogoPath(_themeOrWz, _vertical) {
  return '';
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
 * Show platform text wordmark; hide mono imgs / lettermarks.
 * No-ops when a tenant logo override is active.
 *
 * @param {string|null|undefined} [_themeOrWz]
 * @param {string|null|undefined} [vertical]
 */
export function syncBrandLogos(_themeOrWz, vertical) {
  if (_tenantLogoOverride) return;
  const brand = getBrand(vertical != null ? vertical : _currentVertical);
  const mark = brand.wordmark || PLATFORM_WORDMARK;

  for (let i = 0; i < WORDMARK_SLOTS.length; i++) {
    const slot = WORDMARK_SLOTS[i];
    const img = document.getElementById(slot.img);
    if (img) {
      img.removeAttribute('src');
      img.style.display = 'none';
      img.setAttribute('alt', '');
      img.setAttribute('hidden', '');
    }
    if (slot.letter) {
      const letter = document.getElementById(slot.letter);
      if (letter) {
        letter.style.display = 'none';
        letter.setAttribute('hidden', '');
      }
    }
    const textEl = document.getElementById(slot.text);
    if (textEl) {
      textEl.textContent = mark;
      textEl.removeAttribute('hidden');
      textEl.style.display = '';
      textEl.setAttribute('aria-label', mark);
    }
    if (slot.wrap && slot.wrapClass) {
      const wrap = document.getElementById(slot.wrap);
      if (wrap) {
        slot.wrapClass.split(/\s+/).forEach((c) => {
          if (c) wrap.classList.add(c);
        });
      }
    }
  }
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
    theme = bodyTheme ? bodyTheme[1] : 'dark';
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
  if (loginFooter) loginFooter.textContent = 'Powered by ' + brand.wordmark;
  if (loginSub) loginSub.textContent = brand.loginHeading;
  if (hdrTitle) hdrTitle.textContent = brand.name;
  if (loginTitle) {
    loginTitle.textContent = brand.name;
    if (brand.loginLogoIncludesName) {
      loginTitle.hidden = true;
      loginTitle.classList.add('visually-hidden');
      if (loginLogo) {
        loginLogo.classList.add('login-logo--mark');
        loginLogo.classList.add('login-logo--wordmark');
      }
    } else {
      loginTitle.hidden = false;
      loginTitle.classList.remove('visually-hidden');
      if (loginLogo) loginLogo.classList.remove('login-logo--mark');
    }
  }
}

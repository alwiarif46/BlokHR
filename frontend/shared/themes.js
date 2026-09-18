/**
 * shared/themes.js — Theme Application
 *
 * Two product themes only: light | dark.
 * Legacy ids (chromium, neural, holodeck, clean) normalize via LEGACY_THEME_MAP.
 *
 * Colour-scheme presets (including BlokSchool / csp-blokschool from migration 045)
 * are loaded from the server — not hardcoded here.
 */

import { syncBrandLogos, setTenantLogoOverride } from './brand.js';

const VALID_THEMES = ['light', 'dark'];
const THEME_NAMES = {
  light: 'Light',
  dark: 'Dark',
};

/** Prefer dark for old Chromium/Clean; light for Neural/Holodeck. */
const LEGACY_THEME_MAP = {
  chromium: 'dark',
  clean: 'dark',
  neural: 'light',
  holodeck: 'light',
};

let _currentTheme = 'dark';

/**
 * Map any stored / UI theme id to light | dark.
 * @param {string|null|undefined} name
 * @returns {'light'|'dark'}
 */
export function normalizeTheme(name) {
  const raw = String(name || '').toLowerCase();
  if (VALID_THEMES.indexOf(raw) >= 0) return /** @type {'light'|'dark'} */ (raw);
  if (LEGACY_THEME_MAP[raw]) return /** @type {'light'|'dark'} */ (LEGACY_THEME_MAP[raw]);
  return 'dark';
}

/**
 * @returns {string}
 */
export function getTheme() {
  return _currentTheme;
}

/**
 * Apply a theme by switching body class.
 * Preserves non-theme body classes (e.g. guardian-body, on-login-screen).
 *
 * @param {string} name — light | dark (legacy ids accepted)
 */
export function setTheme(name) {
  const t = normalizeTheme(name);
  _currentTheme = t;
  const keep = Array.from(document.body.classList).filter(function (c) {
    return c && !/^theme-/.test(c);
  });
  document.body.className = ['theme-' + t].concat(keep).join(' ');
  syncThemeDots();
  syncBrandLogos(t);
}

/**
 * @param {{ color_accent?: string, color_status_in?: string,
 *           color_status_break?: string, color_status_absent?: string,
 *           color_bg0?: string, color_tx?: string }} prefs
 */
export function applyColourOverrides(prefs) {
  if (!prefs) return;
  const root = document.documentElement;
  const map = {
    color_accent: '--accent',
    color_status_in: '--status-in',
    color_status_break: '--status-break',
    color_status_absent: '--status-absent',
    color_bg0: '--bg0',
    color_tx: '--tx',
  };
  Object.keys(map).forEach(function (key) {
    const val = prefs[key];
    if (val && typeof val === 'string' && val.match(/^#[0-9A-Fa-f]{3,8}$/)) {
      root.style.setProperty(map[key], val);
      if (key === 'color_accent') {
        root.style.setProperty('--accent-dim', val + '10');
        root.style.setProperty('--accent-glow', val + '40');
      }
    }
  });
}

export function clearColourOverrides() {
  const root = document.documentElement;
  [
    '--accent',
    '--accent-dim',
    '--accent-glow',
    '--status-in',
    '--status-break',
    '--status-absent',
    '--bg0',
    '--tx',
  ].forEach(function (prop) {
    root.style.removeProperty(prop);
  });
}

/**
 * @param {{ bg_image_url?: string, bg_opacity?: number,
 *           bg_blur?: number, bg_darken?: number }} prefs
 */
export function applyBackgroundImage(prefs) {
  if (!prefs) return;
  const root = document.documentElement;
  const bgLayer = document.getElementById('bgLayer');
  const bgDim = document.getElementById('bgDim');

  if (prefs.bg_image_url) {
    if (bgLayer) {
      bgLayer.style.backgroundImage = 'url(' + prefs.bg_image_url + ')';
      bgLayer.classList.add('has-image');
    }
    if (bgDim) bgDim.classList.add('active');
  } else {
    if (bgLayer) {
      bgLayer.style.backgroundImage = '';
      bgLayer.classList.remove('has-image');
    }
    if (bgDim) bgDim.classList.remove('active');
  }

  if (typeof prefs.bg_opacity === 'number') {
    root.style.setProperty('--bg-opacity', String(prefs.bg_opacity / 100));
  }
  if (typeof prefs.bg_blur === 'number') {
    root.style.setProperty('--bg-blur', prefs.bg_blur + 'px');
  }
  if (typeof prefs.bg_darken === 'number') {
    root.style.setProperty('--bg-dim', String(prefs.bg_darken / 100));
  }
}

/**
 * @param {{ platform_name?: string, logo_data_url?: string,
 *           login_tagline?: string }} branding
 */
export function applyBranding(branding) {
  if (!branding) return;

  const name = branding.platform_name || 'BlokHR';
  document.title = name;

  const bootLogo = document.getElementById('bootLogo');
  if (bootLogo) bootLogo.textContent = name[0] || 'B';

  const loginLogoLetter = document.getElementById('loginLogoLetter');
  if (loginLogoLetter) loginLogoLetter.textContent = name[0] || 'B';

  const loginTitle = document.getElementById('loginTitle');
  if (loginTitle) loginTitle.textContent = name;

  const loginTagline = document.getElementById('loginTagline');
  if (loginTagline && branding.login_tagline) {
    loginTagline.textContent = branding.login_tagline;
  }

  const loginFooter = document.getElementById('loginFooter');
  if (loginFooter) loginFooter.textContent = 'Powered by ' + name;

  const hdrTitle = document.getElementById('hdrTitle');
  if (hdrTitle) hdrTitle.textContent = name;

  const hdrLogoLetter = document.getElementById('hdrLogoLetter');
  if (hdrLogoLetter) hdrLogoLetter.textContent = name[0] || 'B';

  if (branding.logo_data_url) {
    setTenantLogoOverride(true);
    const img = document.getElementById('loginLogoImg');
    if (img) {
      img.src = branding.logo_data_url;
      img.style.display = 'block';
      if (img.previousElementSibling) {
        img.previousElementSibling.style.display = 'none';
      }
    }
    const hdrImg = document.getElementById('hdrLogoImg');
    if (hdrImg) {
      hdrImg.src = branding.logo_data_url;
      hdrImg.style.display = 'block';
    }
    const hdrWordmark = document.getElementById('hdrWordmark');
    if (hdrWordmark) {
      hdrWordmark.src = branding.logo_data_url;
      hdrWordmark.style.display = 'block';
    }
  } else {
    setTenantLogoOverride(false);
    syncBrandLogos(_currentTheme);
  }
}

export function syncThemeDots() {
  document.querySelectorAll('.ht-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.theme === _currentTheme);
  });
  document.querySelectorAll('.lt-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.theme === _currentTheme);
  });
  const hdrSub = document.getElementById('hdrSub');
  if (hdrSub) {
    hdrSub.textContent = THEME_NAMES[_currentTheme] || 'Attendance Board';
  }
}

/**
 * @returns {string[]}
 */
export function getValidThemes() {
  return VALID_THEMES.slice();
}

/**
 * @param {string} name
 * @returns {string}
 */
export function getThemeLabel(name) {
  const n = normalizeTheme(name);
  return THEME_NAMES[n] || name;
}

/**
 * shared/themes.js — Theme Application
 *
 * Responsibilities:
 *  - setTheme(name)          — applies theme class to body
 *  - applyColourOverrides()  — per-user colour overrides via CSS custom properties
 *  - applyBranding()         — tenant branding (logo, name, tagline)
 *  - syncThemeDots()         — updates header theme indicator dots
 *
 * Four themes: chromium, neural, holodeck, clean
 * All CSS custom properties are defined in shared.css; this module switches
 * between them by changing document.body.className.
 */

const VALID_THEMES = ['chromium', 'neural', 'holodeck', 'clean'];
const THEME_NAMES = {
  chromium: 'Chromium Forge',
  neural: 'Neural Circuit',
  holodeck: 'Holodeck HUD',
  clean: 'Clean Mode',
};

let _currentTheme = 'chromium';

/**
 * Get the currently active theme name.
 * @returns {string}
 */
export function getTheme() {
  return _currentTheme;
}

/**
 * Apply a theme by switching body class.
 * Does NOT persist — call prefs.savePrefs({ theme }) for that.
 *
 * @param {string} name — one of: chromium, neural, holodeck, clean
 */
export function setTheme(name) {
  const t = VALID_THEMES.indexOf(name) >= 0 ? name : 'chromium';
  _currentTheme = t;
  document.body.className = 'theme-' + t;
  syncThemeDots();
}

/**
 * Apply per-user colour overrides from member_preferences.
 * Each colour is set as a CSS custom property on :root.
 *
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

/**
 * Clear all per-user colour overrides (reset to theme defaults).
 */
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
 * Apply background image settings from member preferences.
 *
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
 * Apply tenant-level branding (logo, platform name, tagline).
 *
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
  }
}

/**
 * Sync header theme indicator dots to the current theme.
 */
export function syncThemeDots() {
  document.querySelectorAll('.ht-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.theme === _currentTheme);
  });
  document.querySelectorAll('.lt-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === _currentTheme);
  });
  const hdrSub = document.getElementById('hdrSub');
  if (hdrSub) {
    hdrSub.textContent = THEME_NAMES[_currentTheme] || 'Attendance Board';
  }
}

/**
 * @returns {string[]} List of valid theme names
 */
export function getValidThemes() {
  return VALID_THEMES.slice();
}

/**
 * @param {string} name
 * @returns {string} Human-readable theme label
 */
export function getThemeLabel(name) {
  return THEME_NAMES[name] || name;
}

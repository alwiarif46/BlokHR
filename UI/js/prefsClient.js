/**
 * prefsClient.js — All user preference reads/writes go through this module.
 * Preferences are stored in the database via PUT /api/profiles/me/prefs.
 * NEVER writes to localStorage.
 */

import { httpClient } from './httpClient.js';
import { setTheme, setDarkMode } from './themeManager.js';

let _prefs = {};

export async function loadPrefs() {
  const res = await httpClient.get('/api/profiles/me/prefs');
  _prefs = res.prefs ?? {};
  applyPrefsToDOM(_prefs);
  return _prefs;
}

export async function savePref(key, value) {
  await httpClient.put('/api/profiles/me/prefs', { [key]: value });
  _prefs[key] = value;
  applyPrefsToDOM(_prefs);
}

export function getPrefs() {
  return { ..._prefs };
}

export function applyPrefsToDOM(prefs) {
  if (prefs.theme) setTheme(prefs.theme);
  if (prefs.dark_mode) setDarkMode(prefs.dark_mode);

  const colorMap = {
    color_accent: '--accent',
    color_status_in: '--status-in',
    color_status_break: '--status-break',
    color_status_absent: '--status-absent',
    color_bg0: '--bg0',
    color_bg1: '--bg1',
    color_bg2: '--bg2',
    color_bg3: '--bg3',
    color_bg4: '--bg4',
    color_tx: '--tx',
    color_tx2: '--tx2',
    color_bd: '--bd',
  };

  Object.entries(colorMap).forEach(([prefKey, cssVar]) => {
    if (prefs[prefKey]) {
      document.documentElement.style.setProperty(cssVar, prefs[prefKey]);
    }
  });

  if (prefs.bg_image_url) {
    document.documentElement.style.setProperty(
      '--bg-image',
      `url(${prefs.bg_image_url})`
    );
  }
  if (prefs.bg_opacity != null) {
    document.documentElement.style.setProperty(
      '--bg-opacity',
      String(prefs.bg_opacity / 100)
    );
  }
  if (prefs.bg_blur != null) {
    document.documentElement.style.setProperty(
      '--bg-blur',
      `${prefs.bg_blur}px`
    );
  }
  if (prefs.bg_darken != null) {
    document.documentElement.style.setProperty(
      '--bg-darken',
      String(prefs.bg_darken / 100)
    );
  }
}

/**
 * shared/prefs.js — Member Preferences
 *
 * All user preferences are database-backed.
 * ZERO localStorage reads or writes in this file.
 *
 * API:
 *   GET  /api/profiles/me/prefs  — load prefs
 *   PUT  /api/profiles/me/prefs  — save partial prefs (merge)
 *
 * Responsibilities:
 *  - loadPrefs()           — fetch from server, cache in memory
 *  - savePrefs(partial)    — PUT partial update, merge with cache, apply to DOM
 *  - applyPrefsToDOM(prefs)— apply all visual preferences
 *  - getPrefs()            — return in-memory cache
 */

import { api } from './api.js';
import { setTheme, applyColourOverrides, applyBackgroundImage } from './themes.js';

let _prefs = null;

/**
 * Load preferences from the server.
 * Caches in memory and applies to DOM.
 *
 * @returns {Promise<object|null>}
 */
export async function loadPrefs() {
  const data = await api.get('/api/profiles/me/prefs');
  if (!data || data._error) {
    _prefs = getDefaults();
    applyPrefsToDOM(_prefs);
    return _prefs;
  }
  _prefs = data.prefs || data;
  applyPrefsToDOM(_prefs);
  return _prefs;
}

/**
 * Save a partial preference update to the server.
 * Merges with the in-memory cache and re-applies to DOM.
 *
 * @param {object} partial — any subset of member_preferences columns
 * @returns {Promise<boolean>} true if save succeeded
 */
export async function savePrefs(partial) {
  const result = await api.put('/api/profiles/me/prefs', partial);
  if (result && result._error) return false;

  _prefs = Object.assign({}, _prefs || getDefaults(), partial);
  applyPrefsToDOM(_prefs);
  return true;
}

/**
 * Get in-memory cached preferences (without hitting server).
 * @returns {object|null}
 */
export function getPrefs() {
  return _prefs;
}

/**
 * Apply all visual preferences to the DOM.
 *
 * @param {object} prefs — full prefs object from server
 */
export function applyPrefsToDOM(prefs) {
  if (!prefs) return;

  /* 1. Theme */
  setTheme(prefs.theme || 'chromium');

  /* 2. Colour overrides */
  applyColourOverrides(prefs);

  /* 3. Background image */
  applyBackgroundImage(prefs);

  /* 4. Timezone — set active timezone for header clock */
  if (prefs.timezone_slot_1) {
    document.dispatchEvent(
      new CustomEvent('blokhr:prefs:timezone', {
        detail: { timezone: prefs.timezone_slot_1 },
      })
    );
  }
}

/**
 * Return sensible defaults when server is unreachable.
 * @returns {object}
 */
function getDefaults() {
  return {
    theme: 'chromium',
    dark_mode: 'system',
    color_accent: null,
    color_status_in: null,
    color_status_break: null,
    color_status_absent: null,
    color_bg0: null,
    color_tx: null,
    bg_image_url: null,
    bg_opacity: 30,
    bg_blur: 0,
    bg_darken: 70,
    timezone_slot_1: 'Asia/Kolkata',
    timezone_slot_2: null,
    timezone_slot_3: null,
    timezone_slot_4: null,
    notification_prefs: null,
  };
}

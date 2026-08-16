/**
 * modules/my_prefs/my_prefs.js
 * Per-user preferences: theme, colour overrides, background, timezones.
 * Persists via shared/prefs.js → GET/PUT /api/profiles/me/prefs (no localStorage).
 */

import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';
import { loadPrefs, savePrefs, getPrefs } from '../../shared/prefs.js';
import { setTheme, getValidThemes, getThemeLabel } from '../../shared/themes.js';

let _container = null;

const COLOR_FIELDS = [
  { key: 'color_accent', label: 'Accent' },
  { key: 'color_status_in', label: 'Status In' },
  { key: 'color_status_break', label: 'Status Break' },
  { key: 'color_status_absent', label: 'Status Absent' },
  { key: 'color_bg0', label: 'Background' },
  { key: 'color_tx', label: 'Text' },
];

const TZ_FIELDS = [
  { key: 'timezone_slot_1', label: 'Primary timezone' },
  { key: 'timezone_slot_2', label: 'Timezone 2' },
  { key: 'timezone_slot_3', label: 'Timezone 3' },
  { key: 'timezone_slot_4', label: 'Timezone 4' },
];

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _hexOrEmpty(v) {
  if (!v || typeof v !== 'string') return '';
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : '';
}

export function renderMyPrefsPage(container) {
  _container = container;
  const themes = getValidThemes();
  container.innerHTML =
    '<div class="mp-wrap">' +
      '<div class="mp-toolbar">' +
        '<div class="mp-title"><span>&#127912;</span> My Preferences</div>' +
        '<div class="mp-spacer"></div>' +
        '<button type="button" class="mp-btn ghost" id="mpReload">Reload</button>' +
      '</div>' +
      '<div class="mp-hint">Theme, colours, background, and clocks for your account. Saved to the server.</div>' +
      '<section class="mp-section">' +
        '<div class="mp-section-title">Theme</div>' +
        '<div class="mp-theme-grid" id="mpThemes">' +
          themes
            .map(function (t) {
              return (
                '<button type="button" class="mp-theme-btn" data-theme="' +
                _esc(t) +
                '">' +
                _esc(getThemeLabel(t)) +
                '</button>'
              );
            })
            .join('') +
        '</div>' +
      '</section>' +
      '<section class="mp-section">' +
        '<div class="mp-section-title">Colour overrides</div>' +
        '<div class="mp-color-grid" id="mpColors">' +
          COLOR_FIELDS.map(function (f) {
            return (
              '<div class="mp-field">' +
                '<label>' +
                _esc(f.label) +
                '</label>' +
                '<div class="mp-color-row">' +
                  '<input type="color" id="mp_' +
                  f.key +
                  '_picker" data-key="' +
                  f.key +
                  '" value="#00e59a">' +
                  '<input type="text" class="mp-input" id="mp_' +
                  f.key +
                  '" data-key="' +
                  f.key +
                  '" placeholder="#RRGGBB" maxlength="7">' +
                  '<button type="button" class="mp-btn ghost mp-clear-color" data-key="' +
                  f.key +
                  '">Clear</button>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
        '<div class="mp-actions">' +
          '<button type="button" class="mp-btn" id="mpSaveColors">Save colours</button>' +
        '</div>' +
      '</section>' +
      '<section class="mp-section">' +
        '<div class="mp-section-title">Background</div>' +
        '<div class="mp-field">' +
          '<label>Image URL</label>' +
          '<input type="text" class="mp-input" id="mp_bg_image_url" placeholder="https://… or leave empty">' +
        '</div>' +
        '<div class="mp-sliders">' +
          '<div class="mp-field">' +
            '<label>Opacity <span id="mp_bg_opacity_v">30</span></label>' +
            '<input type="range" id="mp_bg_opacity" min="0" max="100" value="30">' +
          '</div>' +
          '<div class="mp-field">' +
            '<label>Blur <span id="mp_bg_blur_v">0</span>px</label>' +
            '<input type="range" id="mp_bg_blur" min="0" max="30" value="0">' +
          '</div>' +
          '<div class="mp-field">' +
            '<label>Darken <span id="mp_bg_darken_v">70</span></label>' +
            '<input type="range" id="mp_bg_darken" min="0" max="95" value="70">' +
          '</div>' +
        '</div>' +
        '<div class="mp-actions">' +
          '<button type="button" class="mp-btn ghost" id="mpClearBg">Clear image</button>' +
          '<button type="button" class="mp-btn" id="mpSaveBg">Save background</button>' +
        '</div>' +
      '</section>' +
      '<section class="mp-section">' +
        '<div class="mp-section-title">Timezones</div>' +
        TZ_FIELDS.map(function (f) {
          return (
            '<div class="mp-field">' +
              '<label>' +
              _esc(f.label) +
              '</label>' +
              '<input type="text" class="mp-input" id="mp_' +
              f.key +
              '" placeholder="e.g. Asia/Kolkata">' +
            '</div>'
          );
        }).join('') +
        '<div class="mp-actions">' +
          '<button type="button" class="mp-btn" id="mpSaveTz">Save timezones</button>' +
        '</div>' +
      '</section>' +
    '</div>';

  _bindEvents(container);
  mpLoad();
}

function _syncThemeButtons(active) {
  if (!_container) return;
  _container.querySelectorAll('.mp-theme-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === active);
  });
}

function _fillForm(prefs) {
  if (!_container || !prefs) return;
  _syncThemeButtons(prefs.theme || 'chromium');

  COLOR_FIELDS.forEach(function (f) {
    const hex = _hexOrEmpty(prefs[f.key]);
    const text = _container.querySelector('#mp_' + f.key);
    const picker = _container.querySelector('#mp_' + f.key + '_picker');
    if (text) text.value = hex;
    if (picker) picker.value = hex || '#00e59a';
  });

  const url = _container.querySelector('#mp_bg_image_url');
  if (url) url.value = prefs.bg_image_url || '';

  const op = _container.querySelector('#mp_bg_opacity');
  const opV = _container.querySelector('#mp_bg_opacity_v');
  const blur = _container.querySelector('#mp_bg_blur');
  const blurV = _container.querySelector('#mp_bg_blur_v');
  const dark = _container.querySelector('#mp_bg_darken');
  const darkV = _container.querySelector('#mp_bg_darken_v');
  if (op) {
    op.value = String(typeof prefs.bg_opacity === 'number' ? prefs.bg_opacity : 30);
    if (opV) opV.textContent = op.value;
  }
  if (blur) {
    blur.value = String(typeof prefs.bg_blur === 'number' ? prefs.bg_blur : 0);
    if (blurV) blurV.textContent = blur.value;
  }
  if (dark) {
    dark.value = String(typeof prefs.bg_darken === 'number' ? prefs.bg_darken : 70);
    if (darkV) darkV.textContent = dark.value;
  }

  TZ_FIELDS.forEach(function (f) {
    const el = _container.querySelector('#mp_' + f.key);
    if (!el) return;
    if (f.key === 'timezone_slot_1') {
      el.value = prefs.timezone_slot_1 || 'Asia/Kolkata';
    } else {
      el.value = prefs[f.key] || '';
    }
  });
}

export async function mpLoad() {
  const prefs = await loadPrefs();
  _fillForm(prefs || getPrefs());
}

async function _save(partial, okMsg) {
  const ok = await savePrefs(partial);
  if (ok) {
    toast(okMsg || 'Saved', 'success');
    _fillForm(getPrefs());
    return true;
  }
  toast('Failed to save preferences', 'error');
  return false;
}

function _bindEvents(container) {
  const reload = container.querySelector('#mpReload');
  if (reload) reload.addEventListener('click', mpLoad);

  container.querySelectorAll('.mp-theme-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const theme = btn.getAttribute('data-theme');
      if (!theme) return;
      setTheme(theme);
      _syncThemeButtons(theme);
      await _save({ theme: theme }, 'Theme saved');
    });
  });

  COLOR_FIELDS.forEach(function (f) {
    const text = container.querySelector('#mp_' + f.key);
    const picker = container.querySelector('#mp_' + f.key + '_picker');
    if (picker && text) {
      picker.addEventListener('input', function () {
        text.value = picker.value;
      });
      text.addEventListener('change', function () {
        const hex = _hexOrEmpty(text.value.trim());
        if (hex) picker.value = hex;
      });
    }
  });

  container.querySelectorAll('.mp-clear-color').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const key = btn.getAttribute('data-key');
      const text = container.querySelector('#mp_' + key);
      if (text) text.value = '';
    });
  });

  const saveColors = container.querySelector('#mpSaveColors');
  if (saveColors) {
    saveColors.addEventListener('click', async function () {
      const partial = {};
      let bad = false;
      COLOR_FIELDS.forEach(function (f) {
        const el = container.querySelector('#mp_' + f.key);
        const raw = el ? el.value.trim() : '';
        if (!raw) {
          partial[f.key] = null;
        } else if (_hexOrEmpty(raw)) {
          partial[f.key] = raw;
        } else {
          toast(f.label + ' must be #RRGGBB', 'error');
          bad = true;
        }
      });
      if (bad) return;
      await _save(partial, 'Colours saved');
    });
  }

  function _wireRange(id, labelId) {
    const el = container.querySelector('#' + id);
    const lab = container.querySelector('#' + labelId);
    if (!el) return;
    el.addEventListener('input', function () {
      if (lab) lab.textContent = el.value;
    });
  }
  _wireRange('mp_bg_opacity', 'mp_bg_opacity_v');
  _wireRange('mp_bg_blur', 'mp_bg_blur_v');
  _wireRange('mp_bg_darken', 'mp_bg_darken_v');

  const clearBg = container.querySelector('#mpClearBg');
  if (clearBg) {
    clearBg.addEventListener('click', async function () {
      const url = container.querySelector('#mp_bg_image_url');
      if (url) url.value = '';
      await _save({ bg_image_url: null }, 'Background cleared');
    });
  }

  const saveBg = container.querySelector('#mpSaveBg');
  if (saveBg) {
    saveBg.addEventListener('click', async function () {
      const urlEl = container.querySelector('#mp_bg_image_url');
      const op = container.querySelector('#mp_bg_opacity');
      const blur = container.querySelector('#mp_bg_blur');
      const dark = container.querySelector('#mp_bg_darken');
      const url = urlEl ? urlEl.value.trim() : '';
      await _save(
        {
          bg_image_url: url || null,
          bg_opacity: op ? parseInt(op.value, 10) : 30,
          bg_blur: blur ? parseInt(blur.value, 10) : 0,
          bg_darken: dark ? parseInt(dark.value, 10) : 70,
        },
        'Background saved',
      );
    });
  }

  const saveTz = container.querySelector('#mpSaveTz');
  if (saveTz) {
    saveTz.addEventListener('click', async function () {
      const partial = {};
      TZ_FIELDS.forEach(function (f) {
        const el = container.querySelector('#mp_' + f.key);
        const raw = el ? el.value.trim() : '';
        if (f.key === 'timezone_slot_1') {
          partial[f.key] = raw || 'Asia/Kolkata';
        } else {
          partial[f.key] = raw || null;
        }
      });
      await _save(partial, 'Timezones saved');
    });
  }
}

registerModule('my_prefs', renderMyPrefsPage);

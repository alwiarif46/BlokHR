/**
 * sections/lottie.js
 * Lottie Animations — upload/preview/test/remove per clock action.
 * API: GET /api/settings/lottie, PUT /api/settings/lottie/:action, DELETE /api/settings/lottie/:action
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _actions = [];
let _container = null;

const ACTION_LABELS = {
  'clock-in': 'Clock In',
  'clock-out': 'Clock Out',
  break: 'Break',
  back: 'Back from Break',
};

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="lt-loading">Loading Lottie animations\u2026</div>';

  const data = await api.get('/api/settings/lottie');
  if (!data || data._error) {
    container.innerHTML = '<div class="lt-error">Failed to load Lottie settings</div>';
    return;
  }

  _actions = data.actions || data || [];
  _renderUI();
}

export function destroy() {
  _container = null;
  _actions = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="lt-wrap">';

  (Array.isArray(_actions)
    ? _actions
    : Object.keys(ACTION_LABELS).map(function (k) {
        return { action: k, enabled: false, file_size: 0 };
      })
  ).forEach(function (a) {
    const label = ACTION_LABELS[a.action] || a.action;
    const hasFile = !!a.file_size;

    html += '<div class="lt-card" data-action="' + _esc(a.action) + '">';
    html += '<div class="lt-card-hdr">';
    html += '<span class="lt-action-name">' + _esc(label) + '</span>';
    if (hasFile) {
      html += '<span class="lt-badge-loaded">' + _fmtSize(a.file_size) + '</span>';
    } else {
      html += '<span class="lt-badge-none">No file</span>';
    }
    html += '</div>';

    html += '<div class="lt-field-row">';
    html += '<label>Duration (seconds)</label>';
    html +=
      '<input type="number" class="lt-input lt-duration" min="0.5" max="10" step="0.5" value="' +
      (a.duration_seconds || 2) +
      '">';
    html += '</div>';

    html += '<div class="lt-upload-zone">';
    html += '<div class="lt-upload-text">Drop Lottie JSON here or click to upload (max 2 MB)</div>';
    html +=
      '<input type="file" class="lt-file-input" accept=".json,application/json" data-action="' +
      _esc(a.action) +
      '">';
    html += '</div>';

    html += '<div class="lt-actions-row">';
    html +=
      '<button class="lt-btn lt-upload-btn" data-action="' + _esc(a.action) + '">Upload</button>';
    if (hasFile) {
      html +=
        '<button class="lt-btn lt-test-btn" data-action="' + _esc(a.action) + '">Test</button>';
      html +=
        '<button class="lt-btn danger lt-remove-btn" data-action="' +
        _esc(a.action) +
        '">Remove</button>';
    }
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  _container.innerHTML = html;
  _bindEvents();
}

function _bindEvents() {
  if (!_container) {
    return;
  }

  /* Upload */
  _container.querySelectorAll('.lt-upload-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const action = /** @type {HTMLElement} */ (btn).dataset.action;
      const card = _container.querySelector('[data-action="' + action + '"]');
      if (!card) {
        return;
      }

      const fileInput = /** @type {HTMLInputElement} */ (card.querySelector('.lt-file-input'));
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        toast('Select a JSON file first', 'error');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast('File exceeds 2 MB', 'error');
        return;
      }

      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (_e) {
        toast('Invalid JSON file', 'error');
        return;
      }

      const duration =
        parseFloat(/** @type {HTMLInputElement} */ (card.querySelector('.lt-duration')).value) || 2;

      const res = await api.put('/api/settings/lottie/' + action, {
        file_data: JSON.stringify(parsed),
        duration_seconds: duration,
        enabled: true,
      });

      if (res && !res._error) {
        toast(ACTION_LABELS[action] + ' animation uploaded', 'success');
        const a = _actions.find(function (x) {
          return x.action === action;
        });
        if (a) {
          a.file_size = file.size;
          a.duration_seconds = duration;
          a.enabled = true;
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Upload failed', 'error');
      }
    });
  });

  /* Test */
  _container.querySelectorAll('.lt-test-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const action = /** @type {HTMLElement} */ (btn).dataset.action;
      if (window.BlokHR && window.BlokHR.triggerLottie) {
        window.BlokHR.triggerLottie(action, window.BlokHR.settingsCache);
        toast('Playing ' + (ACTION_LABELS[action] || action) + ' animation', 'info');
      } else {
        toast('Lottie player not available in this context', 'info');
      }
    });
  });

  /* Remove */
  _container.querySelectorAll('.lt-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const action = /** @type {HTMLElement} */ (btn).dataset.action;
      if (!confirm('Remove this animation?')) {
        return;
      }
      const res = await api.delete('/api/settings/lottie/' + action);
      if (res && !res._error) {
        toast(ACTION_LABELS[action] + ' animation removed', 'success');
        const a = _actions.find(function (x) {
          return x.action === action;
        });
        if (a) {
          a.file_size = 0;
          a.enabled = false;
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Remove failed', 'error');
      }
    });
  });
}

function _fmtSize(bytes) {
  if (!bytes) {
    return '';
  }
  return (bytes / 1024).toFixed(1) + ' KB';
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

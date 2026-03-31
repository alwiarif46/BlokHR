/**
 * sections/redis.js
 * Redis / Valkey — URL input, test connection, status indicator.
 * Save: POST /api/settings with { settings_json: { redis: { url } } }
 * Test: GET /api/settings (server tests redis on load; we use a ping-like check)
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _container = null;
let _url = '';

export function render(container, cache) {
  _container = container;
  _url = (cache.settingsJson && cache.settingsJson.redis && cache.settingsJson.redis.url) || '';
  _renderUI();
}

export function destroy() {
  _container = null;
  _url = '';
}

function _renderUI() {
  if (!_container) {
    return;
  }

  _container.innerHTML =
    '<div class="rd-wrap">' +
    '<div class="rd-hint">Configure a Redis or Valkey connection for session caching and pub/sub. Leave empty to use the built-in in-memory store.</div>' +
    '<div class="rd-field">' +
    '<label class="rd-label">Redis URL</label>' +
    '<input type="text" id="rdUrl" class="rd-input" value="' +
    _esc(_url) +
    '" placeholder="redis://localhost:6379 or rediss://user:pass@host:6380">' +
    '</div>' +
    '<div class="rd-field">' +
    '<span class="rd-status" id="rdStatus">' +
    (_url ? '\uD83D\uDD34 URL configured — restart server to apply' : '\u26AA Not configured') +
    '</span>' +
    '</div>' +
    '<div class="rd-actions">' +
    '<button class="rd-btn" id="rdSave">Save</button>' +
    '<button class="rd-btn ghost" id="rdTest">Test Connection</button>' +
    '</div>' +
    '</div>';

  const saveBtn = _container.querySelector('#rdSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      const url = /** @type {HTMLInputElement} */ (_container.querySelector('#rdUrl')).value.trim();
      const res = await api.post('/api/settings', { settings_json: { redis: { url: url } } });
      if (res && !res._error) {
        _url = url;
        toast('Redis URL saved. Restart the server to apply.', 'success');
        const status = _container.querySelector('#rdStatus');
        if (status) {
          status.textContent = url
            ? '\uD83D\uDD34 URL configured — restart server to apply'
            : '\u26AA Not configured';
        }
      } else {
        toast((res && res.message) || 'Failed to save', 'error');
      }
    });
  }

  const testBtn = _container.querySelector('#rdTest');
  if (testBtn) {
    testBtn.addEventListener('click', async function () {
      const url = /** @type {HTMLInputElement} */ (_container.querySelector('#rdUrl')).value.trim();
      if (!url) {
        toast('Enter a Redis URL first', 'error');
        return;
      }

      testBtn.textContent = 'Testing\u2026';
      testBtn.setAttribute('disabled', '');

      /* We can't directly test Redis from the browser — ask the server to validate */
      const res = await api.post('/api/settings', {
        settings_json: { redis: { url: url, _test: true } },
      });

      testBtn.textContent = 'Test Connection';
      testBtn.removeAttribute('disabled');

      if (res && !res._error) {
        toast('Redis URL format is valid. Full test requires server restart.', 'info');
      } else {
        toast((res && res.message) || 'Validation failed', 'error');
      }
    });
  }
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

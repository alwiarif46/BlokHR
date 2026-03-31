/**
 * sections/meetings.js
 * Meeting Integrations — 4 platform cards, masked secrets, Test Connection.
 * API: GET/PUT /api/meeting-platforms, POST /api/meeting-platforms/:platform/test
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _platforms = [];
let _container = null;

const PLATFORM_META = {
  zoom: { label: 'Zoom', fields: ['zoom_account_id', 'zoom_client_id', 'zoom_client_secret'] },
  webex: { label: 'Webex', fields: ['webex_bot_token'] },
  goto: { label: 'GoToMeeting', fields: ['goto_client_id', 'goto_client_secret'] },
  bluejeans: { label: 'BlueJeans', fields: ['bluejeans_api_key'] },
};

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="mp-loading">Loading meeting platforms\u2026</div>';

  const data = await api.get('/api/meeting-platforms');
  if (!data || data._error) {
    container.innerHTML = '<div class="mp-error">Failed to load meeting platforms</div>';
    return;
  }

  _platforms = data.platforms || [];
  _renderUI();
}

export function destroy() {
  _container = null;
  _platforms = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="mp-wrap">';

  _platforms.forEach(function (p) {
    const meta = PLATFORM_META[p.platform] || { label: p.platform, fields: [] };
    const enabled = !!p.enabled;

    html += '<div class="mp-card" data-mp="' + _esc(p.platform) + '">';
    html += '<div class="mp-card-hdr">';
    html += '<span class="mp-name">' + _esc(meta.label) + '</span>';
    html +=
      '<label class="mp-toggle"><input type="checkbox" class="mp-enabled" data-mp="' +
      _esc(p.platform) +
      '"' +
      (enabled ? ' checked' : '') +
      '><span>Enabled</span></label>';
    html += '</div>';

    html += '<div class="mp-fields">';
    meta.fields.forEach(function (f) {
      const isSecret = f.includes('secret') || f.includes('token') || f.includes('key');
      const val = p[f] || '';
      html += '<div class="mp-field-row">';
      html += '<label>' + _esc(f.replace(/_/g, ' ')) + '</label>';
      html +=
        '<input type="' +
        (isSecret ? 'password' : 'text') +
        '" class="mp-input" data-mp="' +
        _esc(p.platform) +
        '" data-fid="' +
        f +
        '" value="' +
        _esc(val) +
        '"' +
        (isSecret ? ' placeholder="****"' : '') +
        '>';
      if (isSecret) {
        html += '<button class="mp-show-btn" type="button">Show</button>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="mp-card-actions">';
    html += '<button class="mp-btn mp-save-btn" data-mp="' + _esc(p.platform) + '">Save</button>';
    html +=
      '<button class="mp-btn mp-test-btn" data-mp="' +
      _esc(p.platform) +
      '">Test Connection</button>';
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

  /* Show/hide secret */
  _container.querySelectorAll('.mp-show-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const inp = /** @type {HTMLInputElement} */ (btn.previousElementSibling);
      if (inp) {
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
      }
    });
  });

  /* Save */
  _container.querySelectorAll('.mp-save-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const mp = /** @type {HTMLElement} */ (btn).dataset.mp;
      const card = _container.querySelector('[data-mp="' + mp + '"]');
      if (!card) {
        return;
      }

      const body = {
        enabled: /** @type {HTMLInputElement} */ (card.querySelector('.mp-enabled')).checked,
      };
      card.querySelectorAll('.mp-input').forEach(function (inp) {
        const val = /** @type {HTMLInputElement} */ (inp).value;
        if (val) {
          body[/** @type {HTMLElement} */ (inp).dataset.fid] = val;
        }
      });

      const res = await api.put('/api/meeting-platforms/' + mp, body);
      if (res && !res._error) {
        toast(((PLATFORM_META[mp] && PLATFORM_META[mp].label) || mp) + ' saved', 'success');
        const plat = _platforms.find(function (x) {
          return x.platform === mp;
        });
        if (plat) {
          plat.enabled = body.enabled ? 1 : 0;
        }
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Test */
  _container.querySelectorAll('.mp-test-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const mp = /** @type {HTMLElement} */ (btn).dataset.mp;
      btn.textContent = 'Testing\u2026';
      btn.setAttribute('disabled', '');
      const res = await api.post('/api/meeting-platforms/' + mp + '/test', {});
      btn.textContent = 'Test Connection';
      btn.removeAttribute('disabled');
      if (res && res.success) {
        toast(((PLATFORM_META[mp] && PLATFORM_META[mp].label) || mp) + ': OK', 'success');
      } else {
        toast((res && res.message) || 'Test failed', 'error');
      }
    });
  });
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

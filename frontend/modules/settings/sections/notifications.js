/**
 * sections/notifications.js
 * Notification Channels — 8 channel cards, masked secrets, Test Connection.
 * API: GET/PUT /api/notification-channels, POST /api/notification-channels/:channel/test
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _channels = [];
let _container = null;

const CHANNEL_META = {
  teams: { label: 'Microsoft Teams', fields: ['teams_app_id', 'teams_app_password'] },
  slack: { label: 'Slack', fields: ['slack_bot_token', 'slack_signing_secret'] },
  google_chat: { label: 'Google Chat', fields: ['google_service_account_json'] },
  discord: { label: 'Discord', fields: ['discord_bot_token', 'discord_app_id'] },
  telegram: { label: 'Telegram', fields: ['telegram_bot_token'] },
  whatsapp: { label: 'WhatsApp', fields: ['whatsapp_phone_id', 'whatsapp_token'] },
  clickup: { label: 'ClickUp', fields: ['clickup_api_token'] },
  email: {
    label: 'Email / SMTP',
    fields: [
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_pass',
      'smtp_from',
      'smtp_server_base_url',
    ],
  },
};

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="nc-loading">Loading notification channels\u2026</div>';

  const data = await api.get('/api/notification-channels');
  if (!data || data._error) {
    container.innerHTML = '<div class="nc-error">Failed to load notification channels</div>';
    return;
  }

  _channels = data.channels || [];
  _renderUI();
}

export function destroy() {
  _container = null;
  _channels = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="nc-wrap">';

  _channels.forEach(function (ch) {
    const meta = CHANNEL_META[ch.channel] || { label: ch.channel, fields: [] };
    const enabled = !!ch.enabled;

    html += '<div class="nc-card" data-ch="' + _esc(ch.channel) + '">';
    html += '<div class="nc-card-hdr">';
    html += '<span class="nc-name">' + _esc(meta.label) + '</span>';
    html +=
      '<label class="nc-toggle"><input type="checkbox" class="nc-enabled" data-ch="' +
      _esc(ch.channel) +
      '"' +
      (enabled ? ' checked' : '') +
      '><span class="nc-toggle-lbl">Enabled</span></label>';
    html +=
      '<div class="nc-status" id="nc-status-' +
      _esc(ch.channel) +
      '">' +
      (enabled ? '\u2705' : '\u274C') +
      '</div>';
    html += '</div>';

    html += '<div class="nc-fields">';
    meta.fields.forEach(function (f) {
      const isSecret =
        f.includes('token') ||
        f.includes('pass') ||
        f.includes('secret') ||
        f.includes('json') ||
        f.includes('key');
      const val = ch[f] || '';
      html += '<div class="nc-field-row">';
      html += '<label>' + _esc(f.replace(/_/g, ' ')) + '</label>';
      html +=
        '<input type="' +
        (isSecret ? 'password' : 'text') +
        '" class="nc-input" data-ch="' +
        _esc(ch.channel) +
        '" data-fid="' +
        f +
        '" value="' +
        _esc(val) +
        '"' +
        (isSecret ? ' placeholder="****"' : '') +
        '>';
      if (isSecret) {
        html += '<button class="nc-show-btn" type="button">Show</button>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="nc-card-actions">';
    html += '<button class="nc-btn nc-save-btn" data-ch="' + _esc(ch.channel) + '">Save</button>';
    html +=
      '<button class="nc-btn nc-test-btn" data-ch="' +
      _esc(ch.channel) +
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
  _container.querySelectorAll('.nc-show-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const inp = /** @type {HTMLInputElement} */ (btn.previousElementSibling);
      if (inp) {
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
      }
    });
  });

  /* Save */
  _container.querySelectorAll('.nc-save-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const ch = /** @type {HTMLElement} */ (btn).dataset.ch;
      const card = _container.querySelector('[data-ch="' + ch + '"]');
      if (!card) {
        return;
      }

      const body = {
        enabled: /** @type {HTMLInputElement} */ (card.querySelector('.nc-enabled')).checked,
      };
      card.querySelectorAll('.nc-input').forEach(function (inp) {
        const val = /** @type {HTMLInputElement} */ (inp).value;
        if (val) {
          body[/** @type {HTMLElement} */ (inp).dataset.fid] = val;
        }
      });

      const res = await api.put('/api/notification-channels/' + ch, body);
      if (res && !res._error) {
        toast(((CHANNEL_META[ch] && CHANNEL_META[ch].label) || ch) + ' saved', 'success');
        const c = _channels.find(function (x) {
          return x.channel === ch;
        });
        if (c) {
          c.enabled = body.enabled;
        }
        const statusEl = _container.querySelector('#nc-status-' + ch);
        if (statusEl) {
          statusEl.textContent = body.enabled ? '\u2705' : '\u274C';
        }
      } else {
        toast((res && res.message) || 'Failed to save', 'error');
      }
    });
  });

  /* Test */
  _container.querySelectorAll('.nc-test-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const ch = /** @type {HTMLElement} */ (btn).dataset.ch;
      btn.textContent = 'Testing\u2026';
      btn.setAttribute('disabled', '');
      const res = await api.post('/api/notification-channels/' + ch + '/test', {});
      btn.textContent = 'Test Connection';
      btn.removeAttribute('disabled');
      if (res && res.success) {
        toast(((CHANNEL_META[ch] && CHANNEL_META[ch].label) || ch) + ': Connection OK', 'success');
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

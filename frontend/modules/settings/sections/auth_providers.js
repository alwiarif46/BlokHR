/**
 * sections/auth_providers.js
 * Auth Providers — 9 provider cards with enabled toggle and provider-specific fields.
 * API: POST /api/settings with { settings_json: { auth: { providers: { ... } } } }
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _container = null;
let _providers = {};

const PROVIDER_CONFIG = [
  {
    key: 'msal',
    label: 'Microsoft (MSAL)',
    fields: [
      { id: 'clientId', label: 'Client ID', type: 'text' },
      { id: 'tenantId', label: 'Tenant ID', type: 'text' },
      { id: 'redirectUri', label: 'Redirect URI', type: 'text' },
    ],
  },
  {
    key: 'google',
    label: 'Google',
    fields: [{ id: 'clientId', label: 'Client ID', type: 'text' }],
  },
  {
    key: 'okta',
    label: 'Okta',
    fields: [
      { id: 'domain', label: 'Domain', type: 'text' },
      { id: 'clientId', label: 'Client ID', type: 'text' },
    ],
  },
  {
    key: 'teamsSso',
    label: 'Teams SSO',
    fields: [{ id: 'clientId', label: 'Client ID', type: 'text' }],
  },
  {
    key: 'github',
    label: 'GitHub',
    fields: [{ id: 'clientId', label: 'Client ID', type: 'text' }],
  },
  {
    key: 'saml',
    label: 'SAML',
    fields: [
      { id: 'metadataUrl', label: 'Metadata URL', type: 'text' },
      { id: 'entityId', label: 'Entity ID', type: 'text' },
    ],
  },
  {
    key: 'customJwt',
    label: 'Custom JWT',
    fields: [
      { id: 'jwksUri', label: 'JWKS URI', type: 'text' },
      { id: 'issuer', label: 'Issuer', type: 'text' },
      { id: 'audience', label: 'Audience', type: 'text' },
    ],
  },
  {
    key: 'magicLink',
    label: 'Magic Link',
    fields: [{ id: 'fromEmail', label: 'From email', type: 'text' }],
  },
  {
    key: 'localPin',
    label: 'Local PIN (Kiosk)',
    fields: [],
  },
];

export async function render(container, cache) {
  _container = container;
  _providers =
    (cache.settingsJson && cache.settingsJson.auth && cache.settingsJson.auth.providers) || {};
  _renderUI();
}

export function destroy() {
  _container = null;
  _providers = {};
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="auth-wrap">';
  html +=
    '<div class="auth-hint">Changes saved per-provider. Each save updates the auth section via POST /api/settings.</div>';

  PROVIDER_CONFIG.forEach(function (p) {
    const pData = _providers[p.key] || {};
    const enabled = !!pData.enabled;
    html += '<div class="auth-card" data-pkey="' + p.key + '">';
    html += '<div class="auth-card-hdr">';
    html += '<span class="auth-provider-name">' + _esc(p.label) + '</span>';
    html +=
      '<label class="auth-toggle-wrap"><input type="checkbox" class="auth-enabled-chk" data-pkey="' +
      p.key +
      '"' +
      (enabled ? ' checked' : '') +
      '><span class="auth-toggle-lbl">Enabled</span></label>';
    html += '</div>';

    if (p.fields.length > 0) {
      html += '<div class="auth-fields' + (enabled ? '' : ' auth-hidden') + '">';
      p.fields.forEach(function (f) {
        const val = pData[f.id] || '';
        html += '<div class="auth-field-row">';
        html += '<label>' + _esc(f.label) + '</label>';
        html +=
          '<input type="text" class="auth-input" data-pkey="' +
          p.key +
          '" data-fid="' +
          f.id +
          '" value="' +
          _esc(val) +
          '">';
        html += '</div>';
      });
      html += '</div>';
    }

    html +=
      '<button class="auth-save-btn" data-pkey="' + p.key + '">Save ' + _esc(p.label) + '</button>';
    html += '</div>';
  });

  html += '</div>';
  _container.innerHTML = html;

  /* Toggle fields visibility on enabled change */
  _container.querySelectorAll('.auth-enabled-chk').forEach(function (chk) {
    chk.addEventListener('change', function () {
      const pkey = /** @type {HTMLElement} */ (chk).dataset.pkey;
      const card = _container.querySelector('[data-pkey="' + pkey + '"]');
      const fields = card && card.querySelector('.auth-fields');
      if (fields) {
        fields.classList.toggle('auth-hidden', !(/** @type {HTMLInputElement} */ (chk).checked));
      }
    });
  });

  _container.querySelectorAll('.auth-save-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const pkey = /** @type {HTMLElement} */ (btn).dataset.pkey;
      const card = _container.querySelector('[data-pkey="' + pkey + '"]');
      if (!card) {
        return;
      }

      const enabled = /** @type {HTMLInputElement} */ (card.querySelector('.auth-enabled-chk'))
        .checked;
      const pData = { enabled: enabled };
      card.querySelectorAll('.auth-input').forEach(function (inp) {
        pData[/** @type {HTMLElement} */ (inp).dataset.fid] = /** @type {HTMLInputElement} */ (
          inp
        ).value.trim();
      });

      const body = { settings_json: { auth: { providers: {} } } };
      body.settings_json.auth.providers[pkey] = pData;

      const res = await api.post('/api/settings', body);
      if (res && !res._error) {
        toast(_providerLabel(pkey) + ' saved', 'success');
        _providers[pkey] = pData;
      } else {
        toast((res && res.message) || 'Failed to save', 'error');
      }
    });
  });
}

function _providerLabel(key) {
  const p = PROVIDER_CONFIG.find(function (x) {
    return x.key === key;
  });
  return p ? p.label : key;
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

/**
 * Login + ambiguous_phone tenant picker.
 * Uses the shared staff login-card chrome so parent sign-in matches HR/Campus.
 */

import { guardianApi } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { applyBrand, getBrand } from '../../shared/brand.js';
import { saveGuardianSession } from '../../shared/session.js';
import { authMainEl, setLogoutVisible } from './shell.js';
import { escapeHtml } from './utils.js';

/** @type {{ phone: string, password: string, tenants: Array<{tenantId: string, guardianId: string}> } | null} */
let pendingAmbiguous = null;

/**
 * @param {HTMLElement|null} errEl
 * @param {string} [msg]
 */
function setLoginError(errEl, msg) {
  if (!errEl) return;
  if (msg) {
    errEl.textContent = msg;
    errEl.classList.add('show');
    errEl.hidden = false;
  } else {
    errEl.textContent = '';
    errEl.classList.remove('show');
    errEl.hidden = true;
  }
}

/**
 * @param {() => Promise<void>} onSuccess
 */
export function renderLogin(onSuccess) {
  setLogoutVisible(false);
  pendingAmbiguous = null;
  const main = authMainEl();
  if (!main) return;
  const brand = getBrand('school');
  main.innerHTML = `
    <div class="login-wrap">
      <div class="login-card" data-view="login">
        <div class="login-logo login-logo--mark df" id="loginLogo">
          <span id="loginLogoLetter" hidden>${escapeHtml(brand.name[0] || 'B')}</span>
          <img
            id="loginLogoImg"
            alt="${escapeHtml(brand.name)}"
            src="${escapeHtml(brand.loginLogoPath || brand.headerLogoPath)}"
          />
        </div>
        <div class="login-title df visually-hidden" id="loginTitle" hidden>${escapeHtml(brand.name)}</div>
        <div class="login-tagline" id="loginTagline">${escapeHtml(brand.tagline)}</div>
        <div class="login-sub mf" id="loginSub">${escapeHtml(brand.loginHeading)}</div>
        <form class="login-form" id="gpLoginForm" style="display: block">
          <div class="lf-field">
            <label class="lf-label" for="gpPhone">Phone</label>
            <input
              class="lf-input"
              id="gpPhone"
              name="phone"
              type="tel"
              autocomplete="tel"
              placeholder="Mobile number"
              required
            />
          </div>
          <div class="lf-field">
            <label class="lf-label" for="gpPassword">Password</label>
            <input
              class="lf-input"
              id="gpPassword"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <button class="lf-submit" type="submit" id="gpLoginBtn">
            Sign In<span class="spinner"></span>
          </button>
          <div class="lf-error" id="gpLoginError" role="alert" hidden></div>
        </form>
        <div id="gpTenantPicker" class="gp-tenant-picker" hidden></div>
        <div class="login-footer" id="loginFooter">Powered by ${escapeHtml(brand.name)}</div>
      </div>
    </div>
  `;
  applyBrand('school');
  main.querySelector('#gpLoginForm').addEventListener('submit', (ev) => {
    onLoginSubmit(ev, onSuccess);
  });
}

/**
 * @param {Event} ev
 * @param {() => Promise<void>} onSuccess
 */
async function onLoginSubmit(ev, onSuccess) {
  ev.preventDefault();
  const errEl = document.getElementById('gpLoginError');
  const btn = document.getElementById('gpLoginBtn');
  const picker = document.getElementById('gpTenantPicker');
  setLoginError(errEl);
  if (picker) {
    picker.hidden = true;
    picker.innerHTML = '';
  }
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }
  const phone = /** @type {HTMLInputElement} */ (document.getElementById('gpPhone')).value.trim();
  const password = /** @type {HTMLInputElement} */ (document.getElementById('gpPassword')).value;
  const res = await guardianApi.post('/guardian/login', { phone, password });
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
  await handleLoginResult(res, phone, password, onSuccess);
}

/**
 * @param {any} res
 * @param {string} phone
 * @param {string} password
 * @param {() => Promise<void>} onSuccess
 */
async function handleLoginResult(res, phone, password, onSuccess) {
  const errEl = document.getElementById('gpLoginError');
  if (res && res._error) {
    if (
      res.status === 409 &&
      String(res.message || '').includes('ambiguous_phone') &&
      Array.isArray(res.tenants) &&
      res.tenants.length
    ) {
      pendingAmbiguous = { phone, password, tenants: res.tenants };
      showTenantPicker(onSuccess);
      return;
    }
    const msg =
      res.status === 423
        ? 'Account locked after too many attempts. Try again in 15 minutes.'
        : res.message || 'Sign-in failed';
    setLoginError(errEl, msg);
    toast(msg, 'error');
    return;
  }
  saveGuardianSession({
    token: res.token,
    tenantId: res.tenant_id || res.tenantId,
    guardianId: res.guardian_id || res.guardianId,
    expiresAt: res.expires_at || res.expiresAt,
    phone,
  });
  pendingAmbiguous = null;
  toast('Signed in', 'success');
  await onSuccess();
}

/**
 * @param {() => Promise<void>} onSuccess
 */
function showTenantPicker(onSuccess) {
  const picker = document.getElementById('gpTenantPicker');
  const errEl = document.getElementById('gpLoginError');
  if (!picker || !pendingAmbiguous) return;
  setLoginError(
    errEl,
    'This phone is linked to more than one school. Choose one to continue.',
  );
  const options = pendingAmbiguous.tenants
    .map((t) => {
      const tid = t.tenantId || t.tenant_id;
      const gid = t.guardianId || t.guardian_id;
      return `<button type="button" class="gp-btn secondary gp-tenant-opt" data-tenant-id="${escapeHtml(tid)}" data-guardian-id="${escapeHtml(gid || '')}">
        School ${escapeHtml(tid)}
      </button>`;
    })
    .join('');
  picker.hidden = false;
  picker.innerHTML = `
    <p class="login-sub">Select your school</p>
    <div class="gp-tenant-list">${options}</div>
  `;
  picker.querySelectorAll('[data-tenant-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tenantId = btn.getAttribute('data-tenant-id');
      const { phone, password } = pendingAmbiguous;
      btn.setAttribute('disabled', 'true');
      const res = await guardianApi.post('/guardian/login', {
        phone,
        password,
        tenant_id: tenantId,
      });
      btn.removeAttribute('disabled');
      await handleLoginResult(res, phone, password, onSuccess);
    });
  });
}

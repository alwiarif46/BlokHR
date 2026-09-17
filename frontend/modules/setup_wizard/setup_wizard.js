/**
 * modules/setup_wizard/setup_wizard.js
 *
 * Extracted from monolith Block 14 — Setup Wizard JS.
 * 4-step flow: Type → Branding → Auth → License/Plan
 * Panels keep stable ids wzP0..wzP3; wizard steps are 1..4.
 * Writes to tenant_settings via POST /api/setup/step1,step2,step3
 *
 * Pattern: initWizard(statusData) called from shell.html boot sequence.
 */

import { isMockMode } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { syncBrandLogos } from '../../shared/brand.js';

/** HR / company default accent (matches colour picker default). */
const WZ_ACCENT_HR = '#F5A623';
/** BlokSchool preview accent until brand preset ships (W-03). */
const WZ_ACCENT_SCHOOL = '#0EA5E9';

let _step = 1;
let _mock = false;
let _mockData = { setupComplete: false, currentStep: 1, branding: {}, lastStep3Body: null };
let _deploymentMode = 'cloud';
/** @type {'hr'|'school'|null} */
let _vertical = null;
/** @type {'hr'|'school'|null} */
let _pendingVertical = null;
let _verticalLocked = false;
let _eventsBound = false;

/**
 * Initialise the setup wizard. Called when setup is not complete.
 * @param {object} statusData — from GET /api/setup/status
 */
export function initWizard(statusData) {
  const scr = document.getElementById('screenSetup');
  if (!scr) return;

  _mock = isMockMode();
  const wzTheme = scr.getAttribute('data-wz-theme') || 'dark';
  const logoUrlEarly = ((document.getElementById('wzLogoUrl') || {}).value || '').trim();
  if (!logoUrlEarly) syncBrandLogos(wzTheme);
  _deploymentMode =
    (statusData && statusData.deploymentMode) || 'cloud';
  wzApplyDeploymentMode(_deploymentMode);

  const existingVertical =
    statusData && (statusData.vertical === 'hr' || statusData.vertical === 'school')
      ? statusData.vertical
      : null;

  if (existingVertical) {
    _vertical = existingVertical;
    _pendingVertical = existingVertical;
    _verticalLocked = true;
    wzSyncVerticalCards(existingVertical);
    wzApplyVerticalCopy(existingVertical);
    if (existingVertical === 'school') wzApplyAccent(WZ_ACCENT_SCHOOL);
    else wzApplyAccent(WZ_ACCENT_HR);
  } else {
    _vertical = null;
    _pendingVertical = null;
    _verticalLocked = false;
    wzSyncVerticalCards(null);
    wzApplyVerticalCopy(null);
  }

  if (statusData && statusData.currentStep > 1) {
    const b = statusData.branding || {};
    const nameInput = document.getElementById('wzCompanyName');
    if (nameInput && b.companyName) nameInput.value = b.companyName;
    const tagInput = document.getElementById('wzTagline');
    if (tagInput && b.tagline) tagInput.value = b.tagline;
    if (b.primaryColor) wzApplyAccent(b.primaryColor);

    const localToggle = document.getElementById('wzAuthLocal');
    if (localToggle && typeof b.authLocalEnabled === 'boolean') {
      localToggle.checked = b.authLocalEnabled;
    }
    const magicToggle = document.getElementById('wzAuthMagic');
    if (magicToggle && typeof b.authMagicLinkEnabled === 'boolean') {
      magicToggle.checked = b.authMagicLinkEnabled;
    }
    const msalClient = document.getElementById('wzMsalClient');
    if (msalClient && b.msalClientId) msalClient.value = b.msalClientId;
    const msalTenant = document.getElementById('wzMsalTenant');
    if (msalTenant && b.msalTenantId) msalTenant.value = b.msalTenantId;
    const googleClient = document.getElementById('wzGoogleClient');
    if (googleClient && b.googleOAuthClientId) googleClient.value = b.googleOAuthClientId;
    if (b.msalClientId || b.googleOAuthClientId) {
      wzExpandSso(true);
    }
  }

  // Resume: skip Type when vertical already set; map API currentStep (1–3) → wizard step (2–4).
  if (existingVertical) {
    const apiStep = Math.min(3, Math.max(1, (statusData && statusData.currentStep) || 1));
    wzGoTo(apiStep + 1, true);
  } else {
    wzGoTo(1, true);
  }

  _bindEvents();
  wzValidate0();
  wzValidate1();
  wzValidate2();
  wzValidate3();
}

/** @returns {'hr'|'school'|null} */
export function getWizardVertical() {
  return _vertical;
}

/** Test helper — last mock step3 payload. */
export function getMockStep3Body() {
  return _mockData.lastStep3Body;
}

function wzApplyDeploymentMode(mode) {
  _deploymentMode = mode === 'self_hosted' ? 'self_hosted' : 'cloud';
  const cloud = document.getElementById('wzCloudPlan');
  const selfHost = document.getElementById('wzSelfHostLicense');
  const sub = document.getElementById('wzStep3Sub');
  const title = document.getElementById('wzStep3Title');
  const btnText = document.getElementById('wzBtn3Text');
  const label = document.getElementById('wzLb4');
  if (cloud) cloud.hidden = _deploymentMode !== 'cloud';
  if (selfHost) selfHost.hidden = _deploymentMode !== 'self_hosted';
  if (label) label.textContent = _deploymentMode === 'self_hosted' ? 'License' : 'Plan';
  if (title) {
    title.textContent =
      _deploymentMode === 'self_hosted' ? 'License & admin' : 'Admin & plan';
  }
  if (sub) {
    sub.textContent =
      _deploymentMode === 'self_hosted'
        ? 'Activate your signed enterprise license, then create the first admin.'
        : 'Create your admin account and start a 1-month free trial. No license key needed.';
  }
  if (btnText) {
    btnText.textContent =
      _deploymentMode === 'self_hosted' ? 'Activate & finish →' : 'Start trial →';
  }
}

/* ── Vertical-aware copy ── */

/**
 * Wizard copy that differs per vertical. The markup ships the HR wording, so
 * an HR workspace is correct with no JS applied; school copy is layered on when
 * that vertical is chosen. Kept local to the wizard because it runs before any
 * tenant settings (and therefore shared/labels.js terminology) exist.
 */
const WZ_VERTICAL_COPY = {
  hr: {
    text: {
      wzSecIdentity: 'Company Identity',
      wzLblOrgName: 'Company Name',
      wzErrName: 'Company name is required',
      wzSecAuth: 'How your team signs in',
      wzLocalHint: 'Best for small teams — no SSO setup needed',
    },
    placeholder: {
      wzCompanyName: 'Acme Corporation',
      wzTagline: 'Empowering your team',
      wzEmailName: 'Defaults to company name',
      wzAdminEmail: 'admin@company.com',
    },
  },
  school: {
    text: {
      wzSecIdentity: 'Campus Identity',
      wzLblOrgName: 'Campus Name',
      wzErrName: 'Campus name is required',
      wzSecAuth: 'How your staff signs in',
      wzLocalHint: 'Best for a single campus — no SSO setup needed',
    },
    placeholder: {
      wzCompanyName: 'Greenwood High School',
      wzTagline: 'Every learner, every day',
      wzEmailName: 'Defaults to campus name',
      wzAdminEmail: 'admin@greenwood.edu',
    },
  },
};

/**
 * Swap wizard copy to match the chosen vertical.
 * @param {'hr'|'school'|null} vertical
 */
function wzApplyVerticalCopy(vertical) {
  const copy = WZ_VERTICAL_COPY[vertical === 'school' ? 'school' : 'hr'];
  Object.keys(copy.text).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = copy.text[id];
  });
  Object.keys(copy.placeholder).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('placeholder', copy.placeholder[id]);
  });
}

/* ── Accent colour application ── */
function wzApplyAccent(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  const scr = document.getElementById('screenSetup');
  if (!scr) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d2 =
    '#' +
    [r, g, b]
      .map((c) =>
        Math.max(0, Math.round(c * 0.85))
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  scr.style.setProperty('--wz-accent', hex);
  scr.style.setProperty('--wz-accent2', d2);
  scr.style.setProperty('--wz-accent-dim', hex + '18');
  scr.style.setProperty('--wz-accent-glow', hex + '40');
}

function wzPanelId(wizardStep) {
  return wizardStep === 1 ? 'wzP0' : 'wzP' + (wizardStep - 1);
}

function wzSyncVerticalCards(vertical) {
  ['wzCardHr', 'wzCardSchool'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const selected = vertical && el.getAttribute('data-vertical') === vertical;
    el.classList.toggle('selected', !!selected);
    el.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (_verticalLocked) el.classList.add('locked');
    else el.classList.remove('locked');
  });
}

function wzValidate0() {
  const btn = document.getElementById('wzBtn0');
  if (btn) btn.disabled = !(_pendingVertical || _vertical);
}

/* ── Step validation ── */
function wzValidate1() {
  const btn = document.getElementById('wzBtn1');
  const name = document.getElementById('wzCompanyName');
  if (btn && name) btn.disabled = !name.value.trim();
}

function wzValidate2() {
  const localOn = !!(document.getElementById('wzAuthLocal') || {}).checked;
  const magicOn = !!(document.getElementById('wzAuthMagic') || {}).checked;
  const ms = (document.getElementById('wzMsalClient') || {}).value || '';
  const gg = (document.getElementById('wzGoogleClient') || {}).value || '';
  const hasProvider = localOn || magicOn || !!ms.trim() || !!gg.trim();
  const btn = document.getElementById('wzBtn2');
  if (btn) btn.disabled = !hasProvider;

  const localCard = document.getElementById('wzLocalCard');
  const magicCard = document.getElementById('wzMagicCard');
  if (localCard) localCard.classList.toggle('has-value', localOn);
  if (magicCard) magicCard.classList.toggle('has-value', magicOn);

  const msCard = document.getElementById('wzMsCard');
  const ggCard = document.getElementById('wzGgCard');
  if (msCard) msCard.classList.toggle('has-value', !!ms.trim());
  if (ggCard) ggCard.classList.toggle('has-value', !!gg.trim());
  if (hasProvider && document.getElementById('wzErrAuth')) {
    document.getElementById('wzErrAuth').classList.remove('show');
  }
}

function wzExpandSso(open) {
  const body = document.getElementById('wzSsoBody');
  const toggle = document.getElementById('wzSsoToggle');
  const collapse = document.getElementById('wzSsoCollapse');
  if (!body || !toggle) return;
  const shouldOpen = open === true || (open !== false && body.hidden);
  body.hidden = !shouldOpen;
  toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (collapse) collapse.classList.toggle('open', shouldOpen);
}

function wzValidate3() {
  const e = (document.getElementById('wzAdminEmail') || {}).value || '';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  let ok = emailOk;
  if (_deploymentMode === 'self_hosted') {
    const token = (document.getElementById('wzLicenseToken') || {}).value || '';
    ok = emailOk && token.trim().length > 20;
  }
  const btn = document.getElementById('wzBtn3');
  if (btn) btn.disabled = !ok;
}

/* ── Step navigation ── */
function wzGoTo(step, instant) {
  if (step === _step && !instant) return;
  const apply = () => {
    document.querySelectorAll('.wz-panel').forEach((p) => {
      p.classList.remove('active');
      p.style.animation = '';
    });
    _step = step;
    const next = document.getElementById(wzPanelId(step));
    if (next) {
      next.classList.add('active');
      if (!instant) next.style.animation = 'wzSlideIn .5s var(--wz-ease) both';
    }
    wzUpdateIndicator();
  };

  if (instant) {
    apply();
    return;
  }

  const old = document.getElementById(wzPanelId(_step));
  if (old && old.classList.contains('active')) {
    old.style.animation = 'wzSlideOut .3s var(--wz-ease) forwards';
    setTimeout(() => {
      old.classList.remove('active');
      old.style.animation = '';
      apply();
    }, 280);
  } else {
    apply();
  }
}

function wzUpdateIndicator() {
  for (let i = 1; i <= 4; i++) {
    const n = document.getElementById('wzSn' + i);
    const l = document.getElementById('wzLb' + i);
    if (n) {
      n.classList.remove('active', 'done');
      if (i < _step) n.classList.add('done');
      else if (i === _step) n.classList.add('active');
    }
    if (l) {
      l.classList.remove('active', 'done');
      if (i < _step) l.classList.add('done');
      else if (i === _step) l.classList.add('active');
    }
  }
  const sl1 = document.getElementById('wzSl1');
  const sl2 = document.getElementById('wzSl2');
  const sl3 = document.getElementById('wzSl3');
  if (sl1) sl1.className = 'wz-sl' + (_step >= 2 ? ' filled' : '');
  if (sl2)
    sl2.className =
      'wz-sl' + (_step >= 3 ? ' filled' : _step === 2 ? ' filling' : '');
  if (sl3)
    sl3.className =
      'wz-sl' + (_step >= 4 ? ' filled' : _step === 3 ? ' filling' : '');
}

/* ── UI helpers ── */
function wzSetLoading(id, on) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.classList.toggle('loading', on);
    if (on) btn.disabled = true;
  }
}

function wzShowErr(inputId, errorId) {
  const inp = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  if (inp) inp.classList.add('err');
  if (err) err.classList.add('show');
}

function wzClearErr(inputId, errorId) {
  const inp = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  if (inp) inp.classList.remove('err');
  if (err) err.classList.remove('show');
}

/* ── API calls with mock fallback ── */
async function wzApi(path, opts) {
  if (_mock || isMockMode()) return wzMockApi(path, opts);
  try {
    const base = location.origin || '';
    const response = await fetch(base + path, opts);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (_e) {
    _mock = true;
    return wzMockApi(path, opts);
  }
}

function wzMockApi(path, opts) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (path === '/api/setup/step1') {
        const b = JSON.parse(opts.body);
        _mockData.currentStep = 2;
        Object.assign(_mockData.branding, b);
        return resolve({ success: true });
      }
      if (path === '/api/setup/step2') {
        _mockData.currentStep = 3;
        return resolve({ success: true });
      }
      if (path === '/api/setup/step3') {
        const body = JSON.parse(opts.body);
        _mockData.lastStep3Body = body;
        _mockData.setupComplete = true;
        return resolve({ success: true });
      }
      resolve({});
    }, 20);
  });
}

/* ── Success + confetti ── */
function wzShowSuccess() {
  document
    .querySelectorAll('.wz-panel')
    .forEach((p) => p.classList.remove('active'));
  const steps = document.getElementById('wzSteps');
  const labels = document.getElementById('wzLabels');
  const title = document.getElementById('wzTitle');
  const subtitle = document.getElementById('wzSubtitle');
  if (steps) steps.style.display = 'none';
  if (labels) labels.style.display = 'none';
  if (title) title.textContent = 'Setup Complete';
  if (subtitle) subtitle.textContent = '';
  const co = document.getElementById('wzSuccessCo');
  const nameInput = document.getElementById('wzCompanyName');
  if (co && nameInput) co.textContent = nameInput.value.trim();
  const success = document.getElementById('wzSuccess');
  if (success) success.classList.add('active');
  wzConfetti();
}

function wzConfetti() {
  const box = document.getElementById('wzConfetti');
  if (!box) return;
  const cols = [
    '#F5A623', '#22C55E', '#3B82F6', '#EF4444', '#A855F7',
    '#EC4899', '#EAB308', '#06B6D4', '#F97316',
  ];
  for (let i = 0; i < 100; i++) {
    const p = document.createElement('div');
    p.className = 'wz-confetti-p';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[Math.floor(Math.random() * cols.length)];
    const sz = 6 + Math.random() * 10;
    p.style.width = sz + 'px';
    p.style.height = (Math.random() > 0.5 ? sz : sz * 0.5) + 'px';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    p.style.animationDuration = 2 + Math.random() * 2.5 + 's';
    p.style.animationDelay = Math.random() * 1 + 's';
    box.appendChild(p);
  }
  setTimeout(() => {
    box.innerHTML = '';
  }, 6000);
}

function wzSelectVertical(vertical) {
  if (_verticalLocked) return;
  if (vertical !== 'hr' && vertical !== 'school') return;
  _pendingVertical = vertical;
  wzSyncVerticalCards(vertical);
  wzApplyVerticalCopy(vertical);
  if (vertical === 'school') wzApplyAccent(WZ_ACCENT_SCHOOL);
  else wzApplyAccent(WZ_ACCENT_HR);
  wzValidate0();
}

async function wzConfirmVerticalAndAdvance() {
  const chosen = _pendingVertical || _vertical;
  if (!chosen) return;

  if (_verticalLocked || _vertical === chosen) {
    wzGoTo(2);
    return;
  }

  const label = chosen === 'school' ? 'Campus' : 'Workforce';
  const ok = await confirmDialog({
    title: 'Confirm workspace type',
    message:
      'You chose ' + label + '. This cannot be changed later. Continue?',
    confirmLabel: 'Continue',
    cancelLabel: 'Go back',
  });
  if (!ok) return;
  _vertical = chosen;
  wzGoTo(2);
}

/* ── Event binding ── */
function _bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  /* Theme toggle */
  const themeBtn = document.getElementById('wzThemeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const scr = document.getElementById('screenSetup');
      if (!scr) return;
      const next =
        scr.getAttribute('data-wz-theme') === 'dark' ? 'light' : 'dark';
      scr.setAttribute('data-wz-theme', next);
      const logoUrl = ((document.getElementById('wzLogoUrl') || {}).value || '').trim();
      if (!logoUrl) syncBrandLogos(next);
    });
  }

  /* Vertical cards */
  ['wzCardHr', 'wzCardSchool'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      wzSelectVertical(el.getAttribute('data-vertical'));
    });
  });

  const btn0 = document.getElementById('wzBtn0');
  if (btn0) {
    btn0.addEventListener('click', () => {
      wzConfirmVerticalAndAdvance();
    });
  }

  /* Color picker */
  const colorPicker = document.getElementById('wzColorPicker');
  if (colorPicker) {
    colorPicker.addEventListener('input', function () {
      const swatch = document.getElementById('wzSwatch');
      const hex = document.getElementById('wzColorHex');
      if (swatch) swatch.style.background = this.value;
      if (hex) hex.value = this.value.toUpperCase();
      wzApplyAccent(this.value);
    });
  }
  const colorHex = document.getElementById('wzColorHex');
  if (colorHex) {
    colorHex.addEventListener('input', function () {
      let v = this.value;
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        const picker = document.getElementById('wzColorPicker');
        const swatch = document.getElementById('wzSwatch');
        if (picker) picker.value = v;
        if (swatch) swatch.style.background = v;
        wzApplyAccent(v);
      }
    });
  }

  /* Logo preview */
  const logoUrl = document.getElementById('wzLogoUrl');
  if (logoUrl) {
    logoUrl.addEventListener('change', function () {
      const url = this.value.trim();
      const img = document.getElementById('wzLogoImg');
      const letter = document.getElementById('wzLogoLetter');
      const logoWrap = document.getElementById('wzLogo');
      if (url && img) {
        img.src = url;
        img.style.display = 'block';
        if (letter) letter.style.display = 'none';
        if (logoWrap) logoWrap.classList.add('wz-logo--mark');
        img.onerror = function () {
          img.style.display = 'none';
          if (letter) letter.style.display = '';
          if (logoWrap) logoWrap.classList.remove('wz-logo--mark');
          const scr = document.getElementById('screenSetup');
          const wzTheme = (scr && scr.getAttribute('data-wz-theme')) || 'dark';
          syncBrandLogos(wzTheme);
        };
      } else {
        if (img) img.style.display = 'none';
        if (letter) letter.style.display = '';
        if (logoWrap) logoWrap.classList.remove('wz-logo--mark');
        const scr = document.getElementById('screenSetup');
        const wzTheme = (scr && scr.getAttribute('data-wz-theme')) || 'dark';
        syncBrandLogos(wzTheme);
      }
    });
  }

  /* Company name → logo letter + validate */
  const nameInput = document.getElementById('wzCompanyName');
  if (nameInput) {
    nameInput.addEventListener('input', function () {
      const v = this.value.trim();
      const logoUrlEl = document.getElementById('wzLogoUrl');
      const letter = document.getElementById('wzLogoLetter');
      if (v && letter && (!logoUrlEl || !logoUrlEl.value.trim())) {
        letter.textContent = v[0].toUpperCase();
      }
      wzValidate1();
    });
  }

  /* Auth validation inputs */
  ['wzMsalClient', 'wzMsalTenant', 'wzGoogleClient'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', wzValidate2);
  });
  ['wzAuthLocal', 'wzAuthMagic'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', wzValidate2);
  });

  const ssoToggle = document.getElementById('wzSsoToggle');
  if (ssoToggle) {
    ssoToggle.addEventListener('click', () => {
      const body = document.getElementById('wzSsoBody');
      wzExpandSso(!!(body && body.hidden));
    });
  }

  /* License / plan validation inputs */
  ['wzLicenseToken', 'wzAdminEmail'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', wzValidate3);
  });

  /* Step 1 submit (branding) → wizard step 3 */
  const btn1 = document.getElementById('wzBtn1');
  if (btn1) {
    btn1.addEventListener('click', () => {
      const name = (document.getElementById('wzCompanyName') || {}).value || '';
      if (!name.trim()) {
        wzShowErr('wzCompanyName', 'wzErrName');
        return;
      }
      wzClearErr('wzCompanyName', 'wzErrName');
      wzSetLoading('wzBtn1', true);
      wzApi('/api/setup/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: name.trim(),
          tagline: ((document.getElementById('wzTagline') || {}).value || '').trim(),
          logoUrl: ((document.getElementById('wzLogoUrl') || {}).value || '').trim(),
          primaryColor: ((document.getElementById('wzColorPicker') || {}).value || '#F5A623'),
          primaryTimezone: ((document.getElementById('wzTimezone') || {}).value || 'Asia/Kolkata').trim(),
          emailFromName: ((document.getElementById('wzEmailName') || {}).value || '').trim(),
        }),
      })
        .then(() => {
          toast('Branding saved', 'success');
          wzGoTo(3);
        })
        .catch((e) => toast(e.message || 'Failed', 'error'))
        .finally(() => {
          wzSetLoading('wzBtn1', false);
          wzValidate1();
        });
    });
  }

  /* Step 2 submit (auth) → wizard step 4 */
  const btn2 = document.getElementById('wzBtn2');
  if (btn2) {
    btn2.addEventListener('click', () => {
      const localOn = !!(document.getElementById('wzAuthLocal') || {}).checked;
      const magicOn = !!(document.getElementById('wzAuthMagic') || {}).checked;
      const ms = ((document.getElementById('wzMsalClient') || {}).value || '').trim();
      const gg = ((document.getElementById('wzGoogleClient') || {}).value || '').trim();
      if (!localOn && !magicOn && !ms && !gg) {
        const errAuth = document.getElementById('wzErrAuth');
        if (errAuth) errAuth.classList.add('show');
        return;
      }
      wzSetLoading('wzBtn2', true);
      wzApi('/api/setup/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authLocalEnabled: localOn,
          authMagicLinkEnabled: magicOn,
          msalClientId: ms,
          msalTenantId: ((document.getElementById('wzMsalTenant') || {}).value || '').trim(),
          googleOAuthClientId: gg,
        }),
      })
        .then(() => {
          toast('Auth configured', 'success');
          wzGoTo(4);
        })
        .catch((e) => toast(e.message || 'Failed', 'error'))
        .finally(() => {
          wzSetLoading('wzBtn2', false);
          wzValidate2();
        });
    });
  }

  /* Step 3 submit (plan) — includes vertical */
  const btn3 = document.getElementById('wzBtn3');
  if (btn3) {
    btn3.addEventListener('click', () => {
      const email = ((document.getElementById('wzAdminEmail') || {}).value || '').trim();
      const token = ((document.getElementById('wzLicenseToken') || {}).value || '').trim();
      let hasErr = false;
      if (_deploymentMode === 'self_hosted' && token.length < 20) {
        wzShowErr('wzLicenseToken', 'wzErrLicense');
        hasErr = true;
      } else {
        wzClearErr('wzLicenseToken', 'wzErrLicense');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        wzShowErr('wzAdminEmail', 'wzErrAdmin');
        hasErr = true;
      } else {
        wzClearErr('wzAdminEmail', 'wzErrAdmin');
      }
      if (hasErr) return;
      wzSetLoading('wzBtn3', true);
      const body = {
        adminEmail: email,
        vertical: _vertical || 'hr',
      };
      if (_deploymentMode === 'self_hosted') body.licenseToken = token;
      wzApi('/api/setup/step3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(() => wzShowSuccess())
        .catch((e) => {
          toast(e.message || 'Failed', 'error');
          wzSetLoading('wzBtn3', false);
          wzValidate3();
        });
    });
  }

  /* Back buttons — wizard steps 3↔2, 4↔3 */
  const back2 = document.getElementById('wzBack2');
  if (back2) back2.addEventListener('click', () => wzGoTo(2));
  const back3 = document.getElementById('wzBack3');
  if (back3) back3.addEventListener('click', () => wzGoTo(3));

  /* Go to login after success */
  const goLogin = document.getElementById('wzGoLogin');
  if (goLogin) {
    goLogin.addEventListener('click', async () => {
      if (!window.BlokHR) return;

      let providers = [];
      try {
        const authData = await window.BlokHR.api('/api/auth/providers', { method: 'GET' });
        if (authData && authData.providers) {
          providers = authData.providers;
        }
      } catch (_e) { /* ignore */ }

      if (!providers.length) {
        providers = [
          { id: 'local', name: 'Email & Password', enabled: true, type: 'local' }
        ];
      }

      if (window.BlokHR.renderLoginProviders) {
        window.BlokHR.renderLoginProviders(providers);
      }

      window.BlokHR.showScreen('screenLogin');
      window.BlokHR.toast('Setup complete — sign in to continue', 'success');
    });
  }
}


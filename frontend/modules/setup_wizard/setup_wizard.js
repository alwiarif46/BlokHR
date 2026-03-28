/**
 * modules/setup_wizard/setup_wizard.js
 *
 * Extracted from monolith Block 14 — Setup Wizard JS.
 * 3-step flow: Branding → Auth → License
 * Writes to tenant_settings via POST /api/setup/step1,step2,step3
 *
 * Pattern: initWizard(statusData) called from shell.html boot sequence.
 */

import { api, isMockMode } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';

let _step = 1;
let _mock = false;
let _mockData = { setupComplete: false, currentStep: 1, branding: {} };

/**
 * Initialise the setup wizard. Called when setup is not complete.
 * @param {object} statusData — from GET /api/setup/status
 */
export function initWizard(statusData) {
  const scr = document.getElementById('screenSetup');
  if (!scr) return;

  _mock = isMockMode();

  if (statusData && statusData.currentStep > 1) {
    const b = statusData.branding || {};
    const nameInput = document.getElementById('wzCompanyName');
    if (nameInput && b.companyName) nameInput.value = b.companyName;
    const tagInput = document.getElementById('wzTagline');
    if (tagInput && b.tagline) tagInput.value = b.tagline;
    if (b.primaryColor) wzApplyAccent(b.primaryColor);
    wzGoTo(statusData.currentStep);
  }

  _bindEvents();
  wzValidate1();
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

/* ── Step validation ── */
function wzValidate1() {
  const btn = document.getElementById('wzBtn1');
  const name = document.getElementById('wzCompanyName');
  if (btn && name) btn.disabled = !name.value.trim();
}

function wzValidate2() {
  const ms = (document.getElementById('wzMsalClient') || {}).value || '';
  const gg = (document.getElementById('wzGoogleClient') || {}).value || '';
  const btn = document.getElementById('wzBtn2');
  if (btn) btn.disabled = !(ms.trim() || gg.trim());
  const msCard = document.getElementById('wzMsCard');
  const ggCard = document.getElementById('wzGgCard');
  if (msCard) msCard.classList.toggle('has-value', !!ms.trim());
  if (ggCard) ggCard.classList.toggle('has-value', !!gg.trim());
  if ((ms.trim() || gg.trim()) && document.getElementById('wzErrAuth')) {
    document.getElementById('wzErrAuth').classList.remove('show');
  }
}

function wzValidate3() {
  const k = (document.getElementById('wzLicenseKey') || {}).value || '';
  const e = (document.getElementById('wzAdminEmail') || {}).value || '';
  const btn = document.getElementById('wzBtn3');
  if (btn) {
    btn.disabled = !(
      k.trim().length >= 8 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
    );
  }
}

/* ── Step navigation ── */
function wzGoTo(step) {
  if (step === _step) return;
  const old = document.getElementById('wzP' + _step);
  if (old) {
    old.style.animation = 'wzSlideOut .3s var(--wz-ease) forwards';
    setTimeout(() => {
      old.classList.remove('active');
      old.style.animation = '';
      _step = step;
      const next = document.getElementById('wzP' + step);
      if (next) {
        next.classList.add('active');
        next.style.animation = 'wzSlideIn .5s var(--wz-ease) both';
      }
      wzUpdateIndicator();
    }, 280);
  } else {
    _step = step;
    const next = document.getElementById('wzP' + step);
    if (next) {
      next.classList.add('active');
      next.style.animation = 'wzSlideIn .5s var(--wz-ease) both';
    }
    wzUpdateIndicator();
  }
}

function wzUpdateIndicator() {
  for (let i = 1; i <= 3; i++) {
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
  if (sl1) sl1.className = 'wz-sl' + (_step >= 2 ? ' filled' : '');
  if (sl2)
    sl2.className =
      'wz-sl' + (_step >= 3 ? ' filled' : _step === 2 ? ' filling' : '');
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
        _mockData.setupComplete = true;
        return resolve({ success: true });
      }
      resolve({});
    }, 600);
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

/* ── Event binding ── */
function _bindEvents() {
  /* Theme toggle */
  const themeBtn = document.getElementById('wzThemeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const scr = document.getElementById('screenSetup');
      if (!scr) return;
      const next =
        scr.getAttribute('data-wz-theme') === 'dark' ? 'light' : 'dark';
      scr.setAttribute('data-wz-theme', next);
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
      if (url && img) {
        img.src = url;
        img.style.display = 'block';
        if (letter) letter.style.display = 'none';
        img.onerror = function () {
          img.style.display = 'none';
          if (letter) letter.style.display = '';
        };
      } else {
        if (img) img.style.display = 'none';
        if (letter) letter.style.display = '';
      }
    });
  }

  /* Company name → logo letter + validate */
  const nameInput = document.getElementById('wzCompanyName');
  if (nameInput) {
    nameInput.addEventListener('input', function () {
      const v = this.value.trim();
      const logoUrl = document.getElementById('wzLogoUrl');
      const letter = document.getElementById('wzLogoLetter');
      if (v && letter && (!logoUrl || !logoUrl.value.trim())) {
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

  /* License validation inputs */
  ['wzLicenseKey', 'wzAdminEmail'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', wzValidate3);
  });

  /* Step 1 submit */
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
          wzGoTo(2);
        })
        .catch((e) => toast(e.message || 'Failed', 'error'))
        .finally(() => {
          wzSetLoading('wzBtn1', false);
          wzValidate1();
        });
    });
  }

  /* Step 2 submit */
  const btn2 = document.getElementById('wzBtn2');
  if (btn2) {
    btn2.addEventListener('click', () => {
      const ms = ((document.getElementById('wzMsalClient') || {}).value || '').trim();
      const gg = ((document.getElementById('wzGoogleClient') || {}).value || '').trim();
      if (!ms && !gg) {
        const errAuth = document.getElementById('wzErrAuth');
        if (errAuth) errAuth.classList.add('show');
        return;
      }
      wzSetLoading('wzBtn2', true);
      wzApi('/api/setup/step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msalClientId: ms,
          msalTenantId: ((document.getElementById('wzMsalTenant') || {}).value || '').trim(),
          googleOAuthClientId: gg,
        }),
      })
        .then(() => {
          toast('Auth configured', 'success');
          wzGoTo(3);
        })
        .catch((e) => toast(e.message || 'Failed', 'error'))
        .finally(() => {
          wzSetLoading('wzBtn2', false);
          wzValidate2();
        });
    });
  }

  /* Step 3 submit */
  const btn3 = document.getElementById('wzBtn3');
  if (btn3) {
    btn3.addEventListener('click', () => {
      const key = ((document.getElementById('wzLicenseKey') || {}).value || '').trim();
      const email = ((document.getElementById('wzAdminEmail') || {}).value || '').trim();
      let hasErr = false;
      if (key.length < 8) {
        wzShowErr('wzLicenseKey', 'wzErrLicense');
        hasErr = true;
      } else {
        wzClearErr('wzLicenseKey', 'wzErrLicense');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        wzShowErr('wzAdminEmail', 'wzErrAdmin');
        hasErr = true;
      } else {
        wzClearErr('wzAdminEmail', 'wzErrAdmin');
      }
      if (hasErr) return;
      wzSetLoading('wzBtn3', true);
      wzApi('/api/setup/step3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, adminEmail: email }),
      })
        .then(() => wzShowSuccess())
        .catch((e) => {
          toast(e.message || 'Failed', 'error');
          wzSetLoading('wzBtn3', false);
          wzValidate3();
        });
    });
  }

  /* Back buttons */
  const back2 = document.getElementById('wzBack2');
  if (back2) back2.addEventListener('click', () => wzGoTo(1));
  const back3 = document.getElementById('wzBack3');
  if (back3) back3.addEventListener('click', () => wzGoTo(2));

  /* Go to login after success */
  const goLogin = document.getElementById('wzGoLogin');
  if (goLogin) {
    goLogin.addEventListener('click', () => {
      if (window.BlokHR && window.BlokHR.showScreen) {
        window.BlokHR.showScreen('screenLogin');
        toast('Setup complete — sign in to continue', 'success');
      }
    });
  }
}

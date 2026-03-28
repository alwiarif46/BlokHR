/**
 * modules/profile/profile.js
 *
 * Employee profile with field-level access control.
 * 5 sections: Organization, Shift, Contact, Financial & Identity, Account.
 *
 * Pattern: renderProfilePage() → profileLoadData() → profileRenderStats()
 *          → profileRender() → validation → certification → save → lock
 *
 * Read-only fields: email, dept, designation, empId, joinDate, gEmail,
 *                   shiftStart, shiftEnd, memberId, updatedAt
 * Editable fields: name, phone, emergency, parentage, PAN, aadhaar,
 *                  UAN, bankAcc, IFSC, bankName
 *
 * Validators: PAN (Income Tax), Aadhaar (Verhoeff), IFSC (Razorpay lookup),
 *             Phone (TRAI Indian mobile), Name (no digits), Bank Account (9-18 digits)
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

/* ── Module state ── */
let _profile = null;
let _locked = false;
let _container = null;
let _fieldErrors = {};

/* ══════════════════════════════════════════════════════════════
   VALIDATORS
   ══════════════════════════════════════════════════════════════ */

/** Verhoeff checksum tables */
const _vD = [
  [0,1,2,3,4,5,6,7,8,9],
  [1,2,3,4,0,6,7,8,9,5],
  [2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],
  [4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],
  [7,6,5,9,8,2,1,0,4,3],
  [8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const _vP = [
  [0,1,2,3,4,5,6,7,8,9],
  [1,5,7,6,2,8,3,0,9,4],
  [5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],
  [4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],
  [7,0,4,6,9,1,3,2,5,8],
];
const _vInv = [0,4,3,2,1,5,6,7,8,9];

/**
 * Validate Aadhaar using Verhoeff checksum.
 * @param {string} raw — 12 digits (spaces stripped)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAadhaar(raw) {
  const digits = String(raw).replace(/\s+/g, '');
  if (!/^\d{12}$/.test(digits)) {
    return { valid: false, error: 'Aadhaar must be exactly 12 digits' };
  }
  let c = 0;
  const arr = digits.split('').reverse().map(Number);
  for (let i = 0; i < arr.length; i++) {
    c = _vD[c][_vP[i % 8][arr[i]]];
  }
  if (c !== 0) {
    return { valid: false, error: 'Invalid Aadhaar checksum' };
  }
  return { valid: true };
}

/**
 * Validate PAN (Income Tax format ABCDE1234F).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePAN(val) {
  const pan = String(val).trim().toUpperCase();
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    return { valid: false, error: 'PAN format: ABCDE1234F' };
  }
  return { valid: true };
}

/**
 * Validate Indian mobile phone (TRAI rules).
 * Accepts: +91XXXXXXXXXX, +91-XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * The 10-digit number must start with 6-9.
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePhone(val) {
  const stripped = String(val).replace(/[\s\-()]/g, '');
  let digits = stripped;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, error: 'Phone must be 10 digits' };
  }
  if (!/^[6-9]/.test(digits)) {
    return { valid: false, error: 'Indian mobile must start with 6-9' };
  }
  return { valid: true };
}

/**
 * Validate IFSC code (RBI format: 4 letters + 0 + 6 alphanumeric).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateIFSC(val) {
  const ifsc = String(val).trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return { valid: false, error: 'IFSC format: ABCD0XXXXXX' };
  }
  return { valid: true };
}

/**
 * Validate name (no digits allowed, min 2 chars).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateName(val) {
  const name = String(val).trim();
  if (name.length < 2) {
    return { valid: false, error: 'Name is required (min 2 characters)' };
  }
  if (/\d/.test(name)) {
    return { valid: false, error: 'Name must not contain digits' };
  }
  return { valid: true };
}

/**
 * Validate bank account (9-18 digits).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBankAccount(val) {
  const acc = String(val).replace(/\s+/g, '');
  if (!/^\d{9,18}$/.test(acc)) {
    return { valid: false, error: 'Bank account: 9-18 digits' };
  }
  return { valid: true };
}

/**
 * Validate UAN (EPFO 12 digits).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUAN(val) {
  const uan = String(val).replace(/\s+/g, '');
  if (!uan) return { valid: true }; /* UAN is optional */
  if (!/^\d{12}$/.test(uan)) {
    return { valid: false, error: 'UAN must be 12 digits' };
  }
  return { valid: true };
}

/**
 * Validate email (basic RFC 5322).
 * @param {string} val
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(val) {
  const email = String(val).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/* Validator map keyed by field ID suffix */
const _validators = {
  name: validateName,
  phone: validatePhone,
  pan: validatePAN,
  aadhaar: validateAadhaar,
  bankAcc: validateBankAccount,
  ifsc: validateIFSC,
  uan: validateUAN,
};

/* Required fields (default; admin-configurable via settings) */
const _requiredFields = ['phone', 'pan', 'aadhaar', 'bankAcc', 'ifsc', 'bankName'];

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

/**
 * Render the profile page into a container.
 * @param {HTMLElement} container
 */
export function renderProfilePage(container) {
  _container = container;
  container.innerHTML = '<div class="pf-form" id="profileForm"><div class="pf-loading">Loading profile…</div></div>';
  profileLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

/**
 * Load profile data from API.
 */
export async function profileLoadData() {
  const session = getSession();
  if (!session) return;

  const [profileData, statusData] = await Promise.all([
    api.get('/api/profiles/me'),
    api.get('/api/profiles/me/status'),
  ]);

  if (profileData && !profileData._error) {
    _profile = profileData;
  } else {
    _profile = _mockProfile(session);
  }

  _locked = !!(statusData && !statusData._error && statusData.certified_at);

  profileRenderStats();
  profileRender();
}

/**
 * Mock profile for offline/demo mode.
 */
function _mockProfile(session) {
  return {
    name: session.name || '',
    email: session.email || '',
    department: '',
    designation: '',
    employee_id: '',
    joining_date: '',
    google_email: '',
    shift_start: '09:00',
    shift_end: '18:00',
    phone: '',
    emergency_contact: '',
    parentage: '',
    pan: '',
    aadhaar: '',
    uan: '',
    bank_account: '',
    ifsc: '',
    bank_name: '',
    member_id: '',
    updated_at: '',
  };
}

/* ══════════════════════════════════════════════════════════════
   STATS (no-op for profile, kept for pattern consistency)
   ══════════════════════════════════════════════════════════════ */

export function profileRenderStats() {
  /* Profile has no stats bar */
}

/* ══════════════════════════════════════════════════════════════
   RENDER FORM
   ══════════════════════════════════════════════════════════════ */

/**
 * Render the full profile form.
 */
export function profileRender() {
  const form = _container && _container.querySelector('#profileForm');
  if (!form || !_profile) return;

  const p = _profile;
  let h = '';

  if (_locked) {
    h += '<div class="pf-locked-banner">&#128274; Profile is certified and locked. Contact admin to unlock for editing.</div>';
  }

  /* Section: Organization */
  h += _section('Organization', [
    _field('name', 'Name', p.name || '', 'Full Name', false, true),
    _field('email', 'Email', p.email || '', '', true),
    _field('dept', 'Department', p.department || '', '', true),
    _field('desg', 'Designation', p.designation || '', '', true),
    _field('empId', 'Employee ID', p.employee_id || '', '', true),
    _field('joinDate', 'Joining Date', p.joining_date || '', '', true),
    _field('gEmail', 'Google Email', p.google_email || '', '', true),
  ]);

  /* Section: Shift */
  h += _section('Shift', [
    _field('shiftStart', 'Shift Start', p.shift_start || '', '', true),
    _field('shiftEnd', 'Shift End', p.shift_end || '', '', true),
  ]);

  /* Section: Contact */
  h += _section('Contact', [
    _field('phone', 'Phone', p.phone || '', '+91-XXXXXXXXXX', false, true, 15),
    _field('emergency', 'Emergency Contact', p.emergency_contact || '', 'Phone number'),
    _field('parentage', 'Parentage / Spouse', p.parentage || '', 'Name'),
  ]);

  /* Section: Financial & Identity */
  h += _section('Financial &amp; Identity', [
    _field('pan', 'PAN', p.pan || '', 'ABCDE1234F', false, true, 10),
    _field('aadhaar', 'Aadhaar', p.aadhaar || '', 'XXXX XXXX XXXX', false, true, 14),
    _field('uan', 'UAN', p.uan || '', '12 digits', false, false, 12),
    _field('bankAcc', 'Bank Account', p.bank_account || '', '9-18 digits', false, true, 18),
    _field('ifsc', 'IFSC', p.ifsc || '', 'ABCD0123456', false, true, 11),
    _field('bankName', 'Bank Name &amp; Branch', p.bank_name || '', 'Auto-filled from IFSC', false, true),
  ]);

  /* Section: Account */
  h += _section('Account', [
    _field('memberId', 'Member ID', p.member_id || '', '', true),
    _field('updatedAt', 'Updated', p.updated_at || '', '', true),
  ]);

  /* Missing fields bar */
  h += '<div class="pf-missing" id="pfMissing"></div>';

  /* Certification */
  h += '<div class="pf-cert"><label class="pf-cert-label"><input type="checkbox" id="pfCertify">';
  h += '<span>I hereby certify that all information provided above is true and correct to the best of my knowledge and belief.</span>';
  h += '</label></div>';

  /* Save button */
  h += '<button class="pf-save" id="pfSave" disabled>Save Profile</button>';

  form.innerHTML = h;

  _bindProfileEvents(form);
  _updateMissingBar();
  _checkSaveable();
}

/* ══════════════════════════════════════════════════════════════
   HTML BUILDERS
   ══════════════════════════════════════════════════════════════ */

function _section(title, fieldsHtml) {
  return '<div class="pf-section"><div class="pf-section-title">' + title + '</div>' +
    '<div class="pf-form-grid">' + fieldsHtml.join('') + '</div></div>';
}

function _field(id, label, value, placeholder, readonly, required, maxlength) {
  const reqSpan = required ? ' <span class="pf-req">*</span>' : '';
  const roClass = (readonly || _locked) ? ' pf-readonly' : '';
  const disabled = (readonly || _locked) ? ' disabled' : '';
  const ml = maxlength ? ' maxlength="' + maxlength + '"' : '';

  return '<div class="pf-form-field">' +
    '<label class="pf-form-label" for="pf-' + id + '">' + label + reqSpan + '</label>' +
    '<div class="pf-input-wrap">' +
    '<input class="pf-form-input' + roClass + '" id="pf-' + id + '" type="text"' +
    ' value="' + _esc(value) + '"' +
    (placeholder ? ' placeholder="' + _esc(placeholder) + '"' : '') +
    disabled + ml + '>' +
    '<span class="pf-field-icon" id="pf-icon-' + id + '"></span>' +
    '</div>' +
    '<div class="pf-field-error" id="pf-err-' + id + '"></div>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindProfileEvents(form) {
  /* Real-time validation on blur and input */
  const editableIds = ['name', 'phone', 'pan', 'aadhaar', 'uan', 'bankAcc', 'ifsc'];
  editableIds.forEach(function (id) {
    const input = form.querySelector('#pf-' + id);
    if (!input || input.disabled) return;
    input.addEventListener('blur', function () { _validateField(id); _updateMissingBar(); _checkSaveable(); });
    input.addEventListener('input', function () { _validateField(id); _updateMissingBar(); _checkSaveable(); });
  });

  /* IFSC auto-fill on blur */
  const ifscInput = form.querySelector('#pf-ifsc');
  if (ifscInput && !ifscInput.disabled) {
    ifscInput.addEventListener('blur', function () { _lookupIFSC(); });
  }

  /* bankName input change */
  const bankNameInput = form.querySelector('#pf-bankName');
  if (bankNameInput && !bankNameInput.disabled) {
    bankNameInput.addEventListener('input', function () { _updateMissingBar(); _checkSaveable(); });
  }

  /* Certification checkbox */
  const cert = form.querySelector('#pfCertify');
  if (cert) {
    cert.addEventListener('change', function () { _checkSaveable(); });
  }

  /* Save button */
  const saveBtn = form.querySelector('#pfSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () { _saveProfile(); });
  }
}

/* ══════════════════════════════════════════════════════════════
   FIELD VALIDATION
   ══════════════════════════════════════════════════════════════ */

function _validateField(id) {
  const input = _container && _container.querySelector('#pf-' + id);
  const icon = _container && _container.querySelector('#pf-icon-' + id);
  const err = _container && _container.querySelector('#pf-err-' + id);
  if (!input) return;

  const val = input.value.trim();
  const validator = _validators[id];

  if (!val && !_requiredFields.includes(id)) {
    if (icon) { icon.textContent = ''; icon.className = 'pf-field-icon'; }
    if (err) err.textContent = '';
    delete _fieldErrors[id];
    return;
  }

  if (!val && _requiredFields.includes(id)) {
    if (icon) { icon.textContent = '\u2718'; icon.className = 'pf-field-icon invalid'; }
    if (err) err.textContent = 'Required';
    _fieldErrors[id] = 'Required';
    return;
  }

  if (validator) {
    const result = validator(val);
    if (result.valid) {
      if (icon) { icon.textContent = '\u2714'; icon.className = 'pf-field-icon valid'; }
      if (err) err.textContent = '';
      delete _fieldErrors[id];
    } else {
      if (icon) { icon.textContent = '\u2718'; icon.className = 'pf-field-icon invalid'; }
      if (err) err.textContent = result.error || 'Invalid';
      _fieldErrors[id] = result.error || 'Invalid';
    }
  } else {
    if (icon) { icon.textContent = '\u2714'; icon.className = 'pf-field-icon valid'; }
    if (err) err.textContent = '';
    delete _fieldErrors[id];
  }
}

/* ══════════════════════════════════════════════════════════════
   IFSC RAZORPAY LOOKUP
   ══════════════════════════════════════════════════════════════ */

async function _lookupIFSC() {
  const ifscInput = _container && _container.querySelector('#pf-ifsc');
  const bankInput = _container && _container.querySelector('#pf-bankName');
  if (!ifscInput || !bankInput) return;

  const ifsc = ifscInput.value.trim().toUpperCase();
  const result = validateIFSC(ifsc);
  if (!result.valid) return;

  try {
    const response = await fetch('https://ifsc.razorpay.com/' + ifsc);
    if (response.ok) {
      const data = await response.json();
      if (data && data.BANK && data.BRANCH) {
        bankInput.value = data.BANK + ' - ' + data.BRANCH;
        const bankIcon = _container.querySelector('#pf-icon-bankName');
        if (bankIcon) { bankIcon.textContent = '\u2714'; bankIcon.className = 'pf-field-icon valid'; }
        const bankErr = _container.querySelector('#pf-err-bankName');
        if (bankErr) bankErr.textContent = '';
        delete _fieldErrors['bankName'];
        _updateMissingBar();
        _checkSaveable();
      }
    }
  } catch (_e) {
    /* Razorpay lookup failed — user can still fill manually */
  }
}

/* ══════════════════════════════════════════════════════════════
   MISSING FIELDS BAR
   ══════════════════════════════════════════════════════════════ */

function _updateMissingBar() {
  const bar = _container && _container.querySelector('#pfMissing');
  if (!bar) return;

  const labels = {
    phone: 'Phone', pan: 'PAN', aadhaar: 'Aadhaar',
    bankAcc: 'Bank Account', ifsc: 'IFSC', bankName: 'Bank Name',
  };

  const missing = [];
  _requiredFields.forEach(function (id) {
    const input = _container.querySelector('#pf-' + id);
    if (input && !input.value.trim()) {
      missing.push(labels[id] || id);
    }
  });

  if (missing.length > 0) {
    bar.textContent = 'Missing: ' + missing.join(', ');
    bar.classList.remove('complete');
  } else {
    bar.textContent = 'All required fields are filled';
    bar.classList.add('complete');
  }
}

/* ══════════════════════════════════════════════════════════════
   SAVEABLE CHECK
   ══════════════════════════════════════════════════════════════ */

function _checkSaveable() {
  const saveBtn = _container && _container.querySelector('#pfSave');
  const cert = _container && _container.querySelector('#pfCertify');
  if (!saveBtn) return;

  if (_locked) { saveBtn.disabled = true; return; }

  /* All required fields must have values */
  let allFilled = true;
  _requiredFields.forEach(function (id) {
    const input = _container.querySelector('#pf-' + id);
    if (!input || !input.value.trim()) allFilled = false;
  });

  /* Name is always required */
  const nameInput = _container.querySelector('#pf-name');
  if (!nameInput || !nameInput.value.trim()) allFilled = false;

  /* No validation errors */
  const noErrors = Object.keys(_fieldErrors).length === 0;

  /* Certification checked */
  const certified = cert ? cert.checked : false;

  saveBtn.disabled = !allFilled || !noErrors || !certified;
}

/**
 * Public check for testing.
 * @returns {boolean}
 */
export function checkProfileSaveable() {
  _checkSaveable();
  const saveBtn = _container && _container.querySelector('#pfSave');
  return saveBtn ? !saveBtn.disabled : false;
}

/* ══════════════════════════════════════════════════════════════
   SAVE PROFILE
   ══════════════════════════════════════════════════════════════ */

async function _saveProfile() {
  if (_locked) return;

  const fields = {};
  const editableMap = {
    name: 'name', phone: 'phone', emergency: 'emergency_contact',
    parentage: 'parentage', pan: 'pan', aadhaar: 'aadhaar',
    uan: 'uan', bankAcc: 'bank_account', ifsc: 'ifsc', bankName: 'bank_name',
  };

  Object.keys(editableMap).forEach(function (id) {
    const input = _container && _container.querySelector('#pf-' + id);
    if (input) fields[editableMap[id]] = input.value.trim();
  });

  const result = await api.put('/api/profiles/me', fields);
  if (result && result._error) {
    toast(result.message || 'Failed to save profile', 'error');
    return;
  }

  toast('Profile saved successfully', 'success');

  /* Certify — locks profile */
  const certResult = await api.post('/api/profiles/me/certify', {});
  if (certResult && !certResult._error) {
    _locked = true;
    toast('Profile certified and locked', 'info');
    profileRender();
  }
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL (pattern consistency)
   ══════════════════════════════════════════════════════════════ */

export function profileCloseModal() {
  /* Profile does not use a modal — no-op for pattern compliance */
}

/* ══════════════════════════════════════════════════════════════
   UTILITY
   ══════════════════════════════════════════════════════════════ */

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

/* ══════════════════════════════════════════════════════════════
   TEST HELPERS
   ══════════════════════════════════════════════════════════════ */

export function _getProfile() { return _profile; }
export function _setProfile(p) { _profile = p; }
export function _isLocked() { return _locked; }
export function _setLocked(v) { _locked = v; }
export function _getFieldErrors() { return Object.assign({}, _fieldErrors); }

export function _resetState() {
  _profile = null;
  _locked = false;
  _container = null;
  _fieldErrors = {};
}

/* ── Register with router ── */
registerModule('profile', renderProfilePage);

/**
 * modules/capture_admin/capture_admin.js
 * Enrolments, devices, consent status, modality health — replaces face/iris stubs.
 * Pattern: renderCaptureAdminPage() → caLoadData() → caRenderStats() → caRender()
 * Never displays raw payload_b64.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { registerModule } from '../../shared/router.js';

/** @type {HTMLElement|null} */
let _container = null;
/** @type {'enrolments'|'devices'|'consent'|'jurisdiction'} */
let _tab = 'enrolments';
let _staffSession = null;
let _studentSession = null;
/** @type {Array<Record<string, unknown>>} */
let _enrolments = [];
let _loadError = '';
let _loading = false;
let _consentOut = '';
/** @type {(() => void)|null} */
let _unbindEvents = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _empty(text, icon) {
  return (
    '<div class="ca-empty"><div class="ca-empty-icon">' +
    (icon || '&#128241;') +
    '</div><div class="ca-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

/** Test helper — reset module state between cases. */
export function _resetState() {
  if (_unbindEvents) {
    _unbindEvents();
    _unbindEvents = null;
  }
  _container = null;
  _tab = 'enrolments';
  _staffSession = null;
  _studentSession = null;
  _enrolments = [];
  _loadError = '';
  _loading = false;
  _consentOut = '';
}

export function renderCaptureAdminPage(container) {
  if (_unbindEvents) {
    _unbindEvents();
    _unbindEvents = null;
  }
  _container = container;
  container.innerHTML =
    '<div class="ca-wrap" id="caWrap">' +
    '<div class="ca-toolbar">' +
    '<div class="ca-title"><span>&#128241;</span> Capture Admin</div>' +
    '<div class="ca-spacer"></div>' +
    '<button type="button" class="ca-btn ghost" data-action="refresh">Refresh</button>' +
    '</div>' +
    '<p class="ca-note">Template-only capture. Raw biometrics never leave the device. Azure Face/iris paths are frozen.</p>' +
    '<div class="ca-stats" id="caStats"></div>' +
    '<div class="ca-tabs" id="caTabs">' +
    '<button type="button" class="ca-tab active" data-tab="enrolments">Enrolments</button>' +
    '<button type="button" class="ca-tab" data-tab="devices">Devices</button>' +
    '<button type="button" class="ca-tab" data-tab="consent">Consent</button>' +
    '<button type="button" class="ca-tab" data-tab="jurisdiction">Jurisdiction</button>' +
    '</div>' +
    '<div id="caContent"></div>' +
    '</div>';

  container.addEventListener('click', _onClick);
  _unbindEvents = function () {
    container.removeEventListener('click', _onClick);
  };

  caLoadData();
}

function _syncTabs() {
  if (!_container) return;
  _container.querySelectorAll('.ca-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

async function caLoadData() {
  if (!_container) return;
  _loading = true;
  _loadError = '';
  const content = _container.querySelector('#caContent');
  if (content && !_enrolments.length && !_staffSession) {
    content.innerHTML = '<div class="ca-loading">Loading capture data…</div>';
  }

  try {
    const [staff, student, enrolRes] = await Promise.all([
      api.get('/api/capture/session-token?subject_type=staff'),
      api.get('/api/capture/session-token?subject_type=student'),
      api.get('/api/capture/enrolments'),
    ]);

    if (staff && staff._error) {
      _loadError = staff.message || staff.error || 'Failed to load capture session';
      _staffSession = null;
      _studentSession = null;
      _enrolments = [];
    } else {
      _staffSession = staff || null;
      _studentSession = student && !student._error ? student : null;
      _enrolments =
        enrolRes && !enrolRes._error && Array.isArray(enrolRes.enrolments)
          ? enrolRes.enrolments
          : [];
      if (enrolRes && enrolRes._error) {
        _loadError = enrolRes.message || enrolRes.error || 'Failed to load enrolments';
      }
    }
  } catch (err) {
    _loadError = err && err.message ? err.message : 'Failed to load capture data';
    _staffSession = null;
    _studentSession = null;
    _enrolments = [];
  }

  _loading = false;
  caRenderStats();
  caRender();
}

function caRenderStats() {
  if (!_container) return;
  const el = _container.querySelector('#caStats');
  if (!el) return;

  if (!_staffSession) {
    el.innerHTML =
      '<div class="ca-stat"><div class="ca-stat-num">—</div><div class="ca-stat-label">Staff Modalities</div></div>' +
      '<div class="ca-stat"><div class="ca-stat-num">—</div><div class="ca-stat-label">Student Modalities</div></div>' +
      '<div class="ca-stat"><div class="ca-stat-num">—</div><div class="ca-stat-label">Roll Call</div></div>';
    return;
  }

  const staffMods = ((_staffSession.available_modalities) || []).join(', ') || 'none';
  const studentMods =
    ((_studentSession && _studentSession.available_modalities) || []).join(', ') || 'none';
  const rollCall = _staffSession.roll_call ? 'yes' : 'no';

  el.innerHTML =
    '<div class="ca-stat"><div class="ca-stat-num" style="color:var(--accent)">' +
    _esc(staffMods) +
    '</div><div class="ca-stat-label">Staff Modalities</div></div>' +
    '<div class="ca-stat"><div class="ca-stat-num" style="color:var(--status-in)">' +
    _esc(studentMods) +
    '</div><div class="ca-stat-label">Student Modalities</div></div>' +
    '<div class="ca-stat"><div class="ca-stat-num">' +
    _esc(rollCall) +
    '</div><div class="ca-stat-label">Roll Call</div></div>';
}

/** True when session loaded but plan/gates yield no capture modalities. */
function _noModalitiesEntitled() {
  if (!_staffSession) return false;
  const staff = (_staffSession.available_modalities || []).length;
  const student =
    _studentSession && Array.isArray(_studentSession.available_modalities)
      ? _studentSession.available_modalities.length
      : 0;
  return staff === 0 && student === 0;
}

function _entitlementBanner() {
  if (!_noModalitiesEntitled()) return '';
  return (
    '<div class="ca-banner" role="status">' +
    '<div class="ca-banner-title">No capture modalities on this plan</div>' +
    '<p>Staff/student modality counters show <strong>none</strong> when the tenant has no entitlement, or the plan omits capture modules (starting with <code>capture_qr</code>). Roll call needs <code>school_roll_call</code> or jurisdiction vertical set to school. This is plan gating, not a service outage.</p>' +
    '</div>'
  );
}

function caRender() {
  if (!_container) return;
  _syncTabs();
  const el = _container.querySelector('#caContent');
  if (!el) return;

  if (_loading && !_staffSession) {
    el.innerHTML = '<div class="ca-loading">Loading capture data…</div>';
    return;
  }

  if (_loadError && !_staffSession) {
    el.innerHTML =
      '<div class="ca-service-error" role="alert">' +
      '<div class="ca-banner-title">Capture service unavailable</div>' +
      '<p>' +
      _esc(_loadError) +
      '</p>' +
      '<button type="button" class="ca-btn" data-action="refresh">Retry</button>' +
      '</div>';
    return;
  }

  const banner = _entitlementBanner();
  const enrolError =
    _loadError && _staffSession
      ? '<div class="ca-banner ca-banner-warn" role="alert">' +
        _esc(_loadError) +
        '</div>'
      : '';

  if (_tab === 'enrolments') el.innerHTML = banner + enrolError + _renderEnrolments();
  else if (_tab === 'devices') el.innerHTML = banner + _renderDevices();
  else if (_tab === 'consent') el.innerHTML = banner + _renderConsent();
  else el.innerHTML = banner + _renderJurisdiction();
}

function _renderEnrolments() {
  let tableHtml;
  if (!_enrolments.length) {
    tableHtml = _empty('No enrolments yet. Enrol a QR card below.', '&#128196;');
  } else {
    tableHtml =
      '<div class="ca-table-wrap"><table class="ca-table"><thead><tr>' +
      '<th>Subject</th><th>Type</th><th>Modality</th><th>Algo</th><th>Consent</th><th></th>' +
      '</tr></thead><tbody>' +
      _enrolments
        .map(function (e) {
          const id = e.id;
          const subject = e.subjectRef || e.subject_ref || '';
          return (
            '<tr><td>' +
            _esc(subject) +
            '</td><td>' +
            _esc(e.subjectType || e.subject_type) +
            '</td><td>' +
            _esc(e.modality) +
            '</td><td>' +
            _esc(e.algo) +
            '</td><td>' +
            _esc(e.consentRef || e.consent_ref || '—') +
            '</td><td><button type="button" class="ca-btn ghost danger" data-action="revoke" data-id="' +
            _esc(id) +
            '" data-subject="' +
            _esc(subject) +
            '">Revoke</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  return (
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">QR enrol</div>' +
    '<p class="ca-panel-sub">Identifier only — payload is hashed on the device. Never store raw biometrics here.</p>' +
    '<div class="ca-grid">' +
    '<div class="ca-field"><label>Subject ref *</label><input id="caSubj" placeholder="e.g. emp_42 or stu_101" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>Subject type</label><select id="caSubjType"><option value="staff">Staff</option><option value="student">Student</option><option value="visitor">Visitor</option></select></div>' +
    '<div class="ca-field full"><label>Card id or payload *</label><input id="caQr" placeholder="Card id or base64 payload" autocomplete="off" /></div>' +
    '</div>' +
    '<div class="ca-form-actions">' +
    '<button type="button" class="ca-btn ghost" data-action="temp-qr">Lost card → temp QR</button>' +
    '<button type="button" class="ca-btn" data-action="enrol-qr">Enrol QR</button>' +
    '</div>' +
    '</div>' +
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">Enrolments</div>' +
    tableHtml +
    '</div>'
  );
}

function _renderDevices() {
  return (
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">Register device</div>' +
    '<p class="ca-panel-sub">Register a capture device and its capabilities. Device listing is not available yet.</p>' +
    '<div class="ca-grid">' +
    '<div class="ca-field"><label>Device id *</label><input id="devId" placeholder="e.g. kiosk-front-desk" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>Name *</label><input id="devName" placeholder="Front desk kiosk" autocomplete="off" /></div>' +
    '<div class="ca-field full"><label>Capabilities</label>' +
    '<div class="ca-check-row">' +
    '<label class="ca-check"><input type="checkbox" id="capNfc" /> NFC</label>' +
    '<label class="ca-check"><input type="checkbox" id="capOtg" /> OTG fingerprint</label>' +
    '<label class="ca-check"><input type="checkbox" id="capQr" checked /> Camera QR</label>' +
    '<label class="ca-check"><input type="checkbox" id="capFace" /> Camera face</label>' +
    '<label class="ca-check"><input type="checkbox" id="capBus" /> Bus RFID</label>' +
    '</div></div>' +
    '</div>' +
    '<div class="ca-form-actions">' +
    '<button type="button" class="ca-btn" data-action="register-device">Register</button>' +
    '</div>' +
    '</div>' +
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">Android capture</div>' +
    '<p class="ca-panel-sub">Student fingerprint requires module <code>capture_fingerprint_students</code>, DPIA on file, guardian consent, and dual finger_slot. Staff uses <code>capture_fingerprint_staff</code>.</p>' +
    '<div class="ca-form-actions">' +
    '<button type="button" class="ca-btn" data-action="open-app">Open Android capture</button>' +
    '</div>' +
    '</div>'
  );
}

function _renderConsent() {
  return (
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">Consent artefact</div>' +
    '<p class="ca-panel-sub">Create a consent record before enrolling biometric modalities. Required for students with a guardian reference.</p>' +
    '<div class="ca-grid">' +
    '<div class="ca-field"><label>Subject ref *</label><input id="cnsSubj" placeholder="e.g. stu_101" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>Modality</label><select id="cnsMod"><option value="fingerprint">Fingerprint</option><option value="face">Face</option><option value="iris">Iris</option></select></div>' +
    '<div class="ca-field"><label>Guardian ref</label><input id="cnsGuardian" placeholder="Required for students" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>DPIA ref</label><input id="cnsDpia" placeholder="dpia_…" autocomplete="off" /></div>' +
    '<div class="ca-field full"><label class="ca-check"><input type="checkbox" id="cnsAlt" checked /> Non-detrimental alternative acknowledged</label></div>' +
    '</div>' +
    '<div class="ca-form-actions">' +
    '<button type="button" class="ca-btn" data-action="create-consent">Create consent</button>' +
    '</div>' +
    (_consentOut
      ? '<div class="ca-mono" id="caConsentOut">' + _esc(_consentOut) + '</div>'
      : '<div id="caConsentOut"></div>') +
    '</div>'
  );
}

function _renderJurisdiction() {
  const j = (_staffSession && _staffSession.jurisdiction) || {};
  const country = j.country || 'IN';
  const vertical = j.vertical || 'hr';
  const faceAdults = !!(j.faceAdultsEnabled || j.face_adults_enabled);
  const dpia = j.faceStudentsDpiaRef || j.face_students_dpia_ref || '';
  const retention = j.retentionDays || j.retention_days || 365;

  return (
    '<div class="ca-panel">' +
    '<div class="ca-panel-title">Jurisdiction</div>' +
    '<p class="ca-panel-sub">Face/iris geo-blocked when country is EU/UK or US BIPA/CUBI states. Emotion APIs: never. Capture vertical is scoped to this module and does not change the workspace type.</p>' +
    '<div class="ca-grid">' +
    '<div class="ca-field"><label>Country</label><input id="caCountry" maxlength="4" value="' +
    _esc(country) +
    '" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>Capture vertical</label><select id="caVertical"><option value="hr"' +
    (vertical === 'hr' ? ' selected' : '') +
    '>HR</option><option value="school"' +
    (vertical === 'school' ? ' selected' : '') +
    '>School</option></select></div>' +
    '<div class="ca-field"><label>Student DPIA ref</label><input id="caDpia" placeholder="dpia_…" value="' +
    _esc(dpia) +
    '" autocomplete="off" /></div>' +
    '<div class="ca-field"><label>Retention days</label><input id="caRetention" type="number" min="30" value="' +
    _esc(String(retention)) +
    '" /></div>' +
    '<div class="ca-field full"><label class="ca-check"><input type="checkbox" id="caFaceAdults"' +
    (faceAdults ? ' checked' : '') +
    ' /> Face adults (India tenants)</label></div>' +
    '</div>' +
    '<div class="ca-form-actions">' +
    '<button type="button" class="ca-btn ghost danger" data-action="purge">Run retention purge</button>' +
    '<button type="button" class="ca-btn" data-action="save-juris">Save</button>' +
    '</div>' +
    '</div>'
  );
}

async function _onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab && tab.classList.contains('ca-tab')) {
    _tab = /** @type {'enrolments'|'devices'|'consent'|'jurisdiction'} */ (
      tab.dataset.tab || 'enrolments'
    );
    caRender();
    return;
  }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.getAttribute('data-action');

  if (action === 'refresh') {
    await caLoadData();
    return;
  }
  if (action === 'enrol-qr') {
    await enrolQr();
    return;
  }
  if (action === 'temp-qr') {
    await tempQr();
    return;
  }
  if (action === 'revoke') {
    await revokeEnrolment(
      actionEl.getAttribute('data-id') || '',
      actionEl.getAttribute('data-subject') || '',
    );
    return;
  }
  if (action === 'register-device') {
    await registerDevice();
    return;
  }
  if (action === 'open-app') {
    window.location.href = 'intent://capture#Intent;scheme=blokhr;package=com.blokhr.capture;end';
    return;
  }
  if (action === 'create-consent') {
    await createConsent();
    return;
  }
  if (action === 'save-juris') {
    await saveJuris();
    return;
  }
  if (action === 'purge') {
    await purge();
  }
}

function _val(sel) {
  const el = _container && _container.querySelector(sel);
  return el && typeof el.value === 'string' ? el.value.trim() : '';
}

function _checked(sel) {
  const el = _container && _container.querySelector(sel);
  return !!(el && el.checked);
}

async function saveJuris() {
  if (!_container) return;
  const res = await api.put('/api/capture/jurisdiction', {
    country: _val('#caCountry'),
    vertical: _val('#caVertical') || 'hr',
    face_adults_enabled: _checked('#caFaceAdults'),
    face_students_dpia_ref: _val('#caDpia'),
    retention_days: Number(_val('#caRetention')) || 365,
  });
  if (res && !res._error) {
    toast('Jurisdiction saved', 'success');
    await caLoadData();
  } else toast((res && (res.error || res.message)) || 'Failed', 'error');
}

async function enrolQr() {
  if (!_container) return;
  const subject = _val('#caSubj');
  const raw = _val('#caQr');
  if (!subject || !raw) {
    toast('Subject ref and card id required', 'error');
    return;
  }
  const payload_b64 = /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 12 ? raw : btoa(raw);
  const res = await api.post('/api/capture/enrolments', {
    subject_ref: subject,
    subject_type: _val('#caSubjType') || 'staff',
    modality: 'qr',
    payload_b64,
  });
  if (res && res.success) {
    toast('QR enrolled', 'success');
    await caLoadData();
  } else toast((res && (res.error || res.message)) || 'Enrol failed', 'error');
}

async function tempQr() {
  if (!_container) return;
  const subject = _val('#caSubj');
  if (!subject) {
    toast('Subject ref required', 'error');
    return;
  }
  const res = await api.post('/api/capture/temporary-qr', {
    subject_ref: subject,
    subject_type: _val('#caSubjType') || 'staff',
  });
  if (res && res.success) {
    toast('Temp QR issued (show payload to teacher)', 'success');
    const qr = _container.querySelector('#caQr');
    if (qr) qr.value = res.payloadB64 || res.payload_b64 || '';
    await caLoadData();
  } else toast((res && (res.error || res.message)) || 'Failed', 'error');
}

async function revokeEnrolment(id, subject) {
  if (!id) return;
  const ok = await confirmDialog({
    title: 'Revoke enrolment',
    message:
      'Revoke enrolment for ' +
      (subject || id) +
      '? The template will be deactivated and cannot be used for capture.',
    confirmLabel: 'Revoke',
    cancelLabel: 'Cancel',
    danger: true,
  });
  if (!ok) return;
  const r = await api.delete('/api/capture/enrolments/' + encodeURIComponent(id));
  if (r && r.success) {
    toast('Revoked', 'success');
    await caLoadData();
  } else toast((r && (r.error || r.message)) || 'Revoke failed', 'error');
}

async function createConsent() {
  if (!_container) return;
  const guardian = _val('#cnsGuardian');
  const dpia = _val('#cnsDpia');
  const res = await api.post('/api/consent/consents', {
    subject_ref: _val('#cnsSubj'),
    modality: _val('#cnsMod') || 'fingerprint',
    legal_basis: 'employment_or_guardian_consent',
    guardian_ref: guardian || undefined,
    dpia_ref: dpia || undefined,
    alternative_acknowledged: _checked('#cnsAlt'),
  });
  if (res && res.success && res.consent) {
    _consentOut = 'consent_ref: ' + res.consent.id;
    toast('Consent created', 'success');
    caRender();
  } else toast((res && (res.error || res.message)) || 'Consent failed', 'error');
}

async function registerDevice() {
  if (!_container) return;
  const caps = [];
  if (_checked('#capNfc')) caps.push('nfc');
  if (_checked('#capOtg')) caps.push('otg_fingerprint');
  if (_checked('#capQr')) caps.push('camera_qr');
  if (_checked('#capFace')) caps.push('camera_face');
  if (_checked('#capBus')) caps.push('bus_rfid');
  const id = _val('#devId');
  const name = _val('#devName');
  if (!id || !name) {
    toast('Device id and name required', 'error');
    return;
  }
  const res = await api.post('/api/capture/devices', {
    id,
    name,
    capabilities: caps,
  });
  if (res && res.success) toast('Device registered', 'success');
  else toast((res && (res.error || res.message)) || 'Failed', 'error');
}

async function purge() {
  const ok = await confirmDialog({
    title: 'Run retention purge',
    message:
      'Permanently delete expired capture templates past the retention window? This cannot be undone.',
    confirmLabel: 'Purge',
    cancelLabel: 'Cancel',
    danger: true,
  });
  if (!ok) return;
  const res = await api.post('/api/capture/retention/purge', {});
  if (res && !res._error) toast('Purged ' + (res.purged || 0), 'success');
  else toast((res && (res.error || res.message)) || 'Purge failed', 'error');
}

registerModule('capture_admin', renderCaptureAdminPage);

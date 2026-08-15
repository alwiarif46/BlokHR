/**
 * modules/capture_admin/capture_admin.js
 * Enrolments, devices, consent status, modality health — replaces face/iris stubs.
 * Never displays raw payload_b64.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function renderCaptureAdminPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ca-wrap">' +
      '<div class="ca-title">Capture admin</div>' +
      '<p class="ca-sub">Template-only capture. Raw biometrics never leave the device. Azure Face/iris paths are frozen.</p>' +
      '<div class="ca-grid" id="caSession"></div>' +
      '<div class="ca-section">' +
        '<h3>Jurisdiction</h3>' +
        '<div id="caJuris"></div>' +
        '<div class="ca-row">' +
          '<label>Country <input id="caCountry" maxlength="4" /></label>' +
          '<label>Vertical <select id="caVertical"><option value="hr">HR</option><option value="school">School</option></select></label>' +
          '<label><input type="checkbox" id="caFaceAdults" /> Face adults (India tenants)</label>' +
          '<label>Student DPIA ref <input id="caDpia" placeholder="dpia_…" /></label>' +
          '<label>Retention days <input id="caRetention" type="number" min="30" /></label>' +
          '<button type="button" class="ca-btn" id="caSaveJuris">Save</button>' +
        '</div>' +
      '</div>' +
      '<div class="ca-section">' +
        '<h3>QR enrol (identifier only)</h3>' +
        '<div class="ca-row">' +
          '<input id="caSubj" placeholder="subject_ref" />' +
          '<select id="caSubjType"><option value="staff">staff</option><option value="student">student</option><option value="visitor">visitor</option></select>' +
          '<input id="caQr" placeholder="card id or base64 payload" />' +
          '<button type="button" class="ca-btn" id="caEnrolQr">Enrol QR</button>' +
          '<button type="button" class="ca-btn ghost" id="caTempQr">Lost card → temp QR</button>' +
        '</div>' +
      '</div>' +
      '<div class="ca-section">' +
        '<h3>Consent artefact</h3>' +
        '<div class="ca-row">' +
          '<input id="cnsSubj" placeholder="subject_ref" />' +
          '<select id="cnsMod"><option value="fingerprint">fingerprint</option><option value="face">face</option><option value="iris">iris</option></select>' +
          '<input id="cnsGuardian" placeholder="guardian_ref (students)" />' +
          '<input id="cnsDpia" placeholder="dpia_ref" />' +
          '<label><input type="checkbox" id="cnsAlt" checked /> Non-detrimental alternative ack</label>' +
          '<button type="button" class="ca-btn" id="caConsent">Create consent</button>' +
        '</div>' +
        '<div id="caConsentOut" class="ca-mono"></div>' +
      '</div>' +
      '<div class="ca-section">' +
        '<h3>Register device</h3>' +
        '<div class="ca-row">' +
          '<input id="devId" placeholder="device id" />' +
          '<input id="devName" placeholder="name" />' +
          '<label><input type="checkbox" id="capNfc" /> nfc</label>' +
          '<label><input type="checkbox" id="capOtg" /> otg_fingerprint</label>' +
          '<label><input type="checkbox" id="capQr" checked /> camera_qr</label>' +
          '<label><input type="checkbox" id="capFace" /> camera_face</label>' +
          '<label><input type="checkbox" id="capBus" /> bus_rfid</label>' +
          '<button type="button" class="ca-btn" id="caDev">Register</button>' +
        '</div>' +
      '</div>' +
      '<div class="ca-section">' +
        '<h3>Enrolments <button type="button" class="ca-btn ghost" id="caRefresh">Refresh</button> <button type="button" class="ca-btn ghost" id="caPurge">Run retention purge</button></h3>' +
        '<div id="caEnrolList"></div>' +
      '</div>' +
      '<div class="ca-section">' +
        '<h3>Open Android capture</h3>' +
        '<button type="button" class="ca-btn" id="caOpenApp">intent:// blokhr-capture</button>' +
        '<p class="ca-sub">Student fingerprint requires module <code>capture_fingerprint_students</code>, DPIA on file, guardian consent, and dual finger_slot. Staff uses <code>capture_fingerprint_staff</code>.</p>' +
      '</div>' +
    '</div>';

  container.querySelector('#caSaveJuris').addEventListener('click', saveJuris);
  container.querySelector('#caEnrolQr').addEventListener('click', enrolQr);
  container.querySelector('#caTempQr').addEventListener('click', tempQr);
  container.querySelector('#caConsent').addEventListener('click', createConsent);
  container.querySelector('#caDev').addEventListener('click', registerDevice);
  container.querySelector('#caRefresh').addEventListener('click', loadEnrolments);
  container.querySelector('#caPurge').addEventListener('click', purge);
  container.querySelector('#caOpenApp').addEventListener('click', () => {
    window.location.href = 'intent://capture#Intent;scheme=blokhr;package=com.blokhr.capture;end';
  });

  boot();
}

async function boot() {
  const staff = await api.get('/api/capture/session-token?subject_type=staff');
  const student = await api.get('/api/capture/session-token?subject_type=student');
  const el = _container.querySelector('#caSession');
  el.innerHTML =
    '<div class="ca-card"><div class="ca-k">Staff modalities</div><div class="ca-v">' +
    _esc(((staff && staff.available_modalities) || []).join(', ') || 'none') +
    '</div></div>' +
    '<div class="ca-card"><div class="ca-k">Student modalities</div><div class="ca-v">' +
    _esc(((student && student.available_modalities) || []).join(', ') || 'none') +
    '</div></div>' +
    '<div class="ca-card"><div class="ca-k">Roll call</div><div class="ca-v">' +
    (staff && staff.roll_call ? 'yes' : 'no') +
    '</div></div>';

  const j = (staff && staff.jurisdiction) || {};
  _container.querySelector('#caCountry').value = j.country || 'IN';
  _container.querySelector('#caVertical').value = j.vertical || 'hr';
  _container.querySelector('#caFaceAdults').checked = !!j.faceAdultsEnabled || !!j.face_adults_enabled;
  _container.querySelector('#caDpia').value = j.faceStudentsDpiaRef || j.face_students_dpia_ref || '';
  _container.querySelector('#caRetention').value = j.retentionDays || j.retention_days || 365;
  _container.querySelector('#caJuris').textContent =
    'Face/iris geo-blocked when country is EU/UK or US BIPA/CUBI states. Emotion APIs: never.';

  await loadEnrolments();
}

async function saveJuris() {
  const res = await api.put('/api/capture/jurisdiction', {
    country: _container.querySelector('#caCountry').value.trim(),
    vertical: _container.querySelector('#caVertical').value,
    face_adults_enabled: _container.querySelector('#caFaceAdults').checked,
    face_students_dpia_ref: _container.querySelector('#caDpia').value.trim(),
    retention_days: Number(_container.querySelector('#caRetention').value) || 365,
  });
  if (res && !res._error) {
    toast('Jurisdiction saved', 'success');
    boot();
  } else toast((res && res.error) || 'Failed', 'error');
}

async function enrolQr() {
  const subject = _container.querySelector('#caSubj').value.trim();
  const raw = _container.querySelector('#caQr').value.trim();
  if (!subject || !raw) {
    toast('subject_ref and card id required', 'error');
    return;
  }
  const payload_b64 = /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 12 ? raw : btoa(raw);
  const res = await api.post('/api/capture/enrolments', {
    subject_ref: subject,
    subject_type: _container.querySelector('#caSubjType').value,
    modality: 'qr',
    payload_b64,
  });
  if (res && res.success) {
    toast('QR enrolled', 'success');
    loadEnrolments();
  } else toast((res && res.error) || 'Enrol failed', 'error');
}

async function tempQr() {
  const subject = _container.querySelector('#caSubj').value.trim();
  if (!subject) {
    toast('subject_ref required', 'error');
    return;
  }
  const res = await api.post('/api/capture/temporary-qr', {
    subject_ref: subject,
    subject_type: _container.querySelector('#caSubjType').value,
  });
  if (res && res.success) {
    toast('Temp QR issued (show payload to teacher)', 'success');
    _container.querySelector('#caQr').value = res.payloadB64 || res.payload_b64 || '';
    loadEnrolments();
  } else toast((res && res.error) || 'Failed', 'error');
}

async function createConsent() {
  const res = await api.post('/api/consent/consents', {
    subject_ref: _container.querySelector('#cnsSubj').value.trim(),
    modality: _container.querySelector('#cnsMod').value,
    legal_basis: 'employment_or_guardian_consent',
    guardian_ref: _container.querySelector('#cnsGuardian').value.trim() || undefined,
    dpia_ref: _container.querySelector('#cnsDpia').value.trim() || undefined,
    alternative_acknowledged: _container.querySelector('#cnsAlt').checked,
  });
  if (res && res.success && res.consent) {
    const id = res.consent.id;
    _container.querySelector('#caConsentOut').textContent = 'consent_ref: ' + id;
    toast('Consent created', 'success');
  } else toast((res && res.error) || 'Consent failed', 'error');
}

async function registerDevice() {
  const caps = [];
  if (_container.querySelector('#capNfc').checked) caps.push('nfc');
  if (_container.querySelector('#capOtg').checked) caps.push('otg_fingerprint');
  if (_container.querySelector('#capQr').checked) caps.push('camera_qr');
  if (_container.querySelector('#capFace').checked) caps.push('camera_face');
  if (_container.querySelector('#capBus').checked) caps.push('bus_rfid');
  const res = await api.post('/api/capture/devices', {
    id: _container.querySelector('#devId').value.trim(),
    name: _container.querySelector('#devName').value.trim(),
    capabilities: caps,
  });
  if (res && res.success) toast('Device registered', 'success');
  else toast((res && res.error) || 'Failed', 'error');
}

async function loadEnrolments() {
  const res = await api.get('/api/capture/enrolments');
  const list = (res && !res._error && res.enrolments) || [];
  const el = _container.querySelector('#caEnrolList');
  if (!list.length) {
    el.innerHTML = '<div class="ca-sub">No enrolments</div>';
    return;
  }
  el.innerHTML =
    '<table class="ca-table"><thead><tr><th>Subject</th><th>Type</th><th>Modality</th><th>Algo</th><th>Consent</th><th></th></tr></thead><tbody>' +
    list
      .map(
        (e) =>
          '<tr><td>' +
          _esc(e.subjectRef || e.subject_ref) +
          '</td><td>' +
          _esc(e.subjectType || e.subject_type) +
          '</td><td>' +
          _esc(e.modality) +
          '</td><td>' +
          _esc(e.algo) +
          '</td><td>' +
          _esc(e.consentRef || e.consent_ref || '—') +
          '</td><td><button type="button" data-revoke="' +
          _esc(e.id) +
          '" class="ca-btn ghost">Revoke</button></td></tr>',
      )
      .join('') +
    '</tbody></table>';
  el.querySelectorAll('[data-revoke]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-revoke');
      const r = await api.delete('/api/capture/enrolments/' + encodeURIComponent(id));
      if (r && r.success) {
        toast('Revoked', 'success');
        loadEnrolments();
      } else toast((r && r.error) || 'Revoke failed', 'error');
    });
  });
}

async function purge() {
  const res = await api.post('/api/capture/retention/purge', {});
  if (res && !res._error) toast('Purged ' + (res.purged || 0), 'success');
  else toast('Purge failed', 'error');
}

registerModule('capture_admin', renderCaptureAdminPage);

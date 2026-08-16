/**
 * modules/school_register/school_register.js
 * Offline-first school roll call. Never blocked by capture hardware.
 * QR is teacher-scans-card only (K-12). Hardware NFC opens blokhr-capture.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

const PENDING_KEY = 'blokhr_school_pending_marks';

let _container = null;
let _classes = [];
let _classId = '';
let _periods = [];
let _periodId = '';
let _roster = [];
let _marks = {};
let _modalities = [];
let _rollCall = true;
let _pending = loadPending();

function loadPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePending() {
  localStorage.setItem(PENDING_KEY, JSON.stringify(_pending));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function idem() {
  return 'mk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function renderSchoolRegisterPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="sr-wrap">' +
      '<div class="sr-toolbar">' +
        '<div class="sr-title">School register</div>' +
        '<div class="sr-spacer"></div>' +
        '<div class="sr-badge" id="srPending">0 pending sync</div>' +
        '<button type="button" class="sr-btn" id="srSync">Sync now</button>' +
        '<button type="button" class="sr-btn ghost" id="srQr">Scan QR card</button>' +
        '<button type="button" class="sr-btn ghost" id="srNfc" style="display:none">Open capture app (NFC)</button>' +
        '<button type="button" class="sr-btn ghost" id="srFp" style="display:none">Open capture app (fingerprint)</button>' +
      '</div>' +
      '<div class="sr-controls">' +
        '<label>Class <select id="srClass"></select></label>' +
        '<label>Period <select id="srPeriod"></select></label>' +
        '<button type="button" class="sr-btn" id="srNewPeriod">New period</button>' +
        '<button type="button" class="sr-btn ghost" id="srNewClass">New class</button>' +
      '</div>' +
      '<div class="sr-hint" id="srHint">Capture-side register. For period photo roll call, open <strong>Roll Call</strong> in the School menu.</div>' +
      '<div class="sr-roster" id="srRoster"></div>' +
    '</div>';

  container.querySelector('#srSync').addEventListener('click', syncPending);
  container.querySelector('#srQr').addEventListener('click', scanQrCard);
  container.querySelector('#srNfc').addEventListener('click', openCaptureApp);
  container.querySelector('#srFp').addEventListener('click', openFingerprintApp);
  container.querySelector('#srClass').addEventListener('change', onClassChange);
  container.querySelector('#srPeriod').addEventListener('change', onPeriodChange);
  container.querySelector('#srNewPeriod').addEventListener('click', createPeriod);
  container.querySelector('#srNewClass').addEventListener('click', createClass);

  boot();
}

async function boot() {
  updatePendingBadge();
  const token = await api.get('/api/capture/session-token?subject_type=student');
  if (token && !token._error) {
    _modalities = token.available_modalities || [];
    _rollCall = !!token.roll_call;
    const nfcBtn = _container.querySelector('#srNfc');
    if (nfcBtn && _modalities.includes('nfc')) nfcBtn.style.display = '';
    const fpBtn = _container.querySelector('#srFp');
    if (fpBtn && _modalities.includes('fingerprint')) fpBtn.style.display = '';
  }
  if (!_rollCall) {
    const hint = _container.querySelector('#srHint');
    hint.classList.add('warn');
    hint.textContent =
      'school_roll_call not entitled for capture. Use School → Roll Call for period marking, or contact your admin.';
  }
  await refreshClasses();
  await syncPending();
}

async function refreshClasses() {
  const res = await api.get('/api/school-attendance/classes');
  _classes = (res && !res._error && res.classes) || [];
  const sel = _container.querySelector('#srClass');
  sel.innerHTML = _classes
    .map((c) => '<option value="' + _esc(c.id) + '">' + _esc(c.name) + '</option>')
    .join('');
  if (!_classes.length) {
    _container.querySelector('#srRoster').innerHTML =
      '<div class="sr-empty">Create a class to start roll call.</div>';
    return;
  }
  _classId = _classes[0].id;
  sel.value = _classId;
  await onClassChange();
}

async function onClassChange() {
  const sel = _container.querySelector('#srClass');
  _classId = sel.value;
  const today = new Date().toISOString().slice(0, 10);
  const bundle = await api.get(
    '/api/school-attendance/classes/' + encodeURIComponent(_classId) + '/offline-bundle?date=' + today,
  );
  if (bundle && !bundle._error) {
    _roster = bundle.roster || [];
    _periods = bundle.periods || [];
    cacheOffline(bundle);
  } else {
    const cached = readCache(_classId, today);
    _roster = (cached && cached.roster) || [];
    _periods = (cached && cached.periods) || [];
  }
  const psel = _container.querySelector('#srPeriod');
  psel.innerHTML = _periods
    .map((p) => '<option value="' + _esc(p.id) + '">' + _esc(p.label || p.id) + '</option>')
    .join('');
  if (_periods.length) {
    _periodId = _periods[0].id;
    psel.value = _periodId;
  } else {
    _periodId = '';
  }
  await loadMarks();
  renderRoster();
}

function cacheOffline(bundle) {
  try {
    localStorage.setItem(
      'blokhr_school_cache_' + _classId,
      JSON.stringify({ ...bundle, cachedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

function readCache(classId, date) {
  try {
    const raw = localStorage.getItem('blokhr_school_cache_' + classId);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (date && data.date && data.date !== date) return data;
    return data;
  } catch {
    return null;
  }
}

async function onPeriodChange() {
  _periodId = _container.querySelector('#srPeriod').value;
  await loadMarks();
  renderRoster();
}

async function loadMarks() {
  _marks = {};
  if (!_periodId) return;
  const res = await api.get('/api/school-attendance/periods/' + encodeURIComponent(_periodId) + '/marks');
  const list = (res && !res._error && res.marks) || [];
  list.forEach((m) => {
    _marks[m.subjectRef || m.subject_ref] = m.status;
  });
  _pending
    .filter((p) => p.period_id === _periodId)
    .forEach((p) => {
      _marks[p.subject_ref] = p.status;
    });
}

function renderRoster() {
  const el = _container.querySelector('#srRoster');
  if (!_roster.length) {
    el.innerHTML = '<div class="sr-empty">No students in this class.</div>';
    return;
  }
  el.innerHTML = _roster
    .map((s) => {
      const id = s.id || s.subject_ref;
      const name = s.displayName || s.display_name || id;
      const st = _marks[id] || '';
      return (
        '<div class="sr-row" data-id="' +
        _esc(id) +
        '">' +
        '<div class="sr-name">' +
        _esc(name) +
        '</div>' +
        '<div class="sr-actions">' +
        btn(id, 'present', st) +
        btn(id, 'late', st) +
        btn(id, 'absent', st) +
        '</div></div>'
      );
    })
    .join('');
  el.querySelectorAll('[data-mark]').forEach((b) => {
    b.addEventListener('click', () => markStudent(b.getAttribute('data-id'), b.getAttribute('data-mark')));
  });
}

function btn(id, status, current) {
  const on = current === status ? ' on' : '';
  return (
    '<button type="button" class="sr-mark' +
    on +
    '" data-id="' +
    _esc(id) +
    '" data-mark="' +
    status +
    '">' +
    status +
    '</button>'
  );
}

async function markStudent(subjectRef, status) {
  if (!_periodId) {
    toast('Create a period first', 'error');
    return;
  }
  _marks[subjectRef] = status;
  renderRoster();
  const payload = {
    period_id: _periodId,
    subject_ref: subjectRef,
    status,
    source: 'roll_call',
    idempotency_key: idem(),
  };
  const online = navigator.onLine;
  if (online) {
    const res = await api.post('/api/school-attendance/marks', payload);
    if (res && !res._error && res.success !== false) {
      toast('Saved', 'success');
      return;
    }
  }
  _pending.push(payload);
  savePending();
  updatePendingBadge();
  toast('Saved offline — will sync', 'success');
}

async function syncPending() {
  if (!_pending.length) {
    updatePendingBadge();
    return;
  }
  const batch = _pending.slice();
  const res = await api.post('/api/school-attendance/marks/sync', { marks: batch });
  if (res && !res._error) {
    _pending = [];
    savePending();
    updatePendingBadge();
    toast('Synced ' + batch.length + ' mark(s)', 'success');
    await loadMarks();
    renderRoster();
  }
}

function updatePendingBadge() {
  const el = _container && _container.querySelector('#srPending');
  if (!el) return;
  const n = _pending.length;
  el.textContent = n + ' period mark(s) pending sync';
  el.className = 'sr-badge' + (n ? ' warn' : '');
}

async function createClass() {
  const name = prompt('Class name');
  if (!name || !name.trim()) return;
  const res = await api.post('/api/school-attendance/classes', { name: name.trim() });
  if (res && !res._error) {
    toast('Class created', 'success');
    await refreshClasses();
  } else toast((res && res.error) || 'Failed', 'error');
}

async function createPeriod() {
  if (!_classId) return;
  const label = prompt('Period label', 'Period 1');
  if (!label) return;
  const res = await api.post('/api/school-attendance/classes/' + encodeURIComponent(_classId) + '/periods', {
    label,
    period_date: new Date().toISOString().slice(0, 10),
  });
  if (res && !res._error) {
    toast('Period created', 'success');
    await onClassChange();
  } else toast((res && res.error) || 'Failed', 'error');
}

/** Teacher scans student card QR (never student-scans-screen). */
async function scanQrCard() {
  if (!_modalities.includes('qr')) {
    toast('QR not available for this tenant session', 'error');
    return;
  }
  const raw = prompt('Scan or paste student card QR payload (base64 or raw id)');
  if (!raw) return;
  const payloadB64 = /^[A-Za-z0-9+/=]+$/.test(raw.trim()) && raw.length > 8
    ? raw.trim()
    : btoa(raw.trim());
  const res = await api.post('/api/capture/events', {
    modality: 'qr',
    payload_b64: payloadB64,
    idempotency_key: idem(),
    context: { period_id: _periodId, class_id: _classId },
    subject_type: 'student',
  });
  if (!res || res._error) {
    toast((res && res.error) || 'QR scan failed', 'error');
    return;
  }
  if (res.decision === 'matched') {
    toast('Matched ' + (res.subject_ref || ''), 'success');
    await loadMarks();
    renderRoster();
    return;
  }
  if (res.decision === 'no_match' || res.decision === 'manual_required') {
    const subject = prompt('No match — enter subject_ref for manual override (required)');
    const reason = prompt('Reason for override');
    if (!subject || !reason) {
      toast('Override cancelled — student not marked absent automatically', 'error');
      return;
    }
    const eventId = res.event_id || res.id;
    const ov = await api.post('/api/capture/events/' + encodeURIComponent(eventId) + '/manual-override', {
      subject_ref: subject.trim(),
      reason: reason.trim(),
    });
    if (ov && !ov._error && ov.success) {
      toast('Manual override recorded', 'success');
      await loadMarks();
      renderRoster();
    } else toast((ov && ov.error) || 'Override failed', 'error');
  }
}

function openCaptureApp() {
  const deep =
    'intent://capture/nfc#Intent;scheme=blokhr;package=com.blokhr.capture;S.period_id=' +
    encodeURIComponent(_periodId || '') +
    ';S.class_id=' +
    encodeURIComponent(_classId || '') +
    ';end';
  window.location.href = deep;
  toast('Opening BlokHR Capture for NFC…', 'success');
}

function openFingerprintApp() {
  const deep =
    'intent://capture/fingerprint?subject_type=student#Intent;scheme=blokhr;package=com.blokhr.capture;S.period_id=' +
    encodeURIComponent(_periodId || '') +
    ';S.class_id=' +
    encodeURIComponent(_classId || '') +
    ';end';
  window.location.href = deep;
  toast('Opening BlokHR Capture for student fingerprint…', 'success');
}

registerModule('school_register', renderSchoolRegisterPage);

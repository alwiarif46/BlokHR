/**
 * modules/guardian_portal/guardian_portal.js
 * Parent surface — login, children switch, attendance, report absence, messages.
 * Storage only via shared/session.js (guardian_session). HTTP only via guardianApi.
 */

import { guardianApi, initApi } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { applyBrand, getBrand } from '../../shared/brand.js';
import {
  saveGuardianSession,
  loadGuardianSession,
  clearGuardianSession,
  getGuardianSession,
} from '../../shared/session.js';

/** @type {HTMLElement | null} */
let _root = null;
/** @type {Array<any>} */
let _students = [];
/** @type {string | null} */
let _selectedStudentId = null;
/** @type {Array<any>} */
let _reasonCodes = [];
/** @type {Array<any>} */
let _threads = [];
/** @type {string | null} */
let _activeThreadId = null;
/** @type {Array<any>} */
let _messages = [];
let _viewMonth = '';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function expandDateRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: 'Use YYYY-MM-DD dates' };
  }
  if (to < from) return { error: 'End date must be on or after start' };
  const today = todayIso();
  if (from < today) return { error: 'Start date must be today or later' };
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (out.length > 15) return { error: 'At most 15 dates allowed' };
    const t = Date.parse(cur + 'T00:00:00.000Z') + 86_400_000;
    cur = new Date(t).toISOString().slice(0, 10);
  }
  return { dates: out };
}

function studentLabel(s) {
  const name = [s.firstName || s.first_name, s.lastName || s.last_name]
    .filter(Boolean)
    .join(' ');
  return name || s.admissionNumber || s.admission_number || s.id;
}

function studentMeta(s) {
  const cls = s.classLabel || s.class_label || '';
  const sec = s.section || '';
  return [cls && ('Class ' + cls), sec && ('Sec ' + sec)].filter(Boolean).join(' · ');
}

const SHELL_HTML = `
<header class="gp-header">
  <img id="hdrWordmark" class="gp-wordmark" alt="BlokSchool" />
  <div class="gp-header-actions">
    <button type="button" class="gp-btn ghost" id="gpLogout" hidden>Sign out</button>
  </div>
</header>
<main class="gp-main" id="gpMain"></main>
`;

export async function bootGuardianPortal(container) {
  _root = container;
  applyBrand('school');
  const brand = getBrand('school');
  container.innerHTML = SHELL_HTML;
  const wm = container.querySelector('#hdrWordmark');
  if (wm) {
    wm.setAttribute('src', brand.wordmarkPath);
    wm.setAttribute('alt', brand.name);
  }
  const logout = container.querySelector('#gpLogout');
  if (logout) {
    logout.addEventListener('click', () => {
      clearGuardianSession();
      renderLogin();
    });
  }
  document.addEventListener('blokhr:guardian:auth:expired', () => {
    toast('Session expired — please sign in again', 'error');
    renderLogin();
  });

  const session = loadGuardianSession();
  if (session && session.token) {
    await enterApp();
  } else {
    renderLogin();
  }
}

function mainEl() {
  return _root && _root.querySelector('#gpMain');
}

function setLogoutVisible(on) {
  const btn = _root && _root.querySelector('#gpLogout');
  if (btn) btn.hidden = !on;
}

export function renderLogin() {
  setLogoutVisible(false);
  const main = mainEl();
  if (!main) return;
  const brand = getBrand('school');
  main.innerHTML = `
    <section class="gp-login" data-view="login">
      <h1 id="loginTitle">${brand.name}</h1>
      <p id="loginTagline">${brand.tagline}</p>
      <p id="loginSub">${brand.loginHeading}</p>
      <form id="gpLoginForm">
        <div class="gp-field">
          <label for="gpPhone">Phone</label>
          <input id="gpPhone" name="phone" type="tel" autocomplete="tel" required />
        </div>
        <div class="gp-field">
          <label for="gpPassword">Password</label>
          <input id="gpPassword" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="gp-btn" type="submit" id="gpLoginBtn">Sign in</button>
        <p class="gp-error" id="gpLoginError" hidden></p>
      </form>
    </section>
  `;
  main.querySelector('#gpLoginForm').addEventListener('submit', onLoginSubmit);
}

async function onLoginSubmit(ev) {
  ev.preventDefault();
  const errEl = document.getElementById('gpLoginError');
  const btn = document.getElementById('gpLoginBtn');
  errEl.hidden = true;
  btn.disabled = true;
  const phone = document.getElementById('gpPhone').value.trim();
  const password = document.getElementById('gpPassword').value;
  const res = await guardianApi.post('/guardian/login', { phone, password });
  btn.disabled = false;
  if (res && res._error) {
    const msg =
      res.status === 423
        ? 'Account locked after too many attempts. Try again in 15 minutes.'
        : res.message || 'Sign-in failed';
    errEl.textContent = msg;
    errEl.hidden = false;
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
  toast('Signed in', 'success');
  await enterApp();
}

async function enterApp() {
  setLogoutVisible(true);
  _viewMonth = monthKey();
  await Promise.all([loadStudents(), loadReasonCodes()]);
  if (!_selectedStudentId && _students[0]) {
    _selectedStudentId = _students[0].id;
  }
  await refreshAllPanes();
}

async function loadStudents() {
  const res = await guardianApi.get('/guardian/me/students');
  if (res && res._error) {
    toast(res.message || 'Could not load children', 'error');
    _students = [];
    return;
  }
  _students = res.students || [];
}

async function loadReasonCodes() {
  const res = await guardianApi.get('/guardian/reason-codes');
  if (res && res._error) {
    _reasonCodes = [];
    return;
  }
  _reasonCodes = res.reasonCodes || res.reason_codes || [];
}

/**
 * Instant sibling switch — refreshes every pane without full reload.
 * @param {string} studentId
 */
export async function selectStudent(studentId) {
  _selectedStudentId = studentId;
  _activeThreadId = null;
  _messages = [];
  await refreshAllPanes();
}

export async function refreshAllPanes() {
  const main = mainEl();
  if (!main) return;
  main.innerHTML = `
    <div class="gp-siblings" id="gpSiblings" data-pane="children"></div>
    <div class="gp-panes">
      <section class="gp-pane" data-pane="attendance" id="gpAttendance"></section>
      <section class="gp-pane" data-pane="absence" id="gpAbsence"></section>
      <section class="gp-pane" data-pane="messages" id="gpMessages"></section>
      <section class="gp-pane" data-pane="surveys" id="gpSurveys"></section>
    </div>
  `;
  renderSiblings();
  await Promise.all([
    renderAttendance(),
    renderAbsenceForm(),
    renderMessages(),
    renderSurveys(),
  ]);
}

function renderSiblings() {
  const el = document.getElementById('gpSiblings');
  if (!el) return;
  if (!_students.length) {
    el.innerHTML = '<p>No linked children.</p>';
    return;
  }
  el.innerHTML = _students
    .map((s) => {
      const active = s.id === _selectedStudentId ? ' active' : '';
      return `<button type="button" class="gp-sib${active}" data-student-id="${s.id}">
        <strong>${escapeHtml(studentLabel(s))}</strong>
        <span class="gp-sib-meta">${escapeHtml(studentMeta(s))}</span>
      </button>`;
    })
    .join('');
  el.querySelectorAll('[data-student-id]').forEach((btn) => {
    btn.addEventListener('click', () => selectStudent(btn.getAttribute('data-student-id')));
  });
}

async function renderAttendance() {
  const el = document.getElementById('gpAttendance');
  if (!el) return;
  el.innerHTML = '<h2>Attendance</h2><p>Loading…</p>';
  if (!_selectedStudentId) {
    el.innerHTML = '<h2>Attendance</h2><p>Select a child.</p>';
    return;
  }
  const days = daysInMonth(_viewMonth);
  const from = _viewMonth + '-01';
  const to = _viewMonth + '-' + String(days).padStart(2, '0');
  const ytdFrom = _viewMonth.slice(0, 4) + '-01-01';
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(_selectedStudentId)}/attendance?from=${from}&to=${to}`,
  );
  const ytd = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(_selectedStudentId)}/attendance?from=${ytdFrom}&to=${to}`,
  );
  if (res && res._error) {
    el.innerHTML = `<h2>Attendance</h2><p class="gp-error">${escapeHtml(res.message)}</p>`;
    return;
  }
  const byDate = {};
  (res.records || []).forEach((r) => {
    byDate[r.date] = r.status;
  });
  const eligibility = res.eligibility_pct;
  const ytdPct = ytd && !ytd._error ? ytd.eligibility_pct : null;
  const heads = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    .map((d) => `<div class="gp-day head">${d}</div>`)
    .join('');
  const [y, m] = _viewMonth.split('-').map(Number);
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="gp-day"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = _viewMonth + '-' + String(d).padStart(2, '0');
    const st = (byDate[iso] || '').toLowerCase();
    const cls = st === 'present' ? 'present' : st === 'absent' ? 'absent' : st === 'late' ? 'late' : '';
    cells += `<div class="gp-day ${cls}" title="${iso}">${d}</div>`;
  }
  const chipCls =
    typeof eligibility === 'number' && eligibility >= 75 ? 'ok' : 'warn';
  el.innerHTML = `
    <h2>Attendance <span data-student="${escapeHtml(_selectedStudentId)}"></span></h2>
    <div class="gp-stats">
      <span class="gp-chip" id="gpYtd">YTD ${ytdPct == null ? '—' : ytdPct + '%'}</span>
      <span class="gp-chip ${chipCls}" id="gpElig">Eligibility ${eligibility == null ? '—' : eligibility + '%'}</span>
      <button type="button" class="gp-btn secondary" id="gpPrevMonth">Prev</button>
      <span class="gp-chip">${_viewMonth}</span>
      <button type="button" class="gp-btn secondary" id="gpNextMonth">Next</button>
    </div>
    <div class="gp-month-grid" id="gpMonthGrid">${heads}${cells}</div>
  `;
  document.getElementById('gpPrevMonth').addEventListener('click', async () => {
    const [yy, mm] = _viewMonth.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm - 2, 1));
    _viewMonth = d.toISOString().slice(0, 7);
    await renderAttendance();
  });
  document.getElementById('gpNextMonth').addEventListener('click', async () => {
    const [yy, mm] = _viewMonth.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm, 1));
    _viewMonth = d.toISOString().slice(0, 7);
    await renderAttendance();
  });
}

export function validateAbsenceForm(from, to) {
  return expandDateRange(from, to);
}

async function renderAbsenceForm() {
  const el = document.getElementById('gpAbsence');
  if (!el) return;
  const options = _reasonCodes
    .map(
      (r) =>
        `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label || r.code)}</option>`,
    )
    .join('');
  el.innerHTML = `
    <h2>Report absence</h2>
    <form id="gpAbsenceForm" data-student="${escapeHtml(_selectedStudentId || '')}">
      <div class="gp-field">
        <label for="gpAbsFrom">From</label>
        <input id="gpAbsFrom" type="date" required />
      </div>
      <div class="gp-field">
        <label for="gpAbsTo">To</label>
        <input id="gpAbsTo" type="date" required />
      </div>
      <div class="gp-field">
        <label for="gpAbsReason">Reason</label>
        <select id="gpAbsReason" required>${options}</select>
      </div>
      <div class="gp-field">
        <label for="gpAbsNote">Note (optional)</label>
        <textarea id="gpAbsNote" rows="2"></textarea>
      </div>
      <button class="gp-btn" type="submit">Notify school</button>
      <p class="gp-error" id="gpAbsError" hidden></p>
      <div class="gp-success" id="gpAbsSuccess" hidden>The school has been notified.</div>
    </form>
  `;
  el.querySelector('#gpAbsenceForm').addEventListener('submit', onAbsenceSubmit);
}

async function onAbsenceSubmit(ev) {
  ev.preventDefault();
  const errEl = document.getElementById('gpAbsError');
  const okEl = document.getElementById('gpAbsSuccess');
  errEl.hidden = true;
  okEl.hidden = true;
  const from = document.getElementById('gpAbsFrom').value;
  const to = document.getElementById('gpAbsTo').value;
  const checked = validateAbsenceForm(from, to);
  if (checked.error) {
    errEl.textContent = checked.error;
    errEl.hidden = false;
    toast(checked.error, 'error');
    return;
  }
  if (!_selectedStudentId) {
    errEl.textContent = 'Select a child first';
    errEl.hidden = false;
    return;
  }
  const res = await guardianApi.post('/guardian/reported-absences', {
    student_id: _selectedStudentId,
    dates: checked.dates,
    reason_code_id: document.getElementById('gpAbsReason').value,
    note: document.getElementById('gpAbsNote').value || null,
    channel: 'app',
  });
  if (res && res._error) {
    errEl.textContent = res.message || 'Could not submit';
    errEl.hidden = false;
    toast(errEl.textContent, 'error');
    return;
  }
  okEl.hidden = false;
  toast('The school has been notified', 'success');
}

async function renderMessages() {
  const el = document.getElementById('gpMessages');
  if (!el) return;
  el.innerHTML = '<h2>Messages</h2><p>Loading…</p>';
  const list = await guardianApi.get('/guardian/threads');
  if (list && list._error) {
    el.innerHTML = `<h2>Messages</h2><p class="gp-error">${escapeHtml(list.message)}</p>`;
    return;
  }
  _threads = (list.threads || []).filter((t) => {
    if (!_selectedStudentId) return true;
    return (t.studentRef || t.student_ref) === _selectedStudentId;
  });
  const items = _threads
    .map((t) => {
      const active = t.id === _activeThreadId ? ' active' : '';
      return `<li class="gp-thread${active}" data-thread-id="${t.id}">
        <strong>${escapeHtml(t.subject || 'Thread')}</strong>
        <span class="gp-sib-meta">${escapeHtml(t.state || '')}</span>
      </li>`;
    })
    .join('');
  el.innerHTML = `
    <h2>Messages</h2>
    <ul class="gp-threads" id="gpThreadList">${items || '<li>No threads yet.</li>'}</ul>
    <div id="gpThreadDetail"></div>
    <form id="gpNewThread" class="gp-pane" style="margin-top:0.75rem;padding:0;border:none;background:transparent">
      <h3>New message</h3>
      <div class="gp-field"><label>Subject</label><input id="gpThreadSubject" required /></div>
      <div class="gp-field"><label>Message</label><textarea id="gpThreadBody" rows="2" required></textarea></div>
      <button class="gp-btn" type="submit">Send</button>
    </form>
  `;
  el.querySelectorAll('[data-thread-id]').forEach((node) => {
    node.addEventListener('click', () => openThread(node.getAttribute('data-thread-id')));
  });
  el.querySelector('#gpNewThread').addEventListener('submit', onCreateThread);
  if (_activeThreadId) await openThread(_activeThreadId);
}

let _pendingSurveys = [];
let _activeSurveyId = null;

async function renderSurveys() {
  const el = document.getElementById('gpSurveys');
  if (!el) return;
  el.innerHTML = '<h2>Surveys</h2><p>Loading…</p>';
  const list = await guardianApi.get('/guardian/surveys');
  if (list && list._error) {
    el.innerHTML = `<h2>Surveys</h2><p class="gp-error">${escapeHtml(list.message)}</p>`;
    return;
  }
  _pendingSurveys = list.surveys || [];
  if (!_pendingSurveys.length) {
    el.innerHTML = '<h2>Surveys</h2><p>No pending surveys.</p>';
    return;
  }
  const items = _pendingSurveys
    .map(
      (s) =>
        `<li class="gp-thread" data-survey-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.title)}</strong>
          <span class="gp-sib-meta">${escapeHtml(s.status || 'active')}</span>
        </li>`,
    )
    .join('');
  el.innerHTML = `
    <h2>Surveys</h2>
    <ul class="gp-threads" id="gpSurveyList">${items}</ul>
    <div id="gpSurveyDetail"></div>
  `;
  el.querySelectorAll('[data-survey-id]').forEach((node) => {
    node.addEventListener('click', () => openSurvey(node.getAttribute('data-survey-id')));
  });
  if (_activeSurveyId) await openSurvey(_activeSurveyId);
}

async function openSurvey(id) {
  _activeSurveyId = id;
  const detail = document.getElementById('gpSurveyDetail');
  if (!detail) return;
  const res = await guardianApi.get(`/guardian/surveys/${encodeURIComponent(id)}`);
  if (res && res._error) {
    detail.innerHTML = `<p class="gp-error">${escapeHtml(res.message)}</p>`;
    return;
  }
  const survey = res.survey || {};
  let questions = [];
  try {
    questions = JSON.parse(survey.questionsJson || survey.questions_json || '[]');
  } catch {
    questions = [];
  }
  const fields = questions
    .map((q) => {
      const key = escapeHtml(q.key);
      if (q.type === 'text') {
        return `<div class="gp-field"><label>${escapeHtml(q.label)}</label><textarea data-q="${key}" rows="2"></textarea></div>`;
      }
      if (q.type === 'yesno') {
        return `<div class="gp-field"><label>${escapeHtml(q.label)}</label>
          <select data-q="${key}"><option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
      }
      const max = q.type === 'nps' ? 10 : 5;
      const start = q.type === 'nps' ? 0 : 1;
      let opts = '';
      for (let i = start; i <= max; i++) opts += `<option value="${i}">${i}</option>`;
      return `<div class="gp-field"><label>${escapeHtml(q.label)}</label>
        <select data-q="${key}"><option value="">Select…</option>${opts}</select></div>`;
    })
    .join('');
  detail.innerHTML = `
    <h3>${escapeHtml(survey.title || 'Survey')}</h3>
    <p class="gp-sib-meta">Responses are anonymous. Completions are tracked separately.</p>
    <form id="gpSurveyForm">
      ${fields || '<p>No questions.</p>'}
      <button class="gp-btn" type="submit">Submit</button>
    </form>
  `;
  const form = detail.querySelector('#gpSurveyForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = {};
    detail.querySelectorAll('[data-q]').forEach((node) => {
      const k = node.getAttribute('data-q');
      const raw = node.value;
      const n = Number(raw);
      answers[k] = raw === '' || isNaN(n) ? raw : n;
    });
    const body = { answers };
    if (_selectedStudentId) body.student_ref = _selectedStudentId;
    const result = await guardianApi.post(
      `/guardian/surveys/${encodeURIComponent(id)}/respond`,
      body,
    );
    if (result && result._error) {
      toast(result.message || 'Failed to submit', 'error');
      return;
    }
    toast('Survey submitted', 'success');
    _activeSurveyId = null;
    await renderSurveys();
  });
}

async function openThread(id) {
  _activeThreadId = id;
  const detail = document.getElementById('gpThreadDetail');
  if (!detail) return;
  const res = await guardianApi.get(`/guardian/threads/${encodeURIComponent(id)}`);
  if (res && res._error) {
    detail.innerHTML = `<p class="gp-error">${escapeHtml(res.message)}</p>`;
    return;
  }
  _messages = res.messages || [];
  detail.innerHTML = `
    <div class="gp-messages" id="gpMsgList" data-thread="${escapeHtml(id)}">
      ${_messages
        .map(
          (m) =>
            `<div class="gp-msg ${escapeHtml(m.direction || '')}">${escapeHtml(m.body || '')}</div>`,
        )
        .join('')}
    </div>
    <form id="gpReplyForm" class="gp-row">
      <textarea id="gpReplyBody" rows="2" required placeholder="Reply…"></textarea>
      <button class="gp-btn" type="submit">Reply</button>
    </form>
  `;
  document.getElementById('gpReplyForm').addEventListener('submit', onReply);
  document.querySelectorAll('#gpThreadList .gp-thread').forEach((n) => {
    n.classList.toggle('active', n.getAttribute('data-thread-id') === id);
  });
}

async function onReply(ev) {
  ev.preventDefault();
  if (!_activeThreadId) return;
  const body = document.getElementById('gpReplyBody').value.trim();
  const res = await guardianApi.post(
    `/guardian/threads/${encodeURIComponent(_activeThreadId)}/reply`,
    { body, author: 'guardian', direction: 'guardian' },
  );
  if (res && res._error) {
    toast(res.message || 'Reply failed', 'error');
    return;
  }
  toast('Reply sent', 'success');
  await openThread(_activeThreadId);
}

async function onCreateThread(ev) {
  ev.preventDefault();
  if (!_selectedStudentId) {
    toast('Select a child first', 'error');
    return;
  }
  const subject = document.getElementById('gpThreadSubject').value.trim();
  const body = document.getElementById('gpThreadBody').value.trim();
  const res = await guardianApi.post('/guardian/threads', {
    student_ref: _selectedStudentId,
    subject,
    body,
    author: 'guardian',
  });
  if (res && res._error) {
    toast(res.message || 'Could not create thread', 'error');
    return;
  }
  toast('Message sent', 'success');
  _activeThreadId = res.thread && res.thread.id;
  await renderMessages();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Test helpers */
export function __testState() {
  return {
    students: _students,
    selectedStudentId: _selectedStudentId,
    threads: _threads,
    activeThreadId: _activeThreadId,
  };
}

export function __setTestState(partial) {
  if (partial.students) _students = partial.students;
  if (partial.selectedStudentId !== undefined) {
    _selectedStudentId = partial.selectedStudentId;
  }
  if (partial.reasonCodes) _reasonCodes = partial.reasonCodes;
  if (partial.threads) _threads = partial.threads;
}

// Ensure initApi is available when tests import the module without guardian.html
void initApi;
void getGuardianSession;

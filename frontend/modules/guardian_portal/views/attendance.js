/**
 * Attendance calendar + report absence.
 */

import { guardianApi } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';
import { state, isStale, currentRequestGen } from '../state.js';
import {
  daysInMonth,
  escapeHtml,
  errorBlock,
  expandDateRange,
  friendlyError,
  isUnavailable,
  emptyState,
} from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderAttendance(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="attendance" id="gpAttendance">
      <h2>Attendance</h2>
      <p>Loading…</p>
    </section>
    <section class="gp-pane" data-pane="absence" id="gpAbsence"></section>
  `;
  await Promise.all([paintCalendar(gen), paintAbsenceForm()]);
}

async function paintCalendar(gen) {
  const el = document.getElementById('gpAttendance');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = '<h2>Attendance</h2><p>Select a child.</p>';
    return;
  }
  const days = daysInMonth(state.viewMonth);
  const from = state.viewMonth + '-01';
  const to = state.viewMonth + '-' + String(days).padStart(2, '0');
  const ytdFrom = state.viewMonth.slice(0, 4) + '-01-01';
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/attendance?from=${from}&to=${to}`,
  );
  const ytd = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/attendance?from=${ytdFrom}&to=${to}`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h2>Attendance</h2>${
      isUnavailable(res)
        ? emptyState('Attendance unavailable', 'Try again later.')
        : errorBlock(friendlyError(res))
    }`;
    return;
  }
  const byDate = {};
  (res.records || []).forEach((r) => {
    byDate[r.date] = r.status;
  });
  const eligibility = res.eligibility_pct;
  const ytdPct = ytd && !ytd._error ? ytd.eligibility_pct : null;
  const heads = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    .map((d) => `<div class="gp-day head" aria-hidden="true">${d}</div>`)
    .join('');
  const [y, m] = state.viewMonth.split('-').map(Number);
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="gp-day" aria-hidden="true"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = state.viewMonth + '-' + String(d).padStart(2, '0');
    const st = (byDate[iso] || '').toLowerCase();
    const cls =
      st === 'present' ? 'present' : st === 'absent' ? 'absent' : st === 'late' ? 'late' : '';
    const statusLabel =
      st === 'present'
        ? 'Present'
        : st === 'absent'
          ? 'Absent'
          : st === 'late'
            ? 'Late'
            : 'No mark';
    cells += `<div class="gp-day ${cls}" title="${iso}: ${statusLabel}" aria-label="${iso}: ${statusLabel}"><span aria-hidden="true">${d}</span><span class="visually-hidden">${statusLabel}</span></div>`;
  }
  const chipCls = typeof eligibility === 'number' && eligibility >= 75 ? 'ok' : 'warn';
  el.innerHTML = `
    <h2>Attendance</h2>
    <div class="gp-stats">
      <span class="gp-chip" id="gpYtd">YTD ${ytdPct == null ? '—' : ytdPct + '%'}</span>
      <span class="gp-chip ${chipCls}" id="gpElig">Eligibility ${eligibility == null ? '—' : eligibility + '%'}</span>
      <button type="button" class="gp-btn secondary" id="gpPrevMonth">Prev</button>
      <span class="gp-chip">${escapeHtml(state.viewMonth)}</span>
      <button type="button" class="gp-btn secondary" id="gpNextMonth">Next</button>
    </div>
    <div class="gp-month-grid" id="gpMonthGrid">${heads}${cells}</div>
  `;
  document.getElementById('gpPrevMonth')?.addEventListener('click', async () => {
    const [yy, mm] = state.viewMonth.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm - 2, 1));
    state.viewMonth = d.toISOString().slice(0, 7);
    const g = currentRequestGen();
    await paintCalendar(g);
  });
  document.getElementById('gpNextMonth')?.addEventListener('click', async () => {
    const [yy, mm] = state.viewMonth.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm, 1));
    state.viewMonth = d.toISOString().slice(0, 7);
    const g = currentRequestGen();
    await paintCalendar(g);
  });
}

async function paintAbsenceForm() {
  const el = document.getElementById('gpAbsence');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = '<h2>Report absence</h2><p>Select a child.</p>';
    return;
  }
  if (!state.reasonCodes.length) {
    el.innerHTML = `<h2>Report absence</h2>${emptyState(
      'Absence reasons unavailable',
      'The school has not published reason codes yet. Try again later.',
    )}`;
    return;
  }
  const options = state.reasonCodes
    .map(
      (r) =>
        `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label || r.code)}</option>`,
    )
    .join('');
  el.innerHTML = `
    <h2>Report absence</h2>
    <form id="gpAbsenceForm" data-student="${escapeHtml(state.selectedStudentId || '')}">
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
  el.querySelector('#gpAbsenceForm')?.addEventListener('submit', onAbsenceSubmit);
}

export function validateAbsenceForm(from, to) {
  return expandDateRange(from, to);
}

async function onAbsenceSubmit(ev) {
  ev.preventDefault();
  const errEl = document.getElementById('gpAbsError');
  const okEl = document.getElementById('gpAbsSuccess');
  if (errEl) errEl.hidden = true;
  if (okEl) okEl.hidden = true;
  const from = /** @type {HTMLInputElement} */ (document.getElementById('gpAbsFrom')).value;
  const to = /** @type {HTMLInputElement} */ (document.getElementById('gpAbsTo')).value;
  const checked = validateAbsenceForm(from, to);
  if (checked.error) {
    if (errEl) {
      errEl.textContent = checked.error;
      errEl.hidden = false;
    }
    toast(checked.error, 'error');
    return;
  }
  if (!state.selectedStudentId) {
    if (errEl) {
      errEl.textContent = 'Select a child first';
      errEl.hidden = false;
    }
    return;
  }
  const res = await guardianApi.post('/guardian/reported-absences', {
    student_id: state.selectedStudentId,
    dates: checked.dates,
    reason_code_id: /** @type {HTMLSelectElement} */ (document.getElementById('gpAbsReason'))
      .value,
    note: /** @type {HTMLTextAreaElement} */ (document.getElementById('gpAbsNote')).value || null,
    channel: 'app',
  });
  if (res && res._error) {
    if (errEl) {
      errEl.textContent = res.message || 'Could not submit';
      errEl.hidden = false;
    }
    toast(errEl?.textContent || 'Could not submit', 'error');
    return;
  }
  if (okEl) okEl.hidden = false;
  toast('The school has been notified', 'success');
}

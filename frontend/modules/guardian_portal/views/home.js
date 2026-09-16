/**
 * Home dashboard — child chips summary, alerts, diary, placeholders with retry.
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen, currentRequestGen, selectedStudent } from '../state.js';
import {
  escapeHtml,
  emptyState,
  errorBlock,
  friendlyError,
  isUnavailable,
  retryButton,
  studentLabel,
  studentMeta,
} from '../utils.js';
import { loadDiary } from './diary.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 * @param {(route: string) => void} navigate
 */
export async function renderHome(main, gen, navigate) {
  const child = selectedStudent();
  main.innerHTML = `
    <section class="gp-pane gp-home" data-pane="home">
      <h2>Home</h2>
      <div class="gp-home-chips" id="gpHomeChips"></div>
      <div class="gp-home-grid">
        <article class="gp-card-block" id="gpHomeAttendance">
          <h3>Attendance</h3>
          <p>Loading…</p>
        </article>
        <article class="gp-card-block" id="gpHomeActions">
          <h3>Actions</h3>
          <p>Loading…</p>
        </article>
        <article class="gp-card-block" id="gpHomeFees">
          <h3>Amount due</h3>
          <p class="gp-sib-meta">Checking…</p>
        </article>
        <article class="gp-card-block" id="gpHomeEvent">
          <h3>Next event</h3>
          <p class="gp-sib-meta">Checking…</p>
        </article>
        <article class="gp-card-block" id="gpHomeBus">
          <h3>Bus status</h3>
          <p class="gp-sib-meta">Checking…</p>
        </article>
      </div>
      <div id="gpDiaryHost" class="gp-pane gp-home-diary"></div>
    </section>
  `;

  const chips = document.getElementById('gpHomeChips');
  if (chips) {
    if (!child) {
      chips.innerHTML = '<p>Select a child.</p>';
    } else {
      chips.innerHTML = `<div class="gp-chip ok">${escapeHtml(studentLabel(child))}</div>
        <span class="gp-sib-meta">${escapeHtml(studentMeta(child))}</span>`;
    }
  }

  await Promise.all([
    loadDiary(gen),
    loadAttendanceAlert(gen, navigate),
    loadActionCounts(gen, navigate),
    loadFeesPlaceholder(gen, navigate),
    loadEventPlaceholder(gen, navigate),
    loadBusPlaceholder(gen, navigate),
  ]);
}

async function loadAttendanceAlert(gen, navigate) {
  const el = document.getElementById('gpHomeAttendance');
  if (!el || !state.selectedStudentId) {
    if (el) el.innerHTML = '<h3>Attendance</h3><p>Select a child.</p>';
    return;
  }
  const ym = state.viewMonth;
  const days = (() => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  })();
  const from = ym + '-01';
  const to = ym + '-' + String(days).padStart(2, '0');
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/attendance?from=${from}&to=${to}`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Attendance</h3>${
      isUnavailable(res)
        ? emptyState('Not available', 'Attendance summary is not enabled yet.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'home-attendance')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => renderHome(el.closest('#gpMain'), bumpRequestGen(), navigate));
    return;
  }
  const pct = res.eligibility_pct;
  const chipCls = typeof pct === 'number' && pct >= 75 ? 'ok' : 'warn';
  const alert =
    typeof pct === 'number' && pct < 75
      ? `<p class="gp-error">Eligibility below 75% — contact the school if needed.</p>`
      : `<p class="gp-sib-meta">Looking good this month.</p>`;
  el.innerHTML = `
    <h3>Attendance</h3>
    <span class="gp-chip ${chipCls}" id="gpHomeElig">Eligibility ${pct == null ? '—' : pct + '%'}</span>
    ${alert}
    <button type="button" class="gp-btn ghost" data-goto="attendance">Open calendar</button>
  `;
  el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('attendance'));
}

async function loadActionCounts(gen, navigate) {
  const el = document.getElementById('gpHomeActions');
  if (!el) return;
  const [threads, surveys] = await Promise.all([
    guardianApi.get('/guardian/threads'),
    guardianApi.get('/guardian/surveys'),
  ]);
  if (isStale(gen)) return;
  let threadCount = 0;
  let surveyCount = 0;
  if (threads && !threads._error) {
    const list = (threads.threads || []).filter((t) => {
      if (!state.selectedStudentId) return true;
      return (t.studentRef || t.student_ref) === state.selectedStudentId;
    });
    threadCount = list.filter((t) => (t.state || '') !== 'closed').length;
  }
  if (surveys && !surveys._error) {
    surveyCount = (surveys.surveys || []).length;
  }
  const unreadDiary = state.diaryEntries.filter((e) => !state.diarySeenIds.has(e.id)).length;
  el.innerHTML = `
    <h3>Actions</h3>
    <div class="gp-stats">
      <button type="button" class="gp-chip" data-goto="inbox">${threadCount} open message${threadCount === 1 ? '' : 's'}</button>
      <button type="button" class="gp-chip" data-goto="forms">${surveyCount} survey${surveyCount === 1 ? '' : 's'}</button>
      <span class="gp-chip">${unreadDiary} unread diary</span>
    </div>
  `;
  el.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.getAttribute('data-goto')));
  });
}

async function loadFeesPlaceholder(gen, navigate) {
  const el = document.getElementById('gpHomeFees');
  if (!el || !state.selectedStudentId) return;
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/fees`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Amount due</h3>${
      isUnavailable(res)
        ? `<p class="gp-sib-meta">Fees not available yet.</p>`
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'home-fees')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => loadFeesPlaceholder(currentRequestGen(), navigate));
    return;
  }
  const due = res.amount_due ?? res.amountDue ?? res.balance ?? null;
  el.innerHTML = `
    <h3>Amount due</h3>
    <p class="gp-chip">${due == null ? '—' : escapeHtml(String(due))}</p>
    <button type="button" class="gp-btn ghost" data-goto="payments">View ledger</button>
  `;
  el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('payments'));
}

async function loadEventPlaceholder(gen, navigate) {
  const el = document.getElementById('gpHomeEvent');
  if (!el) return;
  const res = await guardianApi.get('/guardian/events');
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Next event</h3><p class="gp-sib-meta">No upcoming events.</p>
      <button type="button" class="gp-btn ghost" data-goto="calendar">Calendar</button>`;
    el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('calendar'));
    return;
  }
  const events = res.events || [];
  const next = events[0];
  el.innerHTML = `
    <h3>Next event</h3>
    ${
      next
        ? `<p><strong>${escapeHtml(next.title || next.name || 'Event')}</strong>
           <span class="gp-sib-meta">${escapeHtml(next.date || next.starts_at || '')}</span></p>`
        : `<p class="gp-sib-meta">No upcoming events.</p>`
    }
    <button type="button" class="gp-btn ghost" data-goto="calendar">Calendar</button>
  `;
  el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('calendar'));
}

async function loadBusPlaceholder(gen, navigate) {
  const el = document.getElementById('gpHomeBus');
  if (!el || !state.selectedStudentId) return;
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/transport`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Bus status</h3><p class="gp-sib-meta">Transport status not available.</p>
      <button type="button" class="gp-btn ghost" data-goto="transport">Transport</button>`;
    el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('transport'));
    return;
  }
  const status = res.status || res.bus_status || res.route_name || 'Assigned';
  el.innerHTML = `
    <h3>Bus status</h3>
    <p class="gp-chip">${escapeHtml(String(status))}</p>
    <button type="button" class="gp-btn ghost" data-goto="transport">Details</button>
  `;
  el.querySelector('[data-goto]')?.addEventListener('click', () => navigate('transport'));
}

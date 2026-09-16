/**
 * Learning — report cards, assignments, timetable.
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen } from '../state.js';
import { escapeHtml, emptyState, errorBlock, friendlyError, isUnavailable, retryButton } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderLearning(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="learning">
      <h2>Learning</h2>
      <div id="gpReportCards" class="gp-section"><p>Loading report cards…</p></div>
      <div id="gpAssignments" class="gp-section"><p>Loading assignments…</p></div>
      <div id="gpTimetable" class="gp-section"><p>Loading timetable…</p></div>
    </section>
  `;
  if (!state.selectedStudentId) {
    main.querySelector('#gpReportCards').innerHTML = emptyState('Select a child', '');
    main.querySelector('#gpAssignments').innerHTML = '';
    main.querySelector('#gpTimetable').innerHTML = '';
    return;
  }
  const id = encodeURIComponent(state.selectedStudentId);
  await Promise.all([
    loadList(gen, 'gpReportCards', 'Report cards', `/guardian/students/${id}/report-cards`, (res) => {
      const cards = res.reportCards || res.report_cards || res.items || [];
      if (!cards.length) return '<p class="gp-sib-meta">No published report cards.</p>';
      return `<ul class="gp-list">${cards
        .map(
          (c) =>
            `<li><strong>${escapeHtml(c.title || c.session || c.id)}</strong>
              <span class="gp-sib-meta">${escapeHtml(c.published_at || c.status || '')}</span></li>`,
        )
        .join('')}</ul>`;
    }),
    loadList(gen, 'gpAssignments', 'Assignments', `/guardian/students/${id}/assignments`, (res) => {
      const items = res.assignments || res.items || [];
      if (!items.length) return '<p class="gp-sib-meta">No assignments.</p>';
      return `<ul class="gp-list">${items
        .map(
          (a) =>
            `<li><strong>${escapeHtml(a.title || a.name || a.id)}</strong>
              <span class="gp-sib-meta">${escapeHtml(a.due_date || a.dueDate || a.status || '')}</span></li>`,
        )
        .join('')}</ul>`;
    }),
    loadList(gen, 'gpTimetable', 'Timetable', `/guardian/students/${id}/timetable`, (res) => {
      const slots = res.slots || res.periods || res.items || res.timetable || [];
      if (!slots.length) return '<p class="gp-sib-meta">No timetable published.</p>';
      return `<ul class="gp-list">${slots
        .map(
          (s) =>
            `<li><strong>${escapeHtml(s.subject || s.title || s.day || '')}</strong>
              <span class="gp-sib-meta">${escapeHtml(s.period || s.time || s.start || '')}</span></li>`,
        )
        .join('')}</ul>`;
    }),
  ]);
}

async function loadList(gen, elId, title, path, renderItems) {
  const el = document.getElementById(elId);
  if (!el) return;
  const res = await guardianApi.get(path);
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>${escapeHtml(title)}</h3>${
      isUnavailable(res)
        ? emptyState(`${title} unavailable`, 'This will appear when the school publishes it.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', elId)}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => {
      const main = document.getElementById('gpMain');
      if (main) renderLearning(main, bumpRequestGen());
    });
    return;
  }
  el.innerHTML = `<h3>${escapeHtml(title)}</h3>${renderItems(res)}`;
}

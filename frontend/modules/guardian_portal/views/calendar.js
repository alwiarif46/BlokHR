/**
 * Calendar events (graceful empty when API missing).
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen } from '../state.js';
import { escapeHtml, emptyState, errorBlock, friendlyError, isUnavailable, retryButton } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderCalendar(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="calendar" id="gpCalendar">
      <h2>Calendar</h2>
      <p>Loading…</p>
    </section>
  `;
  const el = document.getElementById('gpCalendar');
  if (!el) return;
  const res = await guardianApi.get('/guardian/events');
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h2>Calendar</h2>${
      isUnavailable(res)
        ? emptyState('No events yet', 'School events will show here when published.')
        : errorBlock(friendlyError(res))
    }${isUnavailable(res) ? '' : retryButton('Retry', 'calendar')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => {
      renderCalendar(main, bumpRequestGen());
    });
    return;
  }
  const events = res.events || res.items || [];
  if (!events.length) {
    el.innerHTML = `<h2>Calendar</h2>${emptyState('No upcoming events', 'Check back later.')}`;
    return;
  }
  el.innerHTML = `
    <h2>Calendar</h2>
    <ul class="gp-list">${events
      .map(
        (e) =>
          `<li><strong>${escapeHtml(e.title || e.name || 'Event')}</strong>
            <span class="gp-sib-meta">${escapeHtml(e.date || e.starts_at || e.startsAt || '')}</span>
            <p>${escapeHtml(e.description || e.location || '')}</p></li>`,
      )
      .join('')}</ul>
  `;
}

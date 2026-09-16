/**
 * Transport status for selected child.
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen } from '../state.js';
import { escapeHtml, emptyState, errorBlock, friendlyError, isUnavailable, retryButton } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderTransport(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="transport" id="gpTransport">
      <h2>Transport</h2>
      <p>Loading…</p>
    </section>
  `;
  const el = document.getElementById('gpTransport');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = '<h2>Transport</h2><p>Select a child.</p>';
    return;
  }
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/transport`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h2>Transport</h2>${
      isUnavailable(res)
        ? emptyState('Transport unavailable', 'Bus details will appear when transport is enabled.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'transport')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => {
      renderTransport(main, bumpRequestGen());
    });
    return;
  }
  const route = res.route_name || res.routeName || res.route || '—';
  const stop = res.stop_name || res.stopName || res.stop || '—';
  const status = res.status || res.bus_status || '—';
  el.innerHTML = `
    <h2>Transport</h2>
    <dl class="gp-dl">
      <div><dt>Route</dt><dd>${escapeHtml(String(route))}</dd></div>
      <div><dt>Stop</dt><dd>${escapeHtml(String(stop))}</dd></div>
      <div><dt>Status</dt><dd><span class="gp-chip">${escapeHtml(String(status))}</span></dd></div>
    </dl>
  `;
}

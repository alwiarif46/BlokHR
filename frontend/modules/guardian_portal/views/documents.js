/**
 * Documents — report cards + policies empty state.
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen } from '../state.js';
import { escapeHtml, emptyState, errorBlock, friendlyError, isUnavailable, retryButton } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderDocuments(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="documents">
      <h2>Documents</h2>
      <div id="gpDocCards" class="gp-section"><p>Loading…</p></div>
      <div id="gpDocPolicies" class="gp-section"></div>
    </section>
  `;
  const cardsEl = document.getElementById('gpDocCards');
  const policiesEl = document.getElementById('gpDocPolicies');
  if (policiesEl) {
    policiesEl.innerHTML = `<h3>Policies</h3>${emptyState(
      'No policies published',
      'School policy documents will appear here.',
    )}`;
  }
  if (!cardsEl) return;
  if (!state.selectedStudentId) {
    cardsEl.innerHTML = '<h3>Report cards</h3><p>Select a child.</p>';
    return;
  }
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/report-cards`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    cardsEl.innerHTML = `<h3>Report cards</h3>${
      isUnavailable(res)
        ? emptyState('No report cards', 'Published report cards will appear here.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'docs')}`;
    cardsEl.querySelector('[data-retry]')?.addEventListener('click', () => {
      renderDocuments(main, bumpRequestGen());
    });
    return;
  }
  const cards = res.reportCards || res.report_cards || res.items || [];
  cardsEl.innerHTML = `
    <h3>Report cards</h3>
    ${
      cards.length
        ? `<ul class="gp-list">${cards
            .map(
              (c) =>
                `<li><strong>${escapeHtml(c.title || c.session || c.id)}</strong>
                  <span class="gp-sib-meta">${escapeHtml(c.published_at || c.status || '')}</span></li>`,
            )
            .join('')}</ul>`
        : emptyState('No report cards', 'Published report cards will appear here.')
    }
  `;
}

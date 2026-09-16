/**
 * Payments — fees ledger.
 */

import { guardianApi } from '../../../shared/api.js';
import { state, isStale, bumpRequestGen } from '../state.js';
import { escapeHtml, emptyState, errorBlock, friendlyError, isUnavailable, retryButton } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderPayments(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="payments" id="gpPayments">
      <h2>Payments</h2>
      <p>Loading…</p>
    </section>
  `;
  const el = document.getElementById('gpPayments');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = '<h2>Payments</h2><p>Select a child.</p>';
    return;
  }
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/fees`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h2>Payments</h2>${
      isUnavailable(res)
        ? emptyState('Fees unavailable', 'The fee ledger will show here when enabled.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'payments')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => {
      renderPayments(main, bumpRequestGen());
    });
    return;
  }
  const rows = res.ledger || res.entries || res.items || res.fees || [];
  const due = res.amount_due ?? res.amountDue ?? res.balance;
  el.innerHTML = `
    <h2>Payments</h2>
    <div class="gp-stats">
      <span class="gp-chip">Amount due: ${due == null ? '—' : escapeHtml(String(due))}</span>
    </div>
    ${
      rows.length
        ? `<ul class="gp-list">${rows
            .map(
              (r) =>
                `<li><strong>${escapeHtml(r.label || r.description || r.id)}</strong>
                  <span class="gp-sib-meta">${escapeHtml(String(r.amount ?? r.balance ?? ''))} · ${escapeHtml(r.status || r.date || '')}</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="gp-sib-meta">No ledger entries.</p>'
    }
  `;
}

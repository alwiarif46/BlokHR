/**
 * Children list (full) + More (library + profile preferences).
 */

import { guardianApi } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';
import { state, isStale, bumpRequestGen, currentRequestGen } from '../state.js';
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
import { getTheme, getValidThemes, getThemeLabel } from '../../../shared/themes.js';

/**
 * @param {HTMLElement} main
 * @param {(studentId: string) => void} onSelect
 */
export function renderChildren(main, onSelect) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="children-full">
      <h2>Children</h2>
      <div id="gpChildrenList" class="gp-children-list"></div>
    </section>
  `;
  const el = document.getElementById('gpChildrenList');
  if (!el) return;
  if (state.accountMode === 'forbidden') {
    el.innerHTML = emptyState(
      'Access restricted',
      'Your account cannot view linked children. Contact the school office.',
    );
    return;
  }
  if (!state.students.length) {
    el.innerHTML = emptyState(
      'No linked children',
      'Ask the school office to link your parent account to a student record.',
    );
    return;
  }
  el.innerHTML = state.students
    .map((s) => {
      const active = s.id === state.selectedStudentId ? ' active' : '';
      return `<button type="button" class="gp-sib gp-sib-lg${active}" data-student-id="${escapeHtml(s.id)}">
        <strong>${escapeHtml(studentLabel(s))}</strong>
        <span class="gp-sib-meta">${escapeHtml(studentMeta(s))}</span>
        <span class="gp-sib-meta">${escapeHtml(s.admissionNumber || s.admission_number || '')}</span>
      </button>`;
    })
    .join('');
  el.querySelectorAll('[data-student-id]').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.getAttribute('data-student-id')));
  });
}

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderMore(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="more">
      <h2>More</h2>
      <div id="gpLibrary" class="gp-section"><p>Loading library…</p></div>
      <div id="gpProfile" class="gp-section"><p>Loading profile…</p></div>
    </section>
  `;
  await Promise.all([loadLibrary(gen), loadProfile(gen)]);
}

async function loadLibrary(gen) {
  const el = document.getElementById('gpLibrary');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = '<h3>Library</h3><p>Select a child.</p>';
    return;
  }
  const res = await guardianApi.get(
    `/guardian/students/${encodeURIComponent(state.selectedStudentId)}/library`,
  );
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Library</h3>${
      isUnavailable(res)
        ? emptyState('Library unavailable', 'Loans and holds will appear when enabled.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'library')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => {
      const main = document.getElementById('gpMain');
      if (main) renderMore(main, bumpRequestGen());
    });
    return;
  }
  const loans = res.loans || res.items || res.books || [];
  el.innerHTML = `
    <h3>Library</h3>
    ${
      loans.length
        ? `<ul class="gp-list">${loans
            .map(
              (b) =>
                `<li><strong>${escapeHtml(b.title || b.name || b.id)}</strong>
                  <span class="gp-sib-meta">${escapeHtml(b.due_date || b.status || '')}</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="gp-sib-meta">No active loans.</p>'
    }
  `;
}

async function loadProfile(gen) {
  const el = document.getElementById('gpProfile');
  if (!el) return;
  const res = await guardianApi.get('/guardian/me/profile');
  if (isStale(gen)) return;
  if (res && res._error) {
    el.innerHTML = `<h3>Profile & preferences</h3>${
      isUnavailable(res)
        ? emptyState('Profile unavailable', 'Preferences will be editable when the school enables this.')
        : errorBlock(friendlyError(res))
    }${retryButton('Retry', 'profile')}`;
    el.querySelector('[data-retry]')?.addEventListener('click', () => loadProfile(currentRequestGen()));
    return;
  }
  const lang = res.preferredLanguage || res.preferred_language || '';
  const tz = res.timezone || '';
  const email = res.email || '';
  const themeOpts = getValidThemes()
    .map((id) => {
      const selected = getTheme() === id ? ' selected' : '';
      return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(getThemeLabel(id))}</option>`;
    })
    .join('');
  el.innerHTML = `
    <h3>Profile & preferences</h3>
    <form id="gpProfileForm">
      <div class="gp-field">
        <label for="gpPrefTheme">Theme</label>
        <select id="gpPrefTheme">${themeOpts}</select>
        <p class="gp-sib-meta">Saved to your parent account. Also available from the header dots.</p>
      </div>
      <div class="gp-field">
        <label for="gpPrefLang">Preferred language</label>
        <input id="gpPrefLang" value="${escapeHtml(lang)}" autocomplete="language" />
      </div>
      <div class="gp-field">
        <label for="gpPrefTz">Timezone</label>
        <input id="gpPrefTz" value="${escapeHtml(tz)}" />
      </div>
      <div class="gp-field">
        <label for="gpPrefEmail">Email</label>
        <input id="gpPrefEmail" type="email" value="${escapeHtml(email)}" autocomplete="email" />
      </div>
      <button class="gp-btn" type="submit">Save</button>
      <p class="gp-error" id="gpProfileError" hidden></p>
    </form>
  `;
  el.querySelector('#gpPrefTheme')?.addEventListener('change', (ev) => {
    const id = /** @type {HTMLSelectElement} */ (ev.target).value;
    const btn = state.root && state.root.querySelector(`#gpHdrThemes [data-theme="${id}"]`);
    if (btn) btn.click();
  });
  el.querySelector('#gpProfileForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errEl = document.getElementById('gpProfileError');
    if (errEl) errEl.hidden = true;
    const body = {
      preferred_language: /** @type {HTMLInputElement} */ (document.getElementById('gpPrefLang'))
        .value.trim(),
      timezone: /** @type {HTMLInputElement} */ (document.getElementById('gpPrefTz')).value.trim(),
      email: /** @type {HTMLInputElement} */ (document.getElementById('gpPrefEmail')).value.trim() || null,
    };
    const patch = await guardianApi.patch('/guardian/me/profile', body);
    if (patch && patch._error) {
      if (errEl) {
        errEl.textContent = friendlyError(patch, 'Could not save');
        errEl.hidden = false;
      }
      toast(friendlyError(patch, 'Could not save'), 'error');
      return;
    }
    toast('Preferences saved', 'success');
  });
}

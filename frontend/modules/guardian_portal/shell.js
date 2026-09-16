/**
 * App shell markup, nav, and sibling strip for the guardian parent portal.
 */

import { getValidThemes, getThemeLabel } from '../../shared/themes.js';
import { state } from './state.js';
import { escapeHtml, studentLabel, studentMeta } from './utils.js';

/** Full destination list (desktop sidebar + More hub). */
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', primary: true },
  { id: 'children', label: 'Children', primary: true },
  { id: 'learning', label: 'Learning', primary: false },
  { id: 'attendance', label: 'Attendance', primary: true },
  { id: 'inbox', label: 'Inbox', primary: true },
  { id: 'calendar', label: 'Calendar', primary: false },
  { id: 'payments', label: 'Payments', primary: false },
  { id: 'transport', label: 'Transport', primary: false },
  { id: 'forms', label: 'Forms', primary: false },
  { id: 'documents', label: 'Documents', primary: false },
  { id: 'more', label: 'More', primary: true },
];

/** Mobile bottom bar: primary destinations only. */
export const PRIMARY_NAV_IDS = NAV_ITEMS.filter((n) => n.primary).map((n) => n.id);

function themePickerHtml() {
  return getValidThemes()
    .map((id) => {
      const label = escapeHtml(getThemeLabel(id));
      return `<button type="button" class="ht-btn" data-theme="${escapeHtml(id)}" title="${label}" aria-label="${label}"></button>`;
    })
    .join('');
}

export function shellHtml(brand) {
  const desktopNav = NAV_ITEMS.map(
    (item) =>
      `<button type="button" class="gp-nav-item" data-route="${item.id}">
        <span class="gp-nav-label">${escapeHtml(item.label)}</span>
      </button>`,
  ).join('');

  const mobileNav = NAV_ITEMS.filter((item) => item.primary)
    .map(
      (item) =>
        `<button type="button" class="gp-nav-item" data-route="${item.id}">
          <span class="gp-nav-label">${escapeHtml(item.label)}</span>
        </button>`,
    )
    .join('');

  return `
<header class="gp-header" id="gpHeader" hidden>
  <img id="hdrWordmark" class="gp-wordmark" src="${escapeHtml(brand.headerLogoPath || brand.wordmarkPath)}" alt="${escapeHtml(brand.name)}" />
  <div class="gp-header-actions">
    <div class="gp-themes hdr-themes" id="gpHdrThemes" role="group" aria-label="Theme">
      ${themePickerHtml()}
    </div>
    <button type="button" class="gp-btn ghost" id="gpLogout" hidden>Sign out</button>
  </div>
</header>
<div class="gp-app" id="gpApp" hidden>
  <div class="gp-siblings" id="gpSiblings" data-pane="children" role="status" aria-label="Children"></div>
  <div class="gp-main" id="gpMain" role="main" tabindex="-1"></div>
  <nav class="gp-nav gp-nav-desktop" id="gpNavDesktop" aria-label="Primary">
    <div class="gp-nav-scroll">${desktopNav}</div>
  </nav>
  <nav class="gp-nav gp-nav-mobile" id="gpNavMobile" aria-label="Primary">
    <div class="gp-nav-scroll">${mobileNav}</div>
  </nav>
</div>
<div class="gp-auth-main" id="gpAuthMain" role="main"></div>
`;
}

export function authMainEl() {
  return state.root && state.root.querySelector('#gpAuthMain');
}

export function viewMainEl() {
  return state.root && state.root.querySelector('#gpMain');
}

export function setLogoutVisible(on) {
  const btn = state.root && state.root.querySelector('#gpLogout');
  if (btn) btn.hidden = !on;
}

/**
 * Toggle authenticated app vs login. Clears stale DOM when hiding the app.
 * Logged-out: hide header + app shell so only the login card shows.
 * @param {boolean} on
 * @param {{ clearMain?: boolean, clearAuth?: boolean }} [opts]
 */
export function setAppVisible(on, opts = {}) {
  const app = state.root && state.root.querySelector('#gpApp');
  const auth = state.root && state.root.querySelector('#gpAuthMain');
  const header = state.root && state.root.querySelector('#gpHeader');
  const siblings = state.root && state.root.querySelector('#gpSiblings');
  const main = viewMainEl();
  if (app) app.hidden = !on;
  if (header) header.hidden = !on;
  if (auth) auth.hidden = !!on;
  document.body.classList.toggle('on-login-screen', !on);
  if (!on && opts.clearMain !== false && main) {
    main.innerHTML = '';
  }
  if (!on && siblings) {
    siblings.innerHTML = '';
    siblings.setAttribute('role', 'status');
  }
  if (on && opts.clearAuth !== false && auth) {
    auth.innerHTML = '';
  }
}

/**
 * @param {(route: string) => void} onNavigate
 * @param {(studentId: string) => void} onSelectStudent
 */
export function bindShell(onNavigate, onSelectStudent) {
  const root = state.root;
  if (!root) return;
  root.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onNavigate(btn.getAttribute('data-route'));
    });
  });
  const siblings = root.querySelector('#gpSiblings');
  if (siblings) {
    siblings.addEventListener('click', (ev) => {
      const btn = ev.target && /** @type {HTMLElement} */ (ev.target).closest('[data-student-id]');
      if (!btn) return;
      onSelectStudent(btn.getAttribute('data-student-id'));
    });
  }
}

/**
 * @param {(themeId: string) => void} onThemeSelect
 */
export function bindThemePicker(onThemeSelect) {
  const el = state.root && state.root.querySelector('#gpHdrThemes');
  if (!el) return;
  el.addEventListener('click', (ev) => {
    const btn = ev.target && /** @type {HTMLElement} */ (ev.target).closest('[data-theme]');
    if (!btn) return;
    const id = btn.getAttribute('data-theme');
    if (id) onThemeSelect(id);
  });
}

export function highlightNav(route) {
  if (!state.root) return;
  const secondary = !PRIMARY_NAV_IDS.includes(route) && route !== 'more';
  state.root.querySelectorAll('[data-route]').forEach((btn) => {
    const id = btn.getAttribute('data-route');
    let active = id === route;
    if (secondary && id === 'more' && btn.closest('#gpNavMobile')) {
      active = true;
    }
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

/**
 * Restrict nav for zero-child / forbidden account modes.
 * @param {'ready'|'no_children'|'forbidden'|'error'|'loading'} mode
 */
export function applyAccountMode(mode) {
  const app = state.root && state.root.querySelector('#gpApp');
  if (app) {
    app.dataset.accountMode = mode;
  }
  const childScoped = new Set([
    'home',
    'learning',
    'attendance',
    'inbox',
    'calendar',
    'payments',
    'transport',
    'forms',
    'documents',
    'children',
  ]);
  const allow =
    mode === 'ready'
      ? null
      : mode === 'no_children'
        ? new Set(['more', 'children'])
        : new Set(['more']);

  if (!state.root) return;
  state.root.querySelectorAll('[data-route]').forEach((btn) => {
    const id = btn.getAttribute('data-route');
    const disabled = allow != null && !allow.has(id);
    btn.disabled = disabled;
    btn.classList.toggle('gp-nav-disabled', disabled);
    if (disabled) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    if (childScoped.has(id) && mode === 'no_children' && id !== 'children' && id !== 'more') {
      btn.hidden = btn.closest('#gpNavMobile') != null ? true : false;
    } else if (mode === 'ready') {
      btn.hidden = false;
    }
  });
}

export function renderSiblings() {
  const el = state.root && state.root.querySelector('#gpSiblings');
  if (!el) return;
  if (!state.students.length) {
    // Empty copy lives in the Children pane — hide the redundant strip.
    el.hidden = true;
    el.innerHTML = '';
    el.setAttribute('role', 'status');
    el.removeAttribute('aria-label');
    return;
  }
  el.hidden = false;
  el.setAttribute('role', 'tablist');
  el.setAttribute('aria-label', 'Children');
  el.innerHTML = state.students
    .map((s) => {
      const active = s.id === state.selectedStudentId ? ' active' : '';
      const selected = s.id === state.selectedStudentId;
      return `<button type="button" class="gp-sib${active}" data-student-id="${escapeHtml(s.id)}" role="tab" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}">
        <strong>${escapeHtml(studentLabel(s))}</strong>
        <span class="gp-sib-meta">${escapeHtml(studentMeta(s))}</span>
      </button>`;
    })
    .join('');
}

/**
 * modules/guardian_portal/guardian_portal.js
 * Parent app boot, routing, sibling switch. HTTP via guardianApi; session via session.js.
 */

import { guardianApi } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { applyBrand, getBrand } from '../../shared/brand.js';
import {
  loadGuardianSession,
  clearGuardianSession,
  getGuardianSession,
} from '../../shared/session.js';
import {
  setTheme,
  getTheme,
  getValidThemes,
  syncThemeDots,
} from '../../shared/themes.js';
import {
  shellHtml,
  bindShell,
  bindThemePicker,
  setLogoutVisible,
  setAppVisible,
  highlightNav,
  renderSiblings,
  viewMainEl,
  applyAccountMode,
  NAV_ITEMS,
  PRIMARY_NAV_IDS,
} from './shell.js';
import { renderLogin } from './login.js';
import { todayIso, daysAgoIso, monthKey, friendlyError, emptyState } from './utils.js';
import {
  state,
  setRoot,
  bumpRequestGen,
  currentRequestGen,
  resetDiaryRange,
  resetAuthenticatedState,
  applyTestState,
  snapshotTestState,
} from './state.js';
import { renderHome } from './views/home.js';
import { renderChildren, renderMore } from './views/more.js';
import { renderLearning } from './views/learning.js';
import { renderAttendance, validateAbsenceForm } from './views/attendance.js';
import { renderInbox } from './views/inbox.js';
import { renderCalendar } from './views/calendar.js';
import { renderPayments } from './views/payments.js';
import { renderTransport } from './views/transport.js';
import { renderForms } from './views/forms.js';
import { renderDocuments } from './views/documents.js';
import { onDiaryAck } from './views/diary.js';

export { validateAbsenceForm, onDiaryAck, NAV_ITEMS, PRIMARY_NAV_IDS };

/** Auth generation — incremented on logout/expiry so in-flight enterApp abandons. */
let _authGen = 0;

function nextAuthGen() {
  _authGen += 1;
  return _authGen;
}

function isAuthStale(gen) {
  return gen !== _authGen;
}

/**
 * @param {HTMLElement} container
 */
export async function bootGuardianPortal(container) {
  setRoot(container);
  applyBrand('school');
  const brand = getBrand('school');
  container.innerHTML = shellHtml(brand);

  const logout = container.querySelector('#gpLogout');
  if (logout) {
    logout.addEventListener('click', () => {
      exitToLogin();
    });
  }

  document.addEventListener('blokhr:guardian:auth:expired', () => {
    toast('Session expired — please sign in again', 'error');
    exitToLogin({ toast: false });
  });

  bindShell(navigate, selectStudent);
  bindThemePicker(onThemeSelect);
  syncThemeDots();

  setTheme('chromium');
  syncThemeDots();

  const session = loadGuardianSession();
  if (session && session.token) {
    await enterApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  nextAuthGen();
  resetAuthenticatedState();
  setLogoutVisible(false);
  setAppVisible(false, { clearMain: true });
  setTheme('chromium');
  syncThemeDots();
  renderLogin(enterApp);
}

/**
 * @param {{ toast?: boolean }} [opts]
 */
function exitToLogin(opts = {}) {
  clearGuardianSession();
  showLogin();
  if (opts.toast === false) return;
}

async function enterApp() {
  const gen = nextAuthGen();
  resetAuthenticatedState();
  setLogoutVisible(true);
  setAppVisible(false, { clearMain: true, clearAuth: true });

  const main = viewMainEl();
  if (main) {
    main.innerHTML = `<section class="gp-pane" role="status"><p>Loading…</p></section>`;
  }
  setAppVisible(true, { clearAuth: true, clearMain: false });
  applyAccountMode('loading');

  state.viewMonth = monthKey();
  resetDiaryRange(daysAgoIso(14), todayIso());

  await loadProfileTheme(gen);
  if (isAuthStale(gen)) return;

  const studentResult = await loadStudents();
  if (isAuthStale(gen)) return;

  if (studentResult === 'unauthorized') {
    return;
  }
  if (studentResult === 'forbidden') {
    state.accountMode = 'forbidden';
    applyAccountMode('forbidden');
    await navigate('more');
    return;
  }
  if (studentResult === 'error') {
    state.accountMode = 'error';
    applyAccountMode('error');
    if (main) {
      main.innerHTML = `<section class="gp-pane">${emptyState(
        'Could not load your account',
        'Check your connection and try signing in again.',
      )}</section>`;
    }
    return;
  }

  await loadReasonCodes();
  if (isAuthStale(gen)) return;

  if (!state.students.length) {
    state.accountMode = 'no_children';
    state.selectedStudentId = null;
    applyAccountMode('no_children');
    renderSiblings();
    await navigate('children');
    return;
  }

  state.accountMode = 'ready';
  applyAccountMode('ready');
  if (!state.selectedStudentId && state.students[0]) {
    state.selectedStudentId = state.students[0].id;
  }
  renderSiblings();
  await navigate(state.currentRoute || 'home');
}

/**
 * @returns {Promise<'ok'|'unauthorized'|'forbidden'|'error'>}
 */
async function loadStudents() {
  const res = await guardianApi.get('/guardian/me/students');
  if (res && res._error) {
    if (res.status === 401) {
      state.students = [];
      return 'unauthorized';
    }
    if (res.status === 403) {
      toast(friendlyError(res, 'Access denied'), 'error');
      state.students = [];
      return 'forbidden';
    }
    toast(friendlyError(res, 'Could not load children'), 'error');
    state.students = [];
    return 'error';
  }
  state.students = res.students || [];
  return 'ok';
}

async function loadReasonCodes() {
  const res = await guardianApi.get('/guardian/reason-codes');
  if (res && res._error) {
    if (res.status === 401) return;
    state.reasonCodes = [];
    return;
  }
  state.reasonCodes = res.reasonCodes || res.reason_codes || [];
}

/**
 * Load accessibility.theme from profile and apply (account preference wins).
 * @param {number} gen
 */
async function loadProfileTheme(gen) {
  const res = await guardianApi.get('/guardian/me/profile');
  if (isAuthStale(gen)) return;
  if (res && res._error) {
    if (res.status === 401) return;
    return;
  }
  const accessibility =
    res.accessibility && typeof res.accessibility === 'object' ? { ...res.accessibility } : {};
  state.profileAccessibility = accessibility;
  const theme = typeof accessibility.theme === 'string' ? accessibility.theme : '';
  if (theme && getValidThemes().indexOf(theme) >= 0) {
    setTheme(theme);
    syncThemeDots();
  }
}

/**
 * @param {string} themeId
 */
async function onThemeSelect(themeId) {
  const session = getGuardianSession();
  if (!session || !session.token) {
    setTheme('chromium');
    syncThemeDots();
    return;
  }
  const prev = getTheme();
  const next = getValidThemes().indexOf(themeId) >= 0 ? themeId : 'chromium';
  setTheme(next);
  syncThemeDots();

  const merged = { ...state.profileAccessibility, theme: next };
  const patch = await guardianApi.patch('/guardian/me/profile', {
    accessibility: merged,
  });
  if (patch && patch._error) {
    if (patch.status === 401) return;
    setTheme(prev);
    syncThemeDots();
    toast(friendlyError(patch, 'Could not save theme'), 'error');
    return;
  }
  state.profileAccessibility = merged;
  if (patch && patch.accessibility && typeof patch.accessibility === 'object') {
    state.profileAccessibility = { ...patch.accessibility };
  }
}

/**
 * Instant sibling switch — bumps request gen so in-flight panes discard results.
 * @param {string} studentId
 */
export async function selectStudent(studentId) {
  if (!studentId || studentId === state.selectedStudentId) return;
  if (state.accountMode !== 'ready') return;
  state.selectedStudentId = studentId;
  state.activeThreadId = null;
  state.messages = [];
  resetDiaryRange(daysAgoIso(14), todayIso());
  bumpRequestGen();
  renderSiblings();
  await navigate(state.currentRoute || 'home');
}

/**
 * @param {string} route
 */
export async function navigate(route) {
  let next = route || 'home';
  if (state.accountMode === 'no_children' && next !== 'children' && next !== 'more') {
    next = 'children';
  }
  if (
    (state.accountMode === 'forbidden' || state.accountMode === 'error') &&
    next !== 'more'
  ) {
    next = 'more';
  }

  state.currentRoute = next;
  highlightNav(next);
  const main = viewMainEl();
  if (!main) return;
  const gen = currentRequestGen();
  main.focus({ preventScroll: true });

  if (state.accountMode === 'no_children' && next === 'children') {
    renderChildren(main, (id) => {
      selectStudent(id);
    });
    return;
  }

  switch (next) {
    case 'home':
      await renderHome(main, gen, navigate);
      break;
    case 'children':
      renderChildren(main, (id) => {
        selectStudent(id);
      });
      break;
    case 'learning':
      await renderLearning(main, gen);
      break;
    case 'attendance':
      await renderAttendance(main, gen);
      break;
    case 'inbox':
      await renderInbox(main, gen);
      break;
    case 'calendar':
      await renderCalendar(main, gen);
      break;
    case 'payments':
      await renderPayments(main, gen);
      break;
    case 'transport':
      await renderTransport(main, gen);
      break;
    case 'forms':
      await renderForms(main, gen);
      break;
    case 'documents':
      await renderDocuments(main, gen);
      break;
    case 'more':
      await renderMore(main, gen);
      break;
    default: {
      const _exhaustive = next;
      void _exhaustive;
      await renderHome(main, gen, navigate);
      break;
    }
  }
}

/** @deprecated Prefer navigate + selectStudent; kept for tests */
export async function refreshAllPanes() {
  bumpRequestGen();
  renderSiblings();
  await navigate(state.currentRoute || 'home');
}

export function __testState() {
  return snapshotTestState();
}

export function __setTestState(partial) {
  applyTestState(partial);
}

export { state, renderLogin, renderSiblings };

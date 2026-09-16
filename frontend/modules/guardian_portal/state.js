/**
 * Shared mutable state for the guardian parent portal.
 * Child-scoped loads use requestGen so stale responses are ignored after sibling switch.
 */

export const state = {
  /** @type {HTMLElement | null} */
  root: null,
  /** @type {Array<any>} */
  students: [],
  /** @type {string | null} */
  selectedStudentId: null,
  /** @type {Array<any>} */
  reasonCodes: [],
  /** @type {Array<any>} */
  threads: [],
  /** @type {string | null} */
  activeThreadId: null,
  /** @type {Array<any>} */
  messages: [],
  /** @type {string} */
  viewMonth: '',
  /** @type {Array<any>} */
  diaryEntries: [],
  /** @type {string} */
  diaryFrom: '',
  /** @type {string} */
  diaryTo: '',
  /** @type {Set<string>} */
  diarySeenIds: new Set(),
  /** @type {Set<string>} */
  diaryAckPending: new Set(),
  /** @type {Array<any>} */
  pendingSurveys: [],
  /** @type {string | null} */
  activeSurveyId: null,
  /** @type {string} */
  currentRoute: 'home',
  /**
   * Account gate after auth:
   * 'loading' | 'ready' | 'no_children' | 'forbidden' | 'error'
   * @type {string}
   */
  accountMode: 'loading',
  /** @type {Record<string, unknown>} */
  profileAccessibility: {},
  /** Increments on sibling switch so in-flight pane loads discard results. */
  requestGen: 0,
};

export function setRoot(el) {
  state.root = el;
}

export function bumpRequestGen() {
  state.requestGen += 1;
  return state.requestGen;
}

export function currentRequestGen() {
  return state.requestGen;
}

export function isStale(gen) {
  return gen !== state.requestGen;
}

export function selectedStudent() {
  return state.students.find((s) => s.id === state.selectedStudentId) || null;
}

/**
 * @param {string} from
 * @param {string} to
 */
export function resetDiaryRange(from, to) {
  state.diaryFrom = from;
  state.diaryTo = to;
  state.diarySeenIds = new Set();
}

/**
 * Clear authenticated in-memory state (logout / session expiry / re-enter).
 * Bumps requestGen so in-flight panes discard results.
 */
export function resetAuthenticatedState() {
  state.students = [];
  state.selectedStudentId = null;
  state.reasonCodes = [];
  state.threads = [];
  state.activeThreadId = null;
  state.messages = [];
  state.viewMonth = '';
  state.diaryEntries = [];
  state.diaryFrom = '';
  state.diaryTo = '';
  state.diarySeenIds = new Set();
  state.diaryAckPending = new Set();
  state.pendingSurveys = [];
  state.activeSurveyId = null;
  state.currentRoute = 'home';
  state.accountMode = 'loading';
  state.profileAccessibility = {};
  bumpRequestGen();
}

export function applyTestState(partial) {
  if (partial.students) state.students = partial.students;
  if (partial.selectedStudentId !== undefined) {
    state.selectedStudentId = partial.selectedStudentId;
  }
  if (partial.reasonCodes) state.reasonCodes = partial.reasonCodes;
  if (partial.threads) state.threads = partial.threads;
  if (partial.diaryEntries) state.diaryEntries = partial.diaryEntries;
  if (partial.diaryFrom) state.diaryFrom = partial.diaryFrom;
  if (partial.diaryTo) state.diaryTo = partial.diaryTo;
  if (partial.diarySeenIds) state.diarySeenIds = new Set(partial.diarySeenIds);
  if (partial.currentRoute) state.currentRoute = partial.currentRoute;
  if (partial.viewMonth) state.viewMonth = partial.viewMonth;
}

export function snapshotTestState() {
  return {
    students: state.students,
    selectedStudentId: state.selectedStudentId,
    threads: state.threads,
    activeThreadId: state.activeThreadId,
    diaryEntries: state.diaryEntries,
    diaryFrom: state.diaryFrom,
    diaryTo: state.diaryTo,
    diarySeenIds: [...state.diarySeenIds],
    currentRoute: state.currentRoute,
    requestGen: state.requestGen,
  };
}

/**
 * modules/school_exams/school_exams.js
 *
 * Exams: Terms | Planner | Marks | Report cards | Sittings | Tickets.
 * Pattern: render… → sexLoadData() → sexRender().
 * HTTP only via api.school('school-assessment') + school-identity for roster.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule, navigateToModule } from '../../shared/router.js';
import { schoolRoleAllows, canSchoolAdminOps } from '../../shared/school-roles.js';

const TERM_LABELS = ['PT1', 'HY', 'PT2', 'Annual', 'custom'];
const EXAM_KINDS = ['formative', 'summative'];
const BOARD_FORMATS = ['cbse_9pt', 'msbshse_ssc', 'msbshse_hsc', 'icse', 'custom'];

/** @type {Array<'terms'|'planner'|'marks'|'report_cards'|'sittings'|'tickets'>} */
const ALL_TABS = ['terms', 'planner', 'marks', 'report_cards', 'sittings', 'tickets'];

let _container = null;
/** @type {'terms'|'planner'|'marks'|'report_cards'|'sittings'|'tickets'} */
let _view = 'marks';
/** @type {object[]} */
let _terms = [];
/** @type {object[]} */
let _exams = [];
/** @type {object[]} */
let _students = [];
/** @type {object[]} */
let _marks = [];
/** @type {object|null} */
let _stats = null;
/** @type {object[]} */
let _templates = [];
/** @type {object[]} */
let _cards = [];
/** @type {object[]} */
let _sittings = [];
/** @type {object[]} */
let _tickets = [];
let _selectedSittingId = '';
let _printCard = null;
let _importErrors = [];
let _sessionId = '';
let _selectedExamId = '';
let _selectedTemplateId = '';
let _classFilter = '';
let _sectionFilter = '';
let _loadError = '';
let _busy = false;
/** @type {Record<string, { draftMarks: string, isAbsent: boolean, isExempt: boolean, markId: string|null, publishedAt: string|null, assignedMarks: number|null }>} */
let _grid = {};
/** @type {string[]} */
let _publishMissing = [];

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _as() {
  return api.school('school-assessment');
}

function _id() {
  return api.school('school-identity');
}

function _err(res) {
  if (!res || res._error) {
    return (res && (res.error || res.message)) || 'Request failed';
  }
  return null;
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'teacher';
}

function _isAdmin() {
  const session = getSession() || {};
  const roles =
    typeof window !== 'undefined' && window.BlokHR && window.BlokHR.userRoles
      ? window.BlokHR.userRoles
      : null;
  return !!(
    (roles && roles.isAdmin) ||
    session.is_admin ||
    session.role === 'admin'
  );
}

function _schoolRole() {
  const s = getSession() || {};
  return s.schoolRole || '';
}

/** Admin ops: terms CRUD, exam create, publish, templates, generate */
export function sexCanAdmin() {
  return canSchoolAdminOps(_schoolRole(), _isAdmin());
}

/** Marks entry: teacher + school_admin */
export function sexCanMarks() {
  return schoolRoleAllows(_schoolRole(), _isAdmin(), 'teacher,school_admin');
}

/** Report card list GET: office+ */
export function sexCanReportCards() {
  return schoolRoleAllows(_schoolRole(), _isAdmin(), 'office,school_admin');
}

/**
 * Sum of term weightage_pct for a session (client display; server remains authority).
 * @param {object[]} terms
 * @param {string} [sessionId]
 */
export function sumWeightage(terms, sessionId) {
  const list = terms || [];
  let sum = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (sessionId && t.academicSessionId !== sessionId && t.academic_session_id !== sessionId) {
      continue;
    }
    const w = Number(t.weightagePct != null ? t.weightagePct : t.weightage_pct);
    if (Number.isFinite(w)) sum += w;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Client hint: draft marks valid for maxMarks (server remains authority).
 * @param {string|number|null|undefined} draft
 * @param {number} maxMarks
 * @param {boolean} isAbsent
 * @param {boolean} isExempt
 */
export function draftMarkValid(draft, maxMarks, isAbsent, isExempt) {
  if (isAbsent && isExempt) return { ok: false, error: 'absent and exempt are mutually exclusive' };
  if (isAbsent || isExempt) {
    if (draft !== '' && draft != null && String(draft).trim() !== '') {
      return { ok: false, error: 'marks cannot be set with absent/exempt' };
    }
    return { ok: true };
  }
  if (draft === '' || draft == null) return { ok: true };
  const n = Number(draft);
  if (!Number.isFinite(n)) return { ok: false, error: 'marks must be a number' };
  if (n < 0 || n > maxMarks) {
    return { ok: false, error: 'marks must be 0..' + maxMarks };
  }
  return { ok: true };
}

/**
 * Parse CSV text into import rows.
 * Header: student_id,draft_marks,is_absent,is_exempt
 * @param {string} text
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseMarksCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  const errors = [];
  const rows = [];
  if (!lines.length) return { rows: [], errors: ['empty file'] };
  let start = 0;
  const header = lines[0].toLowerCase();
  if (header.indexOf('student') >= 0) start = 1;
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',').map(function (p) {
      return p.trim();
    });
    const studentId = parts[0] || '';
    if (!studentId) {
      errors.push('line ' + (i + 1) + ': missing student_id');
      continue;
    }
    const draftRaw = parts[1] || '';
    const absent = /^(1|true|yes|y)$/i.test(parts[2] || '');
    const exempt = /^(1|true|yes|y)$/i.test(parts[3] || '');
    /** @type {Record<string, unknown>} */
    const row = { student_id: studentId };
    if (absent) row.is_absent = true;
    else if (exempt) row.is_exempt = true;
    else if (draftRaw !== '') row.draft_marks = Number(draftRaw);
    rows.push(row);
  }
  return { rows: rows, errors: errors };
}

/**
 * Build PUT marks payload from grid state.
 * @param {Record<string, { draftMarks: string, isAbsent: boolean, isExempt: boolean }>} grid
 * @param {string} enteredBy
 */
export function marksPayloadFromGrid(grid, enteredBy) {
  const marks = [];
  const ids = Object.keys(grid || {});
  for (let i = 0; i < ids.length; i++) {
    const sid = ids[i];
    const row = grid[sid];
    /** @type {Record<string, unknown>} */
    const entry = { student_id: sid };
    if (row.isAbsent) {
      entry.is_absent = true;
    } else if (row.isExempt) {
      entry.is_exempt = true;
    } else if (row.draftMarks !== '' && row.draftMarks != null) {
      entry.draft_marks = Number(row.draftMarks);
    } else {
      continue;
    }
    marks.push(entry);
  }
  return { entered_by: enteredBy, marks: marks };
}

/**
 * Visible tabs for current role.
 * @returns {Array<'terms'|'planner'|'marks'|'report_cards'|'sittings'|'tickets'>}
 */
export function sexVisibleTabs() {
  /** @type {Array<'terms'|'planner'|'marks'|'report_cards'|'sittings'|'tickets'>} */
  const tabs = [];
  if (sexCanAdmin()) tabs.push('terms');
  tabs.push('planner');
  if (sexCanMarks()) tabs.push('marks');
  if (sexCanAdmin() || sexCanReportCards()) tabs.push('report_cards');
  if (sexCanAdmin()) {
    tabs.push('sittings');
    tabs.push('tickets');
  } else if (sexCanMarks()) {
    tabs.push('tickets');
  }
  return tabs.length ? tabs : ['planner'];
}

/**
 * @param {Partial<{view:string,terms:object[],exams:object[],students:object[],marks:object[],stats:object|null,templates:object[],cards:object[],sessionId:string,selectedExamId:string,selectedTemplateId:string,classFilter:string,sectionFilter:string,grid:object,publishMissing:string[]}>} patch
 */
export function sexSetState(patch) {
  if (patch.view != null) _view = /** @type {any} */ (patch.view);
  if (patch.terms != null) _terms = patch.terms;
  if (patch.exams != null) _exams = patch.exams;
  if (patch.students != null) _students = patch.students;
  if (patch.marks != null) _marks = patch.marks;
  if (patch.stats !== undefined) _stats = patch.stats;
  if (patch.templates != null) _templates = patch.templates;
  if (patch.cards != null) _cards = patch.cards;
  if (patch.sessionId != null) _sessionId = patch.sessionId;
  if (patch.selectedExamId != null) _selectedExamId = patch.selectedExamId;
  if (patch.selectedTemplateId != null) _selectedTemplateId = patch.selectedTemplateId;
  if (patch.classFilter != null) _classFilter = patch.classFilter;
  if (patch.sectionFilter != null) _sectionFilter = patch.sectionFilter;
  if (patch.grid != null) _grid = /** @type {any} */ (patch.grid);
  if (patch.publishMissing != null) _publishMissing = patch.publishMissing;
}

export function sexGetState() {
  return {
    view: _view,
    terms: _terms,
    exams: _exams,
    students: _students,
    marks: _marks,
    stats: _stats,
    templates: _templates,
    cards: _cards,
    sessionId: _sessionId,
    selectedExamId: _selectedExamId,
    selectedTemplateId: _selectedTemplateId,
    classFilter: _classFilter,
    sectionFilter: _sectionFilter,
    grid: _grid,
    publishMissing: _publishMissing,
    loadError: _loadError,
  };
}

export async function renderSchoolExamsPage(container) {
  _container = container;
  const tabs = sexVisibleTabs();
  _view = tabs.indexOf('marks') >= 0 ? 'marks' : tabs[0];
  _loadError = '';
  _publishMissing = [];
  if (!_sessionId) _sessionId = 'ay-' + new Date().getFullYear();

  container.innerHTML =
    '<div class="sex-wrap" id="sexWrap">' +
    '<div class="sex-title">Exams</div>' +
    '<div class="sex-tabs" id="sexTabs"></div>' +
    '<div id="sexBody"><div class="sex-empty">Loading…</div></div>' +
    '</div>';

  _bindTabs();
  await sexLoadData();
  sexRender();
}

function _bindTabs() {
  const tabsEl = _container.querySelector('#sexTabs');
  if (!tabsEl) return;
  const tabs = sexVisibleTabs();
  const labels = {
    terms: 'Terms',
    planner: 'Planner',
    marks: 'Marks',
    report_cards: 'Report cards',
    sittings: 'Sittings',
    tickets: 'Tickets',
  };
  tabsEl.innerHTML = tabs
    .map(function (v) {
      return (
        '<button type="button" class="sex-tab' +
        (_view === v ? ' active' : '') +
        '" data-view="' +
        v +
        '">' +
        labels[v] +
        '</button>'
      );
    })
    .join('');

  tabsEl.querySelectorAll('.sex-tab').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      _view = /** @type {any} */ (btn.getAttribute('data-view') || 'planner');
      tabsEl.querySelectorAll('.sex-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab === btn);
      });
      _publishMissing = [];
      _printCard = null;
      _importErrors = [];
      await sexLoadData();
      sexRender();
    });
  });
}

export async function sexLoadData() {
  const client = _as();
  _loadError = '';

  if (_view === 'terms') {
    const res = await client.get(
      '/exam-terms?academic_session_id=' + encodeURIComponent(_sessionId),
    );
    if (_err(res)) _loadError = _err(res);
    else _terms = (res && res.terms) || [];
  } else if (_view === 'planner') {
    const [termsRes, examsRes] = await Promise.all([
      client.get('/exam-terms?academic_session_id=' + encodeURIComponent(_sessionId)),
      client.get('/exams'),
    ]);
    if (_err(termsRes)) _loadError = _err(termsRes);
    else _terms = (termsRes && termsRes.terms) || [];
    if (_err(examsRes)) _loadError = _err(examsRes) || _loadError;
    else _exams = (examsRes && examsRes.exams) || [];
  } else if (_view === 'marks') {
    const examsRes = await client.get('/exams');
    if (_err(examsRes)) {
      _loadError = _err(examsRes);
      return;
    }
    _exams = (examsRes && examsRes.exams) || [];
    if (!_selectedExamId && _exams.length) _selectedExamId = _exams[0].id;
    if (_selectedExamId) await _loadMarksForExam(_selectedExamId);
  } else if (_view === 'sittings') {
    const examsRes = await client.get('/exams');
    if (_err(examsRes)) {
      _loadError = _err(examsRes);
      return;
    }
    _exams = (examsRes && examsRes.exams) || [];
    if (!_selectedExamId && _exams.length) _selectedExamId = _exams[0].id;
    if (_selectedExamId) {
      const sitsRes = await client.get(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/sittings',
      );
      if (_err(sitsRes)) _loadError = _err(sitsRes);
      else _sittings = (sitsRes && sitsRes.sittings) || [];
    } else {
      _sittings = [];
    }
  } else if (_view === 'tickets') {
    const examsRes = await client.get('/exams');
    if (_err(examsRes)) {
      _loadError = _err(examsRes);
      return;
    }
    _exams = (examsRes && examsRes.exams) || [];
    if (!_selectedExamId && _exams.length) _selectedExamId = _exams[0].id;
    if (_selectedExamId) {
      const sitsRes = await client.get(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/sittings',
      );
      if (_err(sitsRes)) {
        _loadError = _err(sitsRes);
        _sittings = [];
      } else {
        _sittings = (sitsRes && sitsRes.sittings) || [];
      }
    } else {
      _sittings = [];
    }
    if (!_selectedSittingId && _sittings.length) _selectedSittingId = _sittings[0].id;
    if (_selectedSittingId) {
      const ticketsRes = await client.get(
        '/sittings/' + encodeURIComponent(_selectedSittingId) + '/tickets',
      );
      if (_err(ticketsRes)) _loadError = _err(ticketsRes) || _loadError;
      else _tickets = (ticketsRes && ticketsRes.tickets) || [];
    } else {
      _tickets = [];
    }
  } else if (_view === 'report_cards') {
    const [tplRes, cardsRes] = await Promise.all([
      sexCanAdmin() ? client.get('/templates') : Promise.resolve({ templates: [] }),
      client.get('/report-cards'),
    ]);
    if (sexCanAdmin() && _err(tplRes)) _loadError = _err(tplRes);
    else _templates = (tplRes && tplRes.templates) || [];
    if (_err(cardsRes)) _loadError = _err(cardsRes) || _loadError;
    else _cards = (cardsRes && cardsRes.cards) || [];
    if (!_selectedTemplateId && _templates.length) {
      const live = _templates.find(function (t) {
        return t.state === 'live';
      });
      _selectedTemplateId = (live || _templates[0]).id;
    }
  }
}

async function _loadMarksForExam(examId) {
  const exam = _exams.find(function (e) {
    return e.id === examId;
  });
  const classLabel = exam ? exam.classLabel || exam.class_label || '' : '';
  const sectionRef = exam ? exam.sectionRef || exam.section_ref || '' : '';

  let qs = '/students?status=active&limit=200&offset=0';
  if (classLabel) qs += '&class=' + encodeURIComponent(classLabel);
  const [marksRes, studentsRes] = await Promise.all([
    _as().get('/exams/' + encodeURIComponent(examId) + '/marks'),
    _id().get(qs),
  ]);

  if (_err(marksRes)) {
    _loadError = _err(marksRes);
    _marks = [];
    _stats = null;
  } else {
    _marks = (marksRes && marksRes.marks) || [];
    _stats = (marksRes && marksRes.stats) || null;
  }

  let students = studentsRes && !studentsRes._error ? studentsRes.items || [] : [];
  if (sectionRef) {
    students = students.filter(function (s) {
      const sec = s.section || s.sectionLabel || s.section_label || '';
      return !sec || sec === sectionRef;
    });
  }
  _students = students;
  _grid = _buildGrid(_students, _marks);
}

/**
 * @param {object[]} students
 * @param {object[]} marks
 */
function _buildGrid(students, marks) {
  /** @type {typeof _grid} */
  const grid = {};
  const byStudent = {};
  (marks || []).forEach(function (m) {
    const sid = m.studentId || m.student_id;
    if (sid) byStudent[sid] = m;
  });
  const ids = {};
  (students || []).forEach(function (s) {
    ids[s.id] = true;
    const m = byStudent[s.id];
    grid[s.id] = {
      draftMarks:
        m && m.draftMarks != null
          ? String(m.draftMarks)
          : m && m.draft_marks != null
            ? String(m.draft_marks)
            : '',
      isAbsent: !!(m && (m.isAbsent || m.is_absent)),
      isExempt: !!(m && (m.isExempt || m.is_exempt)),
      markId: m ? m.id : null,
      publishedAt: m ? m.publishedAt || m.published_at || null : null,
      assignedMarks:
        m && m.assignedMarks != null
          ? m.assignedMarks
          : m && m.assigned_marks != null
            ? m.assigned_marks
            : null,
    };
  });
  Object.keys(byStudent).forEach(function (sid) {
    if (ids[sid]) return;
    const m = byStudent[sid];
    grid[sid] = {
      draftMarks: m.draftMarks != null ? String(m.draftMarks) : '',
      isAbsent: !!(m.isAbsent || m.is_absent),
      isExempt: !!(m.isExempt || m.is_exempt),
      markId: m.id,
      publishedAt: m.publishedAt || m.published_at || null,
      assignedMarks: m.assignedMarks != null ? m.assignedMarks : m.assigned_marks,
    };
  });
  return grid;
}

export function sexRender() {
  if (!_container) return;
  const body = _container.querySelector('#sexBody');
  if (!body) return;
  if (_loadError) {
    body.innerHTML =
      '<div class="sex-service-error" role="alert">' +
      '<div class="sex-service-error-title">Assessment service unavailable</div>' +
      '<p>We could not load exam data. Your current entries have not been changed.</p>' +
      '<p class="sex-hint">' +
      _esc(_loadError) +
      '</p>' +
      '<button type="button" class="sex-btn primary" id="sexRetry">Retry</button>' +
      '</div>';
    const retry = body.querySelector('#sexRetry');
    if (retry) {
      retry.addEventListener('click', async function () {
        await sexLoadData();
        sexRender();
      });
    }
    return;
  }
  if (_view === 'report_cards' && _printCard) {
    body.innerHTML = _htmlPrintCard(_printCard);
  } else if (_view === 'terms') body.innerHTML = _htmlTerms();
  else if (_view === 'planner') body.innerHTML = _htmlPlanner();
  else if (_view === 'marks') body.innerHTML = _htmlMarks();
  else if (_view === 'sittings') body.innerHTML = _htmlSittings();
  else if (_view === 'tickets') body.innerHTML = _htmlTickets();
  else body.innerHTML = _htmlReportCards();
  _bindBody();
}

function _toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = function (n) {
    return String(n).padStart(2, '0');
  };
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function _fromDatetimeLocal(val) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function _htmlTerms() {
  const total = sumWeightage(_terms, _sessionId);
  const warn = total > 100;
  const rows = _terms
    .map(function (t) {
      const w = t.weightagePct != null ? t.weightagePct : t.weightage_pct;
      return (
        '<tr data-term-id="' +
        _esc(t.id) +
        '">' +
        '<td>' +
        _esc(t.label) +
        '</td>' +
        '<td>' +
        _esc(t.startsOn || t.starts_on) +
        '</td>' +
        '<td>' +
        _esc(t.endsOn || t.ends_on) +
        '</td>' +
        '<td>' +
        _esc(String(w)) +
        '%</td>' +
        '<td><button type="button" class="sex-btn sex-del-term" data-id="' +
        _esc(t.id) +
        '">Delete</button></td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="sex-toolbar">' +
    '<label class="sex-hint">Session</label>' +
    '<input class="sex-input" id="sexSession" value="' +
    _esc(_sessionId) +
    '" />' +
    '<button type="button" class="sex-btn" id="sexReloadSession">Load</button>' +
    '<span class="sex-weightage' +
    (warn ? ' warn' : '') +
    '" id="sexWeightTotal">Weightage: ' +
    total +
    '% / 100%</span>' +
    '</div>' +
    (sexCanAdmin()
      ? '<div class="sex-form-grid" id="sexTermForm">' +
        '<label>Label<select class="sex-select" id="sexTermLabel">' +
        TERM_LABELS.map(function (l) {
          return '<option value="' + l + '">' + l + '</option>';
        }).join('') +
        '</select></label>' +
        '<label>Starts<input class="sex-input" type="date" id="sexTermStart" /></label>' +
        '<label>Ends<input class="sex-input" type="date" id="sexTermEnd" /></label>' +
        '<label>Weight %<input class="sex-input narrow" type="number" id="sexTermWeight" min="0" max="100" step="0.1" value="25" /></label>' +
        '<label>&nbsp;<button type="button" class="sex-btn primary" id="sexTermCreate">Add term</button></label>' +
        '</div>'
      : '') +
    (_terms.length
      ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Label</th><th>Starts</th><th>Ends</th><th>Weight</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div>'
      : '<div class="sex-empty">No exam terms for this session.</div>')
  );
}

function _htmlPlanner() {
  const termOpts = _terms
    .map(function (t) {
      return (
        '<option value="' +
        _esc(t.id) +
        '">' +
        _esc(t.label) +
        ' (' +
        _esc(String(t.weightagePct != null ? t.weightagePct : t.weightage_pct)) +
        '%)</option>'
      );
    })
    .join('');

  const rows = _exams
    .map(function (e) {
      return (
        '<tr>' +
        '<td>' +
        _esc(e.subjectCode || e.subject_code) +
        '</td>' +
        '<td>' +
        _esc(e.classLabel || e.class_label) +
        '</td>' +
        '<td>' +
        _esc(e.sectionRef || e.section_ref) +
        '</td>' +
        '<td>' +
        _esc(e.date) +
        '</td>' +
        '<td>' +
        _esc(String(e.maxMarks != null ? e.maxMarks : e.max_marks)) +
        '</td>' +
        '<td>' +
        _esc(e.kind) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="sex-toolbar">' +
    '<label class="sex-hint">Session</label>' +
    '<input class="sex-input" id="sexSession" value="' +
    _esc(_sessionId) +
    '" />' +
    '<button type="button" class="sex-btn" id="sexReloadSession">Reload terms</button>' +
    '</div>' +
    (sexCanAdmin()
      ? '<div class="sex-form-grid" id="sexExamForm">' +
        '<label>Term<select class="sex-select" id="sexExamTerm">' +
        (termOpts || '<option value="">No terms</option>') +
        '</select></label>' +
        '<label>Course ref<input class="sex-input" id="sexExamCourse" placeholder="course-id" /></label>' +
        '<label>Section<input class="sex-input" id="sexExamSection" placeholder="A" /></label>' +
        '<label>Subject<input class="sex-input" id="sexExamSubject" placeholder="SCI" /></label>' +
        '<label>Class<input class="sex-input" id="sexExamClass" placeholder="8" /></label>' +
        '<label>Date<input class="sex-input" type="date" id="sexExamDate" /></label>' +
        '<label>Max marks<input class="sex-input narrow" type="number" id="sexExamMax" min="1" value="80" /></label>' +
        '<label>Kind<select class="sex-select" id="sexExamKind">' +
        EXAM_KINDS.map(function (k) {
          return '<option value="' + k + '">' + k + '</option>';
        }).join('') +
        '</select></label>' +
        '<label>&nbsp;<button type="button" class="sex-btn primary" id="sexExamCreate">Schedule exam</button></label>' +
        '</div>'
      : '<p class="sex-hint">Teachers can view the schedule. School admins create exams.</p>') +
    (_exams.length
      ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Subject</th><th>Class</th><th>Section</th><th>Date</th><th>Max</th><th>Kind</th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div>'
      : '<div class="sex-empty">No exams scheduled yet.</div>')
  );
}

function _htmlMarks() {
  const examOpts = _exams
    .map(function (e) {
      const label =
        (e.subjectCode || e.subject_code || '') +
        ' · ' +
        (e.classLabel || e.class_label || '') +
        (e.sectionRef || e.section_ref ? '-' + (e.sectionRef || e.section_ref) : '') +
        ' · ' +
        (e.date || '');
      return (
        '<option value="' +
        _esc(e.id) +
        '"' +
        (e.id === _selectedExamId ? ' selected' : '') +
        '>' +
        _esc(label) +
        '</option>'
      );
    })
    .join('');

  const exam = _exams.find(function (e) {
    return e.id === _selectedExamId;
  });
  const maxMarks = exam
    ? Number(exam.maxMarks != null ? exam.maxMarks : exam.max_marks) || 0
    : 0;

  const stats = _stats || {};
  const chips =
    '<div class="sex-stats">' +
    '<span class="sex-chip">Mean: ' +
    _esc(stats.mean != null ? String(stats.mean) : '—') +
    '</span>' +
    '<span class="sex-chip">Median: ' +
    _esc(stats.median != null ? String(stats.median) : '—') +
    '</span>' +
    '<span class="sex-chip">High: ' +
    _esc(stats.high != null ? String(stats.high) : '—') +
    '</span>' +
    '<span class="sex-chip">Low: ' +
    _esc(stats.low != null ? String(stats.low) : '—') +
    '</span>' +
    '<span class="sex-chip">Absent: ' +
    _esc(String(stats.absentCount != null ? stats.absentCount : stats.absent_count || 0)) +
    '</span>' +
    '<span class="sex-chip">Max: ' +
    _esc(String(maxMarks)) +
    '</span>' +
    '</div>';

  const studentIds = Object.keys(_grid);
  const rows = studentIds
    .map(function (sid) {
      const s = _students.find(function (x) {
        return x.id === sid;
      });
      const name = s
        ? [s.firstName || s.first_name, s.lastName || s.last_name].filter(Boolean).join(' ') ||
          sid
        : sid;
      const row = _grid[sid];
      const published = !!row.publishedAt;
      return (
        '<tr data-student-id="' +
        _esc(sid) +
        '">' +
        '<td>' +
        _esc(name) +
        (published
          ? ' <span class="sex-badge">published' +
            (row.assignedMarks != null ? ' · ' + row.assignedMarks : '') +
            '</span>'
          : '') +
        '</td>' +
        '<td><input type="number" min="0" max="' +
        maxMarks +
        '" step="0.5" class="sex-draft" data-sid="' +
        _esc(sid) +
        '" value="' +
        _esc(row.draftMarks) +
        '"' +
        (row.isAbsent || row.isExempt ? ' disabled' : '') +
        ' /></td>' +
        '<td><label class="sex-flag"><input type="checkbox" class="sex-absent" data-sid="' +
        _esc(sid) +
        '"' +
        (row.isAbsent ? ' checked' : '') +
        ' />Absent</label>' +
        '<label class="sex-flag"><input type="checkbox" class="sex-exempt" data-sid="' +
        _esc(sid) +
        '"' +
        (row.isExempt ? ' checked' : '') +
        ' />Exempt</label></td>' +
        (sexCanAdmin() && published
          ? '<td><button type="button" class="sex-btn sex-moderate" data-mark-id="' +
            _esc(row.markId || '') +
            '" data-sid="' +
            _esc(sid) +
            '">Moderate</button></td>'
          : '<td></td>') +
        '</tr>'
      );
    })
    .join('');

  const missingHtml =
    _publishMissing.length > 0
      ? '<ul class="sex-error-list" id="sexPublishMissing">' +
        _publishMissing
          .map(function (id) {
            return '<li>Missing draft for student ' + _esc(id) + '</li>';
          })
          .join('') +
        '</ul>'
      : '';

  const importErrHtml =
    _importErrors.length > 0
      ? '<ul class="sex-error-list sex-import-errors" id="sexImportErrors">' +
        _importErrors
          .map(function (msg) {
            return '<li>' + _esc(msg) + '</li>';
          })
          .join('') +
        '</ul>'
      : '';

  const entryClosesAt = exam
    ? exam.entryClosesAt || exam.entry_closes_at || null
    : null;

  const lockHtml = sexCanAdmin()
    ? '<div class="sex-toolbar sex-lock-bar">' +
      '<span class="sex-hint">Entry closes: ' +
      _esc(entryClosesAt || 'not set') +
      '</span>' +
      '<input class="sex-input" type="datetime-local" id="sexLockAt" value="' +
      _esc(_toDatetimeLocal(entryClosesAt)) +
      '" />' +
      '<button type="button" class="sex-btn" id="sexMarksLock"' +
      (_busy || !_selectedExamId ? ' disabled' : '') +
      '>Set lock</button>' +
      '<button type="button" class="sex-btn" id="sexMarksUnlock"' +
      (_busy || !_selectedExamId ? ' disabled' : '') +
      '>Unlock</button>' +
      '</div>'
    : entryClosesAt
      ? '<p class="sex-hint">Marks entry closes at ' + _esc(entryClosesAt) + '</p>'
      : '';

  const importHtml = sexCanMarks()
    ? '<div class="sex-toolbar">' +
      '<input type="file" accept=".csv,text/csv" id="sexCsvFile" class="sex-file" />' +
      '<button type="button" class="sex-btn" id="sexMarksImport"' +
      (_busy || !_selectedExamId ? ' disabled' : '') +
      '>Import</button>' +
      '</div>' +
      importErrHtml
    : '';

  return (
    '<div class="sex-toolbar">' +
    '<label class="sex-hint">Exam</label>' +
    '<select class="sex-select" id="sexMarksExam">' +
    (examOpts || '<option value="">No exams</option>') +
    '</select>' +
    (sexCanMarks()
      ? '<button type="button" class="sex-btn primary" id="sexMarksSave"' +
        (_busy || !_selectedExamId ? ' disabled' : '') +
        '>Save drafts</button>'
      : '') +
    (sexCanAdmin()
      ? '<button type="button" class="sex-btn" id="sexMarksPublish"' +
        (_busy || !_selectedExamId ? ' disabled' : '') +
        '>Publish</button>'
      : '') +
    '</div>' +
    lockHtml +
    importHtml +
    chips +
    missingHtml +
    (studentIds.length
      ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Student</th><th>Draft marks</th><th>Flags</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div>'
      : '<div class="sex-empty">' +
        (_selectedExamId
          ? 'No students for this exam section yet.'
          : 'Select or schedule an exam first.') +
        '</div>')
  );
}

function _htmlReportCards() {
  const tplOpts = _templates
    .map(function (t) {
      return (
        '<option value="' +
        _esc(t.id) +
        '"' +
        (t.id === _selectedTemplateId ? ' selected' : '') +
        '>' +
        _esc(t.label) +
        ' · ' +
        _esc(t.state) +
        ' v' +
        _esc(String(t.version)) +
        '</option>'
      );
    })
    .join('');

  const tplRows = _templates
    .map(function (t) {
      return (
        '<tr>' +
        '<td>' +
        _esc(t.label) +
        '</td>' +
        '<td>' +
        _esc(t.boardFormat || t.board_format) +
        '</td>' +
        '<td><span class="sex-badge' +
        (t.state === 'live' ? ' live' : '') +
        '">' +
        _esc(t.state) +
        '</span></td>' +
        '<td>v' +
        _esc(String(t.version)) +
        '</td>' +
        '<td>' +
        (t.state === 'sandbox'
          ? '<button type="button" class="sex-btn sex-promote" data-id="' +
            _esc(t.id) +
            '">Promote</button> '
          : '') +
        '<button type="button" class="sex-btn sex-clone" data-id="' +
        _esc(t.id) +
        '">Clone</button></td>' +
        '</tr>'
      );
    })
    .join('');

  const cardRows = _cards
    .map(function (c) {
      const payload = c.payload || {};
      const rank = payload.rank != null ? payload.rank : c.rank;
      const outOf =
        payload.out_of != null
          ? payload.out_of
          : payload.outOf != null
            ? payload.outOf
            : c.out_of != null
              ? c.out_of
              : c.outOf;
      const pct =
        payload.percentage != null
          ? payload.percentage
          : c.percentage != null
            ? c.percentage
            : null;
      const visibleFrom = c.visibleFrom || c.visible_from || '';
      return (
        '<tr data-card-id="' +
        _esc(c.id) +
        '">' +
        '<td>' +
        _esc(c.studentId || c.student_id) +
        '</td>' +
        '<td>' +
        _esc(c.academicSessionRef || c.academic_session_ref) +
        '</td>' +
        '<td>' +
        _esc(c.generatedAt || c.generated_at) +
        '</td>' +
        '<td>v' +
        _esc(String(c.templateVersion != null ? c.templateVersion : c.template_version)) +
        '</td>' +
        '<td>' +
        _esc(rank != null ? String(rank) : '—') +
        (outOf != null ? ' / ' + _esc(String(outOf)) : '') +
        '</td>' +
        '<td>' +
        _esc(pct != null ? String(pct) + '%' : '—') +
        '</td>' +
        '<td>' +
        '<input class="sex-input sex-visible-from" type="datetime-local" data-id="' +
        _esc(c.id) +
        '" value="' +
        _esc(_toDatetimeLocal(visibleFrom)) +
        '" />' +
        '<button type="button" class="sex-btn sex-set-release" data-id="' +
        _esc(c.id) +
        '">Set release</button>' +
        '</td>' +
        '<td><button type="button" class="sex-btn sex-print-card" data-id="' +
        _esc(c.id) +
        '">Print</button></td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    (sexCanAdmin()
      ? '<div class="sex-form-grid" id="sexTplForm">' +
        '<label>Label<input class="sex-input" id="sexTplLabel" placeholder="Term 1 card" /></label>' +
        '<label>Board<select class="sex-select" id="sexTplBoard">' +
        BOARD_FORMATS.map(function (b) {
          return '<option value="' + b + '">' + b + '</option>';
        }).join('') +
        '</select></label>' +
        '<label class="sex-flag"><input type="checkbox" id="sexTplHeader" checked /> Header</label>' +
        '<label class="sex-flag"><input type="checkbox" id="sexTplFooter" checked /> Footer</label>' +
        '<label class="sex-flag"><input type="checkbox" id="sexTplSignatures" checked /> Signatures</label>' +
        '<label class="sex-flag"><input type="checkbox" id="sexTplHealth" /> Health</label>' +
        '<label>&nbsp;<button type="button" class="sex-btn primary" id="sexTplCreate">New sandbox template</button></label>' +
        '</div>' +
        (_templates.length
          ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Label</th><th>Board</th><th>State</th><th>Ver</th><th></th></tr></thead><tbody>' +
            tplRows +
            '</tbody></table></div>'
          : '<div class="sex-empty">No templates yet.</div>') +
        '<div class="sex-toolbar" style="margin-top:16px">' +
        '<label class="sex-hint">Generate with</label>' +
        '<select class="sex-select" id="sexGenTpl">' +
        (tplOpts || '<option value="">No templates</option>') +
        '</select>' +
        '<input class="sex-input" id="sexGenSession" value="' +
        _esc(_sessionId) +
        '" placeholder="session" />' +
        '<input class="sex-input" id="sexGenClass" placeholder="class" value="' +
        _esc(_classFilter) +
        '" />' +
        '<input class="sex-input" id="sexGenSection" placeholder="section" value="' +
        _esc(_sectionFilter) +
        '" />' +
        '<button type="button" class="sex-btn primary" id="sexGenRun">Generate</button>' +
        '</div>' +
        '<p class="sex-hint">Only published marks appear on report cards. Draft marks are never included.</p>'
      : '<p class="sex-hint">Office can view generated cards. School admins manage templates and generate.</p>') +
    '<div class="sex-title" style="margin-top:8px;font-size:13px">Generated cards</div>' +
    (_cards.length
      ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Student</th><th>Session</th><th>Generated</th><th>Template</th><th>Rank</th><th>%</th><th>Release</th><th></th></tr></thead><tbody>' +
        cardRows +
        '</tbody></table></div>'
      : '<div class="sex-empty">No report cards generated yet.</div>')
  );
}

function _examSelectHtml(selectId) {
  const examOpts = _exams
    .map(function (e) {
      const label =
        (e.subjectCode || e.subject_code || '') +
        ' · ' +
        (e.classLabel || e.class_label || '') +
        ' · ' +
        (e.date || '');
      return (
        '<option value="' +
        _esc(e.id) +
        '"' +
        (e.id === _selectedExamId ? ' selected' : '') +
        '>' +
        _esc(label) +
        '</option>'
      );
    })
    .join('');
  return (
    '<select class="sex-select" id="' +
    selectId +
    '">' +
    (examOpts || '<option value="">No exams</option>') +
    '</select>'
  );
}

function _htmlSittings() {
  const rows = _sittings
    .map(function (s) {
      return (
        '<tr>' +
        '<td>' +
        _esc(s.id) +
        '</td>' +
        '<td>' +
        _esc(s.roomLabel || s.room_label) +
        '</td>' +
        '<td>' +
        _esc(s.startsOn || s.starts_on) +
        '</td>' +
        '<td>' +
        _esc(s.endsOn || s.ends_on) +
        '</td>' +
        '<td><button type="button" class="sex-btn sex-issue-tickets" data-id="' +
        _esc(s.id) +
        '">Issue tickets</button></td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="sex-toolbar">' +
    '<label class="sex-hint">Exam</label>' +
    _examSelectHtml('sexSittingExam') +
    '</div>' +
    (sexCanAdmin()
      ? '<div class="sex-form-grid" id="sexSittingForm">' +
        '<label>Room<input class="sex-input" id="sexSittingRoom" placeholder="Hall A" /></label>' +
        '<label>Starts<input class="sex-input" type="datetime-local" id="sexSittingStarts" /></label>' +
        '<label>Ends<input class="sex-input" type="datetime-local" id="sexSittingEnds" /></label>' +
        '<label>Student IDs<textarea class="sex-input sex-textarea" id="sexSittingStudents" placeholder="one id per line"></textarea></label>' +
        '<label>&nbsp;<button type="button" class="sex-btn primary" id="sexSittingCreate"' +
        (!_selectedExamId ? ' disabled' : '') +
        '>Create sitting</button></label>' +
        '</div>'
      : '') +
    (_sittings.length
      ? '<div class="sex-table-wrap"><table class="sex-table"><thead><tr><th>Id</th><th>Room</th><th>Starts</th><th>Ends</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table></div>'
      : '<div class="sex-empty">' +
        (_selectedExamId ? 'No sittings for this exam yet.' : 'Select an exam first.') +
        '</div>')
  );
}

function _htmlTickets() {
  const sittingOpts = _sittings
    .map(function (s) {
      const label =
        (s.roomLabel || s.room_label || s.id) +
        ' · ' +
        (s.startsOn || s.starts_on || '');
      return (
        '<option value="' +
        _esc(s.id) +
        '"' +
        (s.id === _selectedSittingId ? ' selected' : '') +
        '>' +
        _esc(label) +
        '</option>'
      );
    })
    .join('');

  const cards = _tickets
    .map(function (t) {
      return (
        '<div class="sex-ticket-card">' +
        '<div class="sex-ticket-code">' +
        _esc(t.ticketCode || t.ticket_code) +
        '</div>' +
        '<div>Student: ' +
        _esc(t.studentId || t.student_id) +
        '</div>' +
        '<div>Room: ' +
        _esc(t.roomLabel || t.room_label || '—') +
        '</div>' +
        '<div>Seat: ' +
        _esc(t.seatCode || t.seat_code || t.seat || '—') +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  return (
    '<div class="sex-toolbar">' +
    '<label class="sex-hint">Exam</label>' +
    _examSelectHtml('sexTicketExam') +
    '<label class="sex-hint">Sitting</label>' +
    '<select class="sex-select" id="sexTicketSitting">' +
    (sittingOpts || '<option value="">No sittings</option>') +
    '</select>' +
    '<button type="button" class="sex-btn" id="sexPrintTickets"' +
    (!_tickets.length ? ' disabled' : '') +
    '>Print tickets</button>' +
    '<a href="#" class="sex-btn" id="sexOpenTakeExam">Open take-exam</a>' +
    '</div>' +
    (_tickets.length
      ? '<div class="sex-ticket-grid" id="sexTicketGrid">' + cards + '</div>'
      : '<div class="sex-empty">' +
        (_selectedSittingId ? 'No tickets issued yet.' : 'Select a sitting first.') +
        '</div>')
  );
}

/**
 * @param {object} card
 */
function _htmlPrintCard(card) {
  const payload = card.payload || {};
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  const sections = blocks
    .map(function (block) {
      const type = block.type || '';
      const data = block.data || {};
      if (type === 'header') {
        return (
          '<header class="sex-print-header">' +
          '<div class="sex-print-school">' +
          _esc(data.schoolName || data.school_name || payload.templateLabel || '') +
          '</div>' +
          '</header>'
        );
      }
      if (type === 'marks_table') {
        const rows = Array.isArray(data.rows)
          ? data.rows
          : Array.isArray(data.subjects)
            ? data.subjects
            : [];
        const body = rows
          .map(function (r) {
            return (
              '<tr><td>' +
              _esc(r.subject || r.subjectCode || r.label || '') +
              '</td><td>' +
              _esc(String(r.marks != null ? r.marks : r.score != null ? r.score : '')) +
              '</td><td>' +
              _esc(String(r.max != null ? r.max : r.maxMarks != null ? r.maxMarks : '')) +
              '</td></tr>'
            );
          })
          .join('');
        return (
          '<section class="sex-print-block"><h3>Marks</h3>' +
          (body
            ? '<table><thead><tr><th>Subject</th><th>Marks</th><th>Max</th></tr></thead><tbody>' +
              body +
              '</tbody></table>'
            : '<pre>' + _esc(JSON.stringify(data, null, 2)) + '</pre>') +
          '</section>'
        );
      }
      if (type === 'attendance') {
        return (
          '<section class="sex-print-block"><h3>Attendance</h3><pre>' +
          _esc(JSON.stringify(data, null, 2)) +
          '</pre></section>'
        );
      }
      if (type === 'hpc_summary') {
        return (
          '<section class="sex-print-block"><h3>HPC summary</h3><pre>' +
          _esc(JSON.stringify(data, null, 2)) +
          '</pre></section>'
        );
      }
      if (type === 'health') {
        return (
          '<section class="sex-print-block"><h3>Health</h3><pre>' +
          _esc(JSON.stringify(data, null, 2)) +
          '</pre></section>'
        );
      }
      if (type === 'co_scholastic') {
        return (
          '<section class="sex-print-block"><h3>Co-scholastic</h3><pre>' +
          _esc(JSON.stringify(data, null, 2)) +
          '</pre></section>'
        );
      }
      if (type === 'signatures') {
        const lines = Array.isArray(data.lines) ? data.lines : [];
        return (
          '<section class="sex-print-block sex-print-signatures"><h3>Signatures</h3>' +
          (lines.length
            ? lines
                .map(function (l) {
                  return (
                    '<div class="sex-print-sig">' +
                    _esc(typeof l === 'string' ? l : l.role || l.label || '') +
                    '</div>'
                  );
                })
                .join('')
            : '<div class="sex-print-sig">Class teacher</div><div class="sex-print-sig">Principal</div>') +
          '</section>'
        );
      }
      if (type === 'footer') {
        return (
          '<footer class="sex-print-footer">' +
          _esc(data.text || data.note || JSON.stringify(data)) +
          '</footer>'
        );
      }
      if (type === 'remarks') {
        return (
          '<section class="sex-print-block"><h3>Remarks</h3><p>' +
          _esc(data.remarks || '') +
          '</p></section>'
        );
      }
      return (
        '<section class="sex-print-block"><h3>' +
        _esc(type) +
        '</h3><pre>' +
        _esc(JSON.stringify(data, null, 2)) +
        '</pre></section>'
      );
    })
    .join('');

  const rank = payload.rank != null ? payload.rank : '—';
  const outOf = payload.out_of != null ? payload.out_of : payload.outOf;
  const pct = payload.percentage != null ? payload.percentage : '—';

  return (
    '<div class="sex-print-toolbar">' +
    '<button type="button" class="sex-btn" id="sexPrintBack">Back</button>' +
    '<button type="button" class="sex-btn primary" id="sexPrintDo">Print</button>' +
    '</div>' +
    '<article class="sex-print">' +
    '<div class="sex-print-meta">' +
    '<div>Student: ' +
    _esc(card.studentId || card.student_id || payload.studentId || '') +
    '</div>' +
    '<div>Session: ' +
    _esc(card.academicSessionRef || card.academic_session_ref || payload.session || '') +
    '</div>' +
    '<div>Rank: ' +
    _esc(String(rank)) +
    (outOf != null ? ' / ' + _esc(String(outOf)) : '') +
    ' · ' +
    _esc(String(pct)) +
    (pct !== '—' ? '%' : '') +
    '</div>' +
    '</div>' +
    sections +
    '</article>'
  );
}

function _bindBody() {
  if (_view === 'report_cards' && _printCard) {
    _bindPrintCard();
    return;
  }
  if (_view === 'terms') _bindTerms();
  else if (_view === 'planner') _bindPlanner();
  else if (_view === 'marks') _bindMarks();
  else if (_view === 'sittings') _bindSittings();
  else if (_view === 'tickets') _bindTickets();
  else _bindReportCards();
}

function _bindPrintCard() {
  const back = _container.querySelector('#sexPrintBack');
  if (back) {
    back.addEventListener('click', function () {
      _printCard = null;
      sexRender();
    });
  }
  const doPrint = _container.querySelector('#sexPrintDo');
  if (doPrint) {
    doPrint.addEventListener('click', function () {
      window.print();
    });
  }
}

function _bindTerms() {
  const reload = _container.querySelector('#sexReloadSession');
  if (reload) {
    reload.addEventListener('click', async function () {
      const inp = _container.querySelector('#sexSession');
      _sessionId = (inp && inp.value) || _sessionId;
      await sexLoadData();
      sexRender();
    });
  }
  const create = _container.querySelector('#sexTermCreate');
  if (create) {
    create.addEventListener('click', async function () {
      if (_busy) return;
      const label = (_container.querySelector('#sexTermLabel') || {}).value;
      const startsOn = (_container.querySelector('#sexTermStart') || {}).value;
      const endsOn = (_container.querySelector('#sexTermEnd') || {}).value;
      const weightagePct = Number((_container.querySelector('#sexTermWeight') || {}).value);
      const sessionInp = _container.querySelector('#sexSession');
      if (sessionInp) _sessionId = sessionInp.value || _sessionId;
      _busy = true;
      const res = await _as().post('/exam-terms', {
        academic_session_id: _sessionId,
        label: label,
        starts_on: startsOn,
        ends_on: endsOn,
        weightage_pct: weightagePct,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Term created', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  }
  _container.querySelectorAll('.sex-del-term').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id || _busy) return;
      _busy = true;
      const res = await _as().del('/exam-terms/' + encodeURIComponent(id));
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Term deleted', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  });
}

function _bindPlanner() {
  const reload = _container.querySelector('#sexReloadSession');
  if (reload) {
    reload.addEventListener('click', async function () {
      const inp = _container.querySelector('#sexSession');
      _sessionId = (inp && inp.value) || _sessionId;
      await sexLoadData();
      sexRender();
    });
  }
  const create = _container.querySelector('#sexExamCreate');
  if (create) {
    create.addEventListener('click', async function () {
      if (_busy) return;
      const payload = {
        exam_term_id: (_container.querySelector('#sexExamTerm') || {}).value,
        course_ref: ((_container.querySelector('#sexExamCourse') || {}).value || '').trim(),
        section_ref: ((_container.querySelector('#sexExamSection') || {}).value || '').trim(),
        subject_code: ((_container.querySelector('#sexExamSubject') || {}).value || '').trim(),
        class_label: ((_container.querySelector('#sexExamClass') || {}).value || '').trim(),
        date: (_container.querySelector('#sexExamDate') || {}).value,
        max_marks: Number((_container.querySelector('#sexExamMax') || {}).value),
        kind: (_container.querySelector('#sexExamKind') || {}).value,
      };
      _busy = true;
      const res = await _as().post('/exams', payload);
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Exam scheduled', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  }
}

function _bindMarks() {
  const sel = _container.querySelector('#sexMarksExam');
  if (sel) {
    sel.addEventListener('change', async function () {
      _selectedExamId = sel.value;
      _publishMissing = [];
      _importErrors = [];
      await _loadMarksForExam(_selectedExamId);
      sexRender();
    });
  }

  _container.querySelectorAll('.sex-draft').forEach(function (inp) {
    inp.addEventListener('change', function () {
      const sid = inp.getAttribute('data-sid');
      if (!sid || !_grid[sid]) return;
      _grid[sid].draftMarks = inp.value;
    });
  });

  _container.querySelectorAll('.sex-absent').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const sid = cb.getAttribute('data-sid');
      if (!sid || !_grid[sid]) return;
      _grid[sid].isAbsent = !!cb.checked;
      if (_grid[sid].isAbsent) {
        _grid[sid].isExempt = false;
        _grid[sid].draftMarks = '';
      }
      sexRender();
    });
  });

  _container.querySelectorAll('.sex-exempt').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const sid = cb.getAttribute('data-sid');
      if (!sid || !_grid[sid]) return;
      _grid[sid].isExempt = !!cb.checked;
      if (_grid[sid].isExempt) {
        _grid[sid].isAbsent = false;
        _grid[sid].draftMarks = '';
      }
      sexRender();
    });
  });

  const save = _container.querySelector('#sexMarksSave');
  if (save) {
    save.addEventListener('click', async function () {
      if (_busy || !_selectedExamId) return;
      const exam = _exams.find(function (e) {
        return e.id === _selectedExamId;
      });
      const maxMarks = exam
        ? Number(exam.maxMarks != null ? exam.maxMarks : exam.max_marks) || 0
        : 0;
      const ids = Object.keys(_grid);
      for (let i = 0; i < ids.length; i++) {
        const row = _grid[ids[i]];
        const v = draftMarkValid(row.draftMarks, maxMarks, row.isAbsent, row.isExempt);
        if (!v.ok) {
          toast(v.error, 'error');
          return;
        }
      }
      const payload = marksPayloadFromGrid(_grid, _actor());
      if (!payload.marks.length) {
        toast('Enter at least one mark, absent, or exempt', 'error');
        return;
      }
      _busy = true;
      const res = await _as().put(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/marks',
        payload,
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Drafts saved', 'success');
        await _loadMarksForExam(_selectedExamId);
        sexRender();
      }
    });
  }

  const publish = _container.querySelector('#sexMarksPublish');
  if (publish) {
    publish.addEventListener('click', async function () {
      if (_busy || !_selectedExamId) return;
      _busy = true;
      _publishMissing = [];
      const res = await _as().post(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/publish',
        { published_by: _actor() },
      );
      _busy = false;
      if (_err(res)) {
        const missing = (res && (res.student_ids || res.studentIds)) || [];
        _publishMissing = Array.isArray(missing) ? missing : [];
        toast(_err(res), 'error');
        sexRender();
      } else {
        toast('Marks published', 'success');
        await _loadMarksForExam(_selectedExamId);
        sexRender();
      }
    });
  }

  _container.querySelectorAll('.sex-moderate').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const markId = btn.getAttribute('data-mark-id');
      if (!markId) return;
      const exam = _exams.find(function (e) {
        return e.id === _selectedExamId;
      });
      const maxMarks = exam
        ? Number(exam.maxMarks != null ? exam.maxMarks : exam.max_marks) || 0
        : 0;
      const raw = window.prompt('New assigned marks (0–' + maxMarks + ')', '');
      if (raw == null) return;
      const reason = window.prompt('Moderation reason', '');
      if (!reason || !String(reason).trim()) {
        toast('Reason required', 'error');
        return;
      }
      const res = await _as().post('/marks/' + encodeURIComponent(markId) + '/moderate', {
        assigned_marks: Number(raw),
        moderated_by: _actor(),
        reason: String(reason).trim(),
      });
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Mark moderated', 'success');
        await _loadMarksForExam(_selectedExamId);
        sexRender();
      }
    });
  });

  const importBtn = _container.querySelector('#sexMarksImport');
  if (importBtn) {
    importBtn.addEventListener('click', function () {
      if (_busy || !_selectedExamId) return;
      const fileInput = _container.querySelector('#sexCsvFile');
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) {
        toast('Choose a CSV file', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = async function () {
        const parsed = parseMarksCsv(String(reader.result || ''));
        _importErrors = parsed.errors.slice();
        if (!parsed.rows.length) {
          toast(parsed.errors[0] || 'No rows to import', 'error');
          sexRender();
          return;
        }
        _busy = true;
        const res = await _as().post(
          '/exams/' + encodeURIComponent(_selectedExamId) + '/marks/import',
          { entered_by: _actor(), rows: parsed.rows },
        );
        _busy = false;
        if (_err(res)) {
          const rowErrs = (res && res.rows) || [];
          if (Array.isArray(rowErrs) && rowErrs.length) {
            _importErrors = rowErrs.map(function (r) {
              return (
                'line ' +
                (r.line || '?') +
                ': ' +
                (r.student_id || r.studentId || '') +
                ' — ' +
                (r.error || 'error')
              );
            });
          }
          toast(_err(res), 'error');
          sexRender();
        } else {
          _importErrors = [];
          toast('Imported ' + parsed.rows.length + ' row(s)', 'success');
          await _loadMarksForExam(_selectedExamId);
          sexRender();
        }
      };
      reader.readAsText(file);
    });
  }

  const lockBtn = _container.querySelector('#sexMarksLock');
  if (lockBtn) {
    lockBtn.addEventListener('click', async function () {
      if (_busy || !_selectedExamId) return;
      const raw = (_container.querySelector('#sexLockAt') || {}).value;
      const iso = _fromDatetimeLocal(raw);
      if (!iso) {
        toast('Pick a lock datetime', 'error');
        return;
      }
      _busy = true;
      const res = await _as().patch('/exams/' + encodeURIComponent(_selectedExamId), {
        entry_closes_at: iso,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Entry lock set', 'success');
        const examsRes = await _as().get('/exams');
        if (!_err(examsRes)) _exams = (examsRes && examsRes.exams) || _exams;
        sexRender();
      }
    });
  }

  const unlockBtn = _container.querySelector('#sexMarksUnlock');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', async function () {
      if (_busy || !_selectedExamId) return;
      const reason = window.prompt('Unlock reason', '');
      if (!reason || !String(reason).trim()) {
        toast('Reason required', 'error');
        return;
      }
      _busy = true;
      const res = await _as().post(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/unlock',
        { unlocked_by: _actor(), reason: String(reason).trim() },
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Marks unlocked', 'success');
        const examsRes = await _as().get('/exams');
        if (!_err(examsRes)) _exams = (examsRes && examsRes.exams) || _exams;
        sexRender();
      }
    });
  }
}

function _bindReportCards() {
  const create = _container.querySelector('#sexTplCreate');
  if (create) {
    create.addEventListener('click', async function () {
      if (_busy) return;
      const label = ((_container.querySelector('#sexTplLabel') || {}).value || '').trim();
      const boardFormat = (_container.querySelector('#sexTplBoard') || {}).value;
      if (!label) {
        toast('Label required', 'error');
        return;
      }
      /** @type {object[]} */
      const definition = [];
      if ((_container.querySelector('#sexTplHeader') || {}).checked) {
        definition.push({ type: 'header', config: { schoolName: '' } });
      }
      definition.push({ type: 'marks_table', config: { aggregation: 'weighted_by_term' } });
      definition.push({ type: 'attendance' });
      definition.push({ type: 'hpc_summary' });
      if ((_container.querySelector('#sexTplHealth') || {}).checked) {
        definition.push({ type: 'health', config: {} });
      }
      definition.push({ type: 'remarks' });
      if ((_container.querySelector('#sexTplSignatures') || {}).checked) {
        definition.push({
          type: 'signatures',
          config: { lines: [{ role: 'Class teacher' }, { role: 'Principal' }] },
        });
      }
      if ((_container.querySelector('#sexTplFooter') || {}).checked) {
        definition.push({ type: 'footer', config: { text: '' } });
      }
      _busy = true;
      const res = await _as().post('/templates', {
        label: label,
        board_format: boardFormat,
        definition: definition,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Sandbox template created', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  }

  _container.querySelectorAll('.sex-promote').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id || _busy) return;
      _busy = true;
      const res = await _as().post('/templates/' + encodeURIComponent(id) + '/promote', {});
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Template promoted', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  });

  _container.querySelectorAll('.sex-clone').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id || _busy) return;
      _busy = true;
      const res = await _as().post('/templates/' + encodeURIComponent(id) + '/clone', {});
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Sandbox clone created', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  });

  const gen = _container.querySelector('#sexGenRun');
  if (gen) {
    gen.addEventListener('click', async function () {
      if (_busy) return;
      const templateId = (_container.querySelector('#sexGenTpl') || {}).value;
      const session = ((_container.querySelector('#sexGenSession') || {}).value || '').trim();
      _classFilter = ((_container.querySelector('#sexGenClass') || {}).value || '').trim();
      _sectionFilter = ((_container.querySelector('#sexGenSection') || {}).value || '').trim();
      if (!templateId || !session) {
        toast('Template and session required', 'error');
        return;
      }
      let qs = '/students?status=active&limit=200&offset=0';
      if (_classFilter) qs += '&class=' + encodeURIComponent(_classFilter);
      const studentsRes = await _id().get(qs);
      if (_err(studentsRes)) {
        toast(_err(studentsRes), 'error');
        return;
      }
      let students = (studentsRes && studentsRes.items) || [];
      if (_sectionFilter) {
        students = students.filter(function (s) {
          const sec = s.section || s.sectionLabel || s.section_label || '';
          return !sec || sec === _sectionFilter;
        });
      }
      if (!students.length) {
        toast('No students found for class/section', 'error');
        return;
      }
      _busy = true;
      const res = await _as().post('/report-cards/generate', {
        template_id: templateId,
        session: session,
        generated_by: _actor(),
        students: students.map(function (s) {
          return { student_id: s.id };
        }),
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        const n = (res && res.cards && res.cards.length) || 0;
        toast('Generated ' + n + ' report card(s)', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  }

  _container.querySelectorAll('.sex-set-release').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id || _busy) return;
      const inp = _container.querySelector('.sex-visible-from[data-id="' + id + '"]');
      const iso = _fromDatetimeLocal(inp && inp.value);
      if (!iso) {
        toast('Pick a release datetime', 'error');
        return;
      }
      _busy = true;
      const res = await _as().patch('/report-cards/' + encodeURIComponent(id), {
        visible_from: iso,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Release time set', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  });

  _container.querySelectorAll('.sex-print-card').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      let card = _cards.find(function (c) {
        return c.id === id;
      });
      if (!card || !card.payload) {
        const res = await _as().get('/report-cards/' + encodeURIComponent(id));
        if (_err(res)) {
          toast(_err(res), 'error');
          return;
        }
        card = res;
      }
      _printCard = card;
      sexRender();
    });
  });
}

function _bindSittings() {
  const examSel = _container.querySelector('#sexSittingExam');
  if (examSel) {
    examSel.addEventListener('change', async function () {
      _selectedExamId = examSel.value;
      await sexLoadData();
      sexRender();
    });
  }
  const create = _container.querySelector('#sexSittingCreate');
  if (create) {
    create.addEventListener('click', async function () {
      if (_busy || !_selectedExamId) return;
      const room = ((_container.querySelector('#sexSittingRoom') || {}).value || '').trim();
      const starts = _fromDatetimeLocal(
        (_container.querySelector('#sexSittingStarts') || {}).value,
      );
      const ends = _fromDatetimeLocal((_container.querySelector('#sexSittingEnds') || {}).value);
      const rawStudents = (_container.querySelector('#sexSittingStudents') || {}).value || '';
      const studentIds = String(rawStudents)
        .split(/[\n,]+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      if (!room || !starts || !ends || !studentIds.length) {
        toast('Room, starts, ends, and student IDs required', 'error');
        return;
      }
      _busy = true;
      const res = await _as().post(
        '/exams/' + encodeURIComponent(_selectedExamId) + '/sittings',
        {
          room_label: room,
          starts_on: starts,
          ends_on: ends,
          student_ids: studentIds,
        },
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Sitting created', 'success');
        await sexLoadData();
        sexRender();
      }
    });
  }
  _container.querySelectorAll('.sex-issue-tickets').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.getAttribute('data-id');
      if (!id || _busy) return;
      _busy = true;
      const res = await _as().post(
        '/sittings/' + encodeURIComponent(id) + '/issue-tickets',
        {},
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        const n = (res && res.tickets && res.tickets.length) || 0;
        toast('Issued ' + n + ' ticket(s)', 'success');
        _selectedSittingId = id;
      }
    });
  });
}

function _bindTickets() {
  const examSel = _container.querySelector('#sexTicketExam');
  if (examSel) {
    examSel.addEventListener('change', async function () {
      _selectedExamId = examSel.value;
      _selectedSittingId = '';
      await sexLoadData();
      sexRender();
    });
  }
  const sittingSel = _container.querySelector('#sexTicketSitting');
  if (sittingSel) {
    sittingSel.addEventListener('change', async function () {
      _selectedSittingId = sittingSel.value;
      await sexLoadData();
      sexRender();
    });
  }
  const printBtn = _container.querySelector('#sexPrintTickets');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }
  const takeExam = _container.querySelector('#sexOpenTakeExam');
  if (takeExam) {
    takeExam.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (_selectedSittingId) {
            sessionStorage.setItem('take_exam_sitting_id', _selectedSittingId);
          }
          if (_selectedExamId) {
            sessionStorage.setItem('take_exam_exam_id', _selectedExamId);
          }
        }
      } catch (_e) {
        /* ignore */
      }
      if (typeof navigateToModule === 'function') {
        navigateToModule('take_exam');
      }
    });
  }
}

export { ALL_TABS, TERM_LABELS, EXAM_KINDS, BOARD_FORMATS };

registerModule('school_exams', renderSchoolExamsPage);

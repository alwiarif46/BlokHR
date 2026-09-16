/**
 * modules/school_academics/school_academics.js
 *
 * Academics: Curriculum | Coverage | Variance | Lessons | Homework.
 * Courses come from School Settings → Syllabus Packs (install/upload), not this module.
 * Pattern: render… → sacLoadData() → sacRender() → tab actions.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { navigateToModule, registerModule } from '../../shared/router.js';
import { canAcademicsCourseWrite } from '../../shared/school-roles.js';

const TABS = ['curriculum', 'coverage', 'variance', 'lessons', 'homework'];
const FIELD_BADGE = { activity: 'A', assessment: 'AS', resource: 'R' };
const DEPTH_BADGE = { introduced: 'I', reinforced: 'R', mastered: 'M' };
const BODY_SECTIONS = ['objectives', 'activities', 'materials', 'assessment_check'];

let _container = null;
let _tab = 'curriculum';
let _courses = [];
let _courseId = '';
let _tree = null;
let _outcomes = [];
let _sectionRef = '';
let _coverage = null;
let _variance = null;
let _targetDate = '';
let _lessons = [];
let _reviewQueue = [];
let _editLesson = null;
let _tagError = '';
let _dragUnitId = null;
/** @type {string|null} set when GET /courses fails (service down / 502) */
let _loadError = null;
/** @type {Array} */
let _assignments = [];
/** @type {string} */
let _hwAssignmentId = '';
/** @type {Array} */
let _submissions = [];
/** @type {object|null} */
let _hwStats = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'teacher';
}

function _ac() {
  return api.school('school-academics');
}

function _tt() {
  return api.school('school-timetable');
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

/** L6 cosmetic — enforced server-side by P12-04/05 */
function _canCourseWrite() {
  const session = getSession() || {};
  return canAcademicsCourseWrite(session.schoolRole, _isAdmin());
}

/** L6 cosmetic — enforced server-side by P12-04 */
function _canReviewLessons() {
  return _canCourseWrite();
}

/** Open School Settings on Syllabus Packs (one-shot sessionStorage handoff). */
function _openSyllabusSettings() {
  try {
    sessionStorage.setItem('scs_open_tab', 'syllabus');
  } catch (_) {
    /* ignore */
  }
  navigateToModule('school_settings');
}

/**
 * Field badge A/AS/R and depth I/R/M.
 * @param {string} field
 * @param {string} depth
 */
export function outcomeTagBadges(field, depth) {
  return {
    fieldBadge: FIELD_BADGE[field] || '?',
    depthBadge: DEPTH_BADGE[depth] || '?',
  };
}

/**
 * Client rule mirror: assessment requires activity on same outcome.
 * @param {Array<{ outcomeId: string, field: string }>} tags
 * @param {string} outcomeId
 * @param {string} field
 * @returns {string|null}
 */
export function validateOutcomeTag(tags, outcomeId, field) {
  if (field !== 'assessment') return null;
  const hasActivity = (tags || []).some(function (t) {
    return t.outcomeId === outcomeId && t.field === 'activity';
  });
  if (!hasActivity) {
    return 'assessment requires activity tag for the same outcome on the unit';
  }
  return null;
}

/**
 * ISO week number — used when mapping timetable instances for variance (P3-05).
 * @param {string} isoDate
 * @returns {number}
 */
export function isoWeekNumber(isoDate) {
  const d = new Date(String(isoDate).slice(0, 10) + 'T00:00:00.000Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Reorder unit ids by moving fromId before/onto toId.
 * @param {string[]} orderedIds
 * @param {string} fromId
 * @param {string} toId
 */
export function reorderIds(orderedIds, fromId, toId) {
  const list = orderedIds.slice();
  const from = list.indexOf(fromId);
  const to = list.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return list;
}

/**
 * Build outcome × {activity,assessment} cells from coverage units.
 * @param {object} coverage
 */
export function buildOutcomeGrid(coverage) {
  const map = new Map();
  const units = (coverage && coverage.units) || [];
  units.forEach(function (u) {
    (u.outcomes || []).forEach(function (o) {
      const cur = map.get(o.outcomeId) || {
        outcomeId: o.outcomeId,
        activity: false,
        assessment: false,
        units: [],
      };
      if (o.coveredActivity) cur.activity = true;
      if (o.coveredAssessment) cur.assessment = true;
      if (cur.units.indexOf(u.label) < 0) cur.units.push(u.label);
      map.set(o.outcomeId, cur);
    });
  });
  return Array.from(map.values());
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolAcademicsPage(container) {
  _container = container;
  _tab = 'curriculum';
  _courses = [];
  _courseId = '';
  _tree = null;
  _coverage = null;
  _variance = null;
  _editLesson = null;
  _tagError = '';
  _sectionRef = '';
  _targetDate = '';
  _loadError = null;

  container.innerHTML =
    '<div class="sac-wrap" id="sacWrap">' +
    '<div class="sac-title">Academics</div>' +
    '<div class="sac-tabs" id="sacTabs">' +
    TABS.map(function (t) {
      return (
        '<button type="button" class="sac-tab' +
        (t === _tab ? ' active' : '') +
        '" data-tab="' +
        t +
        '">' +
        _esc(t) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div id="sacContent"></div>' +
    '</div>';

  container.querySelector('#sacTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.sac-tab');
    if (!btn || !btn.dataset.tab) return;
    sacSwitchTab(btn.dataset.tab);
  });

  sacLoadData();
}

/**
 * @param {string} tab
 */
export function sacSwitchTab(tab) {
  if (TABS.indexOf(tab) < 0) return;
  _tab = tab;
  _container.querySelectorAll('.sac-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  sacLoadData();
}

export async function sacLoadData() {
  if (!_courses.length || _loadError) {
    const res = await _ac().get('/courses');
    if (res && !res._error) {
      _courses = res.courses || [];
      _loadError = null;
      if (!_courseId && _courses.length) _courseId = _courses[0].id;
    } else {
      _courses = [];
      _loadError =
        (res && (res.message || res.error)) ||
        'Academics service unavailable. Start school-academics or check the gateway.';
      toast(res && res.message ? res.message : 'Could not load courses', 'error');
    }
  }

  if (_loadError) {
    sacRender();
    return;
  }

  if (_tab === 'curriculum') await _loadCurriculum();
  else if (_tab === 'coverage') await _loadCoverage();
  else if (_tab === 'variance') await _loadVariance();
  else if (_tab === 'lessons') await _loadLessons();
  else if (_tab === 'homework') await _loadHomework();
  else {
    const _exhaustive = _tab;
    void _exhaustive;
  }
  sacRender();
}

async function _loadCurriculum() {
  if (!_courseId) {
    _tree = null;
    return;
  }
  const [tree, outs] = await Promise.all([
    _ac().get('/courses/' + encodeURIComponent(_courseId) + '/tree'),
    _ac().get('/outcomes'),
  ]);
  if (tree && !tree._error) _tree = tree;
  else {
    _tree = null;
    if (tree && tree._error) toast(tree.message || 'Could not load tree', 'error');
  }
  _outcomes = outs && !outs._error ? outs.outcomes || [] : [];
}

async function _loadCoverage() {
  if (!_courseId || !_sectionRef) {
    _coverage = null;
    return;
  }
  const res = await _ac().get(
    '/courses/' +
      encodeURIComponent(_courseId) +
      '/coverage?section_ref=' +
      encodeURIComponent(_sectionRef),
  );
  if (res && !res._error) _coverage = res;
  else {
    _coverage = null;
    if (res && res._error) toast(res.message || 'Could not load coverage', 'error');
  }
}

/**
 * P3-05 BFF-in-frontend composition: fetch timetable period instances for the
 * section, then POST them to academics `/courses/:id/variance` (no cross-service
 * DB joins — the browser is the BFF for this report).
 */
export async function composeVarianceReport(courseId, sectionRef, opts) {
  const options = opts || {};
  const from = options.from || '2026-01-01';
  const to = options.to || '2026-12-31';
  const targetDate = options.targetDate || null;

  const instRes = await _tt().get(
    '/sections/' +
      encodeURIComponent(sectionRef) +
      '/instances?from=' +
      encodeURIComponent(from) +
      '&to=' +
      encodeURIComponent(to),
  );
  const raw = instRes && !instRes._error ? instRes.instances || [] : [];
  if (instRes && instRes._error) {
    return { error: instRes.message || 'timetable instances failed', instances: [] };
  }

  const instances = raw.map(function (i) {
    return {
      id: i.id,
      week: i.week != null ? Number(i.week) : isoWeekNumber(i.date),
      status: i.status,
      lost_reason: i.lostReason != null ? i.lostReason : i.lost_reason,
      date: i.date,
    };
  });

  const body = {
    section_ref: sectionRef,
    instances: instances,
  };
  if (targetDate) body.target_date = targetDate;

  const report = await _ac().post(
    '/courses/' + encodeURIComponent(courseId) + '/variance',
    body,
  );
  if (report && report._error) {
    return { error: report.message || 'variance failed', instances: instances };
  }
  return { report: report, instances: instances };
}

async function _loadVariance() {
  if (!_courseId || !_sectionRef) {
    _variance = null;
    return;
  }
  const result = await composeVarianceReport(_courseId, _sectionRef, {
    targetDate: _targetDate || null,
  });
  if (result.error) {
    toast(result.error, 'error');
    _variance = null;
    return;
  }
  _variance = result.report;
}

async function _loadLessons() {
  const week = _weekStart();
  const teacher = _actor();
  const reviewPromise = _canReviewLessons()
    ? _ac().get('/lessons?state=submitted')
    : Promise.resolve({ lessons: [] });
  const [mine, queue] = await Promise.all([
    _ac().get(
      '/lessons?teacher_member_id=' +
        encodeURIComponent(teacher) +
        '&week_start=' +
        encodeURIComponent(week),
    ),
    reviewPromise,
  ]);
  _lessons = mine && !mine._error ? mine.lessons || [] : [];
  if (mine && mine._error) toast(mine.message || 'Could not load lessons', 'error');
  _reviewQueue = queue && !queue._error ? queue.lessons || [] : [];
}

function _weekStart() {
  const d = new Date(Date.now() + 330 * 60000);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function sacRender() {
  const content = _container && _container.querySelector('#sacContent');
  if (!content) return;

  if (_loadError) {
    _renderServiceUnavailable(content);
    return;
  }
  if (!_courses.length) {
    _renderNoCourses(content);
    return;
  }

  if (_tab === 'curriculum') _renderCurriculum(content);
  else if (_tab === 'coverage') _renderCoverage(content);
  else if (_tab === 'variance') _renderVariance(content);
  else if (_tab === 'lessons') _renderLessons(content);
  else if (_tab === 'homework') _renderHomework(content);
}

function _renderServiceUnavailable(content) {
  content.innerHTML =
    '<div class="sac-panel sac-state" id="sacUnavailable">' +
    '<h4>Academics service unavailable</h4>' +
    '<p class="sac-help">' +
    _esc(_loadError) +
    '</p>' +
    '<p class="sac-help">Ensure <code>school-academics</code> is running (port 3014) via <code>npm run dev:school</code>.</p>' +
    '<button type="button" class="sac-btn" id="sacRetryBtn">Retry</button>' +
    '</div>';
  content.querySelector('#sacRetryBtn').addEventListener('click', function () {
    _loadError = null;
    _courses = [];
    sacLoadData();
  });
}

function _renderNoCourses(content) {
  const admin = _isAdmin();
  content.innerHTML =
    '<div class="sac-panel sac-state" id="sacNoCourses">' +
    '<h4>No syllabus yet</h4>' +
    '<p class="sac-help">' +
    (admin
      ? 'Install a board pack or upload a custom syllabus in School Settings, then return here.'
      : 'Ask an admin to install a syllabus pack in School Settings.') +
    '</p>' +
    (admin
      ? '<button type="button" class="sac-btn ghost" id="sacInstallSyllabusBtn">Install syllabus…</button>'
      : '') +
    '</div>';
  const btn = content.querySelector('#sacInstallSyllabusBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      _openSyllabusSettings();
    });
  }
}

function _coursePickerHtml() {
  return (
    '<select class="sac-select" id="sacCourse">' +
    (_courses.length
      ? _courses
          .map(function (c) {
            return (
              '<option value="' +
              _esc(c.id) +
              '"' +
              (c.id === _courseId ? ' selected' : '') +
              '>' +
              _esc(c.label || c.subjectCode) +
              '</option>'
            );
          })
          .join('')
      : '<option value="">No courses</option>') +
    '</select>'
  );
}

function _bindCoursePicker(content) {
  const sel = content.querySelector('#sacCourse');
  if (!sel) return;
  sel.addEventListener('change', function () {
    _courseId = sel.value;
    _tree = null;
    _coverage = null;
    _variance = null;
    sacLoadData();
  });
}

function _renderCurriculum(content) {
  const units = (_tree && _tree.units) || [];
  const canWrite = _canCourseWrite();
  let body;
  if (!_courseId) {
    body = '<div class="sac-empty">Select a course.</div>';
  } else if (!units.length) {
    body =
      '<div class="sac-empty" id="sacEmptyUnits">No units in this course yet.</div>';
  } else {
    body =
      '<div id="sacTree">' +
      units
        .map(function (u) {
          const chips = (u.outcomes || [])
            .map(function (t) {
              const b = outcomeTagBadges(t.field, t.depth);
              return (
                '<span class="sac-chip" data-outcome="' +
                _esc(t.outcomeId) +
                '" title="' +
                _esc(t.outcomeId) +
                '"><span class="sac-field">' +
                _esc(b.fieldBadge) +
                '</span>/<span class="sac-depth">' +
                _esc(b.depthBadge) +
                '</span></span>'
              );
            })
            .join('');
          const topics = (u.topics || [])
            .map(function (t) {
              return '<div class="sac-topic">' + _esc(t.label) + '</div>';
            })
            .join('');
          return (
            '<div class="sac-tree-unit"' +
            (canWrite ? ' draggable="true"' : '') +
            ' data-unit-id="' +
            _esc(u.id) +
            '">' +
            '<div class="sac-unit-head">' +
            '<span class="sac-unit-label">' +
            _esc(u.label) +
            '</span>' +
            (canWrite
              ? '<button type="button" class="sac-btn ghost" data-tag-unit="' +
                _esc(u.id) +
                '">Tag outcome</button>'
              : '') +
            '</div>' +
            topics +
            '<div class="sac-chips">' +
            chips +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
  }

  content.innerHTML =
    '<div class="sac-toolbar">' +
    _coursePickerHtml() +
    (canWrite ? '<span class="sac-help">Drag units to reorder</span>' : '') +
    '</div>' +
    (_tagError ? '<div class="sac-inline-err" id="sacTagErr">' + _esc(_tagError) + '</div>' : '') +
    body;

  _bindCoursePicker(content);
  const tree = content.querySelector('#sacTree');
  if (!tree) return;

  /* L6 cosmetic — enforced server-side by P12-04; course writes school_admin+ */
  if (!canWrite) return;

  tree.querySelectorAll('.sac-tree-unit').forEach(function (el) {
    const id = el.getAttribute('data-unit-id');
    el.addEventListener('dragstart', function () {
      _dragUnitId = id;
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
      _dragUnitId = null;
    });
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!_dragUnitId || _dragUnitId === id) return;
      sacReorderUnits(_dragUnitId, id);
    });
  });

  tree.querySelectorAll('[data-tag-unit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      sacOpenTagForm(btn.getAttribute('data-tag-unit'));
    });
  });
}

/**
 * @param {string} fromId
 * @param {string} toId
 */
export async function sacReorderUnits(fromId, toId) {
  const units = (_tree && _tree.units) || [];
  const ordered = reorderIds(
    units.map(function (u) {
      return u.id;
    }),
    fromId,
    toId,
  );
  const res = await _ac().put(
    '/courses/' + encodeURIComponent(_courseId) + '/units/reorder',
    { ordered_ids: ordered },
  );
  if (res && !res._error) {
    toast('Units reordered', 'success');
    await _loadCurriculum();
    sacRender();
    return ordered;
  }
  toast((res && res.message) || 'Reorder failed', 'error');
  return null;
}

/**
 * @param {string} unitId
 */
export function sacOpenTagForm(unitId) {
  const unit = ((_tree && _tree.units) || []).find(function (u) {
    return u.id === unitId;
  });
  if (!unit) return;
  const host = _container.querySelector('#sacContent');
  const panel = document.createElement('div');
  panel.className = 'sac-panel';
  panel.id = 'sacTagPanel';
  panel.innerHTML =
    '<h4>Tag outcome on ' +
    _esc(unit.label) +
    '</h4>' +
    '<div class="sac-field"><label>Outcome</label><select id="sacTagOutcome">' +
    _outcomes
      .slice(0, 80)
      .map(function (o) {
        return (
          '<option value="' +
          _esc(o.id) +
          '">' +
          _esc(o.code) +
          ' — ' +
          _esc(o.description || '').slice(0, 60) +
          '</option>'
        );
      })
      .join('') +
    '</select></div>' +
    '<div class="sac-field"><label>Field</label><select id="sacTagField">' +
    '<option value="activity">activity (A)</option>' +
    '<option value="assessment">assessment (AS)</option>' +
    '<option value="resource">resource (R)</option>' +
    '</select></div>' +
    '<div class="sac-field"><label>Depth</label><select id="sacTagDepth">' +
    '<option value="introduced">introduced (I)</option>' +
    '<option value="reinforced">reinforced (R)</option>' +
    '<option value="mastered">mastered (M)</option>' +
    '</select></div>' +
    '<div class="sac-inline-err" id="sacTagInline" hidden></div>' +
    '<div class="sac-form-actions">' +
    '<button type="button" class="sac-btn ghost" id="sacTagCancel">Cancel</button>' +
    '<button type="button" class="sac-btn" id="sacTagSave">Save tag</button>' +
    '</div>';
  const old = host.querySelector('#sacTagPanel');
  if (old) old.remove();
  host.appendChild(panel);

  panel.querySelector('#sacTagCancel').addEventListener('click', function () {
    panel.remove();
  });
  panel.querySelector('#sacTagSave').addEventListener('click', async function () {
    const outcomeId = panel.querySelector('#sacTagOutcome').value;
    const field = panel.querySelector('#sacTagField').value;
    const depth = panel.querySelector('#sacTagDepth').value;
    const clientErr = validateOutcomeTag(unit.outcomes || [], outcomeId, field);
    const inline = panel.querySelector('#sacTagInline');
    if (clientErr) {
      inline.hidden = false;
      inline.textContent = clientErr;
      _tagError = clientErr;
      toast(clientErr, 'error');
      return;
    }
    const res = await _ac().post('/units/' + encodeURIComponent(unitId) + '/outcomes', {
      outcome_id: outcomeId,
      field: field,
      depth: depth,
    });
    if (res && !res._error) {
      _tagError = '';
      toast('Outcome tagged', 'success');
      panel.remove();
      await _loadCurriculum();
      sacRender();
      return;
    }
    const msg = (res && res.message) || 'Tag failed';
    inline.hidden = false;
    inline.textContent = msg;
    _tagError = msg;
    toast(msg, 'error');
  });
}

function _renderCoverage(content) {
  const grid = buildOutcomeGrid(_coverage);
  content.innerHTML =
    '<div class="sac-toolbar">' +
    _coursePickerHtml() +
    '<input class="sac-input" id="sacSectionRef" placeholder="Section ref" value="' +
    _esc(_sectionRef) +
    '">' +
    '<button type="button" class="sac-btn" id="sacCovLoad">Load</button>' +
    '</div>' +
    '<div id="sacCovBody"></div>';

  _bindCoursePicker(content);
  content.querySelector('#sacCovLoad').addEventListener('click', function () {
    _sectionRef = (content.querySelector('#sacSectionRef').value || '').trim();
    sacLoadData();
  });

  const body = content.querySelector('#sacCovBody');
  if (!_coverage) {
    body.innerHTML = '<div class="sac-empty">Enter a section ref and load coverage.</div>';
    return;
  }

  let bars = '';
  (_coverage.units || []).forEach(function (u) {
    bars +=
      '<div class="sac-bar-row" data-unit-id="' +
      _esc(u.unitId) +
      '"><div class="sac-bar-label"><span>' +
      _esc(u.label) +
      '</span><span>' +
      _esc(String(u.pct)) +
      '% (' +
      u.topicsDelivered +
      '/' +
      u.topicsTotal +
      ')</span></div>' +
      '<div class="sac-bar-track"><div class="sac-bar-fill" style="width:' +
      _esc(String(Math.min(100, u.pct))) +
      '%"></div></div></div>';
  });

  const cols = 3;
  let gridHtml =
    '<div class="sac-outcome-grid" id="sacOutcomeGrid" style="grid-template-columns:repeat(' +
    cols +
    ',minmax(0,1fr))">' +
    '<div class="sac-og-head">Outcome</div><div class="sac-og-head">Activity</div><div class="sac-og-head">Assessment</div>';
  grid.forEach(function (row) {
    gridHtml +=
      '<div class="sac-og-cell" title="' +
      _esc(row.units.join(', ')) +
      '">' +
      _esc(row.outcomeId.slice(0, 8)) +
      '</div>' +
      '<div class="sac-og-cell ' +
      (row.activity ? 'filled' : 'grey') +
      '" data-cell="activity" data-outcome="' +
      _esc(row.outcomeId) +
      '" title="' +
      _esc(row.units.join(', ')) +
      '">' +
      (row.activity ? '●' : '·') +
      '</div>' +
      '<div class="sac-og-cell ' +
      (row.assessment ? 'filled' : 'grey') +
      '" data-cell="assessment" data-outcome="' +
      _esc(row.outcomeId) +
      '" title="' +
      _esc(row.units.join(', ')) +
      '">' +
      (row.assessment ? '●' : '·') +
      '</div>';
  });
  gridHtml += '</div>';

  body.innerHTML = bars + '<h4 class="sac-help">Outcome in-use grid (hover cell for units)</h4>' + gridHtml;
}

function _renderVariance(content) {
  content.innerHTML =
    '<div class="sac-toolbar">' +
    _coursePickerHtml() +
    '<input class="sac-input" id="sacVarSection" placeholder="Section id (timetable)" value="' +
    _esc(_sectionRef) +
    '">' +
    '<input class="sac-input" type="date" id="sacVarTarget" value="' +
    _esc(_targetDate) +
    '" title="Target date">' +
    '<button type="button" class="sac-btn" id="sacVarLoad">Compute</button>' +
    '</div>' +
    '<div id="sacVarBody"></div>';

  _bindCoursePicker(content);
  content.querySelector('#sacVarLoad').addEventListener('click', function () {
    _sectionRef = (content.querySelector('#sacVarSection').value || '').trim();
    _targetDate = content.querySelector('#sacVarTarget').value || '';
    sacLoadData();
  });

  const body = content.querySelector('#sacVarBody');
  if (!_variance) {
    body.innerHTML =
      '<div class="sac-empty">Load variance (fetches timetable instances, then academics report — P3-05).</div>';
    return;
  }

  const planned = _variance.plannedCurve || [];
  const actual = _variance.actualCurve || [];
  const maxCum = Math.max(
    1,
    ...planned.map(function (p) {
      return p.cumulativeTopics;
    }),
    ...actual.map(function (p) {
      return p.cumulativeTopics;
    }),
  );
  const weeks = Array.from(
    new Set(
      planned
        .map(function (p) {
          return p.week;
        })
        .concat(
          actual.map(function (p) {
            return p.week;
          }),
        ),
    ),
  ).sort(function (a, b) {
    return a - b;
  });

  let bars = '<div class="sac-week-bars" id="sacWeekBars">';
  weeks.forEach(function (w) {
    const p = planned.find(function (x) {
      return x.week === w;
    });
    const a = actual.find(function (x) {
      return x.week === w;
    });
    const pv = p ? p.cumulativeTopics : 0;
    const av = a ? a.cumulativeTopics : 0;
    bars +=
      '<div class="sac-week-row" data-week="' +
      w +
      '"><div>W' +
      w +
      '</div><div class="sac-week-pair">' +
      '<div class="sac-week-planned"><span style="width:' +
      (pv / maxCum) * 100 +
      '%"></span></div>' +
      '<div class="sac-week-actual"><span style="width:' +
      (av / maxCum) * 100 +
      '%"></span></div>' +
      '</div></div>';
  });
  bars += '</div>';

  let unitsHtml = '';
  (_variance.units || []).forEach(function (u) {
    const lost = (u.lostPeriods || [])
      .map(function (l) {
        return _esc(l.reason) + ' ×' + l.count;
      })
      .join(', ');
    unitsHtml +=
      '<div class="sac-panel" data-unit-var="' +
      _esc(u.unitId) +
      '"><h4>' +
      _esc(u.label) +
      '</h4>' +
      '<div>Slippage weeks: <strong>' +
      _esc(String(u.slippageWeeks != null ? u.slippageWeeks : '—')) +
      '</strong></div>' +
      '<div>Lost periods: ' +
      (lost || '—') +
      '</div></div>';
  });

  const past = _variance.daysPastTarget;
  const projClass =
    past != null && past > 0 ? 'sac-past-target' : '';

  body.innerHTML =
    '<div class="sac-help">Grey = planned cumulative · accent = actual cumulative</div>' +
    bars +
    '<div class="sac-panel"><div>Projected completion: <strong id="sacProjDate" class="' +
    projClass +
    '">' +
    _esc(_variance.projectedCompletionDate || '—') +
    '</strong>' +
    (past != null
      ? ' · days past target: <strong class="' +
        projClass +
        '">' +
        _esc(String(past)) +
        '</strong>'
      : '') +
    '</div><div>Remaining topics: ' +
    _esc(String(_variance.remainingTopics)) +
    (_variance.stalled ? ' · <strong>stalled</strong>' : '') +
    '</div></div>' +
    unitsHtml;
}

function _renderLessons(content) {
  const showReview = _canReviewLessons();
  content.innerHTML =
    '<div class="sac-toolbar">' +
    '<button type="button" class="sac-btn" id="sacNewLesson">+ Draft</button>' +
    '<button type="button" class="sac-btn ghost" id="sacSubmitWeek">Submit week</button>' +
    '</div>' +
    '<div class="sac-layout">' +
    '<div><h4 class="sac-help">My week</h4><div id="sacLessonList"></div>' +
    (showReview
      ? '<h4 class="sac-help">Reviewer queue</h4><div id="sacReviewList"></div>'
      : '') +
    '</div>' +
    '<div id="sacLessonEditor"></div></div>';

  content.querySelector('#sacNewLesson').addEventListener('click', function () {
    sacOpenLessonEditor(null);
  });
  content.querySelector('#sacSubmitWeek').addEventListener('click', sacSubmitWeek);

  const list = content.querySelector('#sacLessonList');
  list.innerHTML = _lessons.length
    ? '<table class="sac-table"><tbody>' +
      _lessons
        .map(function (l) {
          return (
            '<tr data-lesson-id="' +
            _esc(l.id) +
            '"><td><button type="button" class="sac-list-item" data-edit-lesson="' +
            _esc(l.id) +
            '">' +
            _esc(l.title) +
            '</button></td><td>' +
            _esc(l.state) +
            '</td><td><span class="sac-provenance ' +
            _esc(l.provenance || 'human') +
            '">' +
            _esc(l.provenance || 'human') +
            '</span></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    : '<div class="sac-empty">No lessons this week.</div>';

  list.querySelectorAll('[data-edit-lesson]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const lesson = _lessons.find(function (l) {
        return l.id === btn.getAttribute('data-edit-lesson');
      });
      sacOpenLessonEditor(lesson || null);
    });
  });

  /* L6 cosmetic — enforced server-side by P12-04 */
  if (showReview) {
    const rev = content.querySelector('#sacReviewList');
    rev.innerHTML = _reviewQueue.length
      ? _reviewQueue
          .map(function (l) {
            return (
              '<div class="sac-panel" data-review-id="' +
              _esc(l.id) +
              '"><strong>' +
              _esc(l.title) +
              '</strong> · <span class="sac-provenance ' +
              _esc(l.provenance || '') +
              '">' +
              _esc(l.provenance || 'human') +
              '</span>' +
              '<div class="sac-form-actions">' +
              '<button type="button" class="sac-btn ghost" data-approve="' +
              _esc(l.id) +
              '">Approve</button>' +
              '<button type="button" class="sac-btn ghost" data-changes="' +
              _esc(l.id) +
              '">Changes</button>' +
              '</div>' +
              '<div class="sac-field" hidden data-note-wrap="' +
              _esc(l.id) +
              '"><label>Review note *</label><textarea data-note="' +
              _esc(l.id) +
              '"></textarea>' +
              '<button type="button" class="sac-btn" data-send-changes="' +
              _esc(l.id) +
              '">Request changes</button></div></div>'
            );
          })
          .join('')
      : '<div class="sac-empty">Queue empty.</div>';

    rev.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        sacReviewLesson(btn.getAttribute('data-approve'), 'approved', null);
      });
    });
    rev.querySelectorAll('[data-changes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-changes');
        const wrap = rev.querySelector('[data-note-wrap="' + id + '"]');
        if (wrap) wrap.hidden = false;
      });
    });
    rev.querySelectorAll('[data-send-changes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-send-changes');
        const noteEl = rev.querySelector('[data-note="' + id + '"]');
        const note = noteEl ? (noteEl.value || '').trim() : '';
        sacReviewLesson(id, 'changes_requested', note);
      });
    });
  }

  if (_editLesson !== undefined && _editLesson !== null) {
    sacOpenLessonEditor(_editLesson);
  }
}

/**
 * @param {object|null} lesson
 */
export function sacOpenLessonEditor(lesson) {
  _editLesson = lesson;
  const host = _container.querySelector('#sacLessonEditor');
  if (!host) return;
  const l = lesson || {
    title: '',
    body: { objectives: '', activities: '', materials: '', assessment_check: '' },
    provenance: 'human',
    state: 'draft',
  };
  const body = l.body || {};
  host.innerHTML =
    '<div class="sac-panel"><h4>' +
    (lesson ? 'Edit lesson' : 'New draft') +
    ' <span class="sac-provenance ' +
    _esc(l.provenance || 'human') +
    '" id="sacProvBadge">' +
    _esc(l.provenance || 'human') +
    '</span></h4>' +
    '<div class="sac-field"><label>Title</label><input id="sacLesTitle" value="' +
    _esc(l.title || '') +
    '"></div>' +
    BODY_SECTIONS.map(function (sec) {
      const val =
        body[sec] == null
          ? ''
          : typeof body[sec] === 'string'
            ? body[sec]
            : JSON.stringify(body[sec]);
      return (
        '<div class="sac-field"><label>' +
        _esc(sec) +
        '</label><textarea id="sacBody_' +
        sec +
        '">' +
        _esc(val) +
        '</textarea></div>'
      );
    }).join('') +
    '<div class="sac-form-actions">' +
    '<button type="button" class="sac-btn" id="sacLesSave">Save draft</button>' +
    '</div></div>';

  host.querySelector('#sacLesSave').addEventListener('click', async function () {
    const payloadBody = {};
    BODY_SECTIONS.forEach(function (sec) {
      payloadBody[sec] = host.querySelector('#sacBody_' + sec).value;
    });
    const title = host.querySelector('#sacLesTitle').value.trim();
    if (!title) {
      toast('Title is required', 'error');
      return;
    }
    if (lesson && lesson.id) {
      const res = await _ac().patch('/lessons/' + encodeURIComponent(lesson.id), {
        title: title,
        body: payloadBody,
      });
      if (res && !res._error) {
        toast('Lesson saved', 'success');
        _editLesson = null;
        await _loadLessons();
        sacRender();
        return;
      }
      toast((res && res.message) || 'Save failed', 'error');
      return;
    }
    if (!_courseId || !_tree || !(_tree.units || []).length) {
      toast('Select a course with units first', 'error');
      return;
    }
    const unit = _tree.units[0];
    const res = await _ac().post('/lessons', {
      course_id: _courseId,
      unit_id: unit.id,
      teacher_member_id: _actor(),
      week_start: _weekStart(),
      title: title,
      body: payloadBody,
      provenance: 'human',
    });
    if (res && !res._error) {
      toast('Draft created', 'success');
      _editLesson = null;
      await _loadLessons();
      sacRender();
      return;
    }
    toast((res && res.message) || 'Create failed', 'error');
  });
}

export async function sacSubmitWeek() {
  const res = await _ac().post('/lessons/submit-week', {
    teacher_member_id: _actor(),
    week_start: _weekStart(),
  });
  if (res && !res._error) {
    toast('Week submitted', 'success');
    await _loadLessons();
    sacRender();
    return res;
  }
  toast((res && res.message) || 'Submit failed', 'error');
  return null;
}

/**
 * @param {string} id
 * @param {'approved'|'changes_requested'} decision
 * @param {string|null} note
 */
export async function sacReviewLesson(id, decision, note) {
  if (decision === 'changes_requested' && !(note || '').trim()) {
    toast('review_note is required for changes_requested', 'error');
    return null;
  }
  const res = await _ac().post('/lessons/' + encodeURIComponent(id) + '/review', {
    decision: decision,
    reviewed_by: _actor(),
    review_note: note,
  });
  if (res && !res._error) {
    toast(decision === 'approved' ? 'Approved' : 'Changes requested', 'success');
    await _loadLessons();
    sacRender();
    return res;
  }
  toast((res && res.message) || 'Review failed', 'error');
  return null;
}

async function _loadHomework() {
  _assignments = [];
  _submissions = [];
  _hwStats = null;
  if (!_sectionRef) return;
  const res = await _ac().get(
    '/assignments?section_ref=' + encodeURIComponent(_sectionRef),
  );
  if (res && !res._error) {
    _assignments = res.assignments || [];
    if (!_hwAssignmentId && _assignments[0]) _hwAssignmentId = _assignments[0].id;
  } else if (res && res._error) {
    toast(res.message || 'Could not load assignments', 'error');
  }
  if (_hwAssignmentId) {
    const [subs, stats] = await Promise.all([
      _ac().get('/assignments/' + encodeURIComponent(_hwAssignmentId) + '/submissions'),
      _ac().get('/assignments/' + encodeURIComponent(_hwAssignmentId) + '/stats'),
    ]);
    _submissions = subs && !subs._error ? subs.submissions || [] : [];
    _hwStats = stats && !stats._error ? stats : null;
  }
}

function _renderHomework(content) {
  const session = getSession() || {};
  const asgOpts = _assignments
    .map(function (a) {
      return (
        '<option value="' +
        _esc(a.id) +
        '"' +
        (a.id === _hwAssignmentId ? ' selected' : '') +
        '>' +
        _esc(a.title) +
        '</option>'
      );
    })
    .join('');

  const subRows = _submissions
    .map(function (s) {
      return (
        '<tr><td class="stt-mono">' +
        _esc(s.studentId || s.student_id) +
        '</td><td>' +
        _esc(s.state) +
        '</td><td>' +
        _esc(
          s.draftGrade != null
            ? String(s.draftGrade)
            : s.draft_grade != null
              ? String(s.draft_grade)
              : '—',
        ) +
        '</td><td>' +
        '<input class="sac-input" style="width:72px" data-grade-for="' +
        _esc(s.id) +
        '" placeholder="Grade" />' +
        '<button type="button" class="sac-btn ghost" data-hw-grade="' +
        _esc(s.id) +
        '">Save</button>' +
        '<button type="button" class="sac-btn ghost" data-hw-return="' +
        _esc(s.id) +
        '">Return</button>' +
        '</td></tr>'
      );
    })
    .join('');

  const stats =
    _hwStats &&
    '<div class="sac-help">Assigned ' +
      _esc(String(_hwStats.assigned ?? _hwStats.total ?? '—')) +
      ' · Turned in ' +
      _esc(String(_hwStats.turned_in ?? _hwStats.turnedIn ?? '—')) +
      ' · Returned ' +
      _esc(String(_hwStats.returned ?? '—')) +
      '</div>';

  content.innerHTML =
    '<div class="sac-panel">' +
    '<div class="sac-toolbar">' +
    '<input class="sac-input" id="sacHwSection" placeholder="Section ref (e.g. 8|A or 8A)" value="' +
    _esc(_sectionRef) +
    '" />' +
    '<button type="button" class="sac-btn" id="sacHwLoad">Load</button>' +
    '</div>' +
    '<form class="sac-form" id="sacHwCreate">' +
    '<h4>New assignment</h4>' +
    '<input class="sac-input" name="title" placeholder="Title" required />' +
    '<input class="sac-input" name="due_at" type="datetime-local" required />' +
    '<input class="sac-input" name="max_points" type="number" placeholder="Max points" value="10" />' +
    '<input class="sac-input" name="student_ids" placeholder="Student ids (comma-separated)" required />' +
    '<textarea class="sac-input" name="instructions" placeholder="Instructions" rows="2"></textarea>' +
    '<button type="submit" class="sac-btn">Create</button>' +
    '</form>' +
    '<div class="sac-toolbar"><label>Assignment <select class="sac-input" id="sacHwAsg">' +
    '<option value="">Select…</option>' +
    asgOpts +
    '</select></label>' +
    '<button type="button" class="sac-btn ghost" id="sacHwSweep">Sweep missing</button></div>' +
    (stats || '') +
    '<table class="sac-table"><thead><tr><th>Student</th><th>State</th><th>Grade</th><th></th></tr></thead><tbody>' +
    (subRows || '<tr><td colspan="4">No submissions</td></tr>') +
    '</tbody></table></div>';

  content.querySelector('#sacHwLoad').addEventListener('click', function () {
    _sectionRef = content.querySelector('#sacHwSection').value.trim();
    _hwAssignmentId = '';
    sacLoadData();
  });
  content.querySelector('#sacHwAsg').addEventListener('change', function (e) {
    _hwAssignmentId = e.target.value;
    sacLoadData();
  });
  content.querySelector('#sacHwCreate').addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const section = content.querySelector('#sacHwSection').value.trim() || _sectionRef;
    if (!section || !_courseId) {
      toast('Section ref and course required', 'error');
      return;
    }
    _sectionRef = section;
    const studentIds = String(fd.get('student_ids') || '')
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    const dueRaw = String(fd.get('due_at') || '');
    const dueAt = dueRaw ? new Date(dueRaw).toISOString() : '';
    const res = await _ac().post('/assignments', {
      course_id: _courseId,
      section_ref: section,
      title: String(fd.get('title') || ''),
      instructions: String(fd.get('instructions') || '') || null,
      max_points: Number(fd.get('max_points') || 10),
      due_at: dueAt,
      assigned_by: session.email || session.name || 'teacher',
      student_ids: studentIds,
    });
    if (res && !res._error) {
      toast('Assignment created', 'success');
      _hwAssignmentId = res.assignment ? res.assignment.id : '';
      await _loadHomework();
      sacRender();
    } else toast((res && (res.message || res.error)) || 'Create failed', 'error');
  });
  content.querySelector('#sacHwSweep').addEventListener('click', async function () {
    if (!_hwAssignmentId) return;
    const res = await _ac().post(
      '/assignments/' + encodeURIComponent(_hwAssignmentId) + '/sweep-missing',
      {},
    );
    if (res && !res._error) {
      toast('Sweep done', 'success');
      await _loadHomework();
      sacRender();
    } else toast((res && res.message) || 'Sweep failed', 'error');
  });
  content.querySelectorAll('[data-hw-grade]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const sid = btn.getAttribute('data-hw-grade');
      const input = content.querySelector('[data-grade-for="' + sid + '"]');
      const grade = input ? Number(input.value) : NaN;
      if (isNaN(grade)) {
        toast('Enter a grade', 'warn');
        return;
      }
      const res = await _ac().patch('/submissions/' + encodeURIComponent(sid) + '/grade', {
        draft_grade: grade,
      });
      if (res && !res._error) {
        toast('Grade saved', 'success');
        await _loadHomework();
        sacRender();
      } else toast((res && res.message) || 'Grade failed', 'error');
    });
  });
  content.querySelectorAll('[data-hw-return]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const sid = btn.getAttribute('data-hw-return');
      const res = await _ac().post('/submissions/' + encodeURIComponent(sid) + '/return', {});
      if (res && !res._error) {
        toast('Returned', 'success');
        await _loadHomework();
        sacRender();
      } else toast((res && res.message) || 'Return failed', 'error');
    });
  });
}

/** @returns {object} */
export function sacGetState() {
  return {
    tab: _tab,
    courseId: _courseId,
    courses: _courses.slice(),
    tree: _tree,
    coverage: _coverage,
    variance: _variance,
    lessons: _lessons.slice(),
    reviewQueue: _reviewQueue.slice(),
    tagError: _tagError,
    sectionRef: _sectionRef,
    loadError: _loadError,
  };
}

/** @param {object} partial */
export function sacSetState(partial) {
  if (partial.tab) _tab = partial.tab;
  if (partial.courseId) _courseId = partial.courseId;
  if (partial.courses) _courses = partial.courses;
  if (partial.tree !== undefined) _tree = partial.tree;
  if (partial.coverage !== undefined) _coverage = partial.coverage;
  if (partial.variance !== undefined) _variance = partial.variance;
  if (partial.lessons) _lessons = partial.lessons;
  if (partial.reviewQueue) _reviewQueue = partial.reviewQueue;
  if (partial.outcomes) _outcomes = partial.outcomes;
  if (partial.loadError !== undefined) _loadError = partial.loadError;
  if (partial.sectionRef != null) _sectionRef = partial.sectionRef;
  if (partial.tagError != null) _tagError = partial.tagError;
  if (_container) {
    _container.querySelectorAll('.sac-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === _tab);
    });
    sacRender();
  }
}

registerModule('school_academics', renderSchoolAcademicsPage);

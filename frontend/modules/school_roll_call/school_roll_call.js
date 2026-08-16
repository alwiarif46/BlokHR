/**
 * modules/school_roll_call/school_roll_call.js
 *
 * Teacher roll call: photo/seating grid, period picker, offline durable queue.
 * Pattern: renderSchoolRollCallPage() → rcLoadData() → rcRenderStats() → rcRender()
 */

import { api, getSchoolTenantId } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { getPrefs, loadPrefs, savePrefs } from '../../shared/prefs.js';
import { registerModule } from '../../shared/router.js';
import {
  backoffMs,
  buildPendingRecord,
  countPending,
  enqueueAndFlush,
  flushPending,
  handleRollCallLogout,
  isStaleRecord,
  listPending,
  newIdempotencyKey,
} from './queue.js';

const STATUS_CYCLE = ['present', 'absent', 'late'];
const DEFAULT_LATE_MINUTES = 10;
const SEAT_PREF_KEY = 'rollcall_seat_orders';

let _container = null;
let _periods = [];
let _periodId = '';
let _students = [];
/** @type {Record<string, { status: string, lateMinutes: number|null, reasonCodeId: string|null }>} */
let _marks = {};
let _reasonCodes = null;
let _view = 'grid';
let _multi = false;
let _selected = new Set();
let _inlineStudentId = null;
let _inlineMode = null;
let _pendingCount = 0;
let _pendingRows = [];
let _showPendingPanel = false;
let _sectionMeta = null;
let _dragId = null;
/** Stable idempotency key for the current open period until successful submit clears marks context */
let _submitKey = null;
let _flushTimer = null;
/** @type {'rollcall'|'diary'} */
let _mode = 'rollcall';
/** @type {'today'|'yesterday'} */
let _diaryDay = 'today';
let _diaryKind = 'homework';
let _diaryBody = '';
/** @type {string|null} edit target entry id */
let _diaryEditId = null;
/** @type {Array<any>} */
let _diaryEntries = [];
/** Targeting multi-select for diary compose (none = whole class) */
let _diaryTargetMode = false;
/** @type {Set<string>} */
let _diaryTargets = new Set();
let _diaryOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _today() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

function _memberId() {
  const s = getSession() || {};
  return s.email || s.name || 'teacher';
}

function _ini(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

/**
 * @param {string} current
 * @returns {string}
 */
export function cycleStatus(current) {
  const i = STATUS_CYCLE.indexOf(current);
  const next = STATUS_CYCLE[(i < 0 ? 0 : i + 1) % STATUS_CYCLE.length];
  return next;
}

/**
 * @param {Record<string, { status: string }>} marks
 * @returns {{ present: number, absent: number, late: number, total: number, label: string }}
 */
export function computeCounter(marks) {
  let present = 0;
  let absent = 0;
  let late = 0;
  const ids = Object.keys(marks || {});
  ids.forEach(function (id) {
    const st = marks[id] && marks[id].status;
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else if (st === 'late') late++;
  });
  return {
    present: present,
    absent: absent,
    late: late,
    total: ids.length,
    label: present + ' present · ' + absent + ' absent' + (late ? ' · ' + late + ' late' : ''),
  };
}

/**
 * @param {{ status: string, lateMinutes: number|null }} mark
 * @returns {string|null}
 */
export function validateMark(mark) {
  if (!mark || !mark.status) return 'status required';
  if (mark.status === 'late') {
    if (mark.lateMinutes == null || !Number.isInteger(Number(mark.lateMinutes))) {
      return 'late_minutes is required for late status';
    }
    if (Number(mark.lateMinutes) < 0) return 'late_minutes must be >= 0';
  }
  return null;
}

/**
 * Default all students to present.
 * @param {Array<{ id: string }>} students
 */
export function defaultPresentMarks(students) {
  const marks = {};
  (students || []).forEach(function (s) {
    marks[s.id] = { status: 'present', lateMinutes: null, reasonCodeId: null };
  });
  return marks;
}

/**
 * Apply stored seat order; unknown ids append at end.
 * @param {Array<{ id: string }>} students
 * @param {string[]} order
 */
export function applySeatOrder(students, order) {
  const list = (students || []).slice();
  if (!order || !order.length) return list;
  const byId = new Map(list.map(function (s) {
    return [s.id, s];
  }));
  const out = [];
  order.forEach(function (id) {
    if (byId.has(id)) {
      out.push(byId.get(id));
      byId.delete(id);
    }
  });
  byId.forEach(function (s) {
    out.push(s);
  });
  return out;
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolRollCallPage(container) {
  _container = container;
  _periods = [];
  _periodId = '';
  _students = [];
  _marks = {};
  _view = 'grid';
  _multi = false;
  _selected = new Set();
  _inlineStudentId = null;
  _showPendingPanel = false;
  _submitKey = null;
  _mode = 'rollcall';
  _diaryDay = 'today';
  _diaryKind = 'homework';
  _diaryBody = '';
  _diaryEditId = null;
  _diaryEntries = [];
  _diaryTargetMode = false;
  _diaryTargets = new Set();
  _diaryOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

  container.innerHTML =
    '<div class="rc-wrap" id="rcWrap">' +
    '<div class="rc-toolbar">' +
    '<div class="rc-title">Roll call</div>' +
    '<div class="rc-mode" id="rcMode">' +
    '<button type="button" class="rc-btn ghost active" id="rcModeRoll" data-mode="rollcall">Roll call</button>' +
    '<button type="button" class="rc-btn ghost" id="rcModeDiary" data-mode="diary">Diary</button>' +
    '</div>' +
    '<select class="rc-select" id="rcPeriod" aria-label="Period"></select>' +
    '<button type="button" class="rc-btn ghost" id="rcViewGrid">Grid</button>' +
    '<button type="button" class="rc-btn ghost" id="rcViewSeat">Seating</button>' +
    '<div class="rc-spacer"></div>' +
    '<div class="rc-chip" id="rcCounter">0 present · 0 absent</div>' +
    '<div class="rc-chip pending" id="rcPendingChip" hidden>pending sync: 0</div>' +
    '</div>' +
    '<div class="rc-bulk" id="rcBulk">' +
    '<button type="button" class="rc-btn ghost" id="rcMulti">Multi-select</button>' +
    '<button type="button" class="rc-btn ghost" id="rcRestPresent">Mark rest present</button>' +
    '<button type="button" class="rc-btn ghost" id="rcBulkPresent" hidden>Selected → present</button>' +
    '</div>' +
    '<div id="rcPendingPanel" hidden></div>' +
    '<div class="rc-diary" id="rcDiary" hidden></div>' +
    '<div class="rc-grid" id="rcGrid"></div>' +
    '<div class="rc-footer" id="rcFooter">' +
    '<button type="button" class="rc-btn" id="rcSubmit">Submit</button>' +
    '<span class="rc-chip" id="rcSaved" hidden>Saved ✓</span>' +
    '</div>' +
    '</div>';

  _bind(container);
  window.addEventListener('online', _onOnlineChange);
  window.addEventListener('offline', _onOnlineChange);
  rcLoadData();
}

function _onOnlineChange() {
  _diaryOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  if (_mode === 'diary') rcRenderDiary();
}

function _bind(container) {
  container.querySelector('#rcPeriod').addEventListener('change', function (e) {
    _periodId = e.target.value;
    _submitKey = null;
    _loadRosterForPeriod().then(function () {
      if (_mode === 'diary') return rcLoadDiaryEntries();
      return null;
    });
  });
  container.querySelector('#rcModeRoll').addEventListener('click', function () {
    rcSwitchMode('rollcall');
  });
  container.querySelector('#rcModeDiary').addEventListener('click', function () {
    rcSwitchMode('diary');
  });
  container.querySelector('#rcViewGrid').addEventListener('click', function () {
    _view = 'grid';
    rcRender();
  });
  container.querySelector('#rcViewSeat').addEventListener('click', function () {
    /* L6 cosmetic — seating is roll-call only; diary keeps grid select mode */
    if (_mode === 'diary') return;
    _view = 'seating';
    rcRender();
  });
  container.querySelector('#rcMulti').addEventListener('click', function () {
    _multi = !_multi;
    if (!_multi) _selected = new Set();
    rcRender();
  });
  container.querySelector('#rcRestPresent').addEventListener('click', function () {
    Object.keys(_marks).forEach(function (id) {
      if (_marks[id].status !== 'absent' && _marks[id].status !== 'late') {
        _marks[id] = { status: 'present', lateMinutes: null, reasonCodeId: null };
      }
    });
    /* mark unmarked-as-touched: everyone not absent/late becomes present — already default;
       "rest" means leave explicit absent/late, force others present */
    Object.keys(_marks).forEach(function (id) {
      if (_marks[id].status !== 'absent' && _marks[id].status !== 'late') {
        _marks[id] = { status: 'present', lateMinutes: null, reasonCodeId: _marks[id].reasonCodeId };
      }
    });
    toast('Rest marked present', 'success');
    rcRenderStats();
    rcRender();
  });
  container.querySelector('#rcBulkPresent').addEventListener('click', function () {
    _selected.forEach(function (id) {
      _marks[id] = { status: 'present', lateMinutes: null, reasonCodeId: null };
    });
    _selected = new Set();
    rcRenderStats();
    rcRender();
  });
  container.querySelector('#rcSubmit').addEventListener('click', function () {
    rcSubmit();
  });
  container.querySelector('#rcPendingChip').addEventListener('click', function () {
    _showPendingPanel = !_showPendingPanel;
    rcRenderPendingPanel();
  });
}

/**
 * Init: reason codes, periods, resume queue flush.
 */
export async function rcLoadData() {
  await Promise.all([_ensureReasonCodes(), loadPrefs().catch(function () {
    return null;
  })]);
  await _loadPeriods();
  await _refreshPendingChip();
  /* Startup recovery — resume flush of prior session pending marks */
  flushPending(getSchoolTenantId()).then(function () {
    return _refreshPendingChip();
  });
  _scheduleFlushLoop();
  rcRenderStats();
  rcRender();
}

function _scheduleFlushLoop() {
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(function () {
    flushPending(getSchoolTenantId()).then(function () {
      return _refreshPendingChip();
    });
  }, 15000);
}

/** Clear timers (tests / navigate away). */
export function rcTeardown() {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  window.removeEventListener('online', _onOnlineChange);
  window.removeEventListener('offline', _onOnlineChange);
}

async function _ensureReasonCodes() {
  if (_reasonCodes) return _reasonCodes;
  const res = await api.school('school-attendance').get('/reason-codes');
  if (res && !res._error) {
    _reasonCodes = res.reasonCodes || res.reason_codes || [];
  } else {
    _reasonCodes = [];
    if (res && res._error) toast(res.message || 'Could not load reason codes', 'error');
  }
  return _reasonCodes;
}

async function _loadPeriods() {
  const today = _today();
  const memberId = _memberId();
  const tt = api.school('school-timetable');
  const slotsRes = await tt.get('/teachers/' + encodeURIComponent(memberId) + '/slots');
  const slots = slotsRes && !slotsRes._error ? slotsRes.slots || [] : [];
  if (slotsRes && slotsRes._error) {
    toast(slotsRes.message || 'Could not load timetable', 'error');
  }

  const sectionIds = [];
  slots.forEach(function (s) {
    if (s.sectionId && sectionIds.indexOf(s.sectionId) < 0) sectionIds.push(s.sectionId);
  });

  const periods = [];
  for (let i = 0; i < sectionIds.length; i++) {
    const sectionId = sectionIds[i];
    const [section, instRes] = await Promise.all([
      tt.get('/sections/' + encodeURIComponent(sectionId)),
      tt.get(
        '/sections/' +
          encodeURIComponent(sectionId) +
          '/instances?from=' +
          encodeURIComponent(today) +
          '&to=' +
          encodeURIComponent(today),
      ),
    ]);
    const instances = instRes && !instRes._error ? instRes.instances || [] : [];
    instances.forEach(function (inst) {
      if (inst.status !== 'scheduled' && inst.status !== 'held') return;
      const owns = slots.some(function (sl) {
        return sl.sectionId === sectionId && sl.allocationId === inst.allocationId;
      });
      if (!owns) return;
      periods.push({
        id: inst.id,
        sectionId: sectionId,
        periodIndex: inst.periodIndex,
        status: inst.status,
        allocationId: inst.allocationId,
        date: inst.date || today,
        classLabel: section && !section._error ? section.classLabel : '',
        sectionLabel: section && !section._error ? section.section : '',
        subjectLabel: inst.subjectLabel || inst.subjectCode || '',
      });
    });
  }

  periods.sort(function (a, b) {
    return (a.periodIndex || 0) - (b.periodIndex || 0);
  });
  _periods = periods;

  const sel = _container && _container.querySelector('#rcPeriod');
  if (sel) {
    if (!_periods.length) {
      sel.innerHTML = '<option value="">No periods today</option>';
      _periodId = '';
      _students = [];
      _marks = {};
    } else {
      sel.innerHTML = _periods
        .map(function (p) {
          const label =
            'P' +
            (p.periodIndex + 1) +
            ' · ' +
            (p.classLabel || '') +
            (p.sectionLabel || '') +
            (p.subjectLabel ? ' · ' + p.subjectLabel : '') +
            ' (' +
            p.status +
            ')';
          return (
            '<option value="' +
            _esc(p.id) +
            '"' +
            (p.id === _periodId ? ' selected' : '') +
            '>' +
            _esc(label) +
            '</option>'
          );
        })
        .join('');
      if (!_periodId || !_periods.some(function (p) {
        return p.id === _periodId;
      })) {
        _periodId = _periods[0].id;
        sel.value = _periodId;
      }
      await _loadRosterForPeriod();
    }
  }
}

async function _loadRosterForPeriod() {
  const period = _periods.find(function (p) {
    return p.id === _periodId;
  });
  if (!period) {
    _students = [];
    _marks = {};
    rcRenderStats();
    rcRender();
    return;
  }
  _sectionMeta = period;

  const qs =
    '/students?status=active&limit=200&offset=0&class=' +
    encodeURIComponent(period.classLabel || '') +
    '&section=' +
    encodeURIComponent(period.sectionLabel || '');
  const res = await api.school('school-identity').get(qs);
  let students = res && !res._error ? res.items || [] : [];
  if (res && res._error) toast(res.message || 'Could not load roster', 'error');

  students = students.map(function (s) {
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      name: (s.firstName || '') + ' ' + (s.lastName || ''),
      photoRef: s.photoRef || null,
    };
  });

  const order = _readSeatOrder(period.sectionId);
  _students = applySeatOrder(students, order);
  _marks = defaultPresentMarks(_students);
  _submitKey = null;
  _inlineStudentId = null;
  rcRenderStats();
  rcRender();
}

function _readSeatOrder(sectionId) {
  const prefs = getPrefs() || {};
  let bag = prefs.notification_prefs;
  if (typeof bag === 'string') {
    try {
      bag = JSON.parse(bag);
    } catch (_e) {
      bag = {};
    }
  }
  if (!bag || typeof bag !== 'object') bag = {};
  const orders = bag[SEAT_PREF_KEY] || {};
  return orders[sectionId] || [];
}

async function _persistSeatOrder() {
  if (!_sectionMeta) return;
  const prefs = getPrefs() || {};
  let bag = prefs.notification_prefs;
  if (typeof bag === 'string') {
    try {
      bag = JSON.parse(bag);
    } catch (_e) {
      bag = {};
    }
  }
  if (!bag || typeof bag !== 'object') bag = {};
  const orders = Object.assign({}, bag[SEAT_PREF_KEY] || {});
  orders[_sectionMeta.sectionId] = _students.map(function (s) {
    return s.id;
  });
  bag[SEAT_PREF_KEY] = orders;
  const ok = await savePrefs({ notification_prefs: JSON.stringify(bag) });
  if (!ok) toast('Could not save seating order', 'error');
}

export function rcRenderStats() {
  const counter = _container && _container.querySelector('#rcCounter');
  if (!counter) return;
  const c = computeCounter(_marks);
  counter.textContent = c.label;
  const multiBtn = _container.querySelector('#rcMulti');
  if (multiBtn) multiBtn.classList.toggle('active', _multi);
  const bulkPresent = _container.querySelector('#rcBulkPresent');
  if (bulkPresent) bulkPresent.hidden = !_multi || _selected.size === 0;
  const gridBtn = _container.querySelector('#rcViewGrid');
  const seatBtn = _container.querySelector('#rcViewSeat');
  if (gridBtn) gridBtn.classList.toggle('active', _view === 'grid' && _mode === 'rollcall');
  if (seatBtn) seatBtn.classList.toggle('active', _view === 'seating' && _mode === 'rollcall');
  const rollBtn = _container.querySelector('#rcModeRoll');
  const diaryBtn = _container.querySelector('#rcModeDiary');
  if (rollBtn) rollBtn.classList.toggle('active', _mode === 'rollcall');
  if (diaryBtn) diaryBtn.classList.toggle('active', _mode === 'diary');

  const bulk = _container.querySelector('#rcBulk');
  const footer = _container.querySelector('#rcFooter');
  const diary = _container.querySelector('#rcDiary');
  const pendingPanel = _container.querySelector('#rcPendingPanel');
  if (bulk) bulk.hidden = _mode === 'diary';
  if (footer) footer.hidden = _mode === 'diary';
  if (counter) counter.hidden = _mode === 'diary';
  if (gridBtn) gridBtn.hidden = _mode === 'diary';
  /* L6 cosmetic — seating control hidden in diary; period/section context stays */
  if (seatBtn) seatBtn.hidden = _mode === 'diary';
  if (diary) diary.hidden = _mode !== 'diary';
  if (pendingPanel && _mode === 'diary') pendingPanel.hidden = true;
}

/**
 * @param {'rollcall'|'diary'} mode
 */
export function rcSwitchMode(mode) {
  if (mode !== 'rollcall' && mode !== 'diary') return;
  _mode = mode;
  if (_mode === 'diary') {
    _view = 'grid';
    _diaryTargetMode = false;
    _diaryTargets = new Set();
    rcRenderStats();
    rcRenderDiary();
    rcRender();
    rcLoadDiaryEntries();
  } else {
    rcRenderStats();
    rcRender();
  }
}

function _sectionRef() {
  if (!_sectionMeta) return '';
  return String(_sectionMeta.classLabel || '') + '|' + String(_sectionMeta.sectionLabel || '');
}

function _diaryEntryDate() {
  const today = _today();
  if (_diaryDay === 'yesterday') {
    const t = Date.parse(today + 'T00:00:00.000Z') - 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  }
  return today;
}

export async function rcLoadDiaryEntries() {
  const sectionRef = _sectionRef();
  if (!sectionRef || sectionRef === '|') {
    _diaryEntries = [];
    if (_mode === 'diary') rcRenderDiary();
    return;
  }
  const date = _diaryEntryDate();
  const qs =
    '/diary?section_ref=' +
    encodeURIComponent(sectionRef) +
    '&date=' +
    encodeURIComponent(date);
  const res = await api.school('school-engagement').get(qs);
  if (res && res._error) {
    toast(res.message || 'Could not load diary', 'error');
    _diaryEntries = [];
  } else {
    _diaryEntries = (res && res.entries) || [];
  }
  if (_mode === 'diary') rcRenderDiary();
}

export function rcRenderDiary() {
  const el = _container && _container.querySelector('#rcDiary');
  if (!el) return;
  const online = _diaryOnline;
  const bodyLen = (_diaryBody || '').length;
  const targetHint = _diaryTargets.size
    ? _diaryTargets.size + ' student(s) selected'
    : 'Whole class';
  const entriesHtml = (_diaryEntries || [])
    .map(function (e) {
      const acks = e.acks != null ? e.acks : 0;
      return (
        '<article class="rc-diary-entry" data-diary-id="' +
        _esc(e.id) +
        '">' +
        '<div class="rc-diary-entry-head">' +
        '<span class="rc-chip">' +
        _esc(e.kind || '') +
        '</span>' +
        '<span class="rc-chip">Seen by ' +
        _esc(String(acks)) +
        '</span>' +
        '<button type="button" class="rc-btn ghost" data-diary-edit="' +
        _esc(e.id) +
        '">Edit</button>' +
        '</div>' +
        '<p class="rc-diary-entry-body">' +
        _esc(e.body || '') +
        '</p>' +
        (e.studentRef || e.student_ref
          ? '<p class="rc-chip">Targeted</p>'
          : '<p class="rc-chip">Class</p>') +
        '</article>'
      );
    })
    .join('');

  el.innerHTML =
    '<div class="rc-diary-toolbar">' +
    '<button type="button" class="rc-btn ghost' +
    (_diaryDay === 'today' ? ' active' : '') +
    '" id="rcDiaryToday">Today</button>' +
    '<button type="button" class="rc-btn ghost' +
    (_diaryDay === 'yesterday' ? ' active' : '') +
    '" id="rcDiaryYesterday">Yesterday</button>' +
    '<span class="rc-chip">' +
    _esc(_diaryEntryDate()) +
    ' · ' +
    _esc(_sectionRef()) +
    '</span>' +
    '</div>' +
    '<form class="rc-diary-compose" id="rcDiaryForm">' +
    (online ? '' : '<p class="rc-diary-offline">Diary needs a connection</p>') +
    '<div class="rc-diary-field">' +
    '<label for="rcDiaryKind">Kind</label>' +
    '<select id="rcDiaryKind"' +
    (online ? '' : ' disabled') +
    '>' +
    ['homework', 'note', 'remark', 'reminder']
      .map(function (k) {
        return (
          '<option value="' +
          k +
          '"' +
          (_diaryKind === k ? ' selected' : '') +
          '>' +
          k +
          '</option>'
        );
      })
      .join('') +
    '</select>' +
    '</div>' +
    '<div class="rc-diary-field">' +
    '<label for="rcDiaryBody">Entry</label>' +
    '<textarea id="rcDiaryBody" rows="3" maxlength="2000"' +
    (online ? '' : ' disabled') +
    '>' +
    _esc(_diaryBody) +
    '</textarea>' +
    '<div class="rc-diary-count" id="rcDiaryCount">' +
    bodyLen +
    ' / 2000</div>' +
    '</div>' +
    '<div class="rc-diary-field">' +
    '<button type="button" class="rc-btn ghost' +
    (_diaryTargetMode ? ' active' : '') +
    '" id="rcDiaryTarget"' +
    (online ? '' : ' disabled') +
    '>Target students</button>' +
    '<span class="rc-chip" id="rcDiaryTargetHint">' +
    _esc(targetHint) +
    '</span>' +
    '</div>' +
    '<button type="submit" class="rc-btn" id="rcDiaryPost"' +
    (online ? '' : ' disabled') +
    '>' +
    (_diaryEditId ? 'Save edit' : 'Post diary') +
    '</button>' +
    (_diaryEditId
      ? '<button type="button" class="rc-btn ghost" id="rcDiaryCancelEdit">Cancel edit</button>'
      : '') +
    '</form>' +
    '<div class="rc-diary-list">' +
    '<h3>Entries</h3>' +
    (entriesHtml || '<p class="rc-empty">No entries for this day.</p>') +
    '</div>';

  const kind = el.querySelector('#rcDiaryKind');
  const body = el.querySelector('#rcDiaryBody');
  const form = el.querySelector('#rcDiaryForm');
  const todayBtn = el.querySelector('#rcDiaryToday');
  const ydayBtn = el.querySelector('#rcDiaryYesterday');
  const targetBtn = el.querySelector('#rcDiaryTarget');
  const cancelEdit = el.querySelector('#rcDiaryCancelEdit');

  if (kind) {
    kind.addEventListener('change', function () {
      _diaryKind = kind.value;
    });
  }
  if (body) {
    body.addEventListener('input', function () {
      _diaryBody = body.value.slice(0, 2000);
      const count = el.querySelector('#rcDiaryCount');
      if (count) count.textContent = _diaryBody.length + ' / 2000';
    });
  }
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      rcDiarySubmit();
    });
  }
  if (todayBtn) {
    todayBtn.addEventListener('click', function () {
      _diaryDay = 'today';
      _diaryEditId = null;
      rcLoadDiaryEntries();
    });
  }
  if (ydayBtn) {
    ydayBtn.addEventListener('click', function () {
      _diaryDay = 'yesterday';
      _diaryEditId = null;
      rcLoadDiaryEntries();
    });
  }
  if (targetBtn) {
    targetBtn.addEventListener('click', function () {
      _diaryTargetMode = !_diaryTargetMode;
      if (!_diaryTargetMode) _diaryTargets = new Set();
      rcRenderDiary();
      rcRender();
    });
  }
  if (cancelEdit) {
    cancelEdit.addEventListener('click', function () {
      _diaryEditId = null;
      _diaryBody = '';
      _diaryKind = 'homework';
      rcRenderDiary();
    });
  }
  el.querySelectorAll('[data-diary-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-diary-edit');
      const entry = _diaryEntries.find(function (e) {
        return e.id === id;
      });
      if (!entry) return;
      _diaryEditId = id;
      _diaryKind = entry.kind || 'homework';
      _diaryBody = entry.body || '';
      rcRenderDiary();
    });
  });
}

/**
 * Post or patch diary — online only.
 * Diary posts are online-only: do NOT route through the roll-call offline queue
 * (IndexedDB store is for attendance marks only — the F-03 exception is scoped).
 */
export async function rcDiarySubmit() {
  if (!_diaryOnline) {
    toast('Diary needs a connection', 'error');
    return;
  }
  const sectionRef = _sectionRef();
  if (!sectionRef || sectionRef === '|') {
    toast('Select a period / section first', 'error');
    return;
  }
  const body = (_diaryBody || '').trim();
  if (!body) {
    toast('Entry body is required', 'error');
    return;
  }
  if (body.length > 2000) {
    toast('Body must be ≤2000 characters', 'error');
    return;
  }

  const eng = api.school('school-engagement');
  const wasEdit = Boolean(_diaryEditId);
  let res;

  if (_diaryEditId) {
    res = await eng.patch('/diary/' + encodeURIComponent(_diaryEditId), {
      kind: _diaryKind,
      body: body,
    });
  } else if (_diaryTargets.size > 1) {
    const ids = Array.from(_diaryTargets);
    const base = {
      section_ref: sectionRef,
      entry_date: _diaryEntryDate(),
      kind: _diaryKind,
      body: body,
    };
    for (let i = 0; i < ids.length; i++) {
      res = await eng.post('/diary', Object.assign({}, base, { student_ref: ids[i] }));
      if (res && res._error) break;
    }
  } else {
    const payload = {
      section_ref: sectionRef,
      entry_date: _diaryEntryDate(),
      kind: _diaryKind,
      body: body,
    };
    if (_diaryTargets.size === 1) {
      payload.student_ref = Array.from(_diaryTargets)[0];
    }
    res = await eng.post('/diary', payload);
  }

  if (res && res._error) {
    const errCode = String(res.error || res.message || '');
    if (res.status === 403 && /edit_window_closed/.test(errCode)) {
      toast('Editing window closed', 'error');
    } else {
      toast(res.message || res.error || 'Could not save diary', 'error');
    }
    return;
  }

  _diaryBody = '';
  _diaryTargets = new Set();
  _diaryTargetMode = false;
  _diaryEditId = null;
  toast(wasEdit ? 'Saved' : 'Posted', 'success');
  await rcLoadDiaryEntries();
  rcRender();
}

export function rcRender() {
  const grid = _container && _container.querySelector('#rcGrid');
  if (!grid) return;

  if (_mode === 'diary') {
    grid.className = 'rc-grid diary-select';
    if (!_students.length) {
      grid.innerHTML = '<div class="rc-empty">Select a period to open the class diary.</div>';
      rcRenderStats();
      return;
    }
    if (!_diaryTargetMode) {
      grid.innerHTML =
        '<div class="rc-empty">Optional: turn on “Target students” to pick who this entry is for. None selected = whole class.</div>';
      rcRenderStats();
      return;
    }
    grid.innerHTML = _students
      .map(function (s) {
        const selected = _diaryTargets.has(s.id) ? ' selected' : '';
        const photoStyle = s.photoRef
          ? ' style="background-image:url(\'' + _esc(s.photoRef) + '\')"'
          : '';
        return (
          '<div class="rc-tile diary-pick' +
          selected +
          '" data-student-id="' +
          _esc(s.id) +
          '" data-diary-pick="1">' +
          '<div class="rc-avatar"' +
          photoStyle +
          '>' +
          (s.photoRef ? '' : _esc(_ini(s.name))) +
          '</div>' +
          '<div class="rc-name">' +
          _esc(s.name) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    grid.querySelectorAll('[data-diary-pick]').forEach(function (tile) {
      tile.addEventListener('click', function () {
        const id = tile.getAttribute('data-student-id');
        if (_diaryTargets.has(id)) _diaryTargets.delete(id);
        else _diaryTargets.add(id);
        rcRenderDiary();
        rcRender();
      });
    });
    rcRenderStats();
    return;
  }

  grid.className = 'rc-grid' + (_view === 'seating' ? ' seating' : '');

  if (!_students.length) {
    grid.innerHTML = '<div class="rc-empty">Select a period to mark attendance.</div>';
    rcRenderStats();
    return;
  }

  grid.innerHTML = _students
    .map(function (s) {
      const m = _marks[s.id] || { status: 'present' };
      const selected = _selected.has(s.id) ? ' selected' : '';
      const photoStyle = s.photoRef
        ? ' style="background-image:url(\'' + _esc(s.photoRef) + '\')"'
        : '';
      let inline = '';
      if (_inlineStudentId === s.id && _inlineMode === 'absent') {
        inline = _reasonPickerHtml(s.id, m.reasonCodeId);
      } else if (_inlineStudentId === s.id && _inlineMode === 'late') {
        inline = _lateStepperHtml(s.id, m.lateMinutes != null ? m.lateMinutes : DEFAULT_LATE_MINUTES);
      }
      return (
        '<div class="rc-tile ' +
        _esc(m.status) +
        selected +
        '" draggable="' +
        (_view === 'seating' ? 'true' : 'false') +
        '" data-student-id="' +
        _esc(s.id) +
        '">' +
        '<div class="rc-avatar"' +
        photoStyle +
        '>' +
        (s.photoRef ? '' : _esc(_ini(s.name))) +
        '</div>' +
        '<div class="rc-name">' +
        _esc(s.name) +
        '</div>' +
        '<div class="rc-status">' +
        _esc(m.status) +
        (m.status === 'late' && m.lateMinutes != null ? ' ' + m.lateMinutes + 'm' : '') +
        '</div>' +
        inline +
        '</div>'
      );
    })
    .join('');

  grid.querySelectorAll('.rc-tile').forEach(function (tile) {
    const id = tile.getAttribute('data-student-id');
    tile.addEventListener('click', function (e) {
      if (e.target.closest('.rc-inline')) return;
      if (_multi) {
        if (_selected.has(id)) _selected.delete(id);
        else _selected.add(id);
        rcRenderStats();
        rcRender();
        return;
      }
      rcCycleStudent(id);
    });
    if (_view === 'seating') {
      tile.addEventListener('dragstart', function () {
        _dragId = id;
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', function () {
        tile.classList.remove('dragging');
        _dragId = null;
      });
      tile.addEventListener('dragover', function (e) {
        e.preventDefault();
      });
      tile.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!_dragId || _dragId === id) return;
        _reorderStudents(_dragId, id);
      });
    }
  });

  _wireInline(grid);
  rcRenderStats();
}

function _reasonPickerHtml(studentId, selectedId) {
  const opts = (_reasonCodes || [])
    .filter(function (r) {
      return r.isActive !== false;
    })
    .map(function (r) {
      return (
        '<option value="' +
        _esc(r.id) +
        '"' +
        (r.id === selectedId ? ' selected' : '') +
        '>' +
        _esc(r.label || r.code) +
        '</option>'
      );
    })
    .join('');
  return (
    '<div class="rc-inline" data-inline="absent">' +
    '<select id="rcReason">' +
    '<option value="">Reason…</option>' +
    opts +
    '</select>' +
    '<div class="rc-inline-actions">' +
    '<button type="button" class="rc-btn ghost" data-rc-reason-ok="' +
    _esc(studentId) +
    '">OK</button>' +
    '</div></div>'
  );
}

function _lateStepperHtml(studentId, minutes) {
  return (
    '<div class="rc-inline" data-inline="late">' +
    '<input type="number" id="rcLateMin" min="0" step="1" value="' +
    _esc(String(minutes)) +
    '">' +
    '<div class="rc-inline-actions">' +
    '<button type="button" class="rc-btn ghost" data-rc-late-ok="' +
    _esc(studentId) +
    '">OK</button>' +
    '</div></div>'
  );
}

function _wireInline(grid) {
  grid.querySelectorAll('[data-rc-reason-ok]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const id = btn.getAttribute('data-rc-reason-ok');
      const sel = grid.querySelector('#rcReason');
      const reasonId = sel && sel.value ? sel.value : null;
      _marks[id] = {
        status: 'absent',
        lateMinutes: null,
        reasonCodeId: reasonId,
      };
      _inlineStudentId = null;
      _inlineMode = null;
      rcRenderStats();
      rcRender();
    });
  });
  grid.querySelectorAll('[data-rc-late-ok]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const id = btn.getAttribute('data-rc-late-ok');
      const input = grid.querySelector('#rcLateMin');
      const mins = input ? Number(input.value) : DEFAULT_LATE_MINUTES;
      if (!Number.isInteger(mins) || mins < 0) {
        toast('late_minutes is required for late status', 'error');
        return;
      }
      _marks[id] = {
        status: 'late',
        lateMinutes: mins,
        reasonCodeId: null,
      };
      _inlineStudentId = null;
      _inlineMode = null;
      rcRenderStats();
      rcRender();
    });
  });
}

/**
 * Tap cycle Present → Absent → Late.
 * @param {string} studentId
 */
export function rcCycleStudent(studentId) {
  const cur = (_marks[studentId] && _marks[studentId].status) || 'present';
  const next = cycleStatus(cur);
  if (next === 'absent') {
    _marks[studentId] = { status: 'absent', lateMinutes: null, reasonCodeId: null };
    _inlineStudentId = studentId;
    _inlineMode = 'absent';
  } else if (next === 'late') {
    _marks[studentId] = {
      status: 'late',
      lateMinutes: DEFAULT_LATE_MINUTES,
      reasonCodeId: null,
    };
    _inlineStudentId = studentId;
    _inlineMode = 'late';
  } else {
    _marks[studentId] = { status: 'present', lateMinutes: null, reasonCodeId: null };
    _inlineStudentId = null;
    _inlineMode = null;
  }
  rcRenderStats();
  rcRender();
}

function _reorderStudents(fromId, toId) {
  const from = _students.findIndex(function (s) {
    return s.id === fromId;
  });
  const to = _students.findIndex(function (s) {
    return s.id === toId;
  });
  if (from < 0 || to < 0) return;
  const copy = _students.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  _students = copy;
  _persistSeatOrder();
  rcRender();
}

async function _refreshPendingChip() {
  try {
    _pendingRows = await listPending(getSchoolTenantId());
    _pendingCount = _pendingRows.length;
  } catch (_e) {
    _pendingRows = [];
    _pendingCount = 0;
  }
  const chip = _container && _container.querySelector('#rcPendingChip');
  if (!chip) return;
  if (_pendingCount <= 0) {
    chip.hidden = true;
    _showPendingPanel = false;
    rcRenderPendingPanel();
    return;
  }
  chip.hidden = false;
  const stale = _pendingRows.some(function (r) {
    return isStaleRecord(r.created_at);
  });
  chip.classList.toggle('stale', stale);
  chip.textContent =
    'pending sync: ' +
    _pendingCount +
    ' period' +
    (_pendingCount === 1 ? '' : 's') +
    (stale ? ' · stale — review before sync' : '');
  if (_showPendingPanel) rcRenderPendingPanel();
}

export function rcRenderPendingPanel() {
  const panel = _container && _container.querySelector('#rcPendingPanel');
  if (!panel) return;
  if (!_showPendingPanel || !_pendingCount) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  panel.hidden = false;
  let rows = '';
  _pendingRows.forEach(function (r) {
    const stale = isStaleRecord(r.created_at);
    rows +=
      '<div class="rc-panel-row" data-pending-key="' +
      _esc(r.idempotency_key) +
      '">' +
      '<div>' +
      _esc(r.created_at) +
      (stale ? ' · stale' : '') +
      '<div class="rc-status">' +
      _esc(r.last_error || 'queued') +
      ' · attempts ' +
      _esc(String(r.attempts || 0)) +
      '</div></div>' +
      (stale
        ? '<button type="button" class="rc-btn ghost" data-flush-stale="' +
          _esc(r.idempotency_key) +
          '">Sync now</button>'
        : '') +
      '</div>';
  });
  panel.innerHTML = '<div class="rc-panel"><h4>Pending sync</h4>' + rows + '</div>';
  panel.querySelectorAll('[data-flush-stale]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const key = btn.getAttribute('data-flush-stale');
      await flushPending(getSchoolTenantId(), { allowStaleKeys: [key] });
      await _refreshPendingChip();
      toast('Sync attempted', 'info');
    });
  });
}

/**
 * Submit current marks via durable queue.
 */
export async function rcSubmit() {
  const period = _periods.find(function (p) {
    return p.id === _periodId;
  });
  if (!period) {
    toast('Select a period first', 'error');
    return;
  }

  const markList = [];
  const ids = Object.keys(_marks);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const m = _marks[id];
    const err = validateMark(m);
    if (err) {
      toast(err, 'error');
      return;
    }
    markList.push({
      student_id: id,
      status: m.status,
      reason_code_id: m.reasonCodeId,
      late_minutes: m.status === 'late' ? m.lateMinutes : null,
    });
  }
  if (!markList.length) {
    toast('No students to mark', 'error');
    return;
  }

  if (!_submitKey) _submitKey = newIdempotencyKey();
  const record = buildPendingRecord({
    tenantId: getSchoolTenantId(),
    idempotencyKey: _submitKey,
    markedBy: _memberId(),
    context: {
      date: period.date || _today(),
      period_instance_id: period.id,
    },
    marks: markList,
  });

  const saved = _container.querySelector('#rcSaved');
  if (saved) saved.hidden = false;

  try {
    await enqueueAndFlush(getSchoolTenantId(), record);
  } catch (e) {
    toast((e && e.message) || 'Queue write failed', 'error');
    await _refreshPendingChip();
    return;
  }

  /* Mark period held via timetable PATCH (best-effort; never blocks next period) */
  try {
    await api.school('school-timetable').patch('/instances/' + encodeURIComponent(period.id), {
      status: 'held',
    });
  } catch (_e) {
    /* ignore */
  }

  toast('Saved ✓', 'success');
  _submitKey = null;
  await _refreshPendingChip();

  /* Allow marking the next period even if flush failed */
  setTimeout(function () {
    if (saved) saved.hidden = true;
  }, 2000);
}

/** @returns {object} */
export function rcGetState() {
  return {
    students: _students.slice(),
    marks: Object.assign({}, _marks),
    periodId: _periodId,
    periods: _periods.slice(),
    view: _view,
    mode: _mode,
    multi: _multi,
    selected: Array.from(_selected),
    submitKey: _submitKey,
    pendingCount: _pendingCount,
    reasonCodes: (_reasonCodes || []).slice(),
    diaryDay: _diaryDay,
    diaryKind: _diaryKind,
    diaryBody: _diaryBody,
    diaryEditId: _diaryEditId,
    diaryEntries: _diaryEntries.slice(),
    diaryTargets: Array.from(_diaryTargets),
    diaryTargetMode: _diaryTargetMode,
    diaryOnline: _diaryOnline,
    sectionRef: _sectionRef(),
  };
}

/** Test helper */
export function rcSetState(partial) {
  if (partial.students) _students = partial.students;
  if (partial.marks) _marks = partial.marks;
  if (partial.periodId != null) _periodId = partial.periodId;
  if (partial.periods) _periods = partial.periods;
  if (partial.view) _view = partial.view;
  if (partial.mode) _mode = partial.mode;
  if (partial.submitKey !== undefined) _submitKey = partial.submitKey;
  if (partial.reasonCodes) _reasonCodes = partial.reasonCodes;
  if (partial.sectionMeta) _sectionMeta = partial.sectionMeta;
  if (partial.diaryDay) _diaryDay = partial.diaryDay;
  if (partial.diaryKind) _diaryKind = partial.diaryKind;
  if (partial.diaryBody !== undefined) _diaryBody = partial.diaryBody;
  if (partial.diaryEditId !== undefined) _diaryEditId = partial.diaryEditId;
  if (partial.diaryEntries) _diaryEntries = partial.diaryEntries;
  if (partial.diaryTargets) _diaryTargets = new Set(partial.diaryTargets);
  if (partial.diaryTargetMode !== undefined) _diaryTargetMode = partial.diaryTargetMode;
  if (partial.diaryOnline !== undefined) _diaryOnline = partial.diaryOnline;
  if (_container) {
    rcRenderStats();
    if (_mode === 'diary') rcRenderDiary();
    rcRender();
  }
}

export { backoffMs, handleRollCallLogout, newIdempotencyKey };

registerModule('school_roll_call', renderSchoolRollCallPage);

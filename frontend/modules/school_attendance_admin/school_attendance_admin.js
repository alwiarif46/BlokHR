/**
 * modules/school_attendance_admin/school_attendance_admin.js
 *
 * Office attendance admin: Registers | Unexplained | Settings | Eligibility | Nudge.
 * Pattern: render… → aaLoadData() → aaRenderStats() → aaRender() → CRUD / dialogs.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const TABS = ['registers', 'unexplained', 'settings', 'eligibility', 'nudge'];

const GRANULARITY_HELP = {
  day: 'One mark covers the whole school day (simplest office workflow).',
  session: 'Separate AM/PM marks — use when morning and afternoon differ.',
  period: 'Mark per timetable period — required for period-level roll call.',
};

const DERIVATION_HELP = {
  any_absent: 'A day counts absent if any period that day is absent.',
  majority: 'A day counts present only when a majority of marked periods are present/late.',
  half_day_minutes: 'Day status derives from minutes on campus vs the half-day threshold.',
};

let _container = null;
let _tab = 'registers';
let _date = '';
let _sectionClass = '';
let _section = '';
let _students = [];
let _register = {};
let _unexplained = [];
let _acked = new Set();
let _callNotes = {};
let _detailRow = null;
let _settings = null;
let _eligibility = [];
let _eligThreshold = 75;
let _eligFrom = '';
let _eligTo = '';
let _nudgeConfig = null;
let _nudgeReport = null;
let _regularizeTarget = null;
let _reasonCodes = [];

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _today() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'admin';
}

function _att() {
  return api.school('school-attendance');
}

function _id() {
  return api.school('school-identity');
}

function _eng() {
  return api.school('school-engagement');
}

/**
 * Client-side settings validation mirroring school-attendance rules.
 * @param {object} fields
 * @returns {string|null}
 */
export function validateSettingsFields(fields) {
  const g = fields.granularity;
  if (!['day', 'session', 'period'].includes(g)) {
    return 'granularity must be day, session, or period';
  }
  const edit = Number(fields.edit_window_minutes);
  if (!Number.isInteger(edit) || edit < 0 || edit > 1440) {
    return 'edit_window_minutes must be an integer between 0 and 1440';
  }
  const late = Number(fields.late_threshold_minutes);
  if (!Number.isInteger(late) || late < 5 || late > 120) {
    return 'late_threshold_minutes must be an integer between 5 and 120';
  }
  const half = Number(fields.half_day_min_minutes);
  if (!Number.isInteger(half) || half < 60 || half > 360) {
    return 'half_day_min_minutes must be an integer between 60 and 360';
  }
  if (!['any_absent', 'majority', 'half_day_minutes'].includes(fields.day_derivation)) {
    return 'day_derivation must be any_absent, majority, or half_day_minutes';
  }
  return null;
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolAttendanceAdminPage(container) {
  _container = container;
  _tab = 'registers';
  _date = _today();
  _acked = new Set();
  _callNotes = {};
  _detailRow = null;
  _regularizeTarget = null;

  const sessionYear = new Date().getFullYear();
  _eligFrom = sessionYear + '-04-01';
  _eligTo = sessionYear + 1 + '-03-31';
  _eligThreshold = 75;

  container.innerHTML =
    '<div class="aa-wrap" id="aaWrap">' +
    '<div class="aa-title">Attendance admin</div>' +
    '<div class="aa-tabs" id="aaTabs">' +
    TABS.map(function (t) {
      return (
        '<button type="button" class="aa-tab' +
        (t === _tab ? ' active' : '') +
        '" data-tab="' +
        t +
        '">' +
        _esc(t.replace(/_/g, ' ')) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div class="aa-stats" id="aaStats"></div>' +
    '<div id="aaContent"></div>' +
    '<div class="aa-modal" id="aaModal"><div class="aa-modal-box" id="aaModalBox"></div></div>' +
    '</div>';

  container.querySelector('#aaTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.aa-tab');
    if (!btn || !btn.dataset.tab) return;
    aaSwitchTab(btn.dataset.tab);
  });

  const modal = container.querySelector('#aaModal');
  modal.addEventListener('click', function (e) {
    if (e.target === modal) aaCloseModal();
  });

  aaLoadData();
}

/**
 * @param {string} tab
 */
export function aaSwitchTab(tab) {
  if (TABS.indexOf(tab) < 0) return;
  _tab = tab;
  _container.querySelectorAll('.aa-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  aaLoadData();
}

/**
 * Load active tab data.
 */
export async function aaLoadData() {
  if (_tab === 'registers') await _loadRegisters();
  else if (_tab === 'unexplained') await _loadUnexplained();
  else if (_tab === 'settings') await _loadSettings();
  else if (_tab === 'eligibility') await _loadEligibility();
  else if (_tab === 'nudge') await _loadNudge();
  else {
    const _exhaustive = _tab;
    void _exhaustive;
  }
  aaRenderStats();
  aaRender();
}

async function _loadRegisters() {
  const qs =
    '/students?status=active&limit=200&offset=0' +
    (_sectionClass ? '&class=' + encodeURIComponent(_sectionClass) : '') +
    (_section ? '&section=' + encodeURIComponent(_section) : '');
  const list = await _id().get(qs);
  _students = list && !list._error ? list.items || [] : [];
  if (list && list._error) toast(list.message || 'Could not load students', 'error');

  const ids = _students.map(function (s) {
    return s.id;
  });
  if (!ids.length) {
    _register = {};
    return;
  }
  const reg = await _att().get(
    '/register?date=' +
      encodeURIComponent(_date) +
      '&section=' +
      encodeURIComponent((_sectionClass || '') + (_section || '')) +
      '&student_ids=' +
      encodeURIComponent(ids.join(',')),
  );
  if (reg && !reg._error) {
    _register = reg.register || {};
  } else {
    _register = {};
    if (reg && reg._error) toast(reg.message || 'Could not load register', 'error');
  }

  const codes = await _att().get('/reason-codes');
  _reasonCodes = codes && !codes._error ? codes.reasonCodes || [] : [];
}

async function _loadUnexplained() {
  const res = await _att().get('/unexplained?date=' + encodeURIComponent(_date));
  if (res && !res._error) {
    _unexplained = res.unexplained || [];
  } else {
    _unexplained = [];
    if (res && res._error) toast(res.message || 'Could not load unexplained', 'error');
  }
}

async function _loadSettings() {
  const res = await _att().get('/settings');
  if (res && !res._error) {
    _settings = res.settings || res;
  } else {
    _settings = null;
    if (res && res._error) toast(res.message || 'Could not load settings', 'error');
  }
}

async function _loadEligibility() {
  const list = await _id().get('/students?status=active&limit=100&offset=0');
  const students = list && !list._error ? list.items || [] : [];
  if (list && list._error) toast(list.message || 'Could not load students', 'error');

  const rows = await Promise.all(
    students.map(async function (s) {
      const path =
        '/students/' +
        encodeURIComponent(s.id) +
        '/eligibility?session_from=' +
        encodeURIComponent(_eligFrom) +
        '&session_to=' +
        encodeURIComponent(_eligTo) +
        '&threshold=' +
        encodeURIComponent(String(_eligThreshold));
      const elig = await _att().get(path);
      if (!elig || elig._error) {
        return {
          studentId: s.id,
          name: (s.firstName || '') + ' ' + (s.lastName || ''),
          error: (elig && elig.message) || 'unavailable',
        };
      }
      return {
        studentId: s.id,
        name: (s.firstName || '') + ' ' + (s.lastName || ''),
        pct: elig.pct,
        threshold: elig.threshold,
        eligible: elig.eligible,
        projected: elig.projected_pct_if_no_more_absences,
      };
    }),
  );
  _eligibility = rows;
}

async function _loadNudge() {
  const [cfg, report] = await Promise.all([
    _att().get('/nudge/config'),
    _att().get('/nudge/report'),
  ]);
  _nudgeConfig = cfg && !cfg._error ? cfg : null;
  if (cfg && cfg._error) toast(cfg.message || 'Could not load nudge config', 'error');
  _nudgeReport = report && !report._error ? report : null;
  if (report && report._error) toast(report.message || 'Could not load nudge report', 'error');
}

/**
 * Stats bar for the active tab.
 */
export function aaRenderStats() {
  const el = _container && _container.querySelector('#aaStats');
  if (!el) return;

  if (_tab === 'registers') {
    let unmarked = 0;
    let present = 0;
    let absent = 0;
    _students.forEach(function (s) {
      const row = _register[s.id];
      const st = row && row.status ? row.status : 'unmarked';
      if (st === 'unmarked') unmarked++;
      else if (st === 'present' || st === 'late') present++;
      else if (st === 'absent') absent++;
    });
    el.innerHTML =
      '<div class="aa-pill">Students <strong>' +
      _students.length +
      '</strong></div>' +
      '<div class="aa-pill">Present/late <strong>' +
      present +
      '</strong></div>' +
      '<div class="aa-pill">Absent <strong>' +
      absent +
      '</strong></div>' +
      '<div class="aa-pill">Unmarked <strong>' +
      unmarked +
      '</strong></div>';
    return;
  }

  if (_tab === 'unexplained') {
    const open = _unexplained.filter(function (r) {
      return !_acked.has(r.id || r.studentId + ':' + r.date);
    }).length;
    el.innerHTML =
      '<div class="aa-pill">Unexplained <strong>' +
      _unexplained.length +
      '</strong></div>' +
      '<div class="aa-pill">Open <strong>' +
      open +
      '</strong></div>';
    return;
  }

  if (_tab === 'settings') {
    el.innerHTML =
      '<div class="aa-pill">Granularity <strong>' +
      _esc((_settings && _settings.granularity) || '—') +
      '</strong></div>' +
      '<div class="aa-pill">Edit window <strong>' +
      _esc(String((_settings && _settings.editWindowMinutes) || '—')) +
      'm</strong></div>';
    return;
  }

  if (_tab === 'eligibility') {
    const ok = _eligibility.filter(function (r) {
      return r.eligible === true;
    }).length;
    el.innerHTML =
      '<div class="aa-pill">Checked <strong>' +
      _eligibility.length +
      '</strong></div>' +
      '<div class="aa-pill">Eligible ≥' +
      _esc(String(_eligThreshold)) +
      '% <strong>' +
      ok +
      '</strong></div>';
    return;
  }

  if (_tab === 'nudge') {
    const t = (_nudgeReport && _nudgeReport.treatment) || {};
    const h = (_nudgeReport && _nudgeReport.holdout) || {};
    el.innerHTML =
      '<div class="aa-pill">Treatment n <strong>' +
      _esc(String(t.student_count != null ? t.student_count : 0)) +
      '</strong></div>' +
      '<div class="aa-pill">Holdout n <strong>' +
      _esc(String(h.student_count != null ? h.student_count : 0)) +
      '</strong></div>';
    return;
  }
}

/**
 * Render active tab body.
 */
export function aaRender() {
  const content = _container && _container.querySelector('#aaContent');
  if (!content) return;

  if (_tab === 'registers') _renderRegisters(content);
  else if (_tab === 'unexplained') _renderUnexplained(content);
  else if (_tab === 'settings') _renderSettings(content);
  else if (_tab === 'eligibility') _renderEligibility(content);
  else if (_tab === 'nudge') _renderNudge(content);
}

function _renderRegisters(content) {
  content.innerHTML =
    '<div class="aa-toolbar">' +
    '<input class="aa-input" type="date" id="aaRegDate" value="' +
    _esc(_date) +
    '">' +
    '<input class="aa-input" id="aaRegClass" placeholder="Class" value="' +
    _esc(_sectionClass) +
    '">' +
    '<input class="aa-input" id="aaRegSection" placeholder="Section" value="' +
    _esc(_section) +
    '">' +
    '<button type="button" class="aa-btn" id="aaRegLoad">Load</button>' +
    '</div>' +
    (_students.length
      ? '<table class="aa-table"><thead><tr><th>Student</th><th>Status</th><th></th></tr></thead><tbody>' +
        _students
          .map(function (s) {
            const row = _register[s.id];
            const st = row && row.status ? row.status : 'unmarked';
            const recId = row && row.id ? row.id : '';
            return (
              '<tr data-student-id="' +
              _esc(s.id) +
              '"><td>' +
              _esc((s.firstName || '') + ' ' + (s.lastName || '')) +
              '</td><td><span class="aa-badge ' +
              _esc(st) +
              '">' +
              _esc(st) +
              '</span></td><td>' +
              (recId
                ? '<button type="button" class="aa-btn ghost" data-aa-edit="' +
                  _esc(recId) +
                  '" data-aa-status="' +
                  _esc(st) +
                  '">Edit</button>'
                : '—') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '<div class="aa-empty">No students for this class/section.</div>');

  content.querySelector('#aaRegLoad').addEventListener('click', function () {
    _date = content.querySelector('#aaRegDate').value || _today();
    _sectionClass = (content.querySelector('#aaRegClass').value || '').trim();
    _section = (content.querySelector('#aaRegSection').value || '').trim();
    aaLoadData();
  });

  content.querySelectorAll('[data-aa-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      aaOpenEditRecord(btn.getAttribute('data-aa-edit'), btn.getAttribute('data-aa-status'));
    });
  });
}

/**
 * Edit register row; on window_closed 409 open regularize dialog.
 * @param {string} recordId
 * @param {string} currentStatus
 */
export function aaOpenEditRecord(recordId, currentStatus) {
  _openModal(
    '<div class="aa-modal-title">Edit attendance</div>' +
      '<div class="aa-field"><label>Status</label><select id="aaEditStatus">' +
      ['present', 'absent', 'late', 'left_early']
        .map(function (s) {
          return (
            '<option value="' +
            s +
            '"' +
            (s === currentStatus ? ' selected' : '') +
            '>' +
            s +
            '</option>'
          );
        })
        .join('') +
      '</select></div>' +
      '<div class="aa-form-actions">' +
      '<button type="button" class="aa-btn ghost" id="aaEditCancel">Cancel</button>' +
      '<button type="button" class="aa-btn" id="aaEditSave">Save</button>' +
      '</div>',
  );
  const box = _container.querySelector('#aaModalBox');
  box.querySelector('#aaEditCancel').addEventListener('click', aaCloseModal);
  box.querySelector('#aaEditSave').addEventListener('click', async function () {
    const status = box.querySelector('#aaEditStatus').value;
    const res = await _att().patch('/records/' + encodeURIComponent(recordId), {
      status: status,
      actor: _actor(),
    });
    if (res && !res._error) {
      toast('Record updated', 'success');
      aaCloseModal();
      aaLoadData();
      return;
    }
    if (res && res.status === 409) {
      const msg = res.message || 'window_closed';
      toast(msg, 'error');
      _regularizeTarget = { recordId: recordId, status: status };
      aaOpenRegularizeDialog(recordId, status, msg);
      return;
    }
    toast((res && res.message) || 'Update failed', 'error');
  });
}

/**
 * Regularize dialog after edit window closed (409).
 * @param {string} recordId
 * @param {string} newStatus
 * @param {string} windowMsg
 */
export function aaOpenRegularizeDialog(recordId, newStatus, windowMsg) {
  const reasonOpts = _reasonCodes
    .map(function (r) {
      return '<option value="' + _esc(r.id) + '">' + _esc(r.label || r.code) + '</option>';
    })
    .join('');
  _openModal(
    '<div class="aa-modal-title">Regularize</div>' +
      '<p class="aa-help" id="aaRegHelp">Edit window closed' +
      (windowMsg ? ' (' + _esc(windowMsg) + ')' : '') +
      '. Use regularization to apply the change with approval.</p>' +
      '<div class="aa-field"><label>New status</label><input id="aaRegStatus" value="' +
      _esc(newStatus || 'present') +
      '"></div>' +
      '<div class="aa-field"><label>Excuse</label><select id="aaRegExcuse">' +
      ['excused', 'unexcused', 'exempt', 'unknown']
        .map(function (e) {
          return '<option value="' + e + '">' + e + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="aa-field"><label>Reason code</label><select id="aaRegReason">' +
      reasonOpts +
      '</select></div>' +
      '<div class="aa-field"><label>Note</label><textarea id="aaRegNote"></textarea></div>' +
      '<div class="aa-form-actions">' +
      '<button type="button" class="aa-btn ghost" id="aaRegCancel">Cancel</button>' +
      '<button type="button" class="aa-btn" id="aaRegSave">Regularize</button>' +
      '</div>',
  );
  const box = _container.querySelector('#aaModalBox');
  box.querySelector('#aaRegCancel').addEventListener('click', aaCloseModal);
  box.querySelector('#aaRegSave').addEventListener('click', async function () {
    const body = {
      new_status: box.querySelector('#aaRegStatus').value,
      new_excuse: box.querySelector('#aaRegExcuse').value,
      reason_code_id: box.querySelector('#aaRegReason').value,
      approved_by: _actor(),
      note: (box.querySelector('#aaRegNote').value || '').trim() || undefined,
    };
    if (!body.reason_code_id) {
      toast('Reason code is required', 'error');
      return;
    }
    const res = await _att().post(
      '/records/' + encodeURIComponent(recordId) + '/regularize',
      body,
    );
    if (res && !res._error) {
      toast('Regularized', 'success');
      aaCloseModal();
      aaLoadData();
      return;
    }
    toast((res && res.message) || 'Regularize failed', 'error');
  });
}

function _renderUnexplained(content) {
  content.innerHTML =
    '<div class="aa-toolbar">' +
    '<input class="aa-input" type="date" id="aaUnDate" value="' +
    _esc(_date) +
    '">' +
    '<button type="button" class="aa-btn" id="aaUnLoad">Load</button>' +
    '</div>' +
    '<div id="aaUnDetail"></div>' +
    (_unexplained.length
      ? '<table class="aa-table"><thead><tr><th>Student</th><th>Status</th><th>Call log</th><th></th></tr></thead><tbody>' +
        _unexplained
          .map(function (r) {
            const key = r.id || r.studentId + ':' + r.date;
            const acked = _acked.has(key);
            return (
              '<tr class="' +
              (acked ? 'aa-acked' : '') +
              '" data-un-key="' +
              _esc(key) +
              '"><td>' +
              _esc(r.studentId) +
              '</td><td><span class="aa-badge absent">' +
              _esc(r.status || 'absent') +
              '</span></td><td>' +
              _esc(_callNotes[key] || '—') +
              '</td><td>' +
              '<button type="button" class="aa-btn ghost" data-aa-detail="' +
              _esc(key) +
              '">Details</button>' +
              (acked
                ? ''
                : ' <button type="button" class="aa-btn ghost" data-aa-ack="' +
                  _esc(key) +
                  '">Ack</button>') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '<div class="aa-empty">No unexplained absences for this date.</div>');

  content.querySelector('#aaUnLoad').addEventListener('click', function () {
    _date = content.querySelector('#aaUnDate').value || _today();
    aaLoadData();
  });

  content.querySelectorAll('[data-aa-ack]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      aaOpenCallLog(btn.getAttribute('data-aa-ack'));
    });
  });
  content.querySelectorAll('[data-aa-detail]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      aaShowUnexplainedDetail(btn.getAttribute('data-aa-detail'));
    });
  });

  if (_detailRow) aaShowUnexplainedDetail(_detailRow);
}

/**
 * Call-log note + ack for an unexplained row.
 * @param {string} key
 */
export function aaOpenCallLog(key) {
  const row = _unexplained.find(function (r) {
    return (r.id || r.studentId + ':' + r.date) === key;
  });
  _openModal(
    '<div class="aa-modal-title">Ack + call log</div>' +
      '<p class="aa-help">Note is saved to an engagement thread for office follow-up.</p>' +
      '<div class="aa-field"><label>Call-log note</label><textarea id="aaCallNote">' +
      _esc(_callNotes[key] || '') +
      '</textarea></div>' +
      '<div class="aa-form-actions">' +
      '<button type="button" class="aa-btn ghost" id="aaCallCancel">Cancel</button>' +
      '<button type="button" class="aa-btn" id="aaCallSave">Ack</button>' +
      '</div>',
  );
  const box = _container.querySelector('#aaModalBox');
  box.querySelector('#aaCallCancel').addEventListener('click', aaCloseModal);
  box.querySelector('#aaCallSave').addEventListener('click', async function () {
    const note = (box.querySelector('#aaCallNote').value || '').trim();
    if (!note) {
      toast('Call-log note is required', 'error');
      return;
    }
    _callNotes[key] = note;
    _acked.add(key);
    const thread = await _eng().post('/threads', {
      subject: 'Call log: unexplained absence',
      student_ref: row ? row.studentId : key,
      body: note,
      author: _actor(),
    });
    if (thread && thread._error) {
      toast(thread.message || 'Thread save failed — ack kept locally', 'error');
    } else {
      toast('Acknowledged', 'success');
    }
    aaCloseModal();
    aaRenderStats();
    aaRender();
  });
}

/**
 * Reported-absence style detail incl. certificate ref when available.
 * @param {string} key
 */
export function aaShowUnexplainedDetail(key) {
  _detailRow = key;
  const row = _unexplained.find(function (r) {
    return (r.id || r.studentId + ':' + r.date) === key;
  });
  const host = _container.querySelector('#aaUnDetail');
  if (!host || !row) return;
  const cert =
    row.attachmentRef ||
    row.attachment_ref ||
    row.certificateRef ||
    row.certificate_ref ||
    null;
  host.innerHTML =
    '<div class="aa-panel" id="aaReportedDetail">' +
    '<h4>Absence detail</h4>' +
    '<div>Student: <strong>' +
    _esc(row.studentId) +
    '</strong></div>' +
    '<div>Date: ' +
    _esc(row.date) +
    '</div>' +
    '<div>Record: ' +
    _esc(row.id || '—') +
    '</div>' +
    '<div>Explained: ' +
    _esc(String(row.explained === false ? 'false' : row.explained)) +
    '</div>' +
    '<div>Certificate ref: <span id="aaCertRef">' +
    _esc(cert || '—') +
    '</span></div>' +
    '<div class="aa-help">Unexplained items have no covering parent report yet. Certificate ref appears when a reported absence attachment exists.</div>' +
    '</div>';
}

function _renderSettings(content) {
  const s = _settings || {
    granularity: 'day',
    editWindowMinutes: 120,
    lateThresholdMinutes: 15,
    halfDayMinMinutes: 180,
    dayDerivation: 'majority',
  };
  content.innerHTML =
    '<form id="aaSettingsForm">' +
    '<div class="aa-field"><label>Granularity</label><select id="aaGranularity">' +
    ['day', 'session', 'period']
      .map(function (g) {
        return (
          '<option value="' +
          g +
          '"' +
          (s.granularity === g ? ' selected' : '') +
          '>' +
          g +
          '</option>'
        );
      })
      .join('') +
    '</select><div class="aa-help" id="aaGranHelp">' +
    _esc(GRANULARITY_HELP[s.granularity] || '') +
    '</div></div>' +
    '<div class="aa-field"><label>Day derivation</label><select id="aaDerivation">' +
    ['any_absent', 'majority', 'half_day_minutes']
      .map(function (d) {
        return (
          '<option value="' +
          d +
          '"' +
          (s.dayDerivation === d ? ' selected' : '') +
          '>' +
          d +
          '</option>'
        );
      })
      .join('') +
    '</select><div class="aa-help" id="aaDerHelp">' +
    _esc(DERIVATION_HELP[s.dayDerivation] || '') +
    '</div></div>' +
    '<div class="aa-field"><label>Edit window (minutes)</label><input type="number" id="aaEditWindow" value="' +
    _esc(String(s.editWindowMinutes)) +
    '"></div>' +
    '<div class="aa-field"><label>Late threshold (minutes)</label><input type="number" id="aaLateThr" value="' +
    _esc(String(s.lateThresholdMinutes)) +
    '"><div class="aa-help">Minutes after which a late arrival is still recorded as late (status does not flip).</div></div>' +
    '<div class="aa-field"><label>Half-day minimum (minutes)</label><input type="number" id="aaHalfDay" value="' +
    _esc(String(s.halfDayMinMinutes)) +
    '"></div>' +
    '<button type="button" class="aa-btn" id="aaSettingsSave">Save settings</button>' +
    '</form>';

  const gran = content.querySelector('#aaGranularity');
  const der = content.querySelector('#aaDerivation');
  gran.addEventListener('change', function () {
    content.querySelector('#aaGranHelp').textContent = GRANULARITY_HELP[gran.value] || '';
  });
  der.addEventListener('change', function () {
    content.querySelector('#aaDerHelp').textContent = DERIVATION_HELP[der.value] || '';
  });
  content.querySelector('#aaSettingsSave').addEventListener('click', aaSaveSettings);
}

/**
 * Validate + PUT settings.
 */
export async function aaSaveSettings() {
  const content = _container.querySelector('#aaContent');
  const fields = {
    granularity: content.querySelector('#aaGranularity').value,
    day_derivation: content.querySelector('#aaDerivation').value,
    edit_window_minutes: Number(content.querySelector('#aaEditWindow').value),
    late_threshold_minutes: Number(content.querySelector('#aaLateThr').value),
    half_day_min_minutes: Number(content.querySelector('#aaHalfDay').value),
  };
  const err = validateSettingsFields(fields);
  if (err) {
    toast(err, 'error');
    return false;
  }
  const res = await _att().put('/settings', fields);
  if (res && !res._error) {
    _settings = res.settings || res;
    toast('Settings saved', 'success');
    aaRenderStats();
    return true;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return false;
}

function _renderEligibility(content) {
  content.innerHTML =
    '<div class="aa-toolbar">' +
    '<input class="aa-input" type="date" id="aaElFrom" value="' +
    _esc(_eligFrom) +
    '">' +
    '<input class="aa-input" type="date" id="aaElTo" value="' +
    _esc(_eligTo) +
    '">' +
    '<input class="aa-input" type="number" id="aaElThr" min="0" max="100" value="' +
    _esc(String(_eligThreshold)) +
    '" title="Threshold %">' +
    '<button type="button" class="aa-btn" id="aaElLoad">Run report</button>' +
    '</div>' +
    (_eligibility.length
      ? '<table class="aa-table" id="aaElTable"><thead><tr><th>Student</th><th>Pct</th><th>Projected</th><th>Eligible</th></tr></thead><tbody>' +
        _eligibility
          .map(function (r) {
            if (r.error) {
              return (
                '<tr><td>' +
                _esc(r.name) +
                '</td><td colspan="3">' +
                _esc(r.error) +
                '</td></tr>'
              );
            }
            return (
              '<tr data-student-id="' +
              _esc(r.studentId) +
              '"><td>' +
              _esc(r.name) +
              '</td><td>' +
              _esc(String(r.pct)) +
              '%</td><td>' +
              _esc(String(r.projected)) +
              '%</td><td><span class="aa-badge ' +
              (r.eligible ? 'eligible' : 'ineligible') +
              '">' +
              (r.eligible ? 'yes' : 'no') +
              '</span></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '<div class="aa-empty">Run the eligibility report.</div>');

  content.querySelector('#aaElLoad').addEventListener('click', function () {
    _eligFrom = content.querySelector('#aaElFrom').value;
    _eligTo = content.querySelector('#aaElTo').value;
    _eligThreshold = Number(content.querySelector('#aaElThr').value);
    aaLoadData();
  });
}

function _renderNudge(content) {
  const c = _nudgeConfig || {
    enabled: false,
    atRiskPct: 10,
    chronicDays: 18,
    holdoutPct: 10,
    maxMessagesPerTerm: 6,
  };
  const t = (_nudgeReport && _nudgeReport.treatment) || {
    mean_absence_pct: 0,
    message_count: 0,
    student_count: 0,
  };
  const h = (_nudgeReport && _nudgeReport.holdout) || {
    mean_absence_pct: 0,
    message_count: 0,
    student_count: 0,
  };

  content.innerHTML =
    '<div class="aa-field"><label><input type="checkbox" id="aaNudgeEnabled"' +
    (c.enabled ? ' checked' : '') +
    '> Enabled</label></div>' +
    '<div class="aa-field"><label>At-risk % band</label><input type="number" id="aaAtRisk" value="' +
    _esc(String(c.atRiskPct)) +
    '"></div>' +
    '<div class="aa-field"><label>Chronic days</label><input type="number" id="aaChronic" value="' +
    _esc(String(c.chronicDays)) +
    '"></div>' +
    '<div class="aa-field"><label>Holdout %</label><input type="number" id="aaHoldout" value="' +
    _esc(String(c.holdoutPct)) +
    '"></div>' +
    '<div class="aa-field"><label>Max messages / term</label><input type="number" id="aaMaxMsg" value="' +
    _esc(String(c.maxMessagesPerTerm)) +
    '"></div>' +
    '<div class="aa-form-actions" style="justify-content:flex-start">' +
    '<button type="button" class="aa-btn" id="aaNudgeSave">Save config</button>' +
    '<button type="button" class="aa-btn ghost" id="aaNudgeRun">Run nudge</button>' +
    '</div>' +
    '<div class="aa-report-grid" id="aaNudgeReport">' +
    '<div class="aa-report-card"><h4>Treatment</h4>' +
    '<div class="aa-metric" id="aaTreatMean">' +
    _esc(Number(t.mean_absence_pct).toFixed(1)) +
    '%</div><div class="aa-metric-label">mean absence %</div>' +
    '<div>Messages: <strong id="aaTreatMsg">' +
    _esc(String(t.message_count)) +
    '</strong></div>' +
    '<div>Students: <strong id="aaTreatN">' +
    _esc(String(t.student_count)) +
    '</strong></div></div>' +
    '<div class="aa-report-card"><h4>Holdout</h4>' +
    '<div class="aa-metric" id="aaHoldMean">' +
    _esc(Number(h.mean_absence_pct).toFixed(1)) +
    '%</div><div class="aa-metric-label">mean absence %</div>' +
    '<div>Messages: <strong id="aaHoldMsg">' +
    _esc(String(h.message_count)) +
    '</strong></div>' +
    '<div>Students: <strong id="aaHoldN">' +
    _esc(String(h.student_count)) +
    '</strong></div></div>' +
    '</div>';

  content.querySelector('#aaNudgeSave').addEventListener('click', aaSaveNudgeConfig);
  content.querySelector('#aaNudgeRun').addEventListener('click', aaRunNudge);
}

export async function aaSaveNudgeConfig() {
  const content = _container.querySelector('#aaContent');
  const body = {
    enabled: content.querySelector('#aaNudgeEnabled').checked,
    at_risk_pct: Number(content.querySelector('#aaAtRisk').value),
    chronic_days: Number(content.querySelector('#aaChronic').value),
    holdout_pct: Number(content.querySelector('#aaHoldout').value),
    max_messages_per_term: Number(content.querySelector('#aaMaxMsg').value),
  };
  const res = await _att().put('/nudge/config', body);
  if (res && !res._error) {
    _nudgeConfig = res.config || res;
    toast('Nudge config saved', 'success');
    return true;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return false;
}

export async function aaRunNudge() {
  const classMap = {};
  _eligibility.forEach(function (r) {
    if (r.studentId) classMap[r.studentId] = 'default';
  });
  if (!Object.keys(classMap).length) {
    const list = await _id().get('/students?status=active&limit=100&offset=0');
    const items = list && !list._error ? list.items || [] : [];
    items.forEach(function (s) {
      classMap[s.id] = (s.classLabel || 'default') + (s.section || '');
    });
  }
  const res = await _att().post('/nudge/run', {
    as_of: _today(),
    class_map: classMap,
  });
  if (res && !res._error) {
    toast(
      'Nudge run: sent ' + (res.sent || 0) + ', skipped ' + (res.skipped || 0),
      'success',
    );
    const report = await _att().get('/nudge/report');
    if (report && !report._error) _nudgeReport = report;
    aaRenderStats();
    aaRender();
    return res;
  }
  toast((res && res.message) || 'Nudge run failed', 'error');
  return null;
}

function _openModal(html) {
  const box = _container.querySelector('#aaModalBox');
  const modal = _container.querySelector('#aaModal');
  box.innerHTML = html;
  modal.classList.add('open');
}

export function aaCloseModal() {
  const modal = _container && _container.querySelector('#aaModal');
  if (modal) modal.classList.remove('open');
}

/** @returns {object} */
export function aaGetState() {
  return {
    tab: _tab,
    date: _date,
    students: _students.slice(),
    register: Object.assign({}, _register),
    unexplained: _unexplained.slice(),
    acked: Array.from(_acked),
    settings: _settings,
    eligibility: _eligibility.slice(),
    nudgeReport: _nudgeReport,
    regularizeTarget: _regularizeTarget,
  };
}

/** @param {object} partial */
export function aaSetState(partial) {
  if (partial.tab) _tab = partial.tab;
  if (partial.date) _date = partial.date;
  if (partial.students) _students = partial.students;
  if (partial.register) _register = partial.register;
  if (partial.unexplained) _unexplained = partial.unexplained;
  if (partial.settings) _settings = partial.settings;
  if (partial.eligibility) _eligibility = partial.eligibility;
  if (partial.nudgeReport) _nudgeReport = partial.nudgeReport;
  if (partial.nudgeConfig) _nudgeConfig = partial.nudgeConfig;
  if (partial.reasonCodes) _reasonCodes = partial.reasonCodes;
  if (partial.eligThreshold != null) _eligThreshold = partial.eligThreshold;
  if (_container) {
    _container.querySelectorAll('.aa-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === _tab);
    });
    aaRenderStats();
    aaRender();
  }
}

registerModule('school_attendance_admin', renderSchoolAttendanceAdminPage);

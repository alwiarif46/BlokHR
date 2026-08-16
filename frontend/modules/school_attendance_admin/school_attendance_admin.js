/**
 * modules/school_attendance_admin/school_attendance_admin.js
 *
 * Office attendance ops: Registers | Unexplained.
 * Attendance policy (thresholds/granularity), Eligibility, and Nudge live in
 * school_settings — use the toolbar pointers (sessionStorage scs_open_tab).
 *
 * Pattern: render… → aaLoadData() → aaRenderStats() → aaRender() → CRUD / dialogs.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { navigateToModule, registerModule } from '../../shared/router.js';
import { canSchoolAdminOps } from '../../shared/school-roles.js';

const TABS = ['registers', 'unexplained'];

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

/** L6 cosmetic — enforced server-side by P12-04/05 */
function _canRegularizeAndSettings() {
  const s = getSession() || {};
  return canSchoolAdminOps(s.schoolRole, !!(s.is_admin || s.role === 'admin'));
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
 * Open School Settings on a policy tab (one-shot sessionStorage handoff).
 * @param {'attendance_policy'|'eligibility'|'nudge'} tab
 */
function _openSchoolSettingsTab(tab) {
  try {
    sessionStorage.setItem('scs_open_tab', tab);
  } catch (_) {
    /* ignore quota / private mode */
  }
  navigateToModule('school_settings');
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
}

/**
 * Render active tab body.
 */
export function aaRender() {
  const content = _container && _container.querySelector('#aaContent');
  if (!content) return;

  if (_tab === 'registers') _renderRegisters(content);
  else if (_tab === 'unexplained') _renderUnexplained(content);
}

function _policyToolbar() {
  /* L6 cosmetic — enforced server-side by P12-04; Settings/Nudge are school_admin+ */
  if (!_canRegularizeAndSettings()) return '';
  return (
    '<div class="aa-toolbar aa-policy-links">' +
    '<button type="button" class="aa-btn ghost" id="aaPolicyLink" title="Open School Settings → Attendance Policy">Attendance policy…</button>' +
    '<button type="button" class="aa-btn ghost" id="aaEligLink" title="Open School Settings → Eligibility">Eligibility…</button>' +
    '<button type="button" class="aa-btn ghost" id="aaNudgeLink" title="Open School Settings → Nudge">Nudge…</button>' +
    '</div>'
  );
}

function _bindPolicyLinks(content) {
  const policy = content.querySelector('#aaPolicyLink');
  const elig = content.querySelector('#aaEligLink');
  const nudge = content.querySelector('#aaNudgeLink');
  if (policy) {
    policy.addEventListener('click', function () {
      _openSchoolSettingsTab('attendance_policy');
    });
  }
  if (elig) {
    elig.addEventListener('click', function () {
      _openSchoolSettingsTab('eligibility');
    });
  }
  if (nudge) {
    nudge.addEventListener('click', function () {
      _openSchoolSettingsTab('nudge');
    });
  }
}

function _renderRegisters(content) {
  content.innerHTML =
    _policyToolbar() +
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

  _bindPolicyLinks(content);

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
      /* L6 cosmetic — enforced server-side by P12-04 */
      if (!_canRegularizeAndSettings()) {
        toast("You don't have access to do this", 'error');
        return;
      }
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
  /* L6 cosmetic — enforced server-side by P12-04 */
  if (!_canRegularizeAndSettings()) {
    toast("You don't have access to do this", 'error');
    return;
  }
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
    _policyToolbar() +
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

  _bindPolicyLinks(content);

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
  if (partial.reasonCodes) _reasonCodes = partial.reasonCodes;
  if (_container) {
    _container.querySelectorAll('.aa-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === _tab);
    });
    aaRenderStats();
    aaRender();
  }
}

registerModule('school_attendance_admin', renderSchoolAttendanceAdminPage);

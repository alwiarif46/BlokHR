/**
 * modules/timesheets/timesheets.js
 *
 * Timesheets — weekly grid derived from attendance, leave, overtime and
 * logged time. Hours are generated, not typed: an admin may override a single
 * day, and that override is always shown with its reason.
 *
 * Pattern: renderTimesheetsPage() → tsLoadData() → tsRenderStats() → tsRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

/* ── Module state ── */
let _container = null;
let _tab = 'team';
let _weekOffset = 0;
let _team = [];
let _mine = [];
let _pending = [];
let _loadError = null;
let _featureOff = false;
let _busy = false;

/* ══════════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════════ */

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _session() {
  return getSession() || {};
}

function _myEmail() {
  return (_session().email || '').toLowerCase();
}

function _isAdmin() {
  const s = _session();
  return !!(s.is_admin || s.role === 'admin');
}

/** Local YYYY-MM-DD, avoiding the UTC shift that toISOString() introduces. */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * Seven Date objects, Mon–Sun, for the week at the given offset.
 * @param {number} offset — 0 = current week, -1 = last week.
 */
export function getWeekDates(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay() is 0 for Sunday, so shift by (day + 6) % 7 to land on Monday
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    days.push(dd);
  }
  return days;
}

/** Format a week label like "Mar 24 — Mar 30, 2026". */
export function fmtWeekLabel(days) {
  const opts = { month: 'short', day: 'numeric' };
  return (
    days[0].toLocaleDateString('en-US', opts) +
    ' \u2014 ' +
    days[6].toLocaleDateString('en-US', opts) +
    ', ' +
    days[6].getFullYear()
  );
}

/** The Monday key the API expects for the current offset. */
export function weekStartKey(offset) {
  return dateKey(getWeekDates(offset)[0]);
}

function _hours(minutes) {
  return (Number(minutes) || 0) / 60;
}

function _fmtHours(h) {
  return (Number(h) || 0).toFixed(1);
}

function _statusBadge(status) {
  const label = STATUS_LABELS[status] || status || '—';
  return '<span class="ts-status ' + _esc(status) + '">' + _esc(label) + '</span>';
}

/* ══════════════════════════════════════════════════════════════
   NORMALIZATION
   ══════════════════════════════════════════════════════════════ */

export function _normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const workedMinutes = Number(raw.worked_minutes != null ? raw.worked_minutes : raw.workedMinutes) || 0;
  const rawAdjusted = raw.adjusted_minutes != null ? raw.adjusted_minutes : raw.adjustedMinutes;
  const isAdjusted = rawAdjusted !== null && rawAdjusted !== undefined;
  const adjustedMinutes = isAdjusted ? Number(rawAdjusted) || 0 : null;
  return {
    date: raw.date || '',
    dayType: raw.day_type || raw.dayType || 'workday',
    attendanceStatus: raw.attendance_status || raw.attendanceStatus || '',
    workedMinutes,
    breakMinutes: Number(raw.break_minutes != null ? raw.break_minutes : raw.breakMinutes) || 0,
    isLate: !!(raw.is_late || raw.isLate),
    lateMinutes: Number(raw.late_minutes != null ? raw.late_minutes : raw.lateMinutes) || 0,
    otMinutes: Number(raw.ot_minutes != null ? raw.ot_minutes : raw.otMinutes) || 0,
    otPay: Number(raw.ot_pay != null ? raw.ot_pay : raw.otPay) || 0,
    leaveType: raw.leave_type || raw.leaveType || '',
    leaveDays: Number(raw.leave_days != null ? raw.leave_days : raw.leaveDays) || 0,
    billableHours: Number(raw.billable_hours != null ? raw.billable_hours : raw.billableHours) || 0,
    nonBillableHours:
      Number(raw.non_billable_hours != null ? raw.non_billable_hours : raw.nonBillableHours) || 0,
    adjustedMinutes,
    adjustmentReason: raw.adjustment_reason || raw.adjustmentReason || '',
    adjustedBy: raw.adjusted_by || raw.adjustedBy || '',
    adjustedAt: raw.adjusted_at || raw.adjustedAt || null,
    isAdjusted,
    effectiveMinutes: isAdjusted ? adjustedMinutes : workedMinutes,
  };
}

export function _normalizeTimesheet(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const entries = Array.isArray(raw.entries) ? raw.entries.map(_normalizeEntry) : [];
  return {
    id: raw.id,
    email: raw.email || '',
    name: raw.name || raw.email || '',
    periodType: raw.period_type || raw.periodType || 'weekly',
    startDate: raw.start_date || raw.startDate || '',
    endDate: raw.end_date || raw.endDate || '',
    totalWorkedMinutes:
      Number(raw.total_worked_minutes != null ? raw.total_worked_minutes : raw.totalWorkedMinutes) ||
      0,
    totalBreakMinutes:
      Number(raw.total_break_minutes != null ? raw.total_break_minutes : raw.totalBreakMinutes) || 0,
    totalPresentDays:
      Number(raw.total_present_days != null ? raw.total_present_days : raw.totalPresentDays) || 0,
    totalAbsentDays:
      Number(raw.total_absent_days != null ? raw.total_absent_days : raw.totalAbsentDays) || 0,
    totalLeaveDays:
      Number(raw.total_leave_days != null ? raw.total_leave_days : raw.totalLeaveDays) || 0,
    totalHolidayDays:
      Number(raw.total_holiday_days != null ? raw.total_holiday_days : raw.totalHolidayDays) || 0,
    totalLateDays:
      Number(raw.total_late_days != null ? raw.total_late_days : raw.totalLateDays) || 0,
    totalOtMinutes:
      Number(raw.total_ot_minutes != null ? raw.total_ot_minutes : raw.totalOtMinutes) || 0,
    totalOtPay: Number(raw.total_ot_pay != null ? raw.total_ot_pay : raw.totalOtPay) || 0,
    totalBillableHours:
      Number(raw.total_billable_hours != null ? raw.total_billable_hours : raw.totalBillableHours) ||
      0,
    totalNonBillableHours:
      Number(
        raw.total_non_billable_hours != null
          ? raw.total_non_billable_hours
          : raw.totalNonBillableHours,
      ) || 0,
    status: raw.status || 'draft',
    submittedAt: raw.submitted_at || raw.submittedAt || null,
    approvedBy: raw.approved_by || raw.approvedBy || '',
    approvedAt: raw.approved_at || raw.approvedAt || null,
    rejectedBy: raw.rejected_by || raw.rejectedBy || '',
    rejectedAt: raw.rejected_at || raw.rejectedAt || null,
    rejectionReason: raw.rejection_reason || raw.rejectionReason || '',
    entries,
  };
}

export function _normalizeAdjustment(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    date: raw.date || '',
    action: raw.action || '',
    previousMinutes:
      Number(raw.previous_minutes != null ? raw.previous_minutes : raw.previousMinutes) || 0,
    newMinutes: Number(raw.new_minutes != null ? raw.new_minutes : raw.newMinutes) || 0,
    reason: raw.reason || '',
    actorEmail: raw.actor_email || raw.actorEmail || '',
    actedAt: raw.acted_at || raw.actedAt || '',
  };
}

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

export function renderTimesheetsPage(container) {
  _container = container;
  _tab = 'team';
  _weekOffset = 0;

  container.innerHTML =
    '<div class="ts-wrap" id="tsWrap">' +
      '<div class="ts-toolbar">' +
        '<div class="ts-week-nav">' +
          '<button type="button" id="tsPrev" title="Previous week">&#9664;</button>' +
          '<div class="ts-week-label" id="tsWeekLabel"></div>' +
          '<button type="button" id="tsNext" title="Next week">&#9654;</button>' +
        '</div>' +
        '<div class="ts-spacer"></div>' +
        '<button type="button" class="ts-btn ghost" id="tsToday">Today</button>' +
        '<button type="button" class="ts-btn" id="tsGenerate">Generate</button>' +
      '</div>' +
      '<div class="ts-tabs" id="tsTabs">' +
        '<button type="button" class="ts-tab active" data-tab="team">Team Week</button>' +
        '<button type="button" class="ts-tab" data-tab="mine">My Timesheet</button>' +
        '<button type="button" class="ts-tab" data-tab="approvals">Approvals</button>' +
      '</div>' +
      '<div class="ts-stats" id="tsStats"></div>' +
      '<div id="tsContent"></div>' +
      '<div class="ts-modal" id="tsModal"><div class="ts-modal-box" id="tsModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  tsLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function tsLoadData() {
  _loadError = null;
  _featureOff = false;

  const startDate = weekStartKey(_weekOffset);
  const labelEl = _container && _container.querySelector('#tsWeekLabel');
  if (labelEl) labelEl.textContent = fmtWeekLabel(getWeekDates(_weekOffset));

  const [teamRes, mineRes, pendingRes] = await Promise.all([
    api.get('/api/timesheets/week?startDate=' + startDate),
    api.get('/api/timesheets/week?startDate=' + startDate + '&scope=mine'),
    api.get('/api/timesheets/pending-approvals'),
  ]);

  if (teamRes && teamRes._error) {
    _team = [];
    _loadError = teamRes.message || 'Could not load timesheets';
    if (teamRes.status === 404) {
      _featureOff = true;
      _loadError = 'Timesheets is disabled for this workspace';
    }
  } else {
    const rows = (teamRes && teamRes.timesheets) || [];
    _team = (Array.isArray(rows) ? rows : []).map(_normalizeTimesheet);
  }

  if (mineRes && !mineRes._error) {
    const rows = mineRes.timesheets || [];
    _mine = (Array.isArray(rows) ? rows : []).map(_normalizeTimesheet);
  } else {
    // Fall back to the team payload so the tab still works without identity
    const me = _myEmail();
    _mine = me ? _team.filter((t) => (t.email || '').toLowerCase() === me) : [];
  }

  if (pendingRes && !pendingRes._error) {
    const rows = pendingRes.timesheets || [];
    _pending = (Array.isArray(rows) ? rows : []).map(_normalizeTimesheet);
  } else {
    _pending = [];
  }

  tsRenderStats();
  tsRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export function tsRenderStats() {
  const el = _container && _container.querySelector('#tsStats');
  if (!el) return;

  const rows = _tab === 'mine' ? _mine : _team;
  const totalHrs = rows.reduce((s, t) => s + _hours(t.totalWorkedMinutes), 0);
  const avgHrs = rows.length ? totalHrs / rows.length : 0;
  const submitted = rows.filter((t) => t.status === 'submitted').length;
  const approved = rows.filter((t) => t.status === 'approved').length;
  const draft = rows.filter((t) => t.status === 'draft').length;

  el.innerHTML =
    '<div class="ts-stat"><div class="ts-stat-num">' +
    _fmtHours(totalHrs) +
    'h</div><div class="ts-stat-label">Total Hours</div></div>' +
    '<div class="ts-stat"><div class="ts-stat-num">' +
    _fmtHours(avgHrs) +
    'h</div><div class="ts-stat-label">Avg Per Person</div></div>' +
    '<div class="ts-stat"><div class="ts-stat-num" style="color:var(--status-in)">' +
    submitted +
    '</div><div class="ts-stat-label">Submitted</div></div>' +
    '<div class="ts-stat"><div class="ts-stat-num" style="color:var(--status-in)">' +
    approved +
    '</div><div class="ts-stat-label">Approved</div></div>' +
    '<div class="ts-stat"><div class="ts-stat-num" style="color:var(--status-break)">' +
    draft +
    '</div><div class="ts-stat-label">Draft</div></div>';
}

/* ══════════════════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════════════════ */

function _empty(text) {
  return (
    '<div class="ts-empty"><div class="ts-empty-icon">&#128203;</div><div class="ts-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

export function tsRender() {
  const el = _container && _container.querySelector('#tsContent');
  if (!el) return;
  _syncToolbar();

  if (_featureOff) {
    el.innerHTML = _empty(_loadError || 'Timesheets is disabled');
    return;
  }

  if (_tab === 'approvals') {
    el.innerHTML = _pending.length
      ? '<div class="ts-list">' + _pending.map(_renderApprovalRow).join('') + '</div>'
      : _empty('No timesheets awaiting your approval');
    return;
  }

  const rows = _tab === 'mine' ? _mine : _team;

  if (_loadError && !rows.length) {
    el.innerHTML = _empty(_loadError);
    return;
  }
  if (!rows.length) {
    el.innerHTML = _empty(
      _tab === 'mine'
        ? 'No timesheet for this week — generate one'
        : 'No timesheets for this week — generate the team week',
    );
    return;
  }

  el.innerHTML = '<div class="ts-table-wrap">' + _renderGrid(rows) + '</div>';
}

function _renderGrid(rows) {
  const days = getWeekDates(_weekOffset);
  const todayKey = dateKey(new Date());
  const admin = _isAdmin();

  let html = '<table class="ts-table" id="tsTable"><thead><tr><th>Employee</th>';
  days.forEach((d, i) => {
    const isToday = dateKey(d) === todayKey;
    html +=
      '<th' +
      (isToday ? ' class="today"' : '') +
      '>' +
      DAY_LABELS[i] +
      '<br><span class="ts-th-date">' +
      d.getDate() +
      '</span></th>';
  });
  html += '<th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

  const colTotals = [0, 0, 0, 0, 0, 0, 0];
  let grandTotal = 0;

  rows.forEach((ts) => {
    const byDate = new Map();
    ts.entries.forEach((e) => byDate.set(e.date, e));

    let rowTotal = 0;
    html += '<tr data-id="' + _esc(ts.id) + '"><td>' + _esc(ts.name || ts.email) + '</td>';

    days.forEach((d, i) => {
      const key = dateKey(d);
      const entry = byDate.get(key);
      const h = entry ? _hours(entry.effectiveMinutes) : 0;
      colTotals[i] += h;
      rowTotal += h;

      let cls = h === 0 ? 'ts-off' : h < 8 ? 'ts-short' : h > 8.5 ? 'ts-over' : 'ts-hours';
      if (entry && entry.dayType !== 'workday') cls = 'ts-off';
      const adjusted = entry && entry.isAdjusted;
      const title = adjusted
        ? 'Adjusted by ' +
          entry.adjustedBy +
          ' — ' +
          entry.adjustmentReason +
          ' (was ' +
          _fmtHours(_hours(entry.workedMinutes)) +
          'h)'
        : entry
          ? entry.dayType
          : 'No entry';

      html +=
        '<td class="' +
        cls +
        (adjusted ? ' ts-adjusted' : '') +
        (admin && entry ? ' ts-clickable' : '') +
        '"' +
        (admin && entry
          ? ' data-action="adjust" data-id="' + _esc(ts.id) + '" data-date="' + _esc(key) + '"'
          : '') +
        ' title="' +
        _esc(title) +
        '">' +
        (h > 0 ? _fmtHours(h) : '\u2014') +
        (adjusted ? '<span class="ts-adj-mark">*</span>' : '') +
        '</td>';
    });

    grandTotal += rowTotal;
    const totalCls = rowTotal < 40 ? 'ts-short' : rowTotal > 45 ? 'ts-over' : 'ts-total';
    html +=
      '<td class="' + totalCls + '">' + _fmtHours(rowTotal) + 'h</td>' +
      '<td>' + _statusBadge(ts.status) + '</td>' +
      '<td class="ts-actions">' + _rowActions(ts) + '</td></tr>';
  });

  html += '</tbody><tfoot><tr><td>Team Total</td>';
  colTotals.forEach((t) => {
    html += '<td>' + _fmtHours(t) + '</td>';
  });
  html += '<td>' + _fmtHours(grandTotal) + 'h</td><td></td><td></td></tr></tfoot></table>';
  return html;
}

function _rowActions(ts) {
  const isMine = (ts.email || '').toLowerCase() === _myEmail();
  const admin = _isAdmin();
  let actions =
    '<button type="button" data-action="detail" data-id="' + _esc(ts.id) + '">Detail</button>';

  if (isMine && ts.status === 'draft') {
    actions +=
      '<button type="button" data-action="submit" data-id="' + _esc(ts.id) + '">Submit</button>';
  }
  if ((isMine || admin) && (ts.status === 'draft' || ts.status === 'rejected')) {
    actions +=
      '<button type="button" data-action="regenerate" data-id="' +
      _esc(ts.id) +
      '">Refresh</button>';
  }
  return actions;
}

function _renderApprovalRow(ts, i) {
  return (
    '<div class="ts-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(ts.id) +
    '">' +
    '<div class="ts-card-main">' +
    '<div class="ts-card-title">' +
    _esc(ts.name || ts.email) +
    '</div>' +
    '<div class="ts-card-sub">' +
    _esc(ts.startDate) +
    ' \u2192 ' +
    _esc(ts.endDate) +
    ' · ' +
    _fmtHours(_hours(ts.totalWorkedMinutes)) +
    'h worked · ' +
    _esc(String(ts.totalLeaveDays)) +
    ' leave · ' +
    _fmtHours(_hours(ts.totalOtMinutes)) +
    'h OT' +
    '</div></div>' +
    _statusBadge(ts.status) +
    '<div class="ts-card-actions">' +
    '<button type="button" data-action="detail" data-id="' +
    _esc(ts.id) +
    '">Detail</button>' +
    '<button type="button" data-action="approve" data-id="' +
    _esc(ts.id) +
    '">Approve</button>' +
    '<button type="button" class="danger" data-action="reject" data-id="' +
    _esc(ts.id) +
    '">Reject</button>' +
    '</div></div>'
  );
}

/* ══════════════════════════════════════════════════════════════
   DETAIL
   ══════════════════════════════════════════════════════════════ */

export async function tsShowDetail(id) {
  const box = _container && _container.querySelector('#tsModalBox');
  if (!box) return;
  box.innerHTML = '<div class="ts-modal-title">Loading\u2026</div>';
  _openModal();

  const res = await api.get('/api/timesheets/' + id);
  if (!res || res._error) {
    box.innerHTML =
      '<div class="ts-modal-title">Timesheet</div><div class="ts-empty-text">' +
      _esc((res && res.message) || 'Not found') +
      '</div>' +
      '<div class="ts-form-actions"><button type="button" class="ts-btn ghost" data-action="close-modal">Close</button></div>';
    return;
  }

  const ts = _normalizeTimesheet(res.timesheet || res);
  const entries = (res.entries || []).map(_normalizeEntry);
  const adjustments = (res.adjustments || []).map(_normalizeAdjustment);

  const dayRows = entries.length
    ? entries
        .map(
          (e) =>
            '<tr><td>' +
            _esc(e.date) +
            '</td><td>' +
            _esc(e.dayType) +
            '</td><td>' +
            _esc(e.attendanceStatus || '\u2014') +
            '</td><td>' +
            _fmtHours(_hours(e.effectiveMinutes)) +
            'h' +
            (e.isAdjusted ? '<span class="ts-adj-mark">*</span>' : '') +
            '</td><td>' +
            _fmtHours(_hours(e.otMinutes)) +
            'h</td><td>' +
            _esc(e.leaveType || '\u2014') +
            '</td><td>' +
            _fmtHours(e.billableHours) +
            'h</td></tr>',
        )
        .join('')
    : '<tr><td colspan="7">No daily entries</td></tr>';

  const trail = adjustments.length
    ? adjustments
        .map(
          (a) =>
            '<div class="ts-history-row">' +
            _esc(a.date) +
            ' · ' +
            _esc(a.action) +
            ' ' +
            _fmtHours(_hours(a.previousMinutes)) +
            'h \u2192 ' +
            _fmtHours(_hours(a.newMinutes)) +
            'h by ' +
            _esc(a.actorEmail) +
            (a.reason ? ' — ' + _esc(a.reason) : '') +
            '</div>',
        )
        .join('')
    : '<div class="ts-history-empty">No adjustments</div>';

  box.innerHTML =
    '<div class="ts-modal-title">' +
    _esc(ts.name || ts.email) +
    '</div>' +
    '<div class="ts-detail-meta">' +
    _statusBadge(ts.status) +
    ' · ' +
    _esc(ts.startDate) +
    ' \u2192 ' +
    _esc(ts.endDate) +
    '</div>' +
    '<div class="ts-detail-grid">' +
    '<div><span class="ts-detail-label">Worked</span> ' +
    _fmtHours(_hours(ts.totalWorkedMinutes)) +
    'h</div>' +
    '<div><span class="ts-detail-label">Overtime</span> ' +
    _fmtHours(_hours(ts.totalOtMinutes)) +
    'h</div>' +
    '<div><span class="ts-detail-label">Present</span> ' +
    _esc(String(ts.totalPresentDays)) +
    'd</div>' +
    '<div><span class="ts-detail-label">Absent</span> ' +
    _esc(String(ts.totalAbsentDays)) +
    'd</div>' +
    '<div><span class="ts-detail-label">Leave</span> ' +
    _esc(String(ts.totalLeaveDays)) +
    'd</div>' +
    '<div><span class="ts-detail-label">Late</span> ' +
    _esc(String(ts.totalLateDays)) +
    'd</div>' +
    '<div><span class="ts-detail-label">Billable</span> ' +
    _fmtHours(ts.totalBillableHours) +
    'h</div>' +
    '<div><span class="ts-detail-label">Approver</span> ' +
    _esc(ts.approvedBy || '\u2014') +
    '</div>' +
    '</div>' +
    (ts.rejectionReason
      ? '<div class="ts-card-sub" style="color:var(--status-absent)">Rejected: ' +
        _esc(ts.rejectionReason) +
        '</div>'
      : '') +
    '<div class="ts-section-title">Daily breakdown</div>' +
    '<div class="ts-table-wrap"><table class="ts-table ts-detail-table"><thead><tr>' +
    '<th>Date</th><th>Day</th><th>Attendance</th><th>Worked</th><th>OT</th><th>Leave</th><th>Billable</th>' +
    '</tr></thead><tbody>' +
    dayRows +
    '</tbody></table></div>' +
    '<div class="ts-section-title">Adjustments</div>' +
    '<div class="ts-history">' +
    trail +
    '</div>' +
    '<div class="ts-form-actions">' +
    (ts.status === 'submitted'
      ? '<button type="button" class="ts-btn" data-action="approve" data-id="' +
        _esc(ts.id) +
        '">Approve</button>' +
        '<button type="button" class="ts-btn ghost danger" data-action="reject" data-id="' +
        _esc(ts.id) +
        '">Reject</button>'
      : '') +
    '<button type="button" class="ts-btn ghost" data-action="close-modal">Close</button>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════
   ADJUSTMENT
   ══════════════════════════════════════════════════════════════ */

export function tsShowAdjustForm(id, date) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const box = _container && _container.querySelector('#tsModalBox');
  if (!box) return;

  const ts = _team.concat(_mine).find((t) => t.id === id);
  const entry = ts ? ts.entries.find((e) => e.date === date) : null;
  const currentHours = entry ? _hours(entry.effectiveMinutes) : 0;
  const derivedHours = entry ? _hours(entry.workedMinutes) : 0;

  box.innerHTML =
    '<div class="ts-modal-title">Adjust ' +
    _esc(date) +
    '</div>' +
    '<div class="ts-card-sub">Derived from attendance: ' +
    _fmtHours(derivedHours) +
    'h. An override is recorded with your name and reason.</div>' +
    '<div class="ts-field"><label>Hours</label>' +
    '<input type="number" id="tsF_hours" min="0" max="24" step="0.25" value="' +
    _esc(_fmtHours(currentHours)) +
    '"></div>' +
    '<div class="ts-field"><label>Reason *</label>' +
    '<textarea id="tsF_reason" rows="2" placeholder="Why is this day being overridden?"></textarea></div>' +
    '<div class="ts-form-actions">' +
    (entry && entry.isAdjusted
      ? '<button type="button" class="ts-btn ghost danger" id="tsRevertBtn">Revert</button>'
      : '') +
    '<button type="button" class="ts-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ts-btn" id="tsAdjustBtn">Save</button>' +
    '</div>';
  _openModal();

  const saveBtn = box.querySelector('#tsAdjustBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => tsAdjust(id, date));
  const revertBtn = box.querySelector('#tsRevertBtn');
  if (revertBtn) revertBtn.addEventListener('click', () => tsRevertAdjust(id, date));
}

export async function tsAdjust(id, date) {
  const hoursEl = _container && _container.querySelector('#tsF_hours');
  const reasonEl = _container && _container.querySelector('#tsF_reason');
  const hours = Number(hoursEl ? hoursEl.value : NaN);
  const reason = ((reasonEl && reasonEl.value) || '').trim();

  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    toast('Hours must be between 0 and 24', 'error');
    return;
  }
  if (!reason) {
    toast('A reason is required', 'error');
    return;
  }

  const result = await api.post('/api/timesheets/' + id + '/adjust', { date, hours, reason });
  if (result && !result._error) {
    toast('Day adjusted', 'success');
    tsCloseModal();
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to adjust', 'error');
}

export async function tsRevertAdjust(id, date) {
  const result = await api.post('/api/timesheets/' + id + '/adjust/revert', { date });
  if (result && !result._error) {
    toast('Adjustment reverted', 'success');
    tsCloseModal();
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to revert', 'error');
}

/* ══════════════════════════════════════════════════════════════
   ACTIONS
   ══════════════════════════════════════════════════════════════ */

export async function tsGenerate() {
  if (_busy) return;
  const startDate = weekStartKey(_weekOffset);
  const teamScope = _tab !== 'mine' && _isAdmin();

  _busy = true;
  const result = teamScope
    ? await api.post('/api/timesheets/generate-team', { periodType: 'weekly', startDate })
    : await api.post('/api/timesheets/generate', {
        email: _myEmail(),
        periodType: 'weekly',
        startDate,
      });
  _busy = false;

  if (result && !result._error) {
    const count = result.generated ? result.generated.length : 1;
    toast(
      count
        ? 'Generated ' + count + ' timesheet' + (count === 1 ? '' : 's')
        : 'Nothing new to generate',
      count ? 'success' : 'info',
    );
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to generate', 'error');
}

export async function tsSubmit(id) {
  const result = await api.post('/api/timesheets/' + id + '/submit', {});
  if (result && !result._error) {
    toast('Submitted for approval', 'success');
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to submit', 'error');
}

export async function tsApprove(id) {
  const result = await api.post('/api/timesheets/' + id + '/approve', {});
  if (result && !result._error) {
    toast('Approved', 'success');
    tsCloseModal();
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to approve', 'error');
}

export async function tsReject(id) {
  const reason = window.prompt('Rejection reason', '') || '';
  const result = await api.post('/api/timesheets/' + id + '/reject', { reason });
  if (result && !result._error) {
    toast('Rejected', 'success');
    tsCloseModal();
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to reject', 'error');
}

export async function tsRegenerate(id) {
  const result = await api.post('/api/timesheets/' + id + '/regenerate', {});
  if (result && !result._error) {
    toast('Refreshed from attendance', 'success');
    await tsLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to refresh', 'error');
}

/* ══════════════════════════════════════════════════════════════
   MODAL & EVENTS
   ══════════════════════════════════════════════════════════════ */

function _openModal() {
  const modal = _container && _container.querySelector('#tsModal');
  if (modal) modal.classList.add('open');
}

export function tsCloseModal() {
  const modal = _container && _container.querySelector('#tsModal');
  if (modal) modal.classList.remove('open');
}

function _syncTabs() {
  if (!_container) return;
  _container.querySelectorAll('.ts-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _syncToolbar() {
  const btn = _container && _container.querySelector('#tsGenerate');
  if (!btn) return;
  if (_tab === 'approvals') {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  btn.textContent = _tab !== 'mine' && _isAdmin() ? 'Generate Team Week' : 'Generate My Week';
}

function _handleAction(action, id, date) {
  if (action === 'detail') tsShowDetail(id);
  else if (action === 'submit') tsSubmit(id);
  else if (action === 'approve') tsApprove(id);
  else if (action === 'reject') tsReject(id);
  else if (action === 'regenerate') tsRegenerate(id);
  else if (action === 'adjust') tsShowAdjustForm(id, date);
}

function _bindEvents(container) {
  const prev = container.querySelector('#tsPrev');
  const next = container.querySelector('#tsNext');
  const todayBtn = container.querySelector('#tsToday');
  const generate = container.querySelector('#tsGenerate');

  if (prev)
    prev.addEventListener('click', () => {
      _weekOffset--;
      tsLoadData();
    });
  if (next)
    next.addEventListener('click', () => {
      _weekOffset++;
      tsLoadData();
    });
  if (todayBtn)
    todayBtn.addEventListener('click', () => {
      _weekOffset = 0;
      tsLoadData();
    });
  if (generate) generate.addEventListener('click', tsGenerate);

  const modal = container.querySelector('#tsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) tsCloseModal();
    });
  }

  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.ts-tab');
    if (tab) {
      _tab = tab.dataset.tab || 'team';
      _syncTabs();
      tsRenderStats();
      tsRender();
      return;
    }
    if (e.target.closest('[data-action="close-modal"]')) {
      tsCloseModal();
      return;
    }
    const target = e.target.closest('[data-action]');
    if (!target) return;
    _handleAction(target.dataset.action, target.dataset.id, target.dataset.date);
  });
}

/* ── Test helpers ── */
export function _getTeam() {
  return _team;
}
export function _getMine() {
  return _mine;
}
export function _getPending() {
  return _pending;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _getWeekOffset() {
  return _weekOffset;
}

export function _resetState() {
  _container = null;
  _tab = 'team';
  _weekOffset = 0;
  _team = [];
  _mine = [];
  _pending = [];
  _loadError = null;
  _featureOff = false;
  _busy = false;
}

/* ── Register ── */
registerModule('timesheets', renderTimesheetsPage);

/**
 * modules/timesheets/timesheets.js
 *
 * Weekly timesheet view with editable grid table,
 * week navigation, stats, submit-for-approval.
 *
 * Pattern: renderTimesheetsPage() → tsLoadData() → tsRenderStats()
 *          → tsRender() → edit cells → tsCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

/* ── Module state ── */
let _container = null;
let _tsWeekOffset = 0;
let _tsData = [];

/* ── Mock data ── */
const _mockEmployees = [
  { name: 'Arif Alwi', email: 'arif@blokhr.com', hours: [9.0, 8.5, 9.2, 8.0, 8.5, 0, 0], status: 'approved' },
  { name: 'Sarah Chen', email: 'sarah@blokhr.com', hours: [8.5, 9.0, 8.0, 8.5, 7.5, 0, 0], status: 'submitted' },
  { name: 'Maya Patel', email: 'maya@blokhr.com', hours: [8.0, 8.0, 8.5, 8.0, 8.0, 0, 0], status: 'approved' },
  { name: 'James Wilson', email: 'james@blokhr.com', hours: [7.5, 8.0, 7.0, 8.5, 8.0, 0, 0], status: 'draft' },
  { name: 'Priya Sharma', email: 'priya@blokhr.com', hours: [8.5, 8.5, 9.0, 8.0, 8.5, 0, 0], status: 'approved' },
];

/* ══════════════════════════════════════════════════════════════
   WEEK DATE UTILITIES
   ══════════════════════════════════════════════════════════════ */

/**
 * Get array of 7 Date objects for Mon–Sun of the week at given offset.
 * @param {number} offset — 0 = current week, -1 = last week, etc.
 * @returns {Date[]}
 */
export function getWeekDates(offset) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + (offset * 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    days.push(dd);
  }
  return days;
}

/**
 * Format week label like "Mar 24 — Mar 30, 2026".
 * @param {Date[]} days
 * @returns {string}
 */
export function fmtWeekLabel(days) {
  const opts = { month: 'short', day: 'numeric' };
  return days[0].toLocaleDateString('en-US', opts) + ' \u2014 ' +
    days[6].toLocaleDateString('en-US', opts) + ', ' + days[0].getFullYear();
}

/**
 * Get ISO week string like "2026-W13".
 * @param {Date} d
 * @returns {string}
 */
export function isoWeek(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - jan1) / 86400000);
  const wk = Math.ceil((days + jan1.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(wk).padStart(2, '0');
}

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

export function renderTimesheetsPage(container) {
  _container = container;
  _tsWeekOffset = 0;

  container.innerHTML =
    '<div class="ts-wrap" id="tsWrap">' +
      '<div class="ts-toolbar">' +
        '<div class="ts-week-nav">' +
          '<button id="tsPrev">&#9664;</button>' +
          '<div class="ts-week-label" id="tsWeekLabel"></div>' +
          '<button id="tsNext">&#9654;</button>' +
        '</div>' +
        '<div class="ts-spacer"></div>' +
        '<button class="ts-btn ghost" id="tsToday">Today</button>' +
        '<button class="ts-btn" id="tsSubmitAll">Submit Week</button>' +
      '</div>' +
      '<div id="tsStats"></div>' +
      '<div class="ts-table-wrap"><table class="ts-table" id="tsTable"></table></div>' +
    '</div>';

  _bindEvents(container);
  tsLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function tsLoadData() {
  const days = getWeekDates(_tsWeekOffset);
  const labelEl = _container && _container.querySelector('#tsWeekLabel');
  if (labelEl) labelEl.textContent = fmtWeekLabel(days);

  const weekStr = isoWeek(days[0]);
  const data = await api.get('/api/timesheets?week=' + weekStr);

  _tsData = (data && !data._error)
    ? (data.timesheets || data || [])
    : _mockEmployees;
  if (!Array.isArray(_tsData)) _tsData = _mockEmployees;

  tsRenderStats();
  tsRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export function tsRenderStats() {
  const el = _container && _container.querySelector('#tsStats');
  if (!el) return;

  const totalHrs = _tsData.reduce(function (s, e) {
    return s + e.hours.reduce(function (a, b) { return a + b; }, 0);
  }, 0);
  const avgHrs = _tsData.length ? (totalHrs / _tsData.length) : 0;
  const submitted = _tsData.filter(function (e) { return e.status === 'submitted' || e.status === 'approved'; }).length;
  const draft = _tsData.filter(function (e) { return e.status === 'draft'; }).length;

  el.innerHTML =
    '<div class="ts-stats">' +
      '<div class="ts-stat"><div class="ts-stat-num">' + totalHrs.toFixed(1) + 'h</div><div class="ts-stat-label">Total Hours</div></div>' +
      '<div class="ts-stat"><div class="ts-stat-num">' + avgHrs.toFixed(1) + 'h</div><div class="ts-stat-label">Avg Per Person</div></div>' +
      '<div class="ts-stat"><div class="ts-stat-num" style="color:var(--status-in)">' + submitted + '</div><div class="ts-stat-label">Submitted</div></div>' +
      '<div class="ts-stat"><div class="ts-stat-num" style="color:var(--status-break)">' + draft + '</div><div class="ts-stat-label">Draft</div></div>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════
   RENDER TABLE
   ══════════════════════════════════════════════════════════════ */

export function tsRender() {
  const table = _container && _container.querySelector('#tsTable');
  if (!table) return;

  if (!_tsData.length) {
    table.innerHTML = '';
    const wrap = _container.querySelector('.ts-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="ts-empty"><div class="ts-empty-icon">&#128203;</div><div class="ts-empty-text">No timesheet data</div></div>';
    return;
  }

  const days = getWeekDates(_tsWeekOffset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let html = '<thead><tr><th>Employee</th>';
  days.forEach(function (d, i) {
    const isToday = d.getTime() === today.getTime();
    html += '<th' + (isToday ? ' class="today"' : '') + '>' + dayLabels[i] +
      '<br><span style="font-weight:400;font-size:8px">' + d.getDate() + '</span></th>';
  });
  html += '<th>Total</th><th>Status</th></tr></thead>';

  html += '<tbody>';
  const colTotals = [0, 0, 0, 0, 0, 0, 0];
  let grandTotal = 0;

  _tsData.forEach(function (emp) {
    const rowTotal = emp.hours.reduce(function (a, b) { return a + b; }, 0);
    grandTotal += rowTotal;
    html += '<tr><td>' + _esc(emp.name) + '</td>';
    emp.hours.forEach(function (h, i) {
      colTotals[i] += h;
      const cls = h === 0 ? 'ts-off' : h < 8 ? 'ts-short' : h > 8.5 ? 'ts-over' : 'ts-hours';
      if (emp.status === 'draft' && i < 5) {
        html += '<td><input class="ts-edit-cell" type="number" step="0.5" min="0" max="24" value="' +
          (h || '') + '" data-email="' + _esc(emp.email) + '" data-day="' + i + '"></td>';
      } else {
        html += '<td class="' + cls + '">' + (h > 0 ? h.toFixed(1) : '\u2014') + '</td>';
      }
    });
    const totalCls = rowTotal < 40 ? 'ts-short' : rowTotal > 45 ? 'ts-over' : 'ts-total';
    html += '<td class="' + totalCls + '">' + rowTotal.toFixed(1) + 'h</td>';
    html += '<td><span class="ts-status ' + _esc(emp.status) + '">' + _esc(emp.status) + '</span></td>';
    html += '</tr>';
  });
  html += '</tbody>';

  html += '<tfoot><tr><td>Team Total</td>';
  colTotals.forEach(function (t) { html += '<td>' + t.toFixed(1) + '</td>'; });
  html += '<td>' + grandTotal.toFixed(1) + 'h</td><td></td></tr></tfoot>';

  table.innerHTML = html;
  _bindEditCells();
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL (no-op for pattern)
   ══════════════════════════════════════════════════════════════ */

export function tsCloseModal() { /* Timesheets uses inline editing, no modal */ }

/* ══════════════════════════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════════════════════════ */

function _bindEvents(container) {
  const prev = container.querySelector('#tsPrev');
  const next = container.querySelector('#tsNext');
  const todayBtn = container.querySelector('#tsToday');
  const submitAll = container.querySelector('#tsSubmitAll');

  if (prev) prev.addEventListener('click', function () { _tsWeekOffset--; tsLoadData(); });
  if (next) next.addEventListener('click', function () { _tsWeekOffset++; tsLoadData(); });
  if (todayBtn) todayBtn.addEventListener('click', function () { _tsWeekOffset = 0; tsLoadData(); });

  if (submitAll) {
    submitAll.addEventListener('click', async function () {
      const weekStr = isoWeek(getWeekDates(_tsWeekOffset)[0]);
      const result = await api.post('/api/timesheets/submit-week', { week: weekStr });
      if (result && !result._error) {
        toast('Week submitted for approval', 'success');
        tsLoadData();
        return;
      }
      _tsData.forEach(function (e) { if (e.status === 'draft') e.status = 'submitted'; });
      toast('Week submitted (demo)', 'success');
      tsRender();
    });
  }
}

function _bindEditCells() {
  if (!_container) return;
  _container.querySelectorAll('.ts-edit-cell').forEach(function (inp) {
    inp.addEventListener('change', function () {
      const email = this.dataset.email;
      const day = parseInt(this.dataset.day, 10);
      const val = parseFloat(this.value) || 0;
      const emp = _tsData.find(function (e) { return e.email === email; });
      if (emp) { emp.hours[day] = val; tsRenderStats(); tsRender(); }
      api.post('/api/timesheets', {
        email: email, day: day, hours: val,
        week: isoWeek(getWeekDates(_tsWeekOffset)[0]),
      });
    });
  });
}

/* ── Utility ── */
function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ── Test helpers ── */
export function _getData() { return _tsData; }
export function _setData(list) { _tsData = list; }
export function _getWeekOffset() { return _tsWeekOffset; }

export function _resetState() {
  _container = null;
  _tsWeekOffset = 0;
  _tsData = [];
}

/* ── Register ── */
registerModule('timesheets', renderTimesheetsPage);

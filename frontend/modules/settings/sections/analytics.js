/**
 * modules/analytics/analytics.js
 * HR analytics: attendance, leaves, overtime, department KPIs.
 * Pattern: renderAnalyticsPage() → anlLoadData() → anlRenderKpis()
 *          → anlRenderCharts() (no modal)
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = {};
let _tab = 'overview';  // 'overview' | 'attendance' | 'leaves' | 'overtime'
let _period = '30d';    // '7d' | '30d' | '90d'

const _mock = {
  attendance: {
    present_rate: 91.4, late_rate: 6.2, absent_rate: 2.4,
    avg_hours: 8.3, total_clocks: 892, on_time: 815, late: 55, absent: 22,
    trend: [88, 90, 92, 91, 93, 91, 94, 90, 92, 91, 93, 94, 91, 92],
  },
  leaves: {
    total_applications: 48, approved: 38, rejected: 4, pending: 6,
    avg_days: 2.8, most_common_type: 'Annual',
    by_type: { Annual: 22, Sick: 12, Casual: 9, Comp_Off: 5 },
  },
  overtime: {
    total_requests: 34, approved: 28, total_hours: 87.5, avg_hours: 3.1,
    top_employee: 'Sarah Chen', top_hours: 18.0,
  },
  departments: [
    { name: 'Engineering', headcount: 18, present_rate: 93, avg_ot_hours: 4.2 },
    { name: 'Product',     headcount: 6,  present_rate: 89, avg_ot_hours: 2.1 },
    { name: 'Design',      headcount: 5,  present_rate: 92, avg_ot_hours: 1.5 },
    { name: 'Operations',  headcount: 8,  present_rate: 88, avg_ot_hours: 0.8 },
    { name: 'Sales',       headcount: 10, present_rate: 85, avg_ot_hours: 1.2 },
  ],
};

export function renderAnalyticsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="anl-wrap">' +
      '<div class="anl-toolbar">' +
        '<div class="anl-tabs" id="anlTabs">' +
          '<button class="anl-tab active" data-tab="overview">Overview</button>' +
          '<button class="anl-tab" data-tab="attendance">Attendance</button>' +
          '<button class="anl-tab" data-tab="leaves">Leaves</button>' +
          '<button class="anl-tab" data-tab="overtime">Overtime</button>' +
        '</div>' +
        '<select class="anl-select" id="anlPeriod">' +
          '<option value="7d">Last 7 days</option>' +
          '<option value="30d" selected>Last 30 days</option>' +
          '<option value="90d">Last 90 days</option>' +
        '</select>' +
      '</div>' +
      '<div id="anlKpis" class="anl-kpis"></div>' +
      '<div id="anlCharts"></div>' +
    '</div>';
  _bindEvents(container);
  anlLoadData();
}

export async function anlLoadData() {
  const [attData, lvData, otData, deptData] = await Promise.all([
    api.get('/api/analytics/attendance?period=' + _period),
    api.get('/api/analytics/leaves?period=' + _period),
    api.get('/api/analytics/overtime?period=' + _period),
    api.get('/api/analytics/departments'),
  ]);
  _data.attendance  = (attData  && !attData._error)  ? attData  : _mock.attendance;
  _data.leaves      = (lvData   && !lvData._error)   ? lvData   : _mock.leaves;
  _data.overtime    = (otData   && !otData._error)   ? otData   : _mock.overtime;
  _data.departments = (deptData && !deptData._error) ? (deptData.departments || deptData) : _mock.departments;
  if (!Array.isArray(_data.departments)) _data.departments = _mock.departments;
  anlRenderKpis();
  anlRenderCharts();
}

export function anlRenderKpis() {
  const el = _container && _container.querySelector('#anlKpis');
  if (!el) return;
  const att = _data.attendance || _mock.attendance;
  const lv  = _data.leaves     || _mock.leaves;
  const ot  = _data.overtime   || _mock.overtime;
  el.innerHTML =
    _kpi(att.present_rate + '%',   'Attendance Rate',   'var(--status-in)',     att.present_rate >= 90 ? '&#8679;' : '&#8681;') +
    _kpi(att.late_rate + '%',      'Late Rate',         'var(--status-absent)', att.late_rate > 10 ? '&#8679;' : '&#8681;') +
    _kpi(lv.total_applications,    'Leave Applications','var(--accent)',        '') +
    _kpi(lv.pending,               'Pending Approvals', 'var(--status-break)',  '') +
    _kpi(ot.total_hours + 'h',     'OT Hours',          'var(--tx2)',           '') +
    _kpi(att.avg_hours + 'h',      'Avg Work Hours',    'var(--status-in)',     '');
}

function _kpi(value, label, color, trend) {
  return '<div class="anl-kpi"><div class="anl-kpi-val" style="color:' + color + '">' + value + ' ' + (trend || '') + '</div><div class="anl-kpi-lbl">' + label + '</div></div>';
}

export function anlRenderCharts() {
  const el = _container && _container.querySelector('#anlCharts');
  if (!el) return;
  if (_tab === 'attendance') { _renderAttendance(el); return; }
  if (_tab === 'leaves')     { _renderLeaves(el); return; }
  if (_tab === 'overtime')   { _renderOvertime(el); return; }
  _renderOverview(el);
}

function _renderOverview(el) {
  const dept = _data.departments || _mock.departments;
  let html = '<div class="anl-section-title">Department Summary</div><div class="anl-dept-table"><table class="anl-table"><thead><tr><th>Department</th><th>Headcount</th><th>Attendance %</th><th>Avg OT hrs</th></tr></thead><tbody>';
  dept.forEach(d => {
    html += '<tr><td>' + _esc(d.name) + '</td><td>' + d.headcount + '</td>' +
      '<td><div class="anl-bar-wrap"><div class="anl-bar" style="width:' + d.present_rate + '%;background:var(--status-in)"></div><span>' + d.present_rate + '%</span></div></td>' +
      '<td>' + d.avg_ot_hours + 'h</td></tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function _renderAttendance(el) {
  const att = _data.attendance || _mock.attendance;
  el.innerHTML =
    '<div class="anl-section-title">Attendance Breakdown</div>' +
    '<div class="anl-att-grid">' +
      _attCard('On Time',  att.on_time  || 0, 'var(--status-in)') +
      _attCard('Late',     att.late     || 0, 'var(--status-absent)') +
      _attCard('Absent',   att.absent   || 0, 'var(--status-break)') +
    '</div>' +
    '<div class="anl-section-title" style="margin-top:16px">Trend (last 14 days)</div>' +
    '<div class="anl-spark">' + (att.trend || []).map((v, i) =>
      '<div class="anl-spark-bar" style="height:' + Math.round(v / 1.2) + 'px;background:var(--accent)" title="Day ' + (i+1) + ': ' + v + '%"></div>'
    ).join('') + '</div>';
}

function _attCard(label, value, color) {
  return '<div class="anl-att-card"><div class="anl-att-val" style="color:' + color + '">' + value + '</div><div class="anl-att-lbl">' + label + '</div></div>';
}

function _renderLeaves(el) {
  const lv = _data.leaves || _mock.leaves;
  let html = '<div class="anl-section-title">Leave Applications</div><div class="anl-lv-grid">';
  html += _attCard('Total',    lv.total_applications, 'var(--accent)');
  html += _attCard('Approved', lv.approved,           'var(--status-in)');
  html += _attCard('Rejected', lv.rejected,           'var(--status-absent)');
  html += _attCard('Pending',  lv.pending,            'var(--status-break)');
  html += '</div>';
  if (lv.by_type) {
    html += '<div class="anl-section-title" style="margin-top:16px">By Type</div><div class="anl-by-type">';
    Object.entries(lv.by_type).forEach(([type, count]) => {
      const pct = lv.total_applications ? Math.round((count / lv.total_applications) * 100) : 0;
      html += '<div class="anl-type-row"><span class="anl-type-name">' + _esc(type.replace(/_/g, ' ')) + '</span>' +
        '<div class="anl-bar-wrap"><div class="anl-bar" style="width:' + pct + '%;background:var(--accent)"></div><span>' + count + '</span></div></div>';
    });
    html += '</div>';
  }
  el.innerHTML = html;
}

function _renderOvertime(el) {
  const ot = _data.overtime || _mock.overtime;
  el.innerHTML =
    '<div class="anl-section-title">Overtime Summary</div>' +
    '<div class="anl-ot-grid">' +
      _attCard('Requests',    ot.total_requests, 'var(--accent)') +
      _attCard('Approved',    ot.approved,       'var(--status-in)') +
      _attCard('Total Hours', ot.total_hours,    'var(--status-break)') +
      _attCard('Avg Hours',   ot.avg_hours,      'var(--tx2)') +
    '</div>' +
    (ot.top_employee ? '<div class="anl-top-emp">&#127942; Top OT contributor: <strong>' + _esc(ot.top_employee) + '</strong> — ' + ot.top_hours + 'h</div>' : '');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#anlTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.anl-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.anl-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    anlRenderCharts();
  });
  const period = container.querySelector('#anlPeriod');
  if (period) period.addEventListener('change', function () { _period = this.value; anlLoadData(); });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = {}; _tab = 'overview'; _period = '30d'; }

registerModule('analytics', renderAnalyticsPage);

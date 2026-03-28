/**
 * modules/dashboard/dashboard.js
 *
 * Personal dashboard with 6-tab system:
 *   Dashboard | Attendance | Leaves | Meetings | Regularization | Profile
 *
 * Pattern: renderDashboardPage() → dashLoadData() → dashRenderStats() → dashRender()
 *
 * The Dashboard tab contains: clock card, today timeline, week summary, leave bars.
 * Other tabs delegate to their respective module renderers when available.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _data = {
  attendance: null,
  leaveBalances: [
    { type: 'Casual', used: 3, total: 12, color: 'var(--status-in)' },
    { type: 'Sick', used: 1, total: 6, color: 'var(--status-break)' },
    { type: 'Earned', used: 0, total: 15, color: 'var(--accent)' },
  ],
};
let _activeTab = 'dashboard';
let _clockState = 'out';
let _clockTimer = null;
let _clockStart = null;

/**
 * Render the dashboard page into a container.
 * Called from router when navigating to the personal view.
 * @param {HTMLElement} container
 */
export function renderDashboardPage(container) {
  const E = _esc;
  const session = getSession();
  const name = session ? session.name : 'User';
  const email = session ? session.email : '';

  container.innerHTML =
    '<div class="my">' +
    '<div class="my-hi mf">Welcome back</div>' +
    '<div class="my-name df">' + E(name) + '</div>' +
    '<div class="my-dept">' + E(email) + '</div>' +
    '<div class="dash-tabs" id="dashTabs">' +
    '<button class="dash-tab active" data-tab="dashboard">Dashboard</button>' +
    '<button class="dash-tab" data-tab="attendance">Attendance</button>' +
    '<button class="dash-tab" data-tab="leaves">Leaves</button>' +
    '<button class="dash-tab" data-tab="meetings">Meetings</button>' +
    '<button class="dash-tab" data-tab="regularization">Regularization</button>' +
    '<button class="dash-tab" data-tab="profile">Profile</button>' +
    '</div>' +
    '<div id="dashTabContent"></div>' +
    '</div>';

  const tabs = container.querySelector('#dashTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.dash-tab');
      if (!btn || !btn.dataset.tab) return;
      switchDashTab(btn.dataset.tab, container);
    });
  }

  /* Render immediately with defaults, then update when data arrives */
  renderDashboardTab(container.querySelector('#dashTabContent'));
  dashLoadData(container);
}

/**
 * Switch between dashboard tabs.
 * @param {string} tabKey
 * @param {HTMLElement} container
 */
export function switchDashTab(tabKey, container) {
  _activeTab = tabKey;
  const tabContainer = container || document;
  tabContainer.querySelectorAll('.dash-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });

  const content = tabContainer.querySelector('#dashTabContent');
  if (!content) return;

  const renderers = {
    dashboard: renderDashboardTab,
    attendance: renderAttendanceTab,
    leaves: renderLeavesTab,
    meetings: renderMeetingsTab,
    regularization: renderRegularizationTab,
    profile: renderProfileTab,
  };

  if (renderers[tabKey]) {
    renderers[tabKey](content);
  }
}

/**
 * Load dashboard data from APIs.
 * @param {HTMLElement} container
 */
async function dashLoadData(container) {
  const session = getSession();
  if (!session) return;

  const [attendance, leaveBalances] = await Promise.all([
    api.get('/api/attendance?date=' + _todayStr()),
    api.get('/api/leaves/balance'),
  ]);

  if (attendance && !attendance._error) {
    _data.attendance = attendance;
    if (attendance.status) _clockState = attendance.status;
    if (attendance.clockIn) _clockStart = new Date(attendance.clockIn);
  }

  if (leaveBalances && !leaveBalances._error) {
    _data.leaveBalances = leaveBalances.balances || leaveBalances || [];
  } else {
    _data.leaveBalances = [
      { type: 'Casual', used: 3, total: 12, color: 'var(--status-in)' },
      { type: 'Sick', used: 1, total: 6, color: 'var(--status-break)' },
      { type: 'Earned', used: 0, total: 15, color: 'var(--accent)' },
    ];
  }

  renderDashboardTab(container.querySelector('#dashTabContent'));
}

/* ── Tab renderers ── */

function renderDashboardTab(el) {
  if (!el) return;
  const E = _esc;
  const F = _fmtDur;

  const statusLabel = { in: 'Clocked In', break: 'On Break', out: 'Not Clocked In', absent: 'Absent' }[_clockState] || 'Not Clocked In';
  const clockIcon = { in: '&#9899;', break: '&#9749;', out: '&#9654;' }[_clockState] || '&#9654;';
  const btnClass = 'ck-btn st-' + _clockState;
  const actionBtns = _clockState === 'out'
    ? '<button class="ck-ab primary" data-clock="in">Clock In</button>'
    : _clockState === 'in'
    ? '<button class="ck-ab" data-clock="break">Break</button><button class="ck-ab danger" data-clock="out">Clock Out</button>'
    : _clockState === 'break'
    ? '<button class="ck-ab primary" data-clock="back">Back</button><button class="ck-ab danger" data-clock="out">Clock Out</button>'
    : '<button class="ck-ab primary" data-clock="in">Clock In</button>';

  let dur = '--:--';
  if (_clockStart) {
    const mins = Math.floor((Date.now() - _clockStart.getTime()) / 60000);
    if (mins >= 0) dur = F(mins);
  }

  let html = '<div class="my-g">';
  html += '<div class="mc ck-card" id="clockCard">' +
    '<div class="' + btnClass + '" id="clockBtn">' + clockIcon + '</div>' +
    '<div class="ck-info">' +
    '<div class="ck-st">' + E(statusLabel) + '</div>' +
    '<div class="ck-timer mf" id="clockTimer">' + dur + '</div>' +
    '<div class="ck-actions" id="clockActions">' + actionBtns + '</div>' +
    '</div></div>';

  html += '<div class="mc"><div class="mc-t"><span class="ic">&#128337;</span> Today\'s Timeline</div>' +
    '<div class="my-tl" id="myTimeline">' + _renderTimeline(_data.attendance) + '</div></div>';

  html += '<div class="mc sp3"><div class="mc-t"><span class="ic">&#128197;</span> This Week</div>' +
    '<div class="week-row" id="myWeek">' + _renderWeek() + '</div></div>';

  html += '<div class="mc sp3"><div class="mc-t"><span class="ic">&#127796;</span> Leave Balance</div>' +
    '<div class="leave-bars" id="myLeaves">' + _renderLeaveBalances(_data.leaveBalances) + '</div></div>';

  html += '</div>';
  el.innerHTML = html;

  _bindClockActions(el);
  _startClockTimer(el);
}

function renderAttendanceTab(el) {
  if (!el) return;
  el.innerHTML = '<div class="mod-coming"><div class="mod-coming-icon">&#128197;</div><div class="mod-coming-title df">My Attendance</div><div class="mod-coming-sub mf">View loaded from attendance module</div></div>';
}

function renderLeavesTab(el) {
  if (!el) return;
  el.innerHTML = '<div class="mod-coming"><div class="mod-coming-icon">&#127796;</div><div class="mod-coming-title df">My Leaves</div><div class="mod-coming-sub mf">View loaded from leaves module</div></div>';
}

function renderMeetingsTab(el) {
  if (!el) return;
  el.innerHTML = '<div class="mod-coming"><div class="mod-coming-icon">&#128197;</div><div class="mod-coming-title df">My Meetings</div><div class="mod-coming-sub mf">Meeting schedule and discovery</div></div>';
}

function renderRegularizationTab(el) {
  if (!el) return;
  el.innerHTML = '<div class="mod-coming"><div class="mod-coming-icon">&#128221;</div><div class="mod-coming-title df">Regularizations</div><div class="mod-coming-sub mf">Submit and track attendance corrections</div></div>';
}

function renderProfileTab(el) {
  if (!el) return;
  el.innerHTML = '<div class="mod-coming"><div class="mod-coming-icon">&#128100;</div><div class="mod-coming-title df">My Profile</div><div class="mod-coming-sub mf">View loaded from profile module</div></div>';
}

/* ── Clock actions ── */

function _bindClockActions(el) {
  const actions = el.querySelector('#clockActions');
  if (actions) {
    actions.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-clock]');
      if (!btn) return;
      _doClock(btn.dataset.clock, el);
    });
  }
}

async function _doClock(action, container) {
  const session = getSession();
  if (!session) return;
  const result = await api.post('/api/clock', {
    action: action,
    email: session.email,
    name: session.name,
  });
  if (result && result._error) {
    toast(result.message || 'Clock action failed', 'error');
    return;
  }

  if (action === 'in' || action === 'back') {
    _clockState = 'in';
    _clockStart = new Date();
  } else if (action === 'break') {
    _clockState = 'break';
  } else if (action === 'out') {
    _clockState = 'out';
    _clockStart = null;
  }

  const actionLabel = { in: 'Clocked In', out: 'Clocked Out', break: 'On Break', back: 'Back from Break' };
  toast(actionLabel[action] || action, 'success');

  if (window.BlokHR && window.BlokHR.triggerLottie && window.BlokHR.settingsCache) {
    const lottieAction = action === 'in' ? 'clock-in' : action === 'out' ? 'clock-out' : action;
    window.BlokHR.triggerLottie(lottieAction, window.BlokHR.settingsCache);
  }

  renderDashboardTab(container.querySelector('#dashTabContent') || container);
}

function _startClockTimer(el) {
  if (_clockTimer) clearInterval(_clockTimer);
  if (_clockState !== 'in' && _clockState !== 'break') return;
  _clockTimer = setInterval(function () {
    const timerEl = el.querySelector('#clockTimer');
    if (timerEl && _clockStart) {
      const mins = Math.floor((Date.now() - _clockStart.getTime()) / 60000);
      timerEl.textContent = _fmtDur(mins);
    }
  }, 1000);
}

/* ── Render helpers ── */

function _renderTimeline(attendance) {
  if (!attendance || !attendance.events || !attendance.events.length) {
    return '<div style="font-size:11px;color:var(--tx3);padding:8px 0">No events yet today</div>';
  }
  return attendance.events.map(function (ev) {
    const cls = 'my-tl-item ev-' + (ev.action || 'in');
    const time = ev.time ? '<span class="my-tl-time">' + _esc(ev.time) + '</span>' : '';
    const label = { in: 'Clocked In', out: 'Clocked Out', break: 'Break Started', back: 'Back from Break' }[ev.action] || ev.action;
    return '<div class="' + cls + '">' + time + _esc(label) + '</div>';
  }).join('');
}

function _renderWeek() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  return days.map(function (d, i) {
    const cls = 'week-day' + (i === todayIdx ? ' today' : '');
    return '<div class="' + cls + '"><div class="week-day-name">' + d + '</div><div class="week-day-hrs mf">--</div></div>';
  }).join('');
}

function _renderLeaveBalances(balances) {
  if (!balances || !balances.length) return '<div style="font-size:11px;color:var(--tx3)">No leave data</div>';
  return balances.map(function (b) {
    const used = b.used || 0;
    const total = b.total || b.entitled || 12;
    const pct = total > 0 ? Math.min(100, Math.round(used / total * 100)) : 0;
    const color = b.color || 'var(--accent)';
    return '<div class="lb"><div class="lb-label">' + _esc(b.type || b.name || 'Leave') + '</div>' +
      '<div class="lb-track"><div class="lb-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<div class="lb-nums">' + used + ' <span>/ ' + total + '</span></div></div>';
  }).join('');
}

/* ── Utility ── */
function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function _fmtDur(mins) { if (mins == null) return '--:--'; const h = Math.floor(mins / 60), m = Math.round(mins % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
function _todayStr() { return new Date(Date.now() + 330 * 60000).toISOString().split('T')[0]; }

registerModule('dashboard', renderDashboardPage);

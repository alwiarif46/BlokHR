/**
 * modules/attendance/attendance.js
 *
 * Team attendance grid with employee cards, stat pills, search, filtering,
 * column toggle, and theme-aware detail views.
 *
 * Pattern: renderAttendancePage() → attLoadData() → attRenderStats()
 *          → attRender() → detail open/close → attCloseModal()
 *
 * SSE: listens for attendance-update to refresh cards in real time.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { openDetail, closeDetail } from '../../shared/modal.js';
import { getTheme } from '../../shared/themes.js';
import { onSSE } from '../../shared/sse.js';
import { registerModule } from '../../shared/router.js';
import { triggerLottie } from '../../shared/lottie.js';

/* ── Module state ── */
let _allPeople = [];
let _gridFilter = 'all';
let _gridRefreshTimer = null;
let _detailEmail = '';
let _container = null;

/* ── Utility helpers ── */
function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function _ini(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function _fmtDur(mins) {
  if (mins == null || mins < 0) return '--:--';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function _fmtTime(iso) {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (_e) {
    return '--:--';
  }
}

function _todayStr() {
  return new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
}

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

/**
 * Render the attendance page into a container.
 * Called from router when navigating to attendance team view.
 * @param {HTMLElement} container
 */
export function renderAttendancePage(container) {
  _container = container;

  container.innerHTML =
    '<div class="toolbar" id="attToolbar">' +
      '<div class="tb-title">Team</div>' +
      '<div class="stat-pills" id="statPills">' +
        '<div class="spill active" data-filter="all"><span class="spill-n" id="sAll">0</span></div>' +
        '<div class="spill" data-filter="in"><span class="spill-dot" style="background:var(--status-in)"></span><span class="spill-n" id="sIn">0</span></div>' +
        '<div class="spill" data-filter="break"><span class="spill-dot" style="background:var(--status-break)"></span><span class="spill-n" id="sBrk">0</span></div>' +
        '<div class="spill" data-filter="out"><span class="spill-dot" style="background:var(--status-out)"></span><span class="spill-n" id="sOut">0</span></div>' +
        '<div class="spill" data-filter="absent"><span class="spill-dot" style="background:var(--status-absent)"></span><span class="spill-n" id="sAbs">0</span></div>' +
      '</div>' +
      '<div class="tb-spacer"></div>' +
      '<input class="tb-search" id="teamSearch" placeholder="Search name, dept, email…">' +
      '<div class="col-toggle" id="colToggle">' +
        '<button class="ct-btn" data-cols="2">2</button>' +
        '<button class="ct-btn active" data-cols="3">3</button>' +
        '<button class="ct-btn" data-cols="4">4</button>' +
      '</div>' +
    '</div>' +
    '<div class="main-area">' +
      '<div class="grid-side">' +
        '<div class="egrid" id="empGrid"></div>' +
      '</div>' +
    '</div>';

  _bindEvents(container);
  attLoadData();
  _startAutoRefresh();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

/**
 * Load team attendance data from API.
 */
export async function attLoadData() {
  const grid = _container && _container.querySelector('#empGrid');
  if (grid && !_allPeople.length) {
    grid.innerHTML = _renderSkeletons(6);
  }

  const today = _todayStr();
  const data = await api.get('/api/attendance?date=' + today);

  if (!data || data._error) {
    if (!_allPeople.length) _loadMockPeople();
    return;
  }

  const records = data.people || data.records || data.attendance || data;
  if (Array.isArray(records)) {
    _allPeople = records.map(function (r) {
      return {
        email: r.email || '',
        name: r.name || r.email || '',
        dept: r.group || r.department || '',
        status: (r.status || 'off').toLowerCase(),
        clockIn: r.firstIn || r.clockIn || r.first_in || null,
        clockOut: r.lastOut || r.last_out || null,
        totalWorked: r.totalWorked || 0,
        totalBreak: r.totalBreak || 0,
        isLate: r.isLate || false,
        lateMinutes: r.lateMinutes || 0,
        events: r.timeline || r.events || [],
      };
    });
  }

  attRenderStats();
  attRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS RENDERING
   ══════════════════════════════════════════════════════════════ */

/**
 * Update stat pill counters.
 */
export function attRenderStats() {
  let cin = 0;
  let cbrk = 0;
  let cout = 0;
  let cabs = 0;

  _allPeople.forEach(function (p) {
    const s = p.status;
    if (s === 'in') cin++;
    else if (s === 'break') cbrk++;
    else if (s === 'out') cout++;
    else if (s === 'absent') cabs++;
  });

  _setText('sAll', _allPeople.length);
  _setText('sIn', cin);
  _setText('sBrk', cbrk);
  _setText('sOut', cout);
  _setText('sAbs', cabs);
}

/* ══════════════════════════════════════════════════════════════
   GRID RENDERING
   ══════════════════════════════════════════════════════════════ */

/**
 * Render employee cards into the grid, applying filter and search.
 */
export function attRender() {
  const grid = _container && _container.querySelector('#empGrid');
  if (!grid) return;

  const q = (_getVal('teamSearch') || '').toLowerCase().trim();
  let list = _allPeople.slice();

  if (_gridFilter !== 'all') {
    list = list.filter(function (p) {
      return p.status === _gridFilter;
    });
  }
  if (q) {
    list = list.filter(function (p) {
      return (
        (p.name || '').toLowerCase().indexOf(q) >= 0 ||
        (p.dept || '').toLowerCase().indexOf(q) >= 0 ||
        (p.email || '').toLowerCase().indexOf(q) >= 0
      );
    });
  }

  const order = { in: 1, break: 2, out: 3, absent: 4, off: 5 };
  list.sort(function (a, b) {
    return (order[a.status] || 9) - (order[b.status] || 9);
  });

  if (!list.length) {
    const hasFilters = q || _gridFilter !== 'all';
    grid.innerHTML =
      '<div class="grid-empty">' +
        '<div class="grid-empty-icon">&#128101;</div>' +
        '<div class="grid-empty-text">' +
          (hasFilters ? 'No matches found' : 'No team data yet') +
        '</div>' +
        '<div class="grid-empty-sub">' +
          (q ? 'Try a different search' : 'Employees will appear when they clock in') +
        '</div>' +
      '</div>';
    return;
  }

  const t = getTheme();
  grid.innerHTML = list
    .map(function (p, i) {
      const sc = 's-' + (p.status || 'off');
      const label =
        t === 'clean'
          ? { in: 'Active', break: 'On Break', out: 'Offline', off: 'Offline', absent: 'Absent' }[p.status] || 'Offline'
          : { in: 'ONLINE', break: 'BREAK', out: 'OFF', off: 'OFF', absent: 'ABSENT' }[p.status] || 'OFF';
      let dur = '';
      if (p.clockIn) {
        const mins = Math.floor((Date.now() - new Date(p.clockIn).getTime()) / 60000);
        if (mins >= 0) dur = _fmtDur(mins);
      }
      return (
        '<div class="ec ' + sc + '" style="animation-delay:' + i * 0.03 + 's" data-email="' + _esc(p.email) + '">' +
          '<div class="ec-i">' +
            '<div class="av"><span class="av-i">' + _ini(p.name) + '</span></div>' +
            '<div class="ei">' +
              '<div class="en">' + _esc(p.name) + '</div>' +
              '<div class="es">' + _esc(p.dept || '—') + '</div>' +
            '</div>' +
            '<div class="er">' +
              '<div class="sb st-' + (p.status || 'off') + '">' + label + '</div>' +
              (dur ? '<div class="tmr mf">' + dur + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>'
      );
    })
    .join('');
}

/* ══════════════════════════════════════════════════════════════
   DETAIL VIEWS
   ══════════════════════════════════════════════════════════════ */

/**
 * Open detail view for an employee by email.
 * Delegates to shared/modal.js which handles theme-appropriate pattern.
 * @param {string} email
 */
export function attOpenDetail(email) {
  const person = _allPeople.find(function (p) {
    return p.email === email;
  });
  if (!person) return;

  _detailEmail = email;
  const html = _buildDetailHTML(person);
  openDetail(html, { email: email });
}

/**
 * Close the attendance detail view.
 */
export function attCloseModal() {
  _detailEmail = '';
  closeDetail();
}

/**
 * Build the detail view HTML for a person.
 * @param {object} person
 * @returns {string}
 */
function _buildDetailHTML(person) {
  const s = person.status || 'off';
  const label =
    { in: 'Clocked In', break: 'On Break', out: 'Clocked Out', off: 'Offline', absent: 'Absent' }[s] || 'Offline';
  let dur = '';
  if (person.clockIn) {
    const mins = Math.floor((Date.now() - new Date(person.clockIn).getTime()) / 60000);
    if (mins >= 0) dur = _fmtDur(mins);
  }

  let h = '';
  h +=
    '<div class="detail-hdr">' +
      '<div class="detail-av"><span>' + _ini(person.name) + '</span></div>' +
      '<div>' +
        '<div class="detail-name">' + _esc(person.name) + '</div>' +
        '<div class="detail-dept">' + _esc(person.dept || '—') + '</div>' +
      '</div>' +
      '<button class="detail-close" data-action="close-detail">&#10005;</button>' +
    '</div>';

  h +=
    '<div class="detail-tabs">' +
      '<button class="detail-tab active" data-dtab="attendance">Attendance</button>' +
      '<button class="detail-tab" data-dtab="profile">Profile</button>' +
    '</div>';

  h += '<div class="detail-body">';

  /* Current Status section */
  h +=
    '<div class="d-section">' +
      '<div class="d-section-title">Current Status</div>' +
      '<div class="d-row">' +
        '<span class="d-row-l">Status</span>' +
        '<span class="d-row-v"><span class="sb st-' + s + '">' + label + '</span></span>' +
      '</div>';
  if (dur) {
    h +=
      '<div class="d-row">' +
        '<span class="d-row-l">Duration</span>' +
        '<span class="d-row-v mf">' + dur + '</span>' +
      '</div>';
  }
  if (person.clockIn) {
    h +=
      '<div class="d-row">' +
        '<span class="d-row-l">Clocked In</span>' +
        '<span class="d-row-v mf">' + _fmtTime(person.clockIn) + '</span>' +
      '</div>';
  }
  h += '</div>';

  /* Today's Events section */
  h += '<div class="d-section"><div class="d-section-title">Today\'s Events</div>';
  if (person.events && person.events.length) {
    h += '<div class="d-tl">';
    person.events.forEach(function (ev) {
      const cls =
        ev.type === 'clock_in'
          ? 'ev-in'
          : ev.type === 'break_start' || ev.type === 'break_end'
          ? 'ev-break'
          : 'ev-out';
      h +=
        '<div class="d-tl-item ' + cls + '">' +
          '<span class="d-tl-time mf">' + _fmtTime(ev.time || ev.timestamp) + '</span>' +
          _esc(ev.label || ev.type || 'Event') +
        '</div>';
    });
    h += '</div>';
  } else {
    h += '<div style="font-size:11px;color:var(--tx3);padding:4px 0">No events recorded today</div>';
  }
  h += '</div>';

  h += '</div>'; /* close detail-body */
  return h;
}

/* ══════════════════════════════════════════════════════════════
   MOCK DATA
   ══════════════════════════════════════════════════════════════ */

function _loadMockPeople() {
  _allPeople = [
    { email: 'arif@blokhr.com', name: 'Arif Alwi', dept: 'Engineering', status: 'in', clockIn: '2026-03-24T09:00:00', events: [] },
    { email: 'priya@blokhr.com', name: 'Priya Sharma', dept: 'Design', status: 'in', clockIn: '2026-03-24T09:15:00', events: [] },
    { email: 'james@blokhr.com', name: 'James Wilson', dept: 'Engineering', status: 'break', clockIn: '2026-03-24T08:30:00', events: [] },
    { email: 'sarah@blokhr.com', name: 'Sarah Chen', dept: 'Product', status: 'in', clockIn: '2026-03-24T08:45:00', events: [] },
    { email: 'omar@blokhr.com', name: 'Omar Hassan', dept: 'QA', status: 'out', clockIn: null, events: [] },
    { email: 'maya@blokhr.com', name: 'Maya Patel', dept: 'HR', status: 'in', clockIn: '2026-03-24T09:30:00', events: [] },
    { email: 'dev@blokhr.com', name: 'Dev Krishnan', dept: 'Engineering', status: 'break', clockIn: '2026-03-24T08:00:00', events: [] },
    { email: 'lisa@blokhr.com', name: 'Lisa Park', dept: 'Marketing', status: 'absent', clockIn: null, events: [] },
    { email: 'alex@blokhr.com', name: 'Alex Turner', dept: 'Sales', status: 'in', clockIn: '2026-03-24T09:05:00', events: [] },
    { email: 'nina@blokhr.com', name: 'Nina Rossi', dept: 'Design', status: 'out', clockIn: null, events: [] },
    { email: 'raj@blokhr.com', name: 'Raj Mehta', dept: 'Finance', status: 'in', clockIn: '2026-03-24T08:50:00', events: [] },
    { email: 'emma@blokhr.com', name: 'Emma Davis', dept: 'Support', status: 'absent', clockIn: null, events: [] },
  ];
  attRenderStats();
  attRender();
}

/* ══════════════════════════════════════════════════════════════
   SKELETON LOADERS
   ══════════════════════════════════════════════════════════════ */

function _renderSkeletons(n) {
  let h = '';
  for (let i = 0; i < n; i++) {
    h +=
      '<div class="skel" style="animation-delay:' + i * 0.05 + 's">' +
        '<div style="display:flex;gap:12px;align-items:center">' +
          '<div class="skel-av"></div>' +
          '<div style="flex:1">' +
            '<div class="skel-bar w60"></div>' +
            '<div class="skel-bar w40"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  return h;
}

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindEvents(container) {
  /* Stat pill filtering */
  const pills = container.querySelector('#statPills');
  if (pills) {
    pills.addEventListener('click', function (e) {
      const pill = e.target.closest('.spill');
      if (!pill || !pill.dataset.filter) return;
      _gridFilter = pill.dataset.filter;
      pills.querySelectorAll('.spill').forEach(function (s) {
        s.classList.toggle('active', s.dataset.filter === _gridFilter);
      });
      attRender();
    });
  }

  /* Search input */
  const search = container.querySelector('#teamSearch');
  if (search) {
    search.addEventListener('input', function () {
      attRender();
    });
  }

  /* Column toggle */
  const colToggle = container.querySelector('#colToggle');
  if (colToggle) {
    colToggle.addEventListener('click', function (e) {
      const btn = e.target.closest('.ct-btn');
      if (!btn || !btn.dataset.cols) return;
      colToggle.querySelectorAll('.ct-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      document.documentElement.style.setProperty('--cols', btn.dataset.cols);
    });
  }

  /* Card clicks → open detail */
  const grid = container.querySelector('#empGrid');
  if (grid) {
    grid.addEventListener('click', function (e) {
      const card = e.target.closest('.ec');
      if (!card || !card.dataset.email) return;
      attOpenDetail(card.dataset.email);
    });
  }

  /* Detail tab switching (delegated) */
  container.addEventListener('click', function (e) {
    const tab = e.target.closest('.detail-tab');
    if (!tab) return;
    const parent = tab.closest('.detail-tabs') || tab.parentElement;
    if (parent) {
      parent.querySelectorAll('.detail-tab').forEach(function (t) {
        t.classList.toggle('active', t === tab);
      });
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   SSE INTEGRATION
   ══════════════════════════════════════════════════════════════ */

onSSE('attendance-update', function (data) {
  if (!data || !data.email) return;
  let found = false;
  _allPeople.forEach(function (p) {
    if (p.email === data.email) {
      p.status = data.status || p.status;
      p.clockIn = data.clockIn || p.clockIn;
      found = true;
    }
  });
  if (!found) {
    _allPeople.push({
      email: data.email,
      name: data.name || data.email,
      dept: data.department || '',
      status: data.status || 'in',
      clockIn: data.clockIn || null,
      events: [],
    });
  }
  attRenderStats();
  attRender();
});

/* ══════════════════════════════════════════════════════════════
   AUTO-REFRESH
   ══════════════════════════════════════════════════════════════ */

function _startAutoRefresh() {
  _stopAutoRefresh();
  _gridRefreshTimer = setInterval(function () {
    attLoadData();
  }, 60000);
}

function _stopAutoRefresh() {
  if (_gridRefreshTimer) {
    clearInterval(_gridRefreshTimer);
    _gridRefreshTimer = null;
  }
}

/* ══════════════════════════════════════════════════════════════
   DOM HELPERS
   ══════════════════════════════════════════════════════════════ */

function _setText(id, value) {
  const el = _container && _container.querySelector('#' + id);
  if (el) el.textContent = String(value);
}

function _getVal(id) {
  const el = _container && _container.querySelector('#' + id);
  return el ? el.value : '';
}

/* ══════════════════════════════════════════════════════════════
   TEST HELPERS (exported for test access)
   ══════════════════════════════════════════════════════════════ */

/**
 * Get the current grid data for testing.
 * @returns {Array}
 */
export function _getTeamData() {
  return _allPeople;
}

/**
 * Set team data directly for testing.
 * @param {Array} people
 */
export function _setTeamData(people) {
  _allPeople = people;
}

/**
 * Get current filter for testing.
 * @returns {string}
 */
export function _getFilter() {
  return _gridFilter;
}

/**
 * Reset module state for testing.
 */
export function _resetState() {
  _allPeople = [];
  _gridFilter = 'all';
  _detailEmail = '';
  _container = null;
  _stopAutoRefresh();
}

/* ── Register with router ── */
registerModule('attendance', renderAttendancePage);

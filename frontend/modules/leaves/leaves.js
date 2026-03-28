/**
 * modules/leaves/leaves.js
 *
 * Leave applications: CRUD, balance cards, 3-tab system
 * (My Leaves / Team Approvals / All Leaves), approve/reject/cancel.
 *
 * Pattern: renderLeavesPage() → lvLoadData() → lvRenderStats()
 *          → lvRender() → CRUD → lvCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

/* ── Module state ── */
let _container = null;
let _lvTab = 'my';
let _lvList = [];
let _lvBalances = [];
let _lvSearch = '';

/* ── Mock data ── */
const _mockBalances = [
  { type: 'Annual', total: 18, used: 6, remaining: 12, color: 'var(--status-in)' },
  { type: 'Sick', total: 12, used: 2, remaining: 10, color: 'var(--status-absent)' },
  { type: 'Casual', total: 7, used: 2, remaining: 5, color: 'var(--status-break)' },
  { type: 'Comp Off', total: 3, used: 1, remaining: 2, color: 'var(--accent)' },
];

const _mockList = [
  { id: 'lv1', email: 'test@co.com', name: 'Test User', type: 'Annual', startDate: '2026-04-07', endDate: '2026-04-11', days: 5, status: 'pending', reason: 'Family vacation', appliedOn: '2026-03-24', halfDay: false },
  { id: 'lv2', email: 'bob@co.com', name: 'Bob Builder', type: 'Annual', startDate: '2026-03-28', endDate: '2026-03-30', days: 3, status: 'pending', reason: 'Personal travel', appliedOn: '2026-03-22', halfDay: false },
  { id: 'lv3', email: 'sarah@co.com', name: 'Sarah Chen', type: 'Sick', startDate: '2026-03-20', endDate: '2026-03-20', days: 1, status: 'approved', reason: 'Doctor visit', appliedOn: '2026-03-20', approvedByName: 'Admin', halfDay: false },
  { id: 'lv4', email: 'omar@co.com', name: 'Omar Hassan', type: 'Casual', startDate: '2026-03-18', endDate: '2026-03-18', days: 0.5, status: 'approved', reason: 'Passport renewal', appliedOn: '2026-03-17', approvedByName: 'Admin', halfDay: true },
  { id: 'lv5', email: 'priya@co.com', name: 'Priya Sharma', type: 'Annual', startDate: '2026-03-10', endDate: '2026-03-14', days: 5, status: 'rejected', reason: 'Team outing', appliedOn: '2026-03-05', rejectionReason: 'Overlaps with sprint demo week', halfDay: false },
];

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

/**
 * Render the leaves page.
 * @param {HTMLElement} container
 */
export function renderLeavesPage(container) {
  _container = container;

  container.innerHTML =
    '<div class="lv-wrap" id="lvWrap">' +
      '<div class="lv-toolbar">' +
        '<div class="lv-tabs" id="lvTabs">' +
          '<button class="lv-tab active" data-lvt="my">My Leaves</button>' +
          '<button class="lv-tab" data-lvt="team">Team Approvals</button>' +
          '<button class="lv-tab" data-lvt="all">All Leaves</button>' +
        '</div>' +
        '<input class="lv-search" id="lvSearch" placeholder="Search leaves…" autocomplete="off">' +
        '<div class="lv-spacer"></div>' +
        '<button class="lv-btn" id="lvApplyBtn">+ Apply Leave</button>' +
      '</div>' +
      '<div id="lvBalances"></div>' +
      '<div id="lvContent"></div>' +
      '<div class="lv-modal" id="lvModal"><div class="lv-modal-box" id="lvModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  lvLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function lvLoadData() {
  const [leavesData, balancesData] = await Promise.all([
    api.get('/api/leaves'),
    api.get('/api/leaves/balances'),
  ]);

  _lvList = (leavesData && !leavesData._error)
    ? (leavesData.leaves || leavesData || [])
    : _mockList;
  _lvBalances = (balancesData && !balancesData._error)
    ? (balancesData.balances || balancesData || [])
    : _mockBalances;

  if (!Array.isArray(_lvList)) _lvList = _mockList;
  if (!Array.isArray(_lvBalances)) _lvBalances = _mockBalances;

  lvRenderStats();
  lvRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS (balance cards)
   ══════════════════════════════════════════════════════════════ */

export function lvRenderStats() {
  const el = _container && _container.querySelector('#lvBalances');
  if (!el) return;

  let html = '<div class="lv-balances">';
  _lvBalances.forEach(function (b) {
    const pct = b.total ? Math.round(b.used / b.total * 100) : 0;
    html +=
      '<div class="lv-bal">' +
        '<div class="lv-bal-type">' + _esc(b.type) + '</div>' +
        '<div class="lv-bal-num" style="color:' + (b.color || 'var(--accent)') + '">' + (b.remaining != null ? b.remaining : b.total - b.used) + '</div>' +
        '<div class="lv-bal-of">of ' + b.total + ' remaining (' + b.used + ' used)</div>' +
        '<div class="lv-bal-bar"><div class="lv-bal-fill" style="width:' + pct + '%;background:' + (b.color || 'var(--accent)') + '"></div></div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   RENDER LEAVE CARDS
   ══════════════════════════════════════════════════════════════ */

export function lvRender() {
  const el = _container && _container.querySelector('#lvContent');
  if (!el) return;

  const session = getSession();
  const email = (session && session.email) || '';
  let items = _lvList;

  /* Tab filtering */
  if (_lvTab === 'my') {
    items = items.filter(function (l) { return l.email === email || !email; });
  } else if (_lvTab === 'team') {
    items = items.filter(function (l) { return l.status === 'pending'; });
  }

  /* Search filtering */
  if (_lvSearch) {
    items = items.filter(function (l) {
      return (l.name || '').toLowerCase().indexOf(_lvSearch) >= 0 ||
        (l.type || '').toLowerCase().indexOf(_lvSearch) >= 0 ||
        (l.reason || '').toLowerCase().indexOf(_lvSearch) >= 0 ||
        (l.status || '').indexOf(_lvSearch) >= 0;
    });
  }

  /* Toggle balance/apply visibility */
  const balEl = _container.querySelector('#lvBalances');
  const applyBtn = _container.querySelector('#lvApplyBtn');
  if (balEl) balEl.style.display = _lvTab === 'my' ? '' : 'none';
  if (applyBtn) applyBtn.style.display = _lvTab === 'my' ? '' : 'none';

  if (!items.length) {
    el.innerHTML =
      '<div class="lv-empty">' +
        '<div class="lv-empty-icon">&#127796;</div>' +
        '<div class="lv-empty-text">No leave applications' + (_lvSearch ? ' match' : '') + '</div>' +
      '</div>';
    return;
  }

  const showName = _lvTab !== 'my';
  let html = '<div class="lv-grid">';

  items.forEach(function (l, i) {
    html += '<div class="lv-card" style="animation-delay:' + i * 0.04 + 's">';

    /* Header */
    html += '<div class="lv-card-hdr">';
    if (showName) html += '<div class="lv-card-av">' + _ini(l.name) + '</div>';
    html += '<div style="flex:1;min-width:0"><div class="lv-card-name">' +
      (showName ? _esc(l.name) : _esc(l.type) + ' Leave') + '</div>';
    html += '<div class="lv-card-type">' +
      (showName ? _esc(l.type) + ' &middot; ' : '') + 'Applied ' + _esc(l.appliedOn || '') + '</div></div>';
    html += '<span class="lv-card-badge ' + _esc(l.status) + '">' + _esc(l.status) + '</span>';
    html += '</div>';

    /* Dates + days */
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<div class="lv-card-dates" style="flex:1">' + _esc(l.startDate) +
      ' <span class="lv-arrow">\u2192</span> ' + _esc(l.endDate) +
      (l.halfDay ? ' (Half Day)' : '') + '</div>';
    html += '<div class="lv-card-days">' + l.days + '<span>day' + (l.days !== 1 ? 's' : '') + '</span></div>';
    html += '</div>';

    /* Reason */
    if (l.reason) html += '<div class="lv-card-reason">' + _esc(l.reason) + '</div>';

    /* Metadata */
    if (l.approvedByName) html += '<div class="lv-card-meta positive">Approved by ' + _esc(l.approvedByName) + '</div>';
    if (l.rejectionReason) html += '<div class="lv-card-meta negative">Rejected: ' + _esc(l.rejectionReason) + '</div>';

    /* Actions */
    html += '<div class="lv-card-actions">';
    if (l.status === 'pending' && _lvTab === 'team') {
      html += '<button class="approve" data-lv-action="approve" data-lv-id="' + _esc(l.id) + '">&#10003; Approve</button>';
      html += '<button class="danger" data-lv-action="reject" data-lv-id="' + _esc(l.id) + '">&#10005; Reject</button>';
    }
    if (l.status === 'pending' && _lvTab === 'my') {
      html += '<button class="danger" data-lv-action="cancel" data-lv-id="' + _esc(l.id) + '">Cancel</button>';
    }
    html += '</div></div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   CRUD ACTIONS
   ══════════════════════════════════════════════════════════════ */

export async function lvApprove(id) {
  const result = await api.post('/api/leaves/' + id + '/approve', {});
  if (result && !result._error) {
    toast('Leave approved', 'success');
    lvLoadData();
    return;
  }
  /* Mock fallback */
  const l = _lvList.find(function (x) { return x.id === id; });
  if (l) {
    const s = getSession();
    l.status = 'approved';
    l.approvedByName = (s && s.name) || 'Admin';
  }
  toast('Approved (demo)', 'success');
  lvRender();
}

export async function lvReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;

  const result = await api.post('/api/leaves/' + id + '/reject', { reason: reason });
  if (result && !result._error) {
    toast('Leave rejected', 'success');
    lvLoadData();
    return;
  }
  /* Mock fallback */
  const l = _lvList.find(function (x) { return x.id === id; });
  if (l) { l.status = 'rejected'; l.rejectionReason = reason; }
  toast('Rejected (demo)', 'success');
  lvRender();
}

export async function lvCancel(id) {
  if (!confirm('Cancel this leave application?')) return;

  const result = await api.post('/api/leaves/' + id + '/cancel', {});
  if (result && !result._error) {
    toast('Leave cancelled', 'success');
    lvLoadData();
    return;
  }
  const l = _lvList.find(function (x) { return x.id === id; });
  if (l) l.status = 'cancelled';
  toast('Cancelled (demo)', 'success');
  lvRender();
}

/* ══════════════════════════════════════════════════════════════
   APPLY / EDIT FORM
   ══════════════════════════════════════════════════════════════ */

export function lvShowForm(lv) {
  const isEdit = !!lv;
  const typeOpts = _lvBalances.map(function (b) {
    return '<option value="' + _esc(b.type) + '"' +
      (lv && lv.type === b.type ? ' selected' : '') + '>' +
      _esc(b.type) + ' (' + (b.remaining != null ? b.remaining : b.total - b.used) + ' remaining)</option>';
  }).join('');

  const box = _container && _container.querySelector('#lvModalBox');
  if (!box) return;

  box.innerHTML =
    '<div class="lv-modal-title">' + (isEdit ? 'Edit' : 'Apply for') + ' Leave</div>' +
    '<div class="lv-field"><label>Leave Type *</label><select id="lvType"><option value="">\u2014</option>' + typeOpts + '</select></div>' +
    '<div style="display:flex;gap:8px">' +
      '<div class="lv-field" style="flex:1"><label>Start Date *</label><input type="date" id="lvStart" value="' + _esc((lv && lv.startDate) || '') + '"></div>' +
      '<div class="lv-field" style="flex:1"><label>End Date *</label><input type="date" id="lvEnd" value="' + _esc((lv && lv.endDate) || '') + '"></div>' +
    '</div>' +
    '<div class="lv-field"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="lvHalf"' + (lv && lv.halfDay ? ' checked' : '') + ' style="width:auto"> Half Day</label></div>' +
    '<div class="lv-field"><label>Reason *</label><textarea id="lvReason" style="min-height:50px">' + _esc((lv && lv.reason) || '') + '</textarea></div>' +
    '<div class="lv-days-calc" id="lvDaysCalc"></div>' +
    '<div class="lv-form-actions"><button class="lv-btn ghost" data-lv-action="close-modal">Cancel</button><button class="lv-btn" id="lvSaveBtn">' + (isEdit ? 'Update' : 'Submit') + '</button></div>';

  const modal = _container.querySelector('#lvModal');
  if (modal) modal.classList.add('open');

  /* Days calculator */
  function calcDays() {
    const s = box.querySelector('#lvStart').value;
    const e = box.querySelector('#lvEnd').value;
    const half = box.querySelector('#lvHalf').checked;
    const calc = box.querySelector('#lvDaysCalc');
    if (s && e) {
      let diff = Math.round((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000) + 1;
      if (diff < 1) diff = 1;
      if (half) diff = 0.5;
      if (calc) calc.textContent = diff + ' day' + (diff !== 1 ? 's' : '') + ' leave';
    } else if (calc) {
      calc.textContent = '';
    }
  }
  box.querySelector('#lvStart').addEventListener('change', calcDays);
  box.querySelector('#lvEnd').addEventListener('change', calcDays);
  box.querySelector('#lvHalf').addEventListener('change', calcDays);
  calcDays();

  /* Save handler */
  box.querySelector('#lvSaveBtn').addEventListener('click', function () {
    _saveLeave(lv, isEdit);
  });
}

async function _saveLeave(lv, isEdit) {
  const box = _container && _container.querySelector('#lvModalBox');
  if (!box) return;

  const type = box.querySelector('#lvType').value;
  const start = box.querySelector('#lvStart').value;
  const end = box.querySelector('#lvEnd').value;
  const reason = (box.querySelector('#lvReason').value || '').trim();

  if (!type) { toast('Select a leave type', 'error'); return; }
  if (!start || !end) { toast('Start and end dates are required', 'error'); return; }
  if (!reason) { toast('Reason is required', 'error'); return; }

  const halfDay = box.querySelector('#lvHalf').checked;
  let days = halfDay ? 0.5 : Math.round((new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 86400000) + 1;
  if (days < 0.5) days = 0.5;

  const session = getSession() || {};
  const body = {
    type: type, startDate: start, endDate: end, days: days,
    halfDay: halfDay, reason: reason, status: 'pending',
    email: session.email || '', name: session.name || 'User',
    appliedOn: new Date().toISOString().split('T')[0],
  };

  const method = isEdit ? 'PUT' : 'POST';
  const path = isEdit ? '/api/leaves/' + lv.id : '/api/leaves';

  const result = isEdit
    ? await api.put(path, body)
    : await api.post(path, body);

  if (result && !result._error) {
    toast('Leave ' + (isEdit ? 'updated' : 'submitted'), 'success');
    lvCloseModal();
    lvLoadData();
    return;
  }

  /* Mock fallback */
  if (isEdit) {
    const idx = _lvList.findIndex(function (x) { return x.id === lv.id; });
    if (idx >= 0) Object.assign(_lvList[idx], body);
  } else {
    body.id = 'lv' + Date.now();
    _lvList.unshift(body);
  }
  toast('Leave ' + (isEdit ? 'updated' : 'submitted') + ' (demo)', 'success');
  lvCloseModal();
  lvRender();
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════════════════════ */

export function lvCloseModal() {
  const modal = _container && _container.querySelector('#lvModal');
  if (modal) modal.classList.remove('open');
}

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindEvents(container) {
  /* Tab switching */
  const tabs = container.querySelector('#lvTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.lv-tab');
      if (!tab || !tab.dataset.lvt) return;
      _lvTab = tab.dataset.lvt;
      tabs.querySelectorAll('.lv-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.lvt === _lvTab);
      });
      lvRender();
    });
  }

  /* Search */
  const search = container.querySelector('#lvSearch');
  if (search) {
    search.addEventListener('input', function () {
      _lvSearch = this.value.toLowerCase();
      lvRender();
    });
  }

  /* Apply button */
  const applyBtn = container.querySelector('#lvApplyBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function () {
      lvShowForm(null);
    });
  }

  /* Modal backdrop close */
  const modal = container.querySelector('#lvModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) lvCloseModal();
    });
  }

  /* Delegated card action clicks */
  const content = container.querySelector('#lvContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-lv-action]');
      if (!btn) return;
      const action = btn.dataset.lvAction;
      const id = btn.dataset.lvId;
      if (action === 'approve') lvApprove(id);
      else if (action === 'reject') lvReject(id);
      else if (action === 'cancel') lvCancel(id);
    });
  }

  /* Delegated close-modal from form */
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-lv-action="close-modal"]');
    if (btn) lvCloseModal();
  });
}

/* ══════════════════════════════════════════════════════════════
   UTILITY
   ══════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════
   TEST HELPERS
   ══════════════════════════════════════════════════════════════ */

export function _getLeaves() { return _lvList; }
export function _setLeaves(list) { _lvList = list; }
export function _getBalances() { return _lvBalances; }
export function _setBalances(list) { _lvBalances = list; }
export function _getTab() { return _lvTab; }

export function _resetState() {
  _container = null;
  _lvTab = 'my';
  _lvList = [];
  _lvBalances = [];
  _lvSearch = '';
}

/* ── Register with router ── */
registerModule('leaves', renderLeavesPage);

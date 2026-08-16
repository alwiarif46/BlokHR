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
  const session = getSession();
  const email = (session && session.email) || '';
  const q = email ? '?email=' + encodeURIComponent(email) : '';

  const [leavesData, balancesData, policiesData, typesData] = await Promise.all([
    email ? api.get('/api/leaves' + q) : Promise.resolve({ leaves: [] }),
    email ? api.get('/api/leaves/balances' + q) : Promise.resolve({ balances: [] }),
    api.get('/api/leave-policies'),
    api.get('/api/leave-types'),
  ]);

  _lvList = (leavesData && !leavesData._error)
    ? (leavesData.leaves || leavesData || [])
    : [];
  if (!Array.isArray(_lvList)) _lvList = [];
  _lvList = _lvList.map(_normalizeLeave);

  const fromBalances = (balancesData && !balancesData._error)
    ? (balancesData.balances || [])
    : [];
  _lvBalances = _mergeLeaveTypeOptions(fromBalances, policiesData, typesData);

  if (!Array.isArray(_lvBalances)) _lvBalances = [];

  if (leavesData && leavesData._error) {
    toast(leavesData.message || 'Could not load leaves', 'error');
  }
  if (balancesData && balancesData._error) {
    toast(balancesData.message || 'Could not load leave balances', 'error');
  }

  lvRenderStats();
  lvRender();
}

/**
 * Merge balance rows with configured leave policies/types so Apply Leave
 * always lists types admins created — even before accrual or if balances is empty.
 */
function _mergeLeaveTypeOptions(balances, policiesData, typesData) {
  const byType = Object.create(null);
  (Array.isArray(balances) ? balances : []).forEach(function (b) {
    if (!b || !b.type) return;
    byType[b.type] = Object.assign({}, b);
  });

  const policies = (policiesData && !policiesData._error && policiesData.policies) || [];
  if (Array.isArray(policies)) {
    policies.forEach(function (p) {
      if (!p || p.active === false) return;
      const type = p.leaveType || p.leave_type;
      if (!type) return;
      const unlimited = p.method === 'unlimited';
      if (!byType[type]) {
        byType[type] = {
          type: type,
          total: unlimited ? null : 0,
          used: 0,
          remaining: unlimited ? null : 0,
          unlimited: unlimited,
        };
      } else if (unlimited) {
        byType[type].unlimited = true;
        byType[type].total = null;
        byType[type].remaining = null;
      }
    });
  }

  const types = (typesData && !typesData._error && typesData.types) || [];
  if (Array.isArray(types)) {
    types.forEach(function (t) {
      if (!t || byType[t]) return;
      byType[t] = { type: t, total: 0, used: 0, remaining: 0, unlimited: false };
    });
  }

  return Object.keys(byType).sort().map(function (k) { return byType[k]; });
}

/** Map API leave_request rows to the UI card shape. */
function _normalizeLeave(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const status = raw.status || '';
  const statusKey = String(status).toLowerCase();
  return {
    id: raw.id,
    email: raw.email || raw.person_email || '',
    name: raw.name || raw.person_name || '',
    type: raw.type || raw.leave_type || '',
    startDate: raw.startDate || raw.start_date || '',
    endDate: raw.endDate || raw.end_date || '',
    days: raw.days != null ? raw.days : raw.days_requested,
    halfDay: !!(raw.halfDay || raw.kind === 'FirstHalf' || raw.kind === 'SecondHalf'),
    reason: raw.reason || '',
    status: status,
    statusKey: statusKey,
    appliedOn: raw.appliedOn || (raw.created_at ? String(raw.created_at).slice(0, 10) : ''),
    approvedByName: raw.approvedByName || raw.manager_approver_email || raw.hr_approver_email || '',
    rejectionReason: raw.rejectionReason || raw.rejection_reason || '',
  };
}

/* ══════════════════════════════════════════════════════════════
   STATS (balance cards)
   ══════════════════════════════════════════════════════════════ */

export function lvRenderStats() {
  const el = _container && _container.querySelector('#lvBalances');
  if (!el) return;

  if (!_lvBalances.length) {
    el.innerHTML =
      '<div class="lv-empty" style="padding:12px 0">' +
        '<div class="lv-empty-text" style="font-size:12px">No leave types configured</div>' +
        '<div class="lv-empty-text" style="font-size:11px;opacity:0.7;margin-top:4px">In Settings → Leave Configuration, use <b>Leave policies → + Add leave type</b> (saving the toggles alone does not create types). Then refresh this page.</div>' +
      '</div>';
    return;
  }

  let html = '<div class="lv-balances">';
  _lvBalances.forEach(function (b) {
    const unlimited = !!b.unlimited;
    const remaining = unlimited
      ? '∞'
      : (b.remaining != null ? b.remaining : (b.total || 0) - (b.used || 0));
    const pct = !unlimited && b.total ? Math.round((b.used || 0) / b.total * 100) : 0;
    html +=
      '<div class="lv-bal">' +
        '<div class="lv-bal-type">' + _esc(b.type) + '</div>' +
        '<div class="lv-bal-num" style="color:' + (b.color || 'var(--accent)') + '">' + remaining + '</div>' +
        '<div class="lv-bal-of">' +
          (unlimited
            ? 'Unlimited' + ((b.used || 0) ? ' (' + b.used + ' used)' : '')
            : 'of ' + (b.total != null ? b.total : 0) + ' remaining (' + (b.used || 0) + ' used)') +
        '</div>' +
        (unlimited
          ? ''
          : '<div class="lv-bal-bar"><div class="lv-bal-fill" style="width:' + pct + '%;background:' + (b.color || 'var(--accent)') + '"></div></div>') +
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
    items = items.filter(function (l) {
      return !email || (l.email || '').toLowerCase() === email.toLowerCase();
    });
  } else if (_lvTab === 'team') {
    items = items.filter(function (l) {
      return (l.statusKey || String(l.status || '').toLowerCase()) === 'pending';
    });
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
    html += '<span class="lv-card-badge ' + _esc((l.statusKey || l.status || '').replace(/\s+/g, '-')) + '">' + _esc(l.status) + '</span>';
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
    if ((l.statusKey === 'pending' || l.status === 'Pending') && _lvTab === 'team') {
      html += '<button class="approve" data-lv-action="approve" data-lv-id="' + _esc(l.id) + '">&#10003; Approve</button>';
      html += '<button class="danger" data-lv-action="reject" data-lv-id="' + _esc(l.id) + '">&#10005; Reject</button>';
    }
    if ((l.statusKey === 'pending' || l.status === 'Pending') && _lvTab === 'my') {
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
  const result = await api.post('/api/leave-approve', { leaveId: id });
  if (result && !result._error) {
    toast('Leave approved', 'success');
    lvLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function lvReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;

  const result = await api.post('/api/leave-reject', { leaveId: id, reason: reason });
  if (result && !result._error) {
    toast('Leave rejected', 'success');
    lvLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function lvCancel(id) {
  if (!confirm('Cancel this leave application?')) return;

  const session = getSession() || {};
  const result = await api.post('/api/leave-delete', {
    leaveId: id,
    cancelledBy: session.email || '',
  });
  if (result && !result._error) {
    toast('Leave cancelled', 'success');
    lvLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

/* ══════════════════════════════════════════════════════════════
   APPLY / EDIT FORM
   ══════════════════════════════════════════════════════════════ */

export function lvShowForm(lv) {
  const isEdit = !!lv;
  const typeOpts = _lvBalances.map(function (b) {
    let label = _esc(b.type);
    if (b.unlimited) {
      label += ' (unlimited)';
    } else {
      const rem = b.remaining != null ? b.remaining : ((b.total || 0) - (b.used || 0));
      label += ' (' + rem + ' remaining)';
    }
    return '<option value="' + _esc(b.type) + '"' +
      (lv && lv.type === b.type ? ' selected' : '') + '>' + label + '</option>';
  }).join('');

  const box = _container && _container.querySelector('#lvModalBox');
  if (!box) return;

  const typeField = _lvBalances.length
    ? '<div class="lv-field"><label>Leave Type *</label><select id="lvType"><option value="">\u2014</option>' + typeOpts + '</select></div>'
    : '<div class="lv-field"><label>Leave Type *</label><select id="lvType" disabled><option value="">No leave types configured</option></select>' +
      '<div style="font-size:11px;color:var(--tx3);margin-top:6px">Ask an admin to add leave policies in Settings, then use Accrue now if balances should be credited.</div></div>';

  box.innerHTML =
    '<div class="lv-modal-title">' + (isEdit ? 'Edit' : 'Apply for') + ' Leave</div>' +
    typeField +
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

  if (isEdit) {
    toast('Edit is not supported — cancel the leave and apply again', 'error');
    return;
  }

  const halfDay = box.querySelector('#lvHalf').checked;
  const saveBtn = box.querySelector('#lvSaveBtn');
  if (saveBtn) {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
  }

  const session = getSession() || {};
  const result = await api.post('/api/leave-submit', {
    personName: session.name || session.email || 'User',
    personEmail: session.email || '',
    leaveType: type,
    kind: halfDay ? 'FirstHalf' : 'FullDay',
    startDate: start,
    endDate: end,
    reason: reason,
  });

  if (saveBtn) saveBtn.disabled = false;

  if (result && !result._error) {
    toast('Leave submitted', 'success');
    lvCloseModal();
    lvLoadData();
    return;
  }

  toast((result && result.message) || 'Failed to submit leave', 'error');
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

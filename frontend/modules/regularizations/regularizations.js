/**
 * modules/regularizations/regularizations.js
 *
 * Attendance regularization requests: submit attendance corrections
 * (forgot clock-in, wrong time, etc.), 2-tier approve/reject flow.
 *
 * Pattern: renderRegularizationsPage() → regLoadData() → regRenderStats()
 *          → regRender() → regRenderPending() → CRUD → regCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

/* ── Module state ── */
let _container = null;
let _regTab = 'my';
/** @type {any[]} */
let _regMine = [];
/** @type {any[]} */
let _regPending = [];

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

export function renderRegularizationsPage(container) {
  _container = container;

  container.innerHTML =
    '<div class="reg-wrap" id="regWrap">' +
      '<div class="reg-toolbar">' +
        '<div class="reg-tabs" id="regTabs">' +
          '<button class="reg-tab active" data-regt="my">My Requests</button>' +
          '<button class="reg-tab" data-regt="pending">Pending Approval</button>' +
          '<button class="reg-tab" data-regt="all">All Requests</button>' +
        '</div>' +
        '<div class="reg-spacer"></div>' +
        '<button class="reg-btn" id="regSubmitBtn">+ Submit Request</button>' +
      '</div>' +
      '<div class="reg-stats" id="regStats"></div>' +
      '<div id="regContent"></div>' +
      '<div class="reg-modal" id="regModal"><div class="reg-modal-box" id="regModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  regLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function regLoadData() {
  const session = getSession();
  const email = (session && session.email) || '';
  const q = email ? '?email=' + encodeURIComponent(email) : '';

  const [mineRes, pendingRes] = await Promise.all([
    email ? api.get('/api/regularizations' + q) : Promise.resolve({ regularizations: [] }),
    api.get('/api/pending-actions-detail'),
  ]);

  if (mineRes && mineRes._error) {
    toast(mineRes.message || 'Could not load regularizations', 'error');
    _regMine = [];
  } else {
    const rows = (mineRes && (mineRes.regularizations || mineRes)) || [];
    _regMine = (Array.isArray(rows) ? rows : []).map(_normalizeReg);
  }

  if (pendingRes && pendingRes._error) {
    _regPending = [];
  } else {
    const rows = (pendingRes && pendingRes.regularizations) || [];
    _regPending = (Array.isArray(rows) ? rows : []).map(_normalizeReg);
  }

  regRenderStats();
  regRender();
}

/** Map API rows (snake_case or slim pending detail) to UI shape. */
function _normalizeReg(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const status = raw.status || '';
  const inTime = raw.inTime || raw.in_time || raw.correctedClockIn || '';
  const outTime = raw.outTime || raw.out_time || raw.correctedClockOut || '';
  return {
    id: raw.id,
    email: raw.email || '',
    name: raw.name || '',
    date: raw.date || '',
    correctionType: raw.correctionType || raw.correction_type || raw.type || '',
    status: status,
    statusKey: String(status).toLowerCase(),
    originalClockIn: raw.originalClockIn || '—',
    correctedClockIn: inTime || '—',
    originalClockOut: raw.originalClockOut || '—',
    correctedClockOut: outTime || '—',
    reason: raw.reason || '',
    submittedOn: raw.submittedOn || (raw.created_at ? String(raw.created_at).slice(0, 10) : ''),
    approvedByName:
      raw.approvedByName ||
      raw.hr_approver_email ||
      raw.manager_approver_email ||
      '',
    rejectionReason: raw.rejectionReason || raw.rejection_comments || '',
    tier: status === 'manager_approved' ? 2 : status === 'pending' ? 1 : null,
  };
}

function _mergedList() {
  const byId = Object.create(null);
  _regMine.forEach(function (r) {
    if (r && r.id) byId[r.id] = r;
  });
  _regPending.forEach(function (r) {
    if (r && r.id) byId[r.id] = r;
  });
  return Object.keys(byId).map(function (k) { return byId[k]; });
}

function _emailsMatch(a, b) {
  const x = (a || '').toLowerCase();
  const y = (b || '').toLowerCase();
  if (!x || !y) return !x && !y;
  if (x === y) return true;
  const lx = x.split('@')[0];
  const ly = y.split('@')[0];
  return !!lx && lx === ly;
}

function _itemsForTab() {
  const session = getSession();
  const email = (session && session.email) || '';

  if (_regTab === 'my') {
    return _regMine.filter(function (r) {
      return !email || _emailsMatch(r.email, email);
    });
  }
  if (_regTab === 'pending') {
    return _regPending.filter(function (r) {
      return r.statusKey === 'pending' || r.statusKey === 'manager_approved';
    });
  }
  return _mergedList();
}

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export function regRenderStats() {
  const el = _container && _container.querySelector('#regStats');
  if (!el) return;

  const source = _regTab === 'pending' ? _regPending : _regTab === 'all' ? _mergedList() : _regMine;
  let pending = 0, approved = 0, rejected = 0;
  source.forEach(function (r) {
    if (r.statusKey === 'pending' || r.statusKey === 'manager_approved') pending++;
    else if (r.statusKey === 'approved') approved++;
    else if (r.statusKey === 'rejected') rejected++;
  });

  el.innerHTML =
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-break)">' + pending + '</div><div class="reg-stat-label">Pending</div></div>' +
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-in)">' + approved + '</div><div class="reg-stat-label">Approved</div></div>' +
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-absent)">' + rejected + '</div><div class="reg-stat-label">Rejected</div></div>';
}

/* ══════════════════════════════════════════════════════════════
   RENDER CARDS
   ══════════════════════════════════════════════════════════════ */

export function regRender() {
  const el = _container && _container.querySelector('#regContent');
  if (!el) return;

  const items = _itemsForTab();

  const submitBtn = _container.querySelector('#regSubmitBtn');
  if (submitBtn) submitBtn.style.display = _regTab === 'my' ? '' : 'none';

  regRenderStats();

  if (!items.length) {
    el.innerHTML = '<div class="reg-empty"><div class="reg-empty-icon">&#128221;</div><div class="reg-empty-text">No regularization requests</div></div>';
    return;
  }

  const showName = _regTab !== 'my';
  let html = '<div class="reg-grid">';

  items.forEach(function (r, i) {
    const badgeClass = (r.statusKey || r.status || '').replace(/\s+/g, '_');
    html += '<div class="reg-card" style="animation-delay:' + i * 0.04 + 's">';
    html += '<div class="reg-card-hdr">';
    html += '<div><div class="reg-card-name">' + (showName ? _esc(r.name) : 'Correction for ' + _esc(r.date)) + '</div>';
    html += '<div class="reg-card-date">' + (showName ? _esc(r.date) + ' &middot; ' : '') + 'Submitted ' + _esc(r.submittedOn || '') + '</div></div>';
    html += '<span class="reg-card-badge ' + _esc(badgeClass) + '">' + _esc(r.status) + (r.tier ? ' (T' + r.tier + ')' : '') + '</span>';
    html += '</div>';

    html += '<div class="reg-card-body">';
    html += '<div class="reg-card-row"><span class="reg-card-row-label">Clock In</span><span class="reg-card-row-value">' + _esc(r.originalClockIn || '—') + ' → ' + _esc(r.correctedClockIn || '—') + '</span></div>';
    html += '<div class="reg-card-row"><span class="reg-card-row-label">Clock Out</span><span class="reg-card-row-value">' + _esc(r.originalClockOut || '—') + ' → ' + _esc(r.correctedClockOut || '—') + '</span></div>';
    html += '</div>';

    if (r.reason) html += '<div class="reg-card-reason">' + _esc(r.reason) + '</div>';
    if (r.approvedByName) html += '<div style="font-size:9px;color:var(--status-in);margin-top:4px">Approved by ' + _esc(r.approvedByName) + '</div>';
    if (r.rejectionReason) html += '<div style="font-size:9px;color:var(--status-absent);margin-top:4px">Rejected: ' + _esc(r.rejectionReason) + '</div>';

    html += '<div class="reg-card-actions">';
    if (_regTab === 'pending' && (r.statusKey === 'pending' || r.statusKey === 'manager_approved')) {
      const roleLabel = r.statusKey === 'pending' ? 'Manager approve' : 'HR approve';
      html += '<button class="approve" data-reg-action="approve" data-reg-id="' + _esc(r.id) + '" data-reg-status="' + _esc(r.status) + '">&#10003; ' + roleLabel + '</button>';
      html += '<button class="danger" data-reg-action="reject" data-reg-id="' + _esc(r.id) + '">&#10005; Reject</button>';
    }
    html += '</div></div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/** Alias for pattern consistency */
export function regRenderPending() {
  _regTab = 'pending';
  const tabs = _container && _container.querySelector('#regTabs');
  if (tabs) {
    tabs.querySelectorAll('.reg-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.regt === 'pending');
    });
  }
  regRender();
}

/* ══════════════════════════════════════════════════════════════
   CRUD
   ══════════════════════════════════════════════════════════════ */

export async function regApprove(id, statusHint) {
  const row =
    _regPending.find(function (r) { return r.id === id; }) ||
    _regMine.find(function (r) { return r.id === id; });
  const status = statusHint || (row && row.status) || 'pending';
  const role = status === 'manager_approved' ? 'hr' : 'manager';

  const result = await api.put('/api/regularizations/' + id + '/approve', { role: role });
  if (result && !result._error) {
    toast(role === 'manager' ? 'Manager approved' : 'HR approved', 'success');
    regLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function regReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;

  const result = await api.put('/api/regularizations/' + id + '/reject', { comments: reason });
  if (result && !result._error) {
    toast('Regularization rejected', 'success');
    regLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

/* ══════════════════════════════════════════════════════════════
   SUBMIT FORM
   ══════════════════════════════════════════════════════════════ */

export function regShowForm() {
  const box = _container && _container.querySelector('#regModalBox');
  if (!box) return;

  box.innerHTML =
    '<div class="reg-modal-title">Submit Regularization</div>' +
    '<div class="reg-field"><label>Date *</label><input type="date" id="regDate"></div>' +
    '<div style="display:flex;gap:8px">' +
      '<div class="reg-field" style="flex:1"><label>Corrected Clock In</label><input type="time" id="regClockIn"></div>' +
      '<div class="reg-field" style="flex:1"><label>Corrected Clock Out</label><input type="time" id="regClockOut"></div>' +
    '</div>' +
    '<div class="reg-field"><label>Reason *</label><textarea id="regReason" style="min-height:50px"></textarea></div>' +
    '<div class="reg-form-actions"><button class="reg-btn ghost" data-reg-action="close-modal">Cancel</button><button class="reg-btn" id="regSaveBtn">Submit</button></div>';

  const modal = _container.querySelector('#regModal');
  if (modal) modal.classList.add('open');

  box.querySelector('#regSaveBtn').addEventListener('click', function () { _saveReg(); });
}

async function _saveReg() {
  const box = _container && _container.querySelector('#regModalBox');
  if (!box) return;

  const date = box.querySelector('#regDate').value;
  const clockIn = box.querySelector('#regClockIn').value;
  const clockOut = box.querySelector('#regClockOut').value;
  const reason = (box.querySelector('#regReason').value || '').trim();

  if (!date) { toast('Date is required', 'error'); return; }
  if (!clockIn && !clockOut) { toast('At least one corrected time is required', 'error'); return; }
  if (!reason) { toast('Reason is required', 'error'); return; }

  let correctionType = 'both';
  if (clockIn && !clockOut) correctionType = 'clock-in';
  else if (!clockIn && clockOut) correctionType = 'clock-out';

  const session = getSession() || {};
  const saveBtn = box.querySelector('#regSaveBtn');
  if (saveBtn) {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
  }

  const body = {
    date: date,
    inTime: clockIn || '',
    outTime: clockOut || '',
    correctionType: correctionType,
    reason: reason,
    email: session.email || '',
    name: session.name || 'User',
  };

  const result = await api.post('/api/regularizations', body);
  if (saveBtn) saveBtn.disabled = false;

  if (result && !result._error) {
    toast('Regularization submitted', 'success');
    regCloseModal();
    regLoadData();
    return;
  }

  toast((result && result.message) || 'Failed', 'error');
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════════════════════ */

export function regCloseModal() {
  const modal = _container && _container.querySelector('#regModal');
  if (modal) modal.classList.remove('open');
}

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindEvents(container) {
  const tabs = container.querySelector('#regTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.reg-tab');
      if (!tab || !tab.dataset.regt) return;
      _regTab = tab.dataset.regt;
      tabs.querySelectorAll('.reg-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.regt === _regTab);
      });
      regRender();
    });
  }

  const submitBtn = container.querySelector('#regSubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () { regShowForm(); });
  }

  const modal = container.querySelector('#regModal');
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) regCloseModal(); });
  }

  const content = container.querySelector('#regContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-reg-action]');
      if (!btn) return;
      const action = btn.dataset.regAction;
      const id = btn.dataset.regId;
      if (action === 'approve') regApprove(id, btn.dataset.regStatus);
      else if (action === 'reject') regReject(id);
    });
  }

  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-reg-action="close-modal"]');
    if (btn) regCloseModal();
  });
}

/* ── Utility ── */
function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ── Test helpers ── */
export function _getRegs() { return _mergedList(); }
export function _setRegs(list) {
  _regMine = Array.isArray(list) ? list.map(_normalizeReg) : [];
  _regPending = [];
}
export function _getTab() { return _regTab; }
export function _getMine() { return _regMine; }
export function _getPending() { return _regPending; }

export function _resetState() {
  _container = null;
  _regTab = 'my';
  _regMine = [];
  _regPending = [];
}

/* ── Register ── */
registerModule('regularizations', renderRegularizationsPage);

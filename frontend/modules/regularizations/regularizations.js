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
let _regList = [];

/* ── Mock data ── */
const _mockList = [
  { id: 'reg1', email: 'test@co.com', name: 'Test User', date: '2026-03-25', originalClockIn: null, correctedClockIn: '09:15', originalClockOut: '18:00', correctedClockOut: '18:00', reason: 'Forgot to clock in - was in meeting room', status: 'pending', submittedOn: '2026-03-26', tier: 1 },
  { id: 'reg2', email: 'bob@co.com', name: 'Bob Builder', date: '2026-03-24', originalClockIn: '09:00', correctedClockIn: '08:30', originalClockOut: '17:00', correctedClockOut: '18:30', reason: 'System error - worked till 18:30', status: 'pending', submittedOn: '2026-03-25', tier: 1 },
  { id: 'reg3', email: 'test@co.com', name: 'Test User', date: '2026-03-20', originalClockIn: '09:30', correctedClockIn: '09:00', originalClockOut: '18:00', correctedClockOut: '18:00', reason: 'Badge reader malfunction', status: 'approved', submittedOn: '2026-03-21', approvedByName: 'Admin', tier: 2 },
  { id: 'reg4', email: 'carol@co.com', name: 'Carol Chen', date: '2026-03-18', originalClockIn: null, correctedClockIn: '10:00', originalClockOut: null, correctedClockOut: '19:00', reason: 'Remote work not recorded', status: 'rejected', submittedOn: '2026-03-19', rejectionReason: 'No manager confirmation', tier: 1 },
];

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
  const data = await api.get('/api/regularizations');
  _regList = (data && !data._error)
    ? (data.regularizations || data || [])
    : _mockList;
  if (!Array.isArray(_regList)) _regList = _mockList;

  regRenderStats();
  regRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export function regRenderStats() {
  const el = _container && _container.querySelector('#regStats');
  if (!el) return;

  let pending = 0, approved = 0, rejected = 0;
  _regList.forEach(function (r) {
    if (r.status === 'pending') pending++;
    else if (r.status === 'approved') approved++;
    else if (r.status === 'rejected') rejected++;
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

  const session = getSession();
  const email = (session && session.email) || '';
  let items = _regList;

  if (_regTab === 'my') {
    items = items.filter(function (r) { return r.email === email || !email; });
  } else if (_regTab === 'pending') {
    items = items.filter(function (r) { return r.status === 'pending'; });
  }

  const submitBtn = _container.querySelector('#regSubmitBtn');
  if (submitBtn) submitBtn.style.display = _regTab === 'my' ? '' : 'none';

  if (!items.length) {
    el.innerHTML = '<div class="reg-empty"><div class="reg-empty-icon">&#128221;</div><div class="reg-empty-text">No regularization requests</div></div>';
    return;
  }

  const showName = _regTab !== 'my';
  let html = '<div class="reg-grid">';

  items.forEach(function (r, i) {
    html += '<div class="reg-card" style="animation-delay:' + i * 0.04 + 's">';
    html += '<div class="reg-card-hdr">';
    html += '<div><div class="reg-card-name">' + (showName ? _esc(r.name) : 'Correction for ' + _esc(r.date)) + '</div>';
    html += '<div class="reg-card-date">' + (showName ? _esc(r.date) + ' &middot; ' : '') + 'Submitted ' + _esc(r.submittedOn || '') + '</div></div>';
    html += '<span class="reg-card-badge ' + _esc(r.status) + '">' + _esc(r.status) + (r.tier ? ' (T' + r.tier + ')' : '') + '</span>';
    html += '</div>';

    html += '<div class="reg-card-body">';
    html += '<div class="reg-card-row"><span class="reg-card-row-label">Clock In</span><span class="reg-card-row-value">' + _esc(r.originalClockIn || '—') + ' → ' + _esc(r.correctedClockIn || '—') + '</span></div>';
    html += '<div class="reg-card-row"><span class="reg-card-row-label">Clock Out</span><span class="reg-card-row-value">' + _esc(r.originalClockOut || '—') + ' → ' + _esc(r.correctedClockOut || '—') + '</span></div>';
    html += '</div>';

    if (r.reason) html += '<div class="reg-card-reason">' + _esc(r.reason) + '</div>';
    if (r.approvedByName) html += '<div style="font-size:9px;color:var(--status-in);margin-top:4px">Approved by ' + _esc(r.approvedByName) + '</div>';
    if (r.rejectionReason) html += '<div style="font-size:9px;color:var(--status-absent);margin-top:4px">Rejected: ' + _esc(r.rejectionReason) + '</div>';

    html += '<div class="reg-card-actions">';
    if (r.status === 'pending' && _regTab === 'pending') {
      html += '<button class="approve" data-reg-action="approve" data-reg-id="' + _esc(r.id) + '">&#10003; Approve</button>';
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
  regRender();
}

/* ══════════════════════════════════════════════════════════════
   CRUD
   ══════════════════════════════════════════════════════════════ */

export async function regApprove(id) {
  const result = await api.put('/api/regularizations/' + id + '/approve', {});
  if (result && !result._error) {
    toast('Regularization approved', 'success');
    regLoadData();
    return;
  }
  const r = _regList.find(function (x) { return x.id === id; });
  if (r) { r.status = 'approved'; r.approvedByName = (getSession() && getSession().name) || 'Admin'; }
  toast('Approved (demo)', 'success');
  regRenderStats();
  regRender();
}

export async function regReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;

  const result = await api.put('/api/regularizations/' + id + '/reject', { reason: reason });
  if (result && !result._error) {
    toast('Regularization rejected', 'success');
    regLoadData();
    return;
  }
  const r = _regList.find(function (x) { return x.id === id; });
  if (r) { r.status = 'rejected'; r.rejectionReason = reason; }
  toast('Rejected (demo)', 'success');
  regRenderStats();
  regRender();
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
      '<div class="reg-field" style="flex:1"><label>Corrected Clock In *</label><input type="time" id="regClockIn"></div>' +
      '<div class="reg-field" style="flex:1"><label>Corrected Clock Out *</label><input type="time" id="regClockOut"></div>' +
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

  const session = getSession() || {};
  const body = {
    date: date,
    correctedClockIn: clockIn || null,
    correctedClockOut: clockOut || null,
    reason: reason,
    email: session.email || '',
    name: session.name || 'User',
  };

  const result = await api.post('/api/regularizations', body);
  if (result && !result._error) {
    toast('Regularization submitted', 'success');
    regCloseModal();
    regLoadData();
    return;
  }

  body.id = 'reg' + Date.now();
  body.status = 'pending';
  body.tier = 1;
  body.submittedOn = new Date().toISOString().split('T')[0];
  body.originalClockIn = null;
  body.originalClockOut = null;
  _regList.unshift(body);
  toast('Submitted (demo)', 'success');
  regCloseModal();
  regRenderStats();
  regRender();
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
      if (action === 'approve') regApprove(id);
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
export function _getRegs() { return _regList; }
export function _setRegs(list) { _regList = list; }
export function _getTab() { return _regTab; }

export function _resetState() {
  _container = null;
  _regTab = 'my';
  _regList = [];
}

/* ── Register ── */
registerModule('regularizations', renderRegularizationsPage);

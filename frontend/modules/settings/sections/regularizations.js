/**
 * modules/regularizations/regularizations.js
 *
 * Attendance regularization requests: submit attendance corrections
 * (forgot clock-in, wrong time, etc.), 2-tier approve/reject flow.
 *
 * Pattern: renderRegularizationsPage() → regLoadData() → regRenderStats()
 *          → regRender() → regRenderPending() → CRUD → regCloseModal()
 *
 * Server field names: email, name, date, correction_type, in_time, out_time,
 *   reason, status, manager_approver_email, hr_approver_email,
 *   rejection_comments, created_at
 * Status values: 'pending' | 'manager_approved' | 'approved' | 'rejected'
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

/* ── Module state ── */
// eslint-disable-next-line no-unused-vars -- DOM ref used in _resetState
let _container = null;
let _regTab = 'my';
let _regList = [];

// ── PASS 1 GATE (100 lines) ──────────────────────────────────────────────────

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

/**
 * Render the regularizations page into a container.
 * @param {HTMLElement} container
 */
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
    '<div class="reg-modal" id="regModal">' +
    '<div class="reg-modal-box" id="regModalBox"></div>' +
    '</div>' +
    '</div>';

  _bindEvents(container);
  regLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function regLoadData() {
  const session = getSession();
  if (!session) {
    return;
  }

  const data = await api.get('/api/regularizations?email=' + encodeURIComponent(session.email));
  _regList = data && !data._error ? data.regularizations || data || [] : [];
  if (!Array.isArray(_regList)) {
    _regList = [];
  }

  regRenderStats();
  regRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */

export function regRenderStats() {
  const el = _container && _container.querySelector('#regStats');
  if (!el) {
    return;
  }

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  _regList.forEach(function (r) {
    if (r.status === 'pending' || r.status === 'manager_approved') {
      pending++;
    } else if (r.status === 'approved') {
      approved++;
    } else if (r.status === 'rejected') {
      rejected++;
    }
  });

  el.innerHTML =
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-break)">' +
    pending +
    '</div><div class="reg-stat-label">Pending</div></div>' +
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-in)">' +
    approved +
    '</div><div class="reg-stat-label">Approved</div></div>' +
    '<div class="reg-stat"><div class="reg-stat-num" style="color:var(--status-absent)">' +
    rejected +
    '</div><div class="reg-stat-label">Rejected</div></div>';
}

// ── PASS 2 GATE (200 lines) ──────────────────────────────────────────────────

/* ══════════════════════════════════════════════════════════════
   RENDER CARDS
   ══════════════════════════════════════════════════════════════ */

export function regRender() {
  const el = _container && _container.querySelector('#regContent');
  if (!el) {
    return;
  }

  const session = getSession();
  const email = (session && session.email) || '';
  let items = _regList;

  if (_regTab === 'my') {
    items = items.filter(function (r) {
      return r.email === email || !email;
    });
  } else if (_regTab === 'pending') {
    items = items.filter(function (r) {
      return r.status === 'pending' || r.status === 'manager_approved';
    });
  }

  const submitBtn = _container && _container.querySelector('#regSubmitBtn');
  if (submitBtn) {
    submitBtn.style.display = _regTab === 'my' ? '' : 'none';
  }

  if (!items.length) {
    el.innerHTML =
      '<div class="reg-empty">' +
      '<div class="reg-empty-icon">&#128221;</div>' +
      '<div class="reg-empty-text">No regularization requests</div>' +
      '</div>';
    return;
  }

  const showName = _regTab !== 'my';
  let html = '<div class="reg-grid">';

  items.forEach(function (r, i) {
    const submittedDate = r.created_at ? r.created_at.split('T')[0] : '';
    const statusLabel =
      r.status === 'manager_approved' ? 'pending (tier 2)' : r.status || 'pending';

    html += '<div class="reg-card" style="animation-delay:' + i * 0.04 + 's">';
    html += '<div class="reg-card-hdr">';
    html +=
      '<div><div class="reg-card-name">' +
      (showName ? _esc(r.name) : 'Correction for ' + _esc(r.date)) +
      '</div>';
    html +=
      '<div class="reg-card-date">' +
      (showName ? _esc(r.date) + ' &middot; ' : '') +
      'Submitted ' +
      _esc(submittedDate) +
      '</div></div>';
    html += '<span class="reg-card-badge ' + _esc(r.status) + '">' + _esc(statusLabel) + '</span>';
    html += '</div>';

    html += '<div class="reg-card-body">';
    html +=
      '<div class="reg-card-row">' +
      '<span class="reg-card-row-label">Clock In</span>' +
      '<span class="reg-card-row-value">\u2014 \u2192 ' +
      _esc(r.in_time || '\u2014') +
      '</span></div>';
    html +=
      '<div class="reg-card-row">' +
      '<span class="reg-card-row-label">Clock Out</span>' +
      '<span class="reg-card-row-value">\u2014 \u2192 ' +
      _esc(r.out_time || '\u2014') +
      '</span></div>';
    html += '</div>';

    if (r.reason) {
      html += '<div class="reg-card-reason">' + _esc(r.reason) + '</div>';
    }
    if (r.manager_approver_email) {
      html +=
        '<div style="font-size:9px;color:var(--status-in);margin-top:4px">Approved by ' +
        _esc(r.manager_approver_email) +
        '</div>';
    }
    if (r.rejection_comments) {
      html +=
        '<div style="font-size:9px;color:var(--status-absent);margin-top:4px">Rejected: ' +
        _esc(r.rejection_comments) +
        '</div>';
    }

    html += '<div class="reg-card-actions">';
    if ((r.status === 'pending' || r.status === 'manager_approved') && _regTab === 'pending') {
      html +=
        '<button class="approve" data-reg-action="approve" data-reg-id="' +
        _esc(r.id) +
        '">&#10003; Approve</button>';
      html +=
        '<button class="danger" data-reg-action="reject" data-reg-id="' +
        _esc(r.id) +
        '">&#10005; Reject</button>';
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

// ── PASS 3 GATE (300 lines) ──────────────────────────────────────────────────

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
  toast(result.message || 'Failed to approve', 'error');
}

export async function regReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) {
    return;
  }

  const result = await api.put('/api/regularizations/' + id + '/reject', { reason: reason });
  if (result && !result._error) {
    toast('Regularization rejected', 'success');
    regLoadData();
    return;
  }
  toast(result.message || 'Failed to reject', 'error');
}

/* ══════════════════════════════════════════════════════════════
   SUBMIT FORM
   ══════════════════════════════════════════════════════════════ */

export function regShowForm() {
  const box = _container && _container.querySelector('#regModalBox');
  if (!box) {
    return;
  }

  box.innerHTML =
    '<div class="reg-modal-title">Submit Regularization</div>' +
    '<div class="reg-field"><label>Date *</label><input type="date" id="regDate"></div>' +
    '<div style="display:flex;gap:8px">' +
    '<div class="reg-field" style="flex:1"><label>Corrected Clock In</label>' +
    '<input type="time" id="regClockIn"></div>' +
    '<div class="reg-field" style="flex:1"><label>Corrected Clock Out</label>' +
    '<input type="time" id="regClockOut"></div>' +
    '</div>' +
    '<div class="reg-field"><label>Reason *</label>' +
    '<textarea id="regReason" style="min-height:50px"></textarea></div>' +
    '<div class="reg-form-actions">' +
    '<button class="reg-btn ghost" data-reg-action="close-modal">Cancel</button>' +
    '<button class="reg-btn" id="regSaveBtn">Submit</button>' +
    '</div>';

  const modal = _container && _container.querySelector('#regModal');
  if (modal) {
    modal.classList.add('open');
  }

  box.querySelector('#regSaveBtn').addEventListener('click', function () {
    _saveReg();
  });
}

async function _saveReg() {
  const box = _container && _container.querySelector('#regModalBox');
  if (!box) {
    return;
  }

  const date = /** @type {HTMLInputElement} */ (box.querySelector('#regDate')).value;
  const clockIn = /** @type {HTMLInputElement} */ (box.querySelector('#regClockIn')).value;
  const clockOut = /** @type {HTMLInputElement} */ (box.querySelector('#regClockOut')).value;
  const reason = (
    /** @type {HTMLTextAreaElement} */ (box.querySelector('#regReason')).value || ''
  ).trim();

  if (!date) {
    toast('Date is required', 'error');
    return;
  }
  if (!clockIn && !clockOut) {
    toast('At least one corrected time is required', 'error');
    return;
  }
  if (!reason) {
    toast('Reason is required', 'error');
    return;
  }

  const session = getSession();
  const body = {
    date: date,
    inTime: clockIn || '',
    outTime: clockOut || '',
    reason: reason,
    email: (session && session.email) || '',
    name: (session && session.name) || 'User',
    correctionType: clockIn && clockOut ? 'both' : clockIn ? 'in' : 'out',
  };

  const result = await api.post('/api/regularizations', body);
  if (result && !result._error) {
    toast('Regularization submitted', 'success');
    regCloseModal();
    regLoadData();
    return;
  }
  toast(result.message || 'Failed to submit', 'error');
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL
   ══════════════════════════════════════════════════════════════ */

export function regCloseModal() {
  const modal = _container && _container.querySelector('#regModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

// ── PASS 4 GATE (400 lines) ──────────────────────────────────────────────────

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindEvents(container) {
  const tabs = container.querySelector('#regTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const tab = /** @type {HTMLElement} */ (e.target).closest('.reg-tab');
      if (!tab || !(/** @type {HTMLElement} */ (tab).dataset.regt)) {
        return;
      }
      _regTab = /** @type {HTMLElement} */ (tab).dataset.regt;
      tabs.querySelectorAll('.reg-tab').forEach(function (t) {
        t.classList.toggle('active', /** @type {HTMLElement} */ (t).dataset.regt === _regTab);
      });
      regRender();
    });
  }

  const submitBtn = container.querySelector('#regSubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      regShowForm();
    });
  }

  const modal = container.querySelector('#regModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        regCloseModal();
      }
    });
  }

  const content = container.querySelector('#regContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-reg-action]');
      if (!btn) {
        return;
      }
      const action = /** @type {HTMLElement} */ (btn).dataset.regAction;
      const id = /** @type {HTMLElement} */ (btn).dataset.regId;
      if (action === 'approve') {
        regApprove(id);
      } else if (action === 'reject') {
        regReject(id);
      }
    });
  }

  container.addEventListener('click', function (e) {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-reg-action="close-modal"]');
    if (btn) {
      regCloseModal();
    }
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

/* ══════════════════════════════════════════════════════════════
   TEST HELPERS
   ══════════════════════════════════════════════════════════════ */

export function _getRegs() {
  return _regList;
}
export function _setRegs(list) {
  _regList = list;
}
export function _getTab() {
  return _regTab;
}

export function _resetState() {
  _container = null;
  _regTab = 'my';
  _regList = [];
}

/* ── Register ── */
registerModule('regularizations', renderRegularizationsPage);

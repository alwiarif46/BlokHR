/**
 * modules/overtime/overtime.js
 *
 * Self-service OT + manager/HR approval queue + policy/detect for admins.
 * Calls services/overtime via api.hr('overtime').
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { promptDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tab = 'mine';
let _mine = [];
let _pending = [];
let _requests = [];
let _policy = null;
let _summary = null;
let _loadError = null;
let _featureOff = false;
let _unavailable = false;
let _busy = false;
let _keydownHandler = null;

function otApi() {
  return api.hr('overtime');
}

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

function _role() {
  return String(_session().role || 'employee').toLowerCase();
}

function _isManagerOrAbove() {
  const r = _role();
  return (
    r === 'admin' ||
    r === 'hr' ||
    r === 'manager' ||
    !!_session().is_admin ||
    !!_session().isAdmin
  );
}

function _isHrOrAdmin() {
  const r = _role();
  return r === 'admin' || r === 'hr' || !!_session().is_admin || !!_session().isAdmin;
}

function _today() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function _hours(mins) {
  return Math.round((Number(mins || 0) / 60) * 100) / 100;
}

function _emptyState(title, detail, retry) {
  return (
    '<div class="ot-empty" role="status">' +
    '<div class="ot-empty-icon" aria-hidden="true">&#9203;</div>' +
    '<div class="ot-empty-text">' +
    _esc(title) +
    '</div>' +
    (detail ? '<div class="ot-empty-detail">' + _esc(detail) + '</div>' : '') +
    (retry
      ? '<button type="button" class="ot-btn" data-action="retry" style="margin-top:12px">Retry</button>'
      : '') +
    '</div>'
  );
}

function _classifyError(res) {
  if (!res || !res._error) return null;
  if (res.error === 'upstream_unavailable' || res.status === 502) {
    return { unavailable: true, message: res.message || 'Overtime service is unavailable' };
  }
  if (res.status === 403 || res.status === 402 || res.error === 'feature_disabled') {
    return { featureOff: true, message: res.message || 'Overtime is disabled for this workspace' };
  }
  if (res.status === 404) {
    return { featureOff: true, message: 'Overtime is not available on this plan' };
  }
  return { message: res.message || 'Could not load overtime' };
}

export function renderOvertimePage(container) {
  _container = container;
  _tab = 'mine';
  _loadError = null;
  _featureOff = false;
  _unavailable = false;
  _busy = false;

  const mgrTabs = _isManagerOrAbove()
    ? '<button type="button" class="ot-tab" data-tab="pending" role="tab">Pending</button>' +
      '<button type="button" class="ot-tab" data-tab="requests" role="tab">Requests</button>'
    : '';
  const adminTabs = _isHrOrAdmin()
    ? '<button type="button" class="ot-tab" data-tab="policy" role="tab">Policy</button>'
    : '';

  container.innerHTML =
    '<div class="ot-wrap" id="otWrap">' +
    '<div class="ot-toolbar">' +
    '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px">' +
    '<span aria-hidden="true">&#9203;</span> Overtime</div>' +
    '<div class="ot-spacer"></div>' +
    '<button type="button" class="ot-btn ghost" id="otRequestBtn">Request OT</button>' +
    '<button type="button" class="ot-btn" id="otLogBtn">Log OT</button>' +
    (_isHrOrAdmin()
      ? '<button type="button" class="ot-btn ghost" id="otDetectBtn">Detect today</button>'
      : '') +
    '</div>' +
    '<div class="ot-tabs" role="tablist">' +
    '<button type="button" class="ot-tab active" data-tab="mine" role="tab" aria-selected="true">My overtime</button>' +
    mgrTabs +
    adminTabs +
    '</div>' +
    '<div class="ot-stats" id="otStats"></div>' +
    '<div id="otContent" aria-live="polite"></div>' +
    '<div class="ot-modal" id="otModal" role="dialog" aria-modal="true" aria-labelledby="otModalTitle" hidden>' +
    '<div class="ot-modal-box" id="otModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  otLoadData();
}

export async function otLoadData() {
  if (!_container) return;
  _loadError = null;
  _featureOff = false;
  _unavailable = false;

  const content = _container.querySelector('#otContent');
  if (content) content.innerHTML = '<div class="ot-empty"><div class="ot-empty-text">Loading…</div></div>';

  const client = otApi();
  const tasks = [
    client.get('/records/mine'),
    client.get('/summary/mine'),
    client.get('/requests/mine'),
    client.get('/policy'),
  ];
  if (_isManagerOrAbove()) {
    tasks.push(client.get('/records/pending'));
    tasks.push(client.get('/requests?status=pending'));
  }

  const results = await Promise.all(tasks);
  const mineRes = results[0];
  const summaryRes = results[1];
  const myReqRes = results[2];
  const policyRes = results[3];
  const pendingRes = _isManagerOrAbove() ? results[4] : null;
  const reqPendingRes = _isManagerOrAbove() ? results[5] : null;

  const err = _classifyError(mineRes) || _classifyError(policyRes);
  if (err) {
    _mine = [];
    _pending = [];
    _requests = [];
    _summary = null;
    _policy = null;
    _loadError = err.message;
    _featureOff = !!err.featureOff;
    _unavailable = !!err.unavailable;
    otRenderStats();
    otRender();
    return;
  }

  _mine = Array.isArray(mineRes.items)
    ? mineRes.items
    : Array.isArray(mineRes.records)
      ? mineRes.records
      : [];
  _summary = summaryRes && !summaryRes._error ? summaryRes : null;
  _policy = policyRes && !policyRes._error ? policyRes : null;
  const myReqs = Array.isArray(myReqRes.items) ? myReqRes.items : [];
  _pending =
    pendingRes && !pendingRes._error
      ? Array.isArray(pendingRes.items)
        ? pendingRes.items
        : pendingRes.records || []
      : [];
  const pendingReqs =
    reqPendingRes && !reqPendingRes._error
      ? Array.isArray(reqPendingRes.items)
        ? reqPendingRes.items
        : []
      : [];
  _requests = _isManagerOrAbove() ? pendingReqs : myReqs;

  otRenderStats();
  otRender();
}

export function otRenderStats() {
  const el = _container && _container.querySelector('#otStats');
  if (!el) return;
  if (_featureOff || _unavailable || _loadError) {
    el.innerHTML = '';
    return;
  }

  const pendingCount =
    _tab === 'pending'
      ? _pending.length
      : _mine.filter((r) => r.status === 'pending').length;
  const approvedCount = _mine.filter((r) => r.status === 'approved').length;
  const hours =
    _summary && _summary.totalOtHours != null
      ? _summary.totalOtHours
      : _hours(_mine.reduce((s, r) => s + Number(r.otMinutes || 0), 0));

  el.innerHTML =
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--status-break)">' +
    pendingCount +
    '</div><div class="ot-stat-label">Pending</div></div>' +
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--status-in)">' +
    approvedCount +
    '</div><div class="ot-stat-label">Approved</div></div>' +
    '<div class="ot-stat"><div class="ot-stat-num" style="color:var(--accent)">' +
    _esc(String(hours)) +
    'h</div><div class="ot-stat-label">OT hours</div></div>';
}

export function otRender() {
  const el = _container && _container.querySelector('#otContent');
  if (!el) return;

  if (_featureOff) {
    el.innerHTML = _emptyState(_loadError || 'Overtime is disabled', null, false);
    return;
  }
  if (_unavailable) {
    el.innerHTML = _emptyState(
      'Service unavailable',
      _loadError || 'Overtime service is unavailable',
      true,
    );
    return;
  }
  if (_loadError) {
    el.innerHTML = _emptyState('Could not load', _loadError, true);
    return;
  }

  if (_tab === 'pending') {
    otRenderPending(el);
    return;
  }
  if (_tab === 'requests') {
    otRenderRequests(el);
    return;
  }
  if (_tab === 'policy') {
    otRenderPolicy(el);
    return;
  }
  otRenderMine(el);
}

function statusBadge(status) {
  const label =
    status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
  const color =
    status === 'approved'
      ? 'var(--status-in)'
      : status === 'rejected'
        ? 'var(--status-absent)'
        : 'var(--status-break)';
  return (
    '<span class="ot-card-badge" style="background:var(--accent-dim);color:' +
    color +
    '">' +
    label +
    '</span>'
  );
}

function otRenderMine(el) {
  if (!_mine.length) {
    el.innerHTML = _emptyState(
      'No overtime records',
      'Request prior approval or log overtime when policy allows.',
      false,
    );
    return;
  }
  let html = '<div class="ot-grid">';
  _mine.forEach(function (item, i) {
    html +=
      '<div class="ot-card" data-id="' +
      _esc(item.id) +
      '">' +
      '<div class="ot-card-title">' +
      _esc(item.date) +
      ' · ' +
      _esc(_hours(item.otMinutes)) +
      'h (' +
      _esc(item.otType || 'weekday') +
      ')</div>' +
      '<div class="ot-card-sub">Pay: ' +
      _esc(Number(item.otPay || 0).toFixed(2)) +
      ' · Source: ' +
      _esc(item.source || '') +
      '</div>' +
      statusBadge(item.status) +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function otRenderPending(el) {
  if (!_pending.length) {
    el.innerHTML = _emptyState('No pending approvals', null, false);
    return;
  }
  let html = '<div class="ot-grid">';
  _pending.forEach(function (item, i) {
    html +=
      '<div class="ot-card">' +
      '<div class="ot-card-title">' +
      _esc(item.email) +
      '</div>' +
      '<div class="ot-card-sub">' +
      _esc(item.date) +
      ' · ' +
      _esc(_hours(item.otMinutes)) +
      'h · ' +
      _esc(item.otType || '') +
      '</div>' +
      statusBadge(item.status) +
      '<div class="ot-card-actions">' +
      '<button type="button" data-action="approve-record" data-idx="' +
      i +
      '">Approve</button>' +
      '<button type="button" class="danger" data-action="reject-record" data-idx="' +
      i +
      '">Reject</button>' +
      '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function otRenderRequests(el) {
  if (!_requests.length) {
    el.innerHTML = _emptyState('No pending OT requests', null, false);
    return;
  }
  let html = '<div class="ot-grid">';
  _requests.forEach(function (item, i) {
    html +=
      '<div class="ot-card">' +
      '<div class="ot-card-title">' +
      _esc(item.email || _myEmail()) +
      '</div>' +
      '<div class="ot-card-sub">' +
      _esc(item.date) +
      ' · ' +
      _esc(item.plannedHours) +
      'h planned' +
      (item.reason ? ' · ' + _esc(item.reason) : '') +
      '</div>' +
      statusBadge(item.status) +
      (_isManagerOrAbove() && item.status === 'pending'
        ? '<div class="ot-card-actions">' +
          '<button type="button" data-action="approve-request" data-idx="' +
          i +
          '">Approve</button>' +
          '<button type="button" class="danger" data-action="reject-request" data-idx="' +
          i +
          '">Reject</button></div>'
        : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function otRenderPolicy(el) {
  const p = _policy || {};
  el.innerHTML =
    '<div class="ot-card" style="max-width:520px">' +
    '<div class="ot-card-title">Overtime policy</div>' +
    '<div class="ot-field"><label><input type="checkbox" id="otPolEnabled"' +
    (p.otEnabled !== false && p.otEnabled !== 0 ? ' checked' : '') +
    '> OT enabled</label></div>' +
    '<div class="ot-field"><label for="otPolDaily">Daily threshold (minutes)</label>' +
    '<input id="otPolDaily" type="number" value="' +
    _esc(p.dailyThresholdMinutes ?? 540) +
    '"></div>' +
    '<div class="ot-field"><label for="otPolMult">Weekday multiplier</label>' +
    '<input id="otPolMult" type="number" step="0.1" value="' +
    _esc(p.multiplier ?? 2) +
    '"></div>' +
    '<div class="ot-field"><label for="otPolHol">Holiday multiplier</label>' +
    '<input id="otPolHol" type="number" step="0.1" value="' +
    _esc(p.holidayMultiplier ?? 3) +
    '"></div>' +
    '<div class="ot-field"><label><input type="checkbox" id="otPolPrior"' +
    (p.requiresPriorApproval !== false && p.requiresPriorApproval !== 0
      ? ' checked'
      : '') +
    '> Require prior approval</label></div>' +
    '<div class="ot-field"><label><input type="checkbox" id="otPolAppr"' +
    (p.requiresApproval !== false && p.requiresApproval !== 0 ? ' checked' : '') +
    '> Require post approval</label></div>' +
    '<button type="button" class="ot-btn" data-action="save-policy"' +
    (_busy ? ' disabled' : '') +
    '>Save policy</button>' +
    '</div>';
}

function otShowLogForm() {
  const modal = _container.querySelector('#otModal');
  const box = _container.querySelector('#otModalBox');
  box.innerHTML =
    '<div class="ot-modal-title" id="otModalTitle">Log overtime</div>' +
    '<div class="ot-field"><label for="otLogDate">Date</label>' +
    '<input id="otLogDate" type="date" value="' +
    _esc(_today()) +
    '"></div>' +
    '<div class="ot-field"><label for="otLogMins">OT minutes</label>' +
    '<input id="otLogMins" type="number" min="1" value="60"></div>' +
    '<div class="ot-field"><label for="otLogType">Type</label>' +
    '<select id="otLogType"><option value="weekday">Weekday</option>' +
    '<option value="weekend">Weekend</option><option value="holiday">Holiday</option></select></div>' +
    '<div class="ot-modal-actions">' +
    '<button type="button" class="ot-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ot-btn" data-action="save-log">Save</button></div>';
  modal.hidden = false;
  modal.classList.add('open');
}

function otShowRequestForm() {
  const modal = _container.querySelector('#otModal');
  const box = _container.querySelector('#otModalBox');
  box.innerHTML =
    '<div class="ot-modal-title" id="otModalTitle">Request overtime</div>' +
    '<div class="ot-field"><label for="otReqDate">Date</label>' +
    '<input id="otReqDate" type="date" value="' +
    _esc(_today()) +
    '"></div>' +
    '<div class="ot-field"><label for="otReqHours">Planned hours</label>' +
    '<input id="otReqHours" type="number" min="0.5" step="0.5" value="2"></div>' +
    '<div class="ot-field"><label for="otReqReason">Reason</label>' +
    '<textarea id="otReqReason" rows="3"></textarea></div>' +
    '<div class="ot-modal-actions">' +
    '<button type="button" class="ot-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ot-btn" data-action="save-request">Submit</button></div>';
  modal.hidden = false;
  modal.classList.add('open');
}

function otCloseModal() {
  const modal = _container && _container.querySelector('#otModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.hidden = true;
}

async function otSaveLog() {
  if (_busy) return;
  const date = (_container.querySelector('#otLogDate') || {}).value;
  const otMinutes = Number((_container.querySelector('#otLogMins') || {}).value);
  const otType = (_container.querySelector('#otLogType') || {}).value || 'weekday';
  if (!date || !(otMinutes > 0)) {
    toast('Date and OT minutes are required');
    return;
  }
  _busy = true;
  const res = await otApi().post('/records', {
    email: _myEmail(),
    date: date,
    otMinutes: otMinutes,
    otType: otType,
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to log overtime');
    return;
  }
  toast('Overtime logged');
  otCloseModal();
  await otLoadData();
}

async function otSaveRequest() {
  if (_busy) return;
  const date = (_container.querySelector('#otReqDate') || {}).value;
  const plannedHours = Number((_container.querySelector('#otReqHours') || {}).value);
  const reason = (_container.querySelector('#otReqReason') || {}).value || '';
  if (!date || !(plannedHours > 0)) {
    toast('Date and planned hours are required');
    return;
  }
  _busy = true;
  const res = await otApi().post('/requests', {
    email: _myEmail(),
    name: _session().name || '',
    date: date,
    plannedHours: plannedHours,
    reason: reason,
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to submit request');
    return;
  }
  toast('OT request submitted');
  otCloseModal();
  await otLoadData();
}

async function otApproveRecord(idx) {
  const item = _pending[idx];
  if (!item || _busy) return;
  _busy = true;
  const res = await otApi().post('/records/' + item.id + '/approve', {});
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Approve failed');
    return;
  }
  toast('Overtime approved');
  await otLoadData();
}

async function otRejectRecord(idx) {
  const item = _pending[idx];
  if (!item || _busy) return;
  const reason = await promptDialog({
    title: 'Reject overtime',
    message: 'Rejection reason is required.',
    placeholder: 'Reason',
    required: true,
  });
  if (reason == null || !String(reason).trim()) {
    toast('Rejection reason is required');
    return;
  }
  _busy = true;
  const res = await otApi().post('/records/' + item.id + '/reject', {
    reason: String(reason).trim(),
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Reject failed');
    return;
  }
  toast('Overtime rejected');
  await otLoadData();
}

async function otApproveRequest(idx) {
  const item = _requests[idx];
  if (!item || _busy) return;
  _busy = true;
  const res = await otApi().post('/requests/' + item.id + '/approve', {});
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Approve failed');
    return;
  }
  toast('Request approved');
  await otLoadData();
}

async function otRejectRequest(idx) {
  const item = _requests[idx];
  if (!item || _busy) return;
  const reason = await promptDialog({
    title: 'Reject OT request',
    message: 'Rejection reason is required.',
    placeholder: 'Reason',
    required: true,
  });
  if (reason == null || !String(reason).trim()) {
    toast('Rejection reason is required');
    return;
  }
  _busy = true;
  const res = await otApi().post('/requests/' + item.id + '/reject', {
    reason: String(reason).trim(),
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Reject failed');
    return;
  }
  toast('Request rejected');
  await otLoadData();
}

async function otSavePolicy() {
  if (_busy) return;
  _busy = true;
  const res = await otApi().put('/policy', {
    otEnabled: !!(_container.querySelector('#otPolEnabled') || {}).checked,
    dailyThresholdMinutes: Number((_container.querySelector('#otPolDaily') || {}).value),
    multiplier: Number((_container.querySelector('#otPolMult') || {}).value),
    holidayMultiplier: Number((_container.querySelector('#otPolHol') || {}).value),
    requiresPriorApproval: !!(_container.querySelector('#otPolPrior') || {}).checked,
    requiresApproval: !!(_container.querySelector('#otPolAppr') || {}).checked,
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to save policy');
    return;
  }
  toast('Policy saved');
  _policy = res;
  otRender();
}

async function otDetect() {
  if (_busy) return;
  _busy = true;
  const res = await otApi().post('/detect', { date: _today() });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Detect failed');
    return;
  }
  const created = (res && (res.created || res.detected || res.count)) || 0;
  toast('Detection finished' + (created ? ' (' + created + ')' : ''));
  await otLoadData();
}

function _bindEvents(container) {
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
  }
  _keydownHandler = function (e) {
    if (e.key === 'Escape') otCloseModal();
  };
  document.addEventListener('keydown', _keydownHandler);

  container.onclick = async function (e) {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) {
      const tab = tabBtn.getAttribute('data-tab');
      if ((tab === 'pending' || tab === 'requests') && !_isManagerOrAbove()) return;
      if (tab === 'policy' && !_isHrOrAdmin()) return;
      _tab = tab;
      container.querySelectorAll('.ot-tab').forEach(function (b) {
        const on = b.getAttribute('data-tab') === _tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      otRenderStats();
      otRender();
      return;
    }

    if (t.id === 'otLogBtn') {
      otShowLogForm();
      return;
    }
    if (t.id === 'otRequestBtn') {
      otShowRequestForm();
      return;
    }
    if (t.id === 'otDetectBtn') {
      await otDetect();
      return;
    }

    const actionEl = t.closest('[data-action]');
    const action = actionEl && actionEl.getAttribute('data-action');
    const idx = actionEl ? Number(actionEl.getAttribute('data-idx')) : -1;

    if (action === 'retry') {
      otLoadData();
      return;
    }
    if (action === 'close-modal') {
      otCloseModal();
      return;
    }
    if (action === 'save-log') {
      await otSaveLog();
      return;
    }
    if (action === 'save-request') {
      await otSaveRequest();
      return;
    }
    if (action === 'approve-record') {
      await otApproveRecord(idx);
      return;
    }
    if (action === 'reject-record') {
      await otRejectRecord(idx);
      return;
    }
    if (action === 'approve-request') {
      await otApproveRequest(idx);
      return;
    }
    if (action === 'reject-request') {
      await otRejectRequest(idx);
      return;
    }
    if (action === 'save-policy') {
      await otSavePolicy();
      return;
    }
    if (t.id === 'otModal') {
      otCloseModal();
    }
  };
}

registerModule('overtime', renderOvertimePage);

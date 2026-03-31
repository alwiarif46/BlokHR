/**
 * modules/overtime/overtime.js
 * Overtime requests: submit, approve/reject, view rules, stats.
 * Pattern: renderOvertimePage() → otLoadData() → otRenderStats()
 *          → otRender() → CRUD → otCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _requests = [];
let _rules = null;
let _tab = 'my';    // 'my' | 'approvals' | 'rules'
let _search = '';
let _filterStatus = '';

const _mockRequests = [
  { id: 'ot1', email: 'arif@co.com',  name: 'Arif Alwi',    date: '2026-03-27', hours: 2.5, reason: 'Sprint deadline',    status: 'pending',  multiplier: 2.0 },
  { id: 'ot2', email: 'sarah@co.com', name: 'Sarah Chen',   date: '2026-03-26', hours: 1.5, reason: 'Client demo prep',   status: 'approved', multiplier: 2.0, approved_by: 'Admin' },
  { id: 'ot3', email: 'bob@co.com',   name: 'Bob Builder',  date: '2026-03-25', hours: 3.0, reason: 'Server migration',   status: 'approved', multiplier: 2.0, approved_by: 'Admin' },
  { id: 'ot4', email: 'priya@co.com', name: 'Priya Sharma', date: '2026-03-22', hours: 1.0, reason: 'Report preparation', status: 'rejected', multiplier: 2.0, rejection_reason: 'Did not meet threshold' },
  { id: 'ot5', email: 'omar@co.com',  name: 'Omar Hassan',  date: '2026-03-20', hours: 4.0, reason: 'Holiday coverage',   status: 'pending',  multiplier: 3.0 },
];

const _mockRules = {
  ot_enabled: true,
  ot_daily_threshold_minutes: 540,
  ot_weekly_threshold_minutes: 2880,
  ot_multiplier: 2.0,
  ot_holiday_multiplier: 3.0,
  ot_max_daily_minutes: 240,
  ot_max_quarterly_hours: 125,
  ot_requires_approval: true,
  ot_requires_prior_approval: true,
};

export function renderOvertimePage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && (session.is_admin || session.is_manager);
  container.innerHTML =
    '<div class="ot-wrap">' +
      '<div class="ot-toolbar">' +
        '<div class="ot-tabs" id="otTabs">' +
          '<button class="ot-tab active" data-tab="my">My OT</button>' +
          (isAdmin ? '<button class="ot-tab" data-tab="approvals">Approvals</button>' : '') +
          (isAdmin ? '<button class="ot-tab" data-tab="rules">Rules</button>' : '') +
        '</div>' +
        '<input class="ot-search" id="otSearch" placeholder="Search…" autocomplete="off">' +
        '<select class="ot-select" id="otStatusFilter">' +
          '<option value="">All Status</option>' +
          '<option value="pending">Pending</option>' +
          '<option value="approved">Approved</option>' +
          '<option value="rejected">Rejected</option>' +
        '</select>' +
        '<button class="ot-btn" id="otAddBtn">+ Request OT</button>' +
      '</div>' +
      '<div id="otStats" class="ot-stats"></div>' +
      '<div id="otContent"></div>' +
      '<div class="ot-modal" id="otModal"><div class="ot-modal-box" id="otModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  otLoadData();
}

export async function otLoadData() {
  const [reqData, rulesData] = await Promise.all([
    api.get('/api/overtime'),
    api.get('/api/overtime/rules'),
  ]);
  _requests = (reqData && !reqData._error) ? (reqData.requests || reqData || []) : _mockRequests;
  if (!Array.isArray(_requests)) _requests = _mockRequests;
  _rules = (rulesData && !rulesData._error) ? rulesData : _mockRules;
  otRenderStats();
  otRender();
}

export function otRenderStats() {
  const el = _container && _container.querySelector('#otStats');
  if (!el) return;
  const session = getSession();
  const email = session && session.email;
  const mine = _requests.filter(r => r.email === email);
  const pending = _requests.filter(r => r.status === 'pending').length;
  const approved = _requests.filter(r => r.status === 'approved').length;
  const myHours = mine.filter(r => r.status === 'approved').reduce((s, r) => s + (r.hours || 0), 0);
  el.innerHTML =
    _sc(pending, 'Pending', 'var(--status-absent)') +
    _sc(approved, 'Approved', 'var(--status-in)') +
    _sc(myHours.toFixed(1) + 'h', 'My Approved OT', 'var(--accent)') +
    _sc(_requests.length, 'Total', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="ot-stat"><div class="ot-stat-n" style="color:' + c + '">' + n + '</div><div class="ot-stat-l">' + l + '</div></div>';
}

export function otRender() {
  const el = _container && _container.querySelector('#otContent');
  if (!el) return;
  if (_tab === 'rules') { _renderRules(el); return; }
  _renderRequests(el);
}

function _renderRequests(el) {
  const session = getSession();
  const email = session && session.email;
  const isAdmin = session && (session.is_admin || session.is_manager);
  let items = _requests;
  if (_tab === 'my') items = items.filter(r => r.email === email || !email);
  if (_filterStatus) items = items.filter(r => r.status === _filterStatus);
  if (_search) items = items.filter(r => (r.name + ' ' + r.reason + ' ' + r.date).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="ot-empty"><div style="font-size:2rem">&#9200;</div><div>No overtime requests</div></div>';
    return;
  }

  let html = '<div class="ot-grid">';
  items.forEach(function (r, i) {
    const showApprove = _tab === 'approvals' && r.status === 'pending' && isAdmin;
    html +=
      '<div class="ot-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="ot-card-hdr">' +
          (_tab !== 'my' ? '<div class="ot-av">' + _ini(r.name) + '</div>' : '') +
          '<div class="ot-card-info">' +
            '<div class="ot-card-name">' + (_tab !== 'my' ? _esc(r.name) : 'My OT Request') + '</div>' +
            '<div class="ot-card-date">' + _fmtDate(r.date) + '</div>' +
          '</div>' +
          '<span class="ot-badge ot-badge-' + r.status + '">' + r.status + '</span>' +
        '</div>' +
        '<div class="ot-card-body">' +
          '<div class="ot-hours"><span class="ot-h-num">' + r.hours + '</span><span class="ot-h-lbl">hours</span></div>' +
          '<div class="ot-reason">' + _esc(r.reason || '') + '</div>' +
          (r.approved_by ? '<div class="ot-meta positive">Approved by ' + _esc(r.approved_by) + '</div>' : '') +
          (r.rejection_reason ? '<div class="ot-meta negative">Reason: ' + _esc(r.rejection_reason) + '</div>' : '') +
          '<div class="ot-multiplier">Multiplier: ' + (r.multiplier || 2.0) + 'x</div>' +
        '</div>' +
        '<div class="ot-card-actions">' +
          (showApprove ? '<button data-action="approve" data-id="' + _esc(r.id) + '" class="ot-btn-sm approve">&#10003; Approve</button>' : '') +
          (showApprove ? '<button data-action="reject" data-id="' + _esc(r.id) + '" class="ot-btn-sm danger">&#10005; Reject</button>' : '') +
          (r.status === 'pending' && _tab === 'my' ? '<button data-action="cancel" data-id="' + _esc(r.id) + '" class="ot-btn-sm danger">Cancel</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderRules(el) {
  if (!_rules) { el.innerHTML = '<div class="ot-empty">No rules data</div>'; return; }
  el.innerHTML =
    '<div class="ot-rules">' +
      '<div class="ot-rules-grid">' +
        _rule('Overtime Enabled', _rules.ot_enabled ? 'Yes' : 'No') +
        _rule('Daily Threshold', (_rules.ot_daily_threshold_minutes / 60).toFixed(1) + 'h / day') +
        _rule('Weekly Threshold', (_rules.ot_weekly_threshold_minutes / 60).toFixed(1) + 'h / week') +
        _rule('Regular Multiplier', _rules.ot_multiplier + 'x') +
        _rule('Holiday Multiplier', _rules.ot_holiday_multiplier + 'x') +
        _rule('Max OT per Day', (_rules.ot_max_daily_minutes / 60).toFixed(1) + 'h') +
        _rule('Max per Quarter', _rules.ot_max_quarterly_hours + 'h') +
        _rule('Requires Approval', _rules.ot_requires_approval ? 'Yes' : 'No') +
        _rule('Prior Approval Required', _rules.ot_requires_prior_approval ? 'Yes' : 'No') +
      '</div>' +
      '<div class="ot-rules-note">&#9432; Rules are configured in Admin Settings &rsaquo; Overtime</div>' +
    '</div>';
}

function _rule(label, value) {
  return '<div class="ot-rule-row"><span class="ot-rule-lbl">' + label + '</span><span class="ot-rule-val">' + _esc(String(value)) + '</span></div>';
}

export function otShowForm(req) {
  const isEdit = !!req;
  const r = req || {};
  const box = _container && _container.querySelector('#otModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ot-modal-title">' + (isEdit ? 'Edit' : 'Request') + ' Overtime</div>' +
    '<div class="ot-field"><label>Date *</label><input type="date" id="otFDate" value="' + _esc(r.date || '') + '"></div>' +
    '<div class="ot-field"><label>Hours *</label><input type="number" id="otFHours" value="' + (r.hours || '') + '" min="0.5" max="12" step="0.5" placeholder="e.g. 2.5"></div>' +
    '<div class="ot-field"><label>Reason *</label><textarea id="otFReason" style="min-height:60px">' + _esc(r.reason || '') + '</textarea></div>' +
    '<div class="ot-form-actions">' +
      '<button class="ot-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="ot-btn" id="otSaveBtn">' + (isEdit ? 'Update' : 'Submit') + '</button>' +
    '</div>';
  _container.querySelector('#otModal').classList.add('open');
  box.querySelector('#otSaveBtn').addEventListener('click', () => _save(req, isEdit));
}

async function _save(req, isEdit) {
  const box = _container && _container.querySelector('#otModalBox');
  if (!box) return;
  const date = box.querySelector('#otFDate').value;
  const hours = parseFloat(box.querySelector('#otFHours').value);
  const reason = (box.querySelector('#otFReason').value || '').trim();
  if (!date) { toast('Date is required', 'error'); return; }
  if (!hours || hours <= 0) { toast('Valid hours required', 'error'); return; }
  if (!reason) { toast('Reason is required', 'error'); return; }
  const session = getSession() || {};
  const body = { date, hours, reason, email: session.email, name: session.name, status: 'pending', multiplier: _rules ? _rules.ot_multiplier : 2.0 };
  const result = isEdit ? await api.put('/api/overtime/' + req.id, body) : await api.post('/api/overtime', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Submitted', 'success'); otCloseModal(); otLoadData(); return; }
  if (isEdit) { const i = _requests.findIndex(r => r.id === req.id); if (i >= 0) Object.assign(_requests[i], body); }
  else _requests.unshift({ id: 'ot' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Submitted') + ' (demo)', 'success');
  otCloseModal(); otRenderStats(); otRender();
}

export async function otApprove(id) {
  const result = await api.put('/api/overtime/' + id + '/approve', {});
  if (result && !result._error) { toast('Approved', 'success'); otLoadData(); return; }
  const r = _requests.find(x => x.id === id);
  if (r) { r.status = 'approved'; r.approved_by = (getSession() || {}).name || 'Admin'; }
  toast('Approved (demo)', 'success'); otRenderStats(); otRender();
}

export async function otReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;
  const result = await api.put('/api/overtime/' + id + '/reject', { reason });
  if (result && !result._error) { toast('Rejected', 'success'); otLoadData(); return; }
  const r = _requests.find(x => x.id === id);
  if (r) { r.status = 'rejected'; r.rejection_reason = reason; }
  toast('Rejected (demo)', 'success'); otRenderStats(); otRender();
}

export function otCloseModal() {
  const m = _container && _container.querySelector('#otModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#otTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.ot-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.ot-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    otRender();
  });
  const s = container.querySelector('#otSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); otRender(); });
  const f = container.querySelector('#otStatusFilter');
  if (f) f.addEventListener('change', function () { _filterStatus = this.value; otRender(); });
  const ab = container.querySelector('#otAddBtn');
  if (ab) ab.addEventListener('click', () => otShowForm(null));
  const modal = container.querySelector('#otModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) otCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') otCloseModal();
    else if (action === 'approve') otApprove(id);
    else if (action === 'reject') otReject(id);
    else if (action === 'cancel') {
      if (confirm('Cancel this OT request?')) {
        const r = _requests.find(x => x.id === id); if (r) r.status = 'cancelled';
        toast('Cancelled (demo)', 'success'); otRender();
      }
    }
  });
}

function _fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0, 2).toUpperCase(); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getRequests() { return _requests; }
export function _setRequests(list) { _requests = list; }
export function _resetState() { _container = null; _requests = []; _rules = null; _tab = 'my'; _search = ''; _filterStatus = ''; }

registerModule('overtime', renderOvertimePage);

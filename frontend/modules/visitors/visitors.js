/**
 * modules/visitors/visitors.js
 * Visitor Management — front desk: today, upcoming, my visitors.
 * Pattern: renderVisitorsPage() → visLoadData() → visRenderStats() → visRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { promptDialog, confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const STATUS_LABELS = {
  pre_registered: 'Expected',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

let _container = null;
let _tab = 'today';
let _visits = [];
let _mine = [];
let _checkedInCount = 0;
let _filterStatus = '';
let _loadError = null;
let _featureOff = false;
let _saving = false;
let _editing = null;

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function _statusBadge(status) {
  const label = STATUS_LABELS[status] || status || '—';
  let color = 'var(--tx2)';
  if (status === 'checked_in') color = 'var(--status-in)';
  else if (status === 'pre_registered') color = 'var(--accent)';
  else if (status === 'checked_out') color = 'var(--tx3)';
  else if (status === 'cancelled' || status === 'no_show') color = 'var(--status-absent)';
  return (
    '<span class="vis-card-badge" style="background:var(--accent-dim);color:' +
    color +
    '">' +
    _esc(label) +
    '</span>'
  );
}

/** Normalize visit row from API (snake_case). */
export function _normalizeVisit(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    visitorName: raw.visitor_name || raw.visitorName || '',
    visitorCompany: raw.visitor_company || raw.visitorCompany || '',
    visitorEmail: raw.visitor_email || raw.visitorEmail || '',
    visitorPhone: raw.visitor_phone || raw.visitorPhone || '',
    hostEmail: raw.host_email || raw.hostEmail || '',
    purpose: raw.purpose || '',
    expectedDate: raw.expected_date || raw.expectedDate || '',
    expectedTime: raw.expected_time || raw.expectedTime || '',
    expectedDurationMinutes:
      Number(
        raw.expected_duration_minutes != null
          ? raw.expected_duration_minutes
          : raw.expectedDurationMinutes,
      ) || 60,
    actualCheckin: raw.actual_checkin || raw.actualCheckin || null,
    actualCheckout: raw.actual_checkout || raw.actualCheckout || null,
    receptionNotes: raw.reception_notes || raw.receptionNotes || '',
    badgeDataJson: raw.badge_data_json || raw.badgeDataJson || '{}',
    photoFileId: raw.photo_file_id || raw.photoFileId || null,
    status: raw.status || 'pre_registered',
    createdBy: raw.created_by || raw.createdBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

/** Normalize visitor form row. */
export function _normalizeForm(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    visitId: raw.visit_id || raw.visitId || '',
    formType: raw.form_type || raw.formType || 'nda',
    signatureBase64: raw.signature_base64 || raw.signatureBase64 || '',
    fileId: raw.file_id || raw.fileId || null,
    signedAt: raw.signed_at || raw.signedAt || '',
  };
}

function _partitionToday() {
  const today = _todayStr();
  return _visits.filter((v) => v.expectedDate === today);
}

function _partitionUpcoming() {
  const today = _todayStr();
  return _visits.filter(
    (v) => v.expectedDate > today && v.status === 'pre_registered',
  );
}

export function renderVisitorsPage(container) {
  _container = container;
  _tab = 'today';
  _editing = null;
  _filterStatus = '';
  container.innerHTML =
    '<div class="vis-wrap" id="visWrap">' +
      '<div class="vis-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128100;</span> Visitor Management</div>' +
        '<div class="vis-spacer"></div>' +
        '<button type="button" class="vis-btn" id="visAddBtn" style="display:none">+ Add</button>' +
      '</div>' +
      '<div class="vis-tabs" id="visTabs">' +
        '<button type="button" class="vis-tab active" data-tab="today">Today</button>' +
        '<button type="button" class="vis-tab" data-tab="upcoming">Upcoming</button>' +
        '<button type="button" class="vis-tab" data-tab="mine">My Visitors</button>' +
      '</div>' +
      '<div class="vis-stats" id="visStats"></div>' +
      '<div id="visFilters" class="vis-filters"></div>' +
      '<div id="visContent"></div>' +
      '<div class="vis-modal" id="visModal"><div class="vis-modal-box wide" id="visModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _syncAddButton();
  visLoadData();
}

function _syncAddButton() {
  const btn = _container && _container.querySelector('#visAddBtn');
  if (!btn) return;
  const show = _isAdmin() && (_tab === 'today' || _tab === 'upcoming');
  btn.style.display = show ? '' : 'none';
}

function _listQuery() {
  const qs = [];
  if (_filterStatus) qs.push('status=' + encodeURIComponent(_filterStatus));
  return qs.length ? '/api/visitors?' + qs.join('&') : '/api/visitors';
}

export async function visLoadData() {
  _loadError = null;
  _featureOff = false;

  const [listRes, mineRes, countRes] = await Promise.all([
    api.get(_listQuery()),
    api.get('/api/visitors/my-expected'),
    api.get('/api/visitors/checked-in-count'),
  ]);

  if (listRes && listRes._error) {
    _visits = [];
    _loadError = listRes.message || 'Could not load visitors';
    if (listRes.status === 404) {
      _featureOff = true;
      _loadError = 'Visitor Management is disabled for this workspace';
    }
  } else {
    const rows = (listRes && (listRes.visits || listRes.visitors || listRes)) || [];
    _visits = (Array.isArray(rows) ? rows : []).map(_normalizeVisit);
  }

  if (mineRes && !mineRes._error) {
    const rows = mineRes.visits || [];
    _mine = (Array.isArray(rows) ? rows : []).map(_normalizeVisit);
  } else {
    _mine = [];
  }

  if (countRes && !countRes._error) {
    _checkedInCount = Number(countRes.count) || 0;
  } else {
    _checkedInCount = 0;
  }

  visRenderStats();
  visRender();
}

export function visRenderStats() {
  const el = _container && _container.querySelector('#visStats');
  if (!el) return;
  const todayCount = _partitionToday().length;
  const upcomingCount = _partitionUpcoming().length;
  el.innerHTML =
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--accent)">' +
    todayCount +
    '</div><div class="vis-stat-label">Today</div></div>' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--status-in)">' +
    _checkedInCount +
    '</div><div class="vis-stat-label">Checked In</div></div>' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--status-break)">' +
    upcomingCount +
    '</div><div class="vis-stat-label">Upcoming</div></div>' +
    '<div class="vis-stat"><div class="vis-stat-num" style="color:var(--tx2)">' +
    _mine.length +
    '</div><div class="vis-stat-label">My Expected</div></div>';
}

function _empty(text) {
  return (
    '<div class="vis-empty"><div class="vis-empty-icon">&#128100;</div><div class="vis-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

function _renderFilters() {
  const el = _container && _container.querySelector('#visFilters');
  if (!el) return;
  if (_tab === 'mine' || _featureOff) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML =
    '<div class="vis-field"><label>Status</label><select id="visFilterStatus">' +
    '<option value="">All statuses</option>' +
    Object.keys(STATUS_LABELS)
      .map(
        (s) =>
          '<option value="' +
          s +
          '"' +
          (_filterStatus === s ? ' selected' : '') +
          '>' +
          _esc(STATUS_LABELS[s]) +
          '</option>',
      )
      .join('') +
    '</select></div>';
}

export function visRender() {
  const el = _container && _container.querySelector('#visContent');
  if (!el) return;
  _syncAddButton();
  _renderFilters();

  if (_featureOff) {
    el.innerHTML = _empty(_loadError || 'Visitor Management is disabled');
    return;
  }

  if (_tab === 'today') {
    if (_loadError && !_visits.length) {
      el.innerHTML = _empty(_loadError);
      return;
    }
    const list = _partitionToday();
    if (!list.length) {
      el.innerHTML = _empty(
        _isAdmin() ? 'No visitors expected today — register one' : 'No visitors expected today',
      );
      return;
    }
    el.innerHTML = '<div class="vis-grid">' + list.map(_renderVisitCard).join('') + '</div>';
    return;
  }

  if (_tab === 'upcoming') {
    const list = _partitionUpcoming();
    if (!list.length) {
      el.innerHTML = _empty(
        _isAdmin() ? 'No upcoming visits — register one' : 'No upcoming visits',
      );
      return;
    }
    el.innerHTML = '<div class="vis-grid">' + list.map(_renderVisitCard).join('') + '</div>';
    return;
  }

  if (_tab === 'mine') {
    if (!_mine.length) {
      el.innerHTML = _empty('No visitors expected for you');
      return;
    }
    el.innerHTML = '<div class="vis-grid">' + _mine.map(_renderMineCard).join('') + '</div>';
  }
}

function _renderVisitCard(item, i) {
  const admin = _isAdmin();
  let actions =
    '<button type="button" data-action="detail" data-id="' + _esc(item.id) + '">Detail</button>' +
    '<button type="button" data-action="badge" data-id="' + _esc(item.id) + '">Badge</button>';

  if (admin && item.status === 'pre_registered') {
    actions +=
      '<button type="button" data-action="check-in" data-id="' +
      _esc(item.id) +
      '">Check In</button>' +
      '<button type="button" data-action="no-show" data-id="' +
      _esc(item.id) +
      '">No Show</button>' +
      '<button type="button" data-action="edit" data-id="' +
      _esc(item.id) +
      '">Edit</button>' +
      '<button type="button" class="danger" data-action="cancel" data-id="' +
      _esc(item.id) +
      '">Cancel</button>';
  }
  if (admin && item.status === 'checked_in') {
    actions +=
      '<button type="button" data-action="check-out" data-id="' +
      _esc(item.id) +
      '">Check Out</button>' +
      '<button type="button" class="danger" data-action="cancel" data-id="' +
      _esc(item.id) +
      '">Cancel</button>';
  }

  return (
    '<div class="vis-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="vis-card-title">' +
    _esc(item.visitorName) +
    '</div>' +
    '<div class="vis-card-sub">' +
    _esc(item.visitorCompany || '—') +
    ' · Host ' +
    _esc(item.hostEmail) +
    (item.expectedTime ? ' · ' + _esc(item.expectedTime) : '') +
    '</div>' +
    (item.purpose ? '<div class="vis-card-sub">' + _esc(item.purpose) + '</div>' : '') +
    _statusBadge(item.status) +
    '<div class="vis-card-actions">' +
    actions +
    '</div></div>'
  );
}

function _renderMineCard(item, i) {
  return (
    '<div class="vis-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="vis-card-title">' +
    _esc(item.visitorName) +
    '</div>' +
    '<div class="vis-card-sub">' +
    _esc(item.expectedDate) +
    (item.expectedTime ? ' · ' + _esc(item.expectedTime) : '') +
    (item.visitorCompany ? ' · ' + _esc(item.visitorCompany) : '') +
    '</div>' +
    (item.purpose ? '<div class="vis-card-sub">' + _esc(item.purpose) + '</div>' : '') +
    _statusBadge(item.status) +
    '<div class="vis-card-actions">' +
    '<button type="button" data-action="detail" data-id="' +
    _esc(item.id) +
    '">Detail</button>' +
    '</div></div>'
  );
}

function _findVisit(id) {
  return (
    _visits.find((v) => v.id === id) ||
    _mine.find((v) => v.id === id) ||
    null
  );
}

export function visShowForm(item) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  _editing = item || null;
  const isEdit = !!item;
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;
  const today = _todayStr();
  box.innerHTML =
    '<div class="vis-modal-title">' +
    (isEdit ? 'Edit Visit' : 'Register Visitor') +
    '</div>' +
    '<div class="vis-row">' +
    '<div class="vis-field" style="flex:1"><label>Visitor Name *</label><input type="text" id="visF_name" value="' +
    _esc(item ? item.visitorName : '') +
    '"></div>' +
    '<div class="vis-field" style="flex:1"><label>Company</label><input type="text" id="visF_company" value="' +
    _esc(item ? item.visitorCompany : '') +
    '"></div>' +
    '</div>' +
    '<div class="vis-row">' +
    '<div class="vis-field" style="flex:1"><label>Email</label><input type="email" id="visF_email" value="' +
    _esc(item ? item.visitorEmail : '') +
    '"></div>' +
    '<div class="vis-field" style="flex:1"><label>Phone</label><input type="text" id="visF_phone" value="' +
    _esc(item ? item.visitorPhone : '') +
    '"></div>' +
    '</div>' +
    '<div class="vis-field"><label>Host Email *</label><input type="email" id="visF_host" value="' +
    _esc(item ? item.hostEmail : '') +
    '" ' +
    (isEdit ? 'readonly' : '') +
    '></div>' +
    '<div class="vis-row">' +
    '<div class="vis-field" style="flex:1"><label>Expected Date *</label><input type="date" id="visF_date" value="' +
    _esc(item ? item.expectedDate : today) +
    '"></div>' +
    '<div class="vis-field" style="flex:1"><label>Expected Time</label><input type="time" id="visF_time" value="' +
    _esc(item ? item.expectedTime : '') +
    '"></div>' +
    '<div class="vis-field" style="flex:1"><label>Duration (min)</label><input type="number" id="visF_duration" min="15" value="' +
    _esc(item ? String(item.expectedDurationMinutes || 60) : '60') +
    '"></div>' +
    '</div>' +
    '<div class="vis-field"><label>Purpose</label><input type="text" id="visF_purpose" value="' +
    _esc(item ? item.purpose : '') +
    '"></div>' +
    '<div class="vis-form-actions">' +
    '<button type="button" class="vis-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="vis-btn" id="visSaveBtn">' +
    (isEdit ? 'Update' : 'Register') +
    '</button></div>';
  const modal = _container.querySelector('#visModal');
  if (modal) modal.classList.add('open');
  const saveBtn = box.querySelector('#visSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', visSave);
}

export async function visSave() {
  if (_saving || !_isAdmin()) return;
  const name = ((_container.querySelector('#visF_name') || {}).value || '').trim();
  const hostEmail = ((_container.querySelector('#visF_host') || {}).value || '')
    .trim()
    .toLowerCase();
  const expectedDate = ((_container.querySelector('#visF_date') || {}).value || '').trim();
  if (!name) {
    toast('Visitor name is required', 'error');
    return;
  }
  if (!_editing && !hostEmail) {
    toast('Host email is required', 'error');
    return;
  }
  if (!expectedDate) {
    toast('Expected date is required', 'error');
    return;
  }

  const body = {
    visitorName: name,
    visitorCompany: ((_container.querySelector('#visF_company') || {}).value || '').trim(),
    visitorEmail: ((_container.querySelector('#visF_email') || {}).value || '').trim(),
    visitorPhone: ((_container.querySelector('#visF_phone') || {}).value || '').trim(),
    purpose: ((_container.querySelector('#visF_purpose') || {}).value || '').trim(),
    expectedDate,
    expectedTime: ((_container.querySelector('#visF_time') || {}).value || '').trim(),
    expectedDurationMinutes:
      Number((_container.querySelector('#visF_duration') || {}).value) || 60,
  };

  _saving = true;
  let result;
  if (_editing && _editing.id) {
    result = await api.put('/api/visitors/' + _editing.id, body);
  } else {
    body.hostEmail = hostEmail;
    result = await api.post('/api/visitors', body);
  }
  _saving = false;

  if (result && !result._error) {
    toast(_editing ? 'Updated' : 'Registered', 'success');
    visCloseModal();
    _editing = null;
    await visLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to save', 'error');
}

export async function visCheckIn(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const notes = await promptDialog({
    title: 'Check in visitor',
    label: 'Reception notes (optional)',
    placeholder: 'Anything to record at reception?',
    confirmLabel: 'Check in',
  });
  if (notes === null) return;
  const result = await api.post('/api/visitors/' + id + '/check-in', {
    receptionNotes: notes,
  });
  if (result && !result._error) {
    toast('Checked in', 'success');
    await visLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to check in', 'error');
}

export async function visCheckOut(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const result = await api.post('/api/visitors/' + id + '/check-out', {});
  if (result && !result._error) {
    toast('Checked out', 'success');
    await visLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to check out', 'error');
}

export async function visCancel(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  if (!(await confirmDialog({ message: 'Cancel this visit?', confirmLabel: 'Cancel visit', cancelLabel: 'Keep', danger: true }))) return;
  const result = await api.post('/api/visitors/' + id + '/cancel', {});
  if (result && !result._error) {
    toast('Cancelled', 'success');
    await visLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to cancel', 'error');
}

export async function visMarkNoShow(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  if (!(await confirmDialog({ message: 'Mark this visitor as no-show?', confirmLabel: 'Mark no-show', danger: true }))) return;
  const result = await api.post('/api/visitors/' + id + '/no-show', {});
  if (result && !result._error) {
    toast('Marked no-show', 'success');
    await visLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function visShowDetail(id) {
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;
  box.innerHTML = '<div class="vis-modal-title">Loading…</div>';
  const modal = _container.querySelector('#visModal');
  if (modal) modal.classList.add('open');

  const [detailRes, formsRes] = await Promise.all([
    api.get('/api/visitors/' + id),
    api.get('/api/visitors/' + id + '/forms'),
  ]);

  if (detailRes && detailRes._error) {
    box.innerHTML =
      '<div class="vis-modal-title">Visit</div><div class="vis-empty-text">' +
      _esc(detailRes.message || 'Not found') +
      '</div>' +
      '<div class="vis-form-actions"><button type="button" class="vis-btn ghost" data-action="close-modal">Close</button></div>';
    return;
  }

  const visit = _normalizeVisit(detailRes.visit || detailRes);
  const forms = ((formsRes && formsRes.forms) || []).map(_normalizeForm);

  let formsHtml = '<div class="vis-history-empty">No forms signed</div>';
  if (forms.length) {
    formsHtml = forms
      .map(
        (f) =>
          '<div class="vis-history-row">' +
          _esc(f.formType.toUpperCase()) +
          ' · ' +
          _esc(f.signedAt || '—') +
          '</div>',
      )
      .join('');
  }

  const admin = _isAdmin();
  box.innerHTML =
    '<div class="vis-modal-title">' +
    _esc(visit.visitorName) +
    '</div>' +
    '<div class="vis-detail-meta">' +
    _statusBadge(visit.status) +
    ' · ' +
    _esc(visit.expectedDate) +
    (visit.expectedTime ? ' ' + _esc(visit.expectedTime) : '') +
    '</div>' +
    '<div class="vis-detail-grid">' +
    '<div><span class="vis-detail-label">Company</span> ' +
    _esc(visit.visitorCompany || '—') +
    '</div>' +
    '<div><span class="vis-detail-label">Host</span> ' +
    _esc(visit.hostEmail) +
    '</div>' +
    '<div><span class="vis-detail-label">Email</span> ' +
    _esc(visit.visitorEmail || '—') +
    '</div>' +
    '<div><span class="vis-detail-label">Phone</span> ' +
    _esc(visit.visitorPhone || '—') +
    '</div>' +
    '<div><span class="vis-detail-label">Purpose</span> ' +
    _esc(visit.purpose || '—') +
    '</div>' +
    '<div><span class="vis-detail-label">Duration</span> ' +
    _esc(String(visit.expectedDurationMinutes)) +
    ' min</div>' +
    '<div><span class="vis-detail-label">Check-in</span> ' +
    _esc(visit.actualCheckin || '—') +
    '</div>' +
    '<div><span class="vis-detail-label">Check-out</span> ' +
    _esc(visit.actualCheckout || '—') +
    '</div>' +
    '</div>' +
    (visit.receptionNotes
      ? '<div class="vis-card-sub" style="margin:10px 0">Notes: ' +
        _esc(visit.receptionNotes) +
        '</div>'
      : '') +
    '<div class="vis-section-title">Forms</div>' +
    '<div class="vis-history">' +
    formsHtml +
    '</div>' +
    '<div class="vis-form-actions">' +
    (admin
      ? '<button type="button" class="vis-btn ghost" data-action="sign-nda" data-id="' +
        _esc(visit.id) +
        '">Sign NDA</button>'
      : '') +
    '<button type="button" class="vis-btn ghost" data-action="badge" data-id="' +
    _esc(visit.id) +
    '">Badge</button>' +
    '<button type="button" class="vis-btn ghost" data-action="close-modal">Close</button>' +
    '</div>';
}

export async function visSignNda(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const result = await api.post('/api/visitors/' + id + '/forms', {
    formType: 'nda',
    signatureBase64: 'acknowledged',
  });
  if (result && !result._error) {
    toast('NDA signed', 'success');
    await visShowDetail(id);
    return;
  }
  toast((result && result.message) || 'Failed to sign NDA', 'error');
}

export function visShowBadge(id) {
  const visit = _findVisit(id);
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;

  const render = function (v) {
    box.innerHTML =
      '<div class="vis-modal-title">Visitor Badge</div>' +
      '<div class="vis-badge" id="visBadgePrint">' +
      '<div class="vis-badge-title">VISITOR</div>' +
      '<div class="vis-badge-name">' +
      _esc(v.visitorName) +
      '</div>' +
      '<div class="vis-badge-meta">' +
      _esc(v.visitorCompany || 'Guest') +
      '</div>' +
      '<div class="vis-badge-meta">Host: ' +
      _esc(v.hostEmail) +
      '</div>' +
      '<div class="vis-badge-meta">' +
      _esc(v.expectedDate) +
      (v.expectedTime ? ' · ' + _esc(v.expectedTime) : '') +
      '</div>' +
      (v.purpose
        ? '<div class="vis-badge-meta">' + _esc(v.purpose) + '</div>'
        : '') +
      '</div>' +
      '<div class="vis-form-actions">' +
      '<button type="button" class="vis-btn ghost" data-action="close-modal">Close</button>' +
      '<button type="button" class="vis-btn" id="visPrintBadge">Print</button>' +
      '</div>';
    const modal = _container.querySelector('#visModal');
    if (modal) modal.classList.add('open');
    const printBtn = box.querySelector('#visPrintBadge');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  };

  if (visit) {
    render(visit);
    return;
  }

  box.innerHTML = '<div class="vis-modal-title">Loading…</div>';
  const modal = _container.querySelector('#visModal');
  if (modal) modal.classList.add('open');
  api.get('/api/visitors/' + id).then(function (res) {
    if (res && !res._error) {
      render(_normalizeVisit(res.visit || res));
    } else {
      box.innerHTML =
        '<div class="vis-modal-title">Badge</div><div class="vis-empty-text">Visit not found</div>' +
        '<div class="vis-form-actions"><button type="button" class="vis-btn ghost" data-action="close-modal">Close</button></div>';
    }
  });
}

export function visCloseModal() {
  const modal = _container && _container.querySelector('#visModal');
  if (modal) modal.classList.remove('open');
  _editing = null;
}

function _syncTabs() {
  if (!_container) return;
  _container.querySelectorAll('.vis-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#visAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      visShowForm(null);
    });
  }

  const modal = container.querySelector('#visModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) visCloseModal();
    });
  }

  container.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.classList.contains('vis-tab')) {
      _tab = tab.dataset.tab || 'today';
      _syncTabs();
      visRender();
      return;
    }
    if (e.target.closest('[data-action="close-modal"]')) {
      visCloseModal();
      return;
    }
    const signBtn = e.target.closest('[data-action="sign-nda"]');
    if (signBtn) {
      visSignNda(signBtn.dataset.id);
      return;
    }
    const badgeInModal = e.target.closest('#visModalBox [data-action="badge"]');
    if (badgeInModal) {
      visShowBadge(badgeInModal.dataset.id);
    }
  });

  container.addEventListener('change', function (e) {
    if (e.target.id === 'visFilterStatus') {
      _filterStatus = e.target.value || '';
      visLoadData();
    }
  });

  const content = container.querySelector('#visContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit') {
        const visit = _findVisit(id);
        if (visit) visShowForm(visit);
      } else if (action === 'check-in') visCheckIn(id);
      else if (action === 'check-out') visCheckOut(id);
      else if (action === 'cancel') visCancel(id);
      else if (action === 'no-show') visMarkNoShow(id);
      else if (action === 'detail') visShowDetail(id);
      else if (action === 'badge') visShowBadge(id);
    });
  }
}

export function _getVisits() {
  return _visits;
}
export function _getMine() {
  return _mine;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _getCheckedInCount() {
  return _checkedInCount;
}
export function _resetState() {
  _container = null;
  _tab = 'today';
  _visits = [];
  _mine = [];
  _checkedInCount = 0;
  _filterStatus = '';
  _loadError = null;
  _featureOff = false;
  _saving = false;
  _editing = null;
}

registerModule('visitors', renderVisitorsPage);

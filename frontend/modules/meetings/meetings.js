/**
 * modules/meetings/meetings.js
 *
 * Personal calendar (Microsoft / Google) + BD + tracked meetings.
 * Full interactive workflows: create, qualify, reject, approve, edit, delete, sync.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { promptDialog, confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tracked = [];
let _bd = [];
let _myEvents = [];
let _orgEvents = [];
let _calStatus = { providers: [] };
let _userRoles = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _session() {
  return getSession();
}

function _fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

async function _ensureRoles() {
  if (_userRoles) return _userRoles;
  const res = await api.get('/api/settings/me/roles');
  _userRoles = (res && !res._error) ? res : { isAdmin: _isAdmin(), isGlobalManager: false, isGlobalHR: false };
  return _userRoles;
}

export function renderMeetingsPage(container) {
  _container = container;
  _userRoles = null;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="mtg-wrap">' +
      '<div class="mtg-toolbar">' +
        '<div class="mtg-title"><span>&#128197;</span> Meetings</div>' +
        '<div class="mtg-spacer"></div>' +
        '<button type="button" class="mtg-btn" id="mtgBtnCreateBD">+ BD Meeting</button>' +
        '<button type="button" class="mtg-btn" id="mtgBtnCreateTracked">+ Tracked Meeting</button>' +
        '<button type="button" class="mtg-btn ghost" id="mtgRefresh">Refresh</button>' +
      '</div>' +
      '<div class="mtg-hint mf">Your calendar, BD meeting requests, and tracked meetings.</div>' +
      '<div class="mtg-section-title">My calendar</div>' +
      '<div id="mtgCalActions" class="mtg-cal-actions"></div>' +
      '<div id="mtgMyCalList" class="mtg-list"><div class="mtg-empty">Loading...</div></div>' +
      (admin ? '<div class="mtg-section-title">Team calendars</div><div id="mtgOrgCalList" class="mtg-list"><div class="mtg-empty">Loading...</div></div>' : '') +
      '<div class="mtg-section-title">My BD meetings</div>' +
      '<div id="mtgBdList" class="mtg-list"><div class="mtg-empty">Loading...</div></div>' +
      '<div class="mtg-section-title">Tracked meetings</div>' +
      '<div id="mtgTrackedList" class="mtg-list"><div class="mtg-empty">Loading...</div></div>' +
    '</div>';

  const refresh = container.querySelector('#mtgRefresh');
  if (refresh) refresh.addEventListener('click', mtgLoadData);
  const btnBD = container.querySelector('#mtgBtnCreateBD');
  if (btnBD) btnBD.addEventListener('click', mtgCreateBD);
  const btnT = container.querySelector('#mtgBtnCreateTracked');
  if (btnT) btnT.addEventListener('click', mtgCreateTracked);
  const calActions = container.querySelector('#mtgCalActions');
  if (calActions) {
    calActions.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cal-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-cal-action');
      const provider = btn.getAttribute('data-provider');
      if (action === 'connect' && provider) mtgConnect(provider);
      if (action === 'link' && provider) mtgLink(provider);
      if (action === 'disconnect' && provider) mtgDisconnect(provider);
    });
  }
  _handleCalendarQueryToast();
  mtgLoadData();
}

function _handleCalendarQueryToast() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const cal = params.get('calendar');
    if (!cal) return;
    if (cal === 'connected') toast('Calendar connected', 'success');
    else if (cal === 'error') toast(params.get('calendar_error') || 'Calendar connection failed', 'error');
    params.delete('calendar'); params.delete('calendar_error');
    const next = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (next ? '?' + next : '') + (window.location.hash || ''));
  } catch { /* ignore */ }
}

export async function mtgLoadData() {
  if (!_container) return;
  const session = _session();
  const email = session ? session.email : '';
  const admin = _isAdmin();
  const bdEl = _container.querySelector('#mtgBdList');
  const trackedEl = _container.querySelector('#mtgTrackedList');
  if (bdEl) bdEl.innerHTML = '<div class="mtg-empty">Loading...</div>';
  if (trackedEl) trackedEl.innerHTML = '<div class="mtg-empty">Loading...</div>';

  const [tracked, bd, status, myCal, orgCal] = await Promise.all([
    api.get('/api/meetings'),
    email ? api.get('/api/bd-meetings?email=' + encodeURIComponent(email)) : Promise.resolve(null),
    email ? api.get('/api/meetings/calendar/status') : Promise.resolve(null),
    email ? api.get('/api/meetings/my-calendar') : Promise.resolve(null),
    admin ? api.get('/api/meetings/calendar/org') : Promise.resolve(null),
  ]);

  _tracked = (tracked && !tracked._error) ? (Array.isArray(tracked.meetings) ? tracked.meetings : []) : [];
  _bd = (bd && !bd._error) ? (Array.isArray(bd.meetings) ? bd.meetings : []) : [];
  _calStatus = (status && !status._error) ? status : { providers: [] };
  _myEvents = (myCal && !myCal._error && Array.isArray(myCal.events)) ? myCal.events : [];
  _orgEvents = (orgCal && !orgCal._error && Array.isArray(orgCal.events)) ? orgCal.events : [];
  await _ensureRoles();
  mtgRender();
}

// -- Calendar --
async function mtgConnect(provider) {
  const res = await api.get('/api/meetings/calendar/connect/' + encodeURIComponent(provider));
  if (res && !res._error && res.authorizeUrl) { window.location.href = res.authorizeUrl; return; }
  toast((res && (res.message || res.error)) || 'Calendar connect is not configured', 'error');
}
async function mtgLink(provider) {
  const labels = { zoom: 'Zoom user ID or email', webex: 'Webex host email', gotomeeting: 'GoTo organizer key', bluejeans: 'BlueJeans user ID' };
  const session = _session();
  const externalUserId = await promptDialog({ title: 'Link ' + (provider || 'platform') + ' calendar', label: labels[provider] || 'Platform user ID', value: session && session.email ? session.email : '', placeholder: 'Leave blank to use your login email', confirmLabel: 'Link' });
  if (externalUserId === null) return;
  const res = await api.post('/api/meetings/calendar/link/' + encodeURIComponent(provider), { externalUserId: (externalUserId || '').trim() || undefined });
  if (res && !res._error && res.success) { toast((provider || 'Platform') + ' linked', 'success'); mtgLoadData(); return; }
  toast((res && (res.message || res.error)) || 'Link failed', 'error');
}
async function mtgDisconnect(provider) {
  if (!(await confirmDialog({ message: 'Disconnect ' + provider + ' calendar?', confirmLabel: 'Disconnect', danger: true }))) return;
  const res = await api.delete('/api/meetings/calendar/connect/' + encodeURIComponent(provider));
  if (res && !res._error) { toast('Disconnected', 'success'); mtgLoadData(); return; }
  toast((res && (res.message || res.error)) || 'Failed to disconnect', 'error');
}

// -- BD Meetings --
async function mtgCreateBD() {
  const session = _session();
  if (!session || !session.email) { toast('Not logged in', 'error'); return; }
  const client = await promptDialog({ title: 'New BD Meeting', label: 'Client name', confirmLabel: 'Next' });
  if (client === null) return;
  if (!client.trim()) { toast('Client name is required', 'error'); return; }
  const date = await promptDialog({ title: 'BD Meeting date', label: 'Date (YYYY-MM-DD)', value: new Date().toISOString().split('T')[0], confirmLabel: 'Next' });
  if (date === null) return;
  const notes = await promptDialog({ title: 'Notes (optional)', label: 'Notes', confirmLabel: 'Submit' });
  if (notes === null) return;
  const btn = _container && _container.querySelector('#mtgBtnCreateBD');
  if (btn) btn.disabled = true;
  const res = await api.post('/api/bd-meetings', { email: session.email, name: session.name || session.email, client: client.trim(), date: date.trim(), notes: (notes || '').trim(), time: '', location: '' });
  if (btn) btn.disabled = false;
  if (res && !res._error && res.success !== false) { toast('BD meeting submitted', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to submit', 'error'); }
}
async function mtgQualify(meetingId) {
  if (!(await confirmDialog({ message: 'Qualify this BD meeting?', confirmLabel: 'Qualify' }))) return;
  const res = await api.post('/api/bd-meetings/qualify', { meetingId });
  if (res && !res._error && res.success !== false) { toast('Meeting qualified', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to qualify', 'error'); }
}
async function mtgReject(meetingId) {
  const reason = await promptDialog({ title: 'Reject BD meeting', label: 'Reason (optional)', confirmLabel: 'Reject' });
  if (reason === null) return;
  const res = await api.post('/api/bd-meetings/reject', { meetingId, reason: (reason || '').trim() });
  if (res && !res._error && res.success !== false) { toast('Meeting rejected', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to reject', 'error'); }
}
async function mtgApprove(meetingId) {
  if (!(await confirmDialog({ message: 'Approve this BD meeting?', confirmLabel: 'Approve' }))) return;
  const res = await api.post('/api/bd-meetings/approve', { meetingId });
  if (res && !res._error && res.success !== false) { toast('Meeting approved', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to approve', 'error'); }
}

// -- Tracked Meetings --
async function mtgCreateTracked() {
  const name = await promptDialog({ title: 'New Tracked Meeting', label: 'Meeting name', confirmLabel: 'Next' });
  if (name === null) return;
  if (!name.trim()) { toast('Meeting name is required', 'error'); return; }
  const joinUrl = await promptDialog({ title: 'Join URL (optional)', label: 'Join URL', placeholder: 'https://teams.microsoft.com/...', confirmLabel: 'Create' });
  if (joinUrl === null) return;
  const btn = _container && _container.querySelector('#mtgBtnCreateTracked');
  if (btn) btn.disabled = true;
  const res = await api.post('/api/meetings', { name: name.trim(), joinUrl: (joinUrl || '').trim(), client: '', purpose: '' });
  if (btn) btn.disabled = false;
  if (res && !res._error && res.success !== false) { toast('Tracked meeting created', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to create meeting', 'error'); }
}
async function mtgEditTracked(meetingId) {
  const existing = _tracked.find(function (m) { return m.id === meetingId; });
  if (!existing) return;
  const client = await promptDialog({ title: 'Edit meeting - Client', label: 'Client name', value: existing.client || '', confirmLabel: 'Save' });
  if (client === null) return;
  const purpose = await promptDialog({ title: 'Edit meeting - Purpose', label: 'Purpose', value: existing.purpose || '', confirmLabel: 'Save' });
  if (purpose === null) return;
  const res = await api.put('/api/meetings/' + encodeURIComponent(meetingId), { client: client.trim(), purpose: purpose.trim() });
  if (res && !res._error && res.success !== false) { toast('Meeting updated', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to update meeting', 'error'); }
}
async function mtgDeleteTracked(meetingId) {
  if (!(await confirmDialog({ message: 'Delete this tracked meeting? This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
  const res = await api.delete('/api/meetings/' + encodeURIComponent(meetingId));
  if (res && !res._error && res.success !== false) { toast('Meeting deleted', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Failed to delete meeting', 'error'); }
}
async function mtgSyncAttendance(meetingId) {
  const today = new Date().toISOString().split('T')[0];
  const sessionDate = await promptDialog({ title: 'Sync attendance', label: 'Session date', value: today, confirmLabel: 'Sync' });
  if (sessionDate === null) return;
  const res = await api.post('/api/meetings/' + encodeURIComponent(meetingId) + '/sync-attendance', { sessionDate: (sessionDate || today).trim() });
  if (res && !res._error && res.success !== false) { toast('Attendance synced', 'success'); mtgLoadData(); }
  else { toast((res && (res.error || res.message)) || 'Sync failed (platform credentials may not be configured)', 'error'); }
}

// -- Render --
function _providerLabel(provider) {
  const map = { microsoft: 'Microsoft', google: 'Google', zoom: 'Zoom', webex: 'Webex', gotomeeting: 'GoTo', bluejeans: 'BlueJeans' };
  return map[provider] || provider;
}
function _bdStatusBadge(status) {
  const cls = { pending: 'mtg-badge-pending', qualified: 'mtg-badge-qualified', notified: 'mtg-badge-qualified', approved: 'mtg-badge-approved', rejected: 'mtg-badge-rejected' };
  return '<span class="mtg-badge ' + (cls[status] || '') + '">' + _esc(status || 'unknown') + '</span>';
}
function mtgRenderCalActions() {
  const el = _container && _container.querySelector('#mtgCalActions');
  if (!el) return;
  const providers = (_calStatus && _calStatus.providers) || [];
  if (!providers.length) { el.innerHTML = '<div class="mtg-empty">Sign in to connect Microsoft or Google. Other providers require admin to configure API credentials.</div>'; return; }
  el.innerHTML = providers.map(function (p) {
    const label = _providerLabel(p.provider);
    if (!p.configured) return '<span class="mtg-cal-chip muted">' + _esc(label) + ' -- not configured (admin must add credentials)</span>';
    if (p.connected) {
      const idHint = p.externalUserId || p.accountEmail || '';
      return '<span class="mtg-cal-chip">' + _esc(label) + (idHint ? ' - ' + _esc(idHint) : '') + '</span><button type="button" class="mtg-btn ghost" data-cal-action="disconnect" data-provider="' + _esc(p.provider) + '">Disconnect ' + _esc(label) + '</button>';
    }
    if (p.authMode === 'link') return '<button type="button" class="mtg-btn ghost" data-cal-action="link" data-provider="' + _esc(p.provider) + '">Link ' + _esc(label) + '</button>';
    return '<button type="button" class="mtg-btn ghost" data-cal-action="connect" data-provider="' + _esc(p.provider) + '">Connect ' + _esc(label) + '</button>';
  }).join('');
}
function _eventCard(m, showOwner) {
  return '<div class="mtg-card"><div class="mtg-card-title">' + _esc(m.subject || 'Meeting') + '</div><div class="mtg-card-sub">' + _esc(_fmtWhen(m.start)) + (m.end ? ' - ' + _esc(_fmtWhen(m.end)) : '') + (m.provider ? ' - ' + _esc(m.provider) : '') + (showOwner && m.ownerEmail ? ' - ' + _esc(m.ownerEmail) : '') + (m.location ? ' - ' + _esc(m.location) : '') + '</div>' + (m.joinUrl ? '<div class="mtg-card-sub"><a class="mtg-link" href="' + _esc(m.joinUrl) + '" target="_blank" rel="noopener">Join</a></div>' : '') + '</div>';
}
function mtgRender() {
  mtgRenderCalActions();
  const myEl = _container && _container.querySelector('#mtgMyCalList');
  if (myEl) {
    const connected = ((_calStatus && _calStatus.providers) || []).some(function (p) { return p.connected; });
    myEl.innerHTML = !_myEvents.length ? '<div class="mtg-empty">' + (connected ? 'No upcoming events in the next 14 days' : 'Connect Microsoft/Google or link Zoom/Webex/GoTo/BlueJeans to see your calendar') + '</div>' : _myEvents.map(function (m) { return _eventCard(m, false); }).join('');
  }
  const orgEl = _container && _container.querySelector('#mtgOrgCalList');
  if (orgEl) { orgEl.innerHTML = !_orgEvents.length ? '<div class="mtg-empty">No team calendar events (team members must connect their calendars)</div>' : _orgEvents.map(function (m) { return _eventCard(m, true); }).join(''); }
  _renderBdList();
  _renderTrackedList();
}
function _renderBdList() {
  const bdEl = _container && _container.querySelector('#mtgBdList');
  if (!bdEl) return;
  const session = _session();
  const myEmail = session && session.email ? session.email.toLowerCase().trim() : '';
  const roles = _userRoles || {};
  const canManage = roles.isAdmin || roles.isGlobalManager || roles.isGlobalHR;
  const canApprove = roles.isAdmin || roles.isGlobalHR;
  if (!_bd.length) { bdEl.innerHTML = '<div class="mtg-empty">No BD meeting requests yet. Click <em>+ BD Meeting</em> to submit one.</div>'; return; }
  bdEl.innerHTML = _bd.map(function (m) {
    const isOwner = m.email && m.email.toLowerCase().trim() === myEmail;
    const qualifiable = m.status === 'pending' && canManage && !isOwner;
    const approvable = (m.status === 'qualified' || m.status === 'notified') && canApprove;
    const rejectable = m.status !== 'approved' && m.status !== 'rejected' && canManage && !isOwner;
    return '<div class="mtg-card"><div class="mtg-card-title">' + _esc(m.client || m.name || 'BD Meeting') + '</div><div class="mtg-card-sub">' + _esc(m.date || '') + (m.email && !isOwner ? ' - ' + _esc(m.email) : '') + ' - ' + _bdStatusBadge(m.status) + (m.qualifier_email ? ' - Qualified by: ' + _esc(m.qualifier_email) : '') + (m.approver_email ? ' - Approved by: ' + _esc(m.approver_email) : '') + (m.rejection_reason ? ' - ' + _esc(m.rejection_reason) : '') + '</div><div class="mtg-card-actions">' + (qualifiable ? '<button type="button" class="mtg-btn ghost mtg-action-qualify" data-id="' + _esc(m.id) + '">Qualify</button>' : '') + (approvable ? '<button type="button" class="mtg-btn ghost mtg-action-approve" data-id="' + _esc(m.id) + '">Approve</button>' : '') + (rejectable ? '<button type="button" class="mtg-btn ghost danger mtg-action-reject" data-id="' + _esc(m.id) + '">Reject</button>' : '') + '</div></div>';
  }).join('');
  bdEl.addEventListener('click', function bdClick(e) {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('mtg-action-qualify')) mtgQualify(id);
    else if (btn.classList.contains('mtg-action-approve')) mtgApprove(id);
    else if (btn.classList.contains('mtg-action-reject')) mtgReject(id);
    bdEl.removeEventListener('click', bdClick);
  });
}
function _renderTrackedList() {
  const trackedEl = _container && _container.querySelector('#mtgTrackedList');
  if (!trackedEl) return;
  const session = _session();
  const myEmail = session && session.email ? session.email.toLowerCase().trim() : '';
  if (!_tracked.length) { trackedEl.innerHTML = '<div class="mtg-empty">No tracked meetings yet. Click <em>+ Tracked Meeting</em> to add one.</div>'; return; }
  trackedEl.innerHTML = _tracked.map(function (m) {
    const isOwner = m.added_by && m.added_by.toLowerCase().trim() === myEmail;
    return '<div class="mtg-card"><div class="mtg-card-title">' + _esc(m.name || m.platform || 'Meeting') + '</div><div class="mtg-card-sub">' + _esc(m.platform || 'manual') + (m.client ? ' - ' + _esc(m.client) : '') + (m.purpose ? ' - ' + _esc(m.purpose) : '') + (m.join_url ? ' - <a class="mtg-link" href="' + _esc(m.join_url) + '" target="_blank" rel="noopener">Join</a>' : '') + '</div><div class="mtg-card-actions"><button type="button" class="mtg-btn ghost mtg-action-sync" data-id="' + _esc(m.id) + '">Sync attendance</button>' + (isOwner ? '<button type="button" class="mtg-btn ghost mtg-action-edit" data-id="' + _esc(m.id) + '">Edit</button><button type="button" class="mtg-btn ghost danger mtg-action-delete" data-id="' + _esc(m.id) + '">Delete</button>' : '') + '</div></div>';
  }).join('');
  trackedEl.addEventListener('click', function trkClick(e) {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('mtg-action-edit')) mtgEditTracked(id);
    else if (btn.classList.contains('mtg-action-delete')) mtgDeleteTracked(id);
    else if (btn.classList.contains('mtg-action-sync')) mtgSyncAttendance(id);
    trackedEl.removeEventListener('click', trkClick);
  });
}

registerModule('meetings', renderMeetingsPage);

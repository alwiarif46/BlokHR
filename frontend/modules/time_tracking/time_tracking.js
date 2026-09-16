/**
 * modules/time_tracking/time_tracking.js
 *
 * Employee self-service time entries + admin clients/projects.
 * Calls services/time-tracking via api.hr('time-tracking').
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tab = 'entries';
let _entries = [];
let _projects = [];
let _clients = [];
let _summary = null;
let _loadError = null;
let _featureOff = false;
let _unavailable = false;
let _busy = false;
let _filters = { start: '', end: '', projectId: '', clientId: '' };
let _editEntry = null;
let _keydownHandler = null;

function ttApi() {
  return api.hr('time-tracking');
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

function _canAdminCatalog() {
  const r = _role();
  return r === 'admin' || !!_session().is_admin || !!_session().isAdmin;
}

function _canApprove() {
  const r = _role();
  return r === 'admin' || r === 'hr' || r === 'manager' || !!_session().is_admin;
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

function _emptyState(title, detail, retry) {
  return (
    '<div class="tt-empty" role="status">' +
    '<div class="tt-empty-icon" aria-hidden="true">&#9201;</div>' +
    '<div class="tt-empty-text">' +
    _esc(title) +
    '</div>' +
    (detail
      ? '<div class="tt-empty-detail">' + _esc(detail) + '</div>'
      : '') +
    (retry
      ? '<button type="button" class="tt-btn" data-action="retry" style="margin-top:12px">Retry</button>'
      : '') +
    '</div>'
  );
}

function _classifyError(res) {
  if (!res || !res._error) return null;
  if (res.error === 'upstream_unavailable' || res.status === 502) {
    return { unavailable: true, message: res.message || 'Time tracking service is unavailable' };
  }
  if (res.status === 403 || res.status === 402 || res.error === 'feature_disabled') {
    return { featureOff: true, message: res.message || 'Time Tracking is disabled for this workspace' };
  }
  if (res.status === 404) {
    return { featureOff: true, message: 'Time Tracking is not available on this plan' };
  }
  return { message: res.message || 'Could not load time tracking' };
}

export function renderTimeTrackingPage(container) {
  _container = container;
  _tab = 'entries';
  _loadError = null;
  _featureOff = false;
  _unavailable = false;
  _busy = false;
  _editEntry = null;

  const adminTabs = _canAdminCatalog()
    ? '<button type="button" class="tt-tab" data-tab="projects">Projects</button>' +
      '<button type="button" class="tt-tab" data-tab="clients">Clients</button>'
    : '';

  container.innerHTML =
    '<div class="tt-wrap" id="ttWrap">' +
    '<div class="tt-toolbar">' +
    '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px">' +
    '<span aria-hidden="true">&#9201;</span> Time Tracking</div>' +
    '<div class="tt-spacer"></div>' +
    '<button type="button" class="tt-btn" id="ttAddBtn">+ Log time</button>' +
    '</div>' +
    '<div class="tt-tabs" role="tablist">' +
    '<button type="button" class="tt-tab active" data-tab="entries" role="tab" aria-selected="true">My entries</button>' +
    adminTabs +
    '</div>' +
    '<div class="tt-filters" id="ttFilters"></div>' +
    '<div class="tt-stats" id="ttStats"></div>' +
    '<div id="ttContent" aria-live="polite"></div>' +
    '<div class="tt-modal" id="ttModal" role="dialog" aria-modal="true" aria-labelledby="ttModalTitle" hidden>' +
    '<div class="tt-modal-box" id="ttModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  ttRenderFilters();
  ttLoadData();
}

function ttRenderFilters() {
  const el = _container && _container.querySelector('#ttFilters');
  if (!el) return;
  if (_tab !== 'entries') {
    el.innerHTML = '';
    return;
  }
  const projectOpts =
    '<option value="">All projects</option>' +
    _projects
      .map(
        (p) =>
          '<option value="' +
          _esc(p.id) +
          '"' +
          (_filters.projectId === p.id ? ' selected' : '') +
          '>' +
          _esc(p.name) +
          '</option>',
      )
      .join('');
  const clientOpts =
    '<option value="">All clients</option>' +
    _clients
      .map(
        (c) =>
          '<option value="' +
          _esc(c.id) +
          '"' +
          (_filters.clientId === c.id ? ' selected' : '') +
          '>' +
          _esc(c.name) +
          '</option>',
      )
      .join('');
  el.innerHTML =
    '<label class="tt-filter"><span>From</span><input type="date" id="ttFilterStart" value="' +
    _esc(_filters.start) +
    '"></label>' +
    '<label class="tt-filter"><span>To</span><input type="date" id="ttFilterEnd" value="' +
    _esc(_filters.end) +
    '"></label>' +
    '<label class="tt-filter"><span>Project</span><select id="ttFilterProject">' +
    projectOpts +
    '</select></label>' +
    '<label class="tt-filter"><span>Client</span><select id="ttFilterClient">' +
    clientOpts +
    '</select></label>' +
    '<button type="button" class="tt-btn ghost" data-action="apply-filters">Apply</button>';
}

export async function ttLoadData() {
  if (!_container) return;
  _loadError = null;
  _featureOff = false;
  _unavailable = false;

  const content = _container.querySelector('#ttContent');
  if (content) content.innerHTML = '<div class="tt-empty"><div class="tt-empty-text">Loading…</div></div>';

  const client = ttApi();
  const qs = [];
  if (_filters.start) qs.push('start_date=' + encodeURIComponent(_filters.start));
  if (_filters.end) qs.push('end_date=' + encodeURIComponent(_filters.end));
  if (_filters.projectId) qs.push('project_id=' + encodeURIComponent(_filters.projectId));
  if (_filters.clientId) qs.push('client_id=' + encodeURIComponent(_filters.clientId));
  const q = qs.length ? '?' + qs.join('&') : '';

  const [entriesRes, projectsRes, clientsRes, summaryRes] = await Promise.all([
    client.get('/time-entries' + q),
    client.get('/projects'),
    client.get('/clients'),
    client.get('/time-summary' + q),
  ]);

  const err =
    _classifyError(entriesRes) ||
    _classifyError(projectsRes) ||
    _classifyError(clientsRes);
  if (err) {
    _entries = [];
    _projects = [];
    _clients = [];
    _summary = null;
    _loadError = err.message;
    _featureOff = !!err.featureOff;
    _unavailable = !!err.unavailable;
    ttRenderStats();
    ttRender();
    return;
  }

  _entries = Array.isArray(entriesRes.entries) ? entriesRes.entries : [];
  _projects = Array.isArray(projectsRes.projects) ? projectsRes.projects : [];
  _clients = Array.isArray(clientsRes.clients) ? clientsRes.clients : [];
  _summary =
    summaryRes && !summaryRes._error
      ? summaryRes
      : { totalHours: 0, billableHours: 0, nonBillableHours: 0, entries: 0 };

  ttRenderFilters();
  ttRenderStats();
  ttRender();
}

export function ttRenderStats() {
  const el = _container && _container.querySelector('#ttStats');
  if (!el) return;
  if (_featureOff || _unavailable || _loadError) {
    el.innerHTML = '';
    return;
  }
  const s = _summary || {};
  const billable = _entries.filter((e) => e.billable).length;
  el.innerHTML =
    '<div class="tt-stat"><div class="tt-stat-num" style="color:var(--accent)">' +
    _esc(Number(s.totalHours || 0).toFixed(1)) +
    'h</div><div class="tt-stat-label">Total hours</div></div>' +
    '<div class="tt-stat"><div class="tt-stat-num" style="color:var(--status-in)">' +
    _esc(Number(s.billableHours || 0).toFixed(1)) +
    'h</div><div class="tt-stat-label">Billable</div></div>' +
    '<div class="tt-stat"><div class="tt-stat-num">' +
    _esc(String(s.entries != null ? s.entries : _entries.length)) +
    '</div><div class="tt-stat-label">Entries</div></div>' +
    '<div class="tt-stat"><div class="tt-stat-num">' +
    billable +
    '</div><div class="tt-stat-label">Billable rows</div></div>';
}

export function ttRender() {
  const el = _container && _container.querySelector('#ttContent');
  if (!el) return;

  if (_featureOff) {
    el.innerHTML = _emptyState(_loadError || 'Time Tracking is disabled', null, false);
    return;
  }
  if (_unavailable) {
    el.innerHTML = _emptyState(
      'Service unavailable',
      _loadError || 'Time tracking service is unavailable',
      true,
    );
    return;
  }
  if (_loadError) {
    el.innerHTML = _emptyState('Could not load', _loadError, true);
    return;
  }

  if (_tab === 'projects') {
    ttRenderProjects(el);
    return;
  }
  if (_tab === 'clients') {
    ttRenderClients(el);
    return;
  }
  ttRenderEntries(el);
}

function ttRenderEntries(el) {
  if (!_entries.length) {
    el.innerHTML = _emptyState(
      'No time entries yet',
      'Log time against a project to see it here.',
      false,
    );
    return;
  }
  let html = '<div class="tt-grid">';
  _entries.forEach(function (item, i) {
    const locked = !!item.approved;
    const statusLabel = locked ? 'Approved' : 'Open';
    const statusColor = locked ? 'var(--status-in)' : 'var(--status-break)';
    html +=
      '<div class="tt-card" style="animation-delay:' +
      i * 0.04 +
      's" data-id="' +
      _esc(item.id) +
      '">' +
      '<div class="tt-card-title">' +
      _esc(item.projectName || item.projectId) +
      '</div>' +
      '<div class="tt-card-sub">' +
      _esc(item.date) +
      ' · ' +
      _esc(item.hours) +
      'h' +
      (item.clientName ? ' · ' + _esc(item.clientName) : '') +
      '</div>' +
      '<div class="tt-card-sub">' +
      _esc(item.description || '') +
      '</div>' +
      '<span class="tt-card-badge" style="background:var(--accent-dim);color:' +
      statusColor +
      '">' +
      statusLabel +
      (item.billable ? ' · Billable' : ' · Non-billable') +
      '</span>' +
      '<div class="tt-card-actions">';
    if (!locked) {
      html +=
        '<button type="button" data-action="edit" data-idx="' +
        i +
        '">Edit</button>' +
        '<button type="button" class="danger" data-action="delete" data-idx="' +
        i +
        '">Delete</button>';
    }
    if (_canApprove() && !locked) {
      html +=
        '<button type="button" data-action="approve" data-idx="' + i + '">Approve</button>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function ttRenderProjects(el) {
  if (!_projects.length) {
    el.innerHTML = _emptyState('No projects', 'Create a project under a client.', false);
    return;
  }
  let html =
    '<div style="margin-bottom:12px"><button type="button" class="tt-btn" data-action="add-project">+ Project</button></div><div class="tt-grid">';
  _projects.forEach(function (p, i) {
    html +=
      '<div class="tt-card"><div class="tt-card-title">' +
      _esc(p.name) +
      '</div><div class="tt-card-sub">' +
      _esc(p.clientName || p.clientId) +
      ' · ' +
      (p.billable ? 'Billable' : 'Non-billable') +
      ' · ' +
      _esc(p.status) +
      '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function ttRenderClients(el) {
  if (!_clients.length) {
    el.innerHTML = _emptyState('No clients', 'Add a client to start tracking project time.', false);
    return;
  }
  let html =
    '<div style="margin-bottom:12px"><button type="button" class="tt-btn" data-action="add-client">+ Client</button></div><div class="tt-grid">';
  _clients.forEach(function (c) {
    html +=
      '<div class="tt-card"><div class="tt-card-title">' +
      _esc(c.name) +
      '</div><div class="tt-card-sub">' +
      _esc(c.code || '') +
      (c.active === false ? ' · Inactive' : '') +
      '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function ttShowForm(item) {
  _editEntry = item || null;
  const modal = _container.querySelector('#ttModal');
  const box = _container.querySelector('#ttModalBox');
  if (!modal || !box) return;

  const projectOpts = _projects
    .map(
      (p) =>
        '<option value="' +
        _esc(p.id) +
        '"' +
        (item && item.projectId === p.id ? ' selected' : '') +
        '>' +
        _esc(p.name) +
        '</option>',
    )
    .join('');

  box.innerHTML =
    '<div class="tt-modal-title" id="ttModalTitle">' +
    (item ? 'Edit entry' : 'Log time') +
    '</div>' +
    '<div class="tt-field"><label for="ttDate">Date</label>' +
    '<input id="ttDate" type="date" value="' +
    _esc((item && item.date) || _today()) +
    '"></div>' +
    '<div class="tt-field"><label for="ttProject">Project</label>' +
    '<select id="ttProject">' +
    projectOpts +
    '</select></div>' +
    '<div class="tt-field"><label for="ttHours">Hours</label>' +
    '<input id="ttHours" type="number" min="0.25" step="0.25" value="' +
    _esc((item && item.hours) || 1) +
    '"></div>' +
    '<div class="tt-field"><label for="ttDesc">Description</label>' +
    '<textarea id="ttDesc" rows="3">' +
    _esc((item && item.description) || '') +
    '</textarea></div>' +
    '<div class="tt-field"><label><input type="checkbox" id="ttBillable"' +
    (!item || item.billable ? ' checked' : '') +
    '> Billable</label></div>' +
    '<div class="tt-modal-actions">' +
    '<button type="button" class="tt-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="tt-btn" data-action="save-entry" ' +
    (_busy ? 'disabled' : '') +
    '>Save</button>' +
    '</div>';

  modal.hidden = false;
  modal.classList.add('open');
  const focusEl = box.querySelector('#ttHours');
  if (focusEl) focusEl.focus();
}

function ttCloseModal() {
  const modal = _container && _container.querySelector('#ttModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.hidden = true;
  _editEntry = null;
}

async function ttSaveEntry() {
  if (_busy) return;
  const projectId = (_container.querySelector('#ttProject') || {}).value;
  const date = (_container.querySelector('#ttDate') || {}).value;
  const hours = Number((_container.querySelector('#ttHours') || {}).value);
  const description = (_container.querySelector('#ttDesc') || {}).value || '';
  const billable = !!(_container.querySelector('#ttBillable') || {}).checked;
  if (!projectId || !date || !(hours > 0)) {
    toast('Project, date, and hours are required');
    return;
  }

  _busy = true;
  const client = ttApi();
  let res;
  if (_editEntry && _editEntry.id) {
    res = await client.put('/time-entries/' + _editEntry.id, {
      projectId: projectId,
      date: date,
      hours: hours,
      description: description,
      billable: billable,
    });
  } else {
    res = await client.post('/time-entries', {
      email: _myEmail(),
      projectId: projectId,
      date: date,
      hours: hours,
      description: description,
      billable: billable,
    });
  }
  _busy = false;

  if (res && res._error) {
    toast(res.message || 'Failed to save entry');
    return;
  }
  toast(_editEntry ? 'Entry updated' : 'Entry logged');
  ttCloseModal();
  await ttLoadData();
}

async function ttDeleteEntry(idx) {
  const item = _entries[idx];
  if (!item || item.approved) return;
  const ok = await confirmDialog({
    title: 'Delete entry',
    message: 'Delete this time entry? This cannot be undone.',
    confirmLabel: 'Delete',
  });
  if (!ok) return;
  _busy = true;
  const res = await ttApi().del('/time-entries/' + item.id);
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to delete');
    return;
  }
  toast('Entry deleted');
  await ttLoadData();
}

async function ttApproveEntry(idx) {
  const item = _entries[idx];
  if (!item || item.approved) return;
  _busy = true;
  const res = await ttApi().post('/time-entries/' + item.id + '/approve', {});
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to approve');
    return;
  }
  toast('Entry approved');
  await ttLoadData();
}

async function ttSaveClient() {
  const name = (_container.querySelector('#ttClientName') || {}).value;
  if (!name) {
    toast('Client name is required');
    return;
  }
  _busy = true;
  const res = await ttApi().post('/clients', {
    name: name,
    code: (_container.querySelector('#ttClientCode') || {}).value || '',
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to create client');
    return;
  }
  toast('Client created');
  ttCloseModal();
  await ttLoadData();
}

async function ttSaveProject() {
  const name = (_container.querySelector('#ttProjectName') || {}).value;
  const clientId = (_container.querySelector('#ttProjectClient') || {}).value;
  if (!name || !clientId) {
    toast('Project name and client are required');
    return;
  }
  _busy = true;
  const res = await ttApi().post('/projects', {
    name: name,
    clientId: clientId,
    billable: !!(_container.querySelector('#ttProjectBillable') || {}).checked,
  });
  _busy = false;
  if (res && res._error) {
    toast(res.message || 'Failed to create project');
    return;
  }
  toast('Project created');
  ttCloseModal();
  await ttLoadData();
}

function ttShowClientForm() {
  const modal = _container.querySelector('#ttModal');
  const box = _container.querySelector('#ttModalBox');
  box.innerHTML =
    '<div class="tt-modal-title" id="ttModalTitle">New client</div>' +
    '<div class="tt-field"><label for="ttClientName">Name</label><input id="ttClientName" type="text"></div>' +
    '<div class="tt-field"><label for="ttClientCode">Code</label><input id="ttClientCode" type="text"></div>' +
    '<div class="tt-modal-actions">' +
    '<button type="button" class="tt-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="tt-btn" data-action="save-client">Save</button></div>';
  modal.hidden = false;
  modal.classList.add('open');
}

function ttShowProjectForm() {
  const modal = _container.querySelector('#ttModal');
  const box = _container.querySelector('#ttModalBox');
  const opts = _clients
    .map((c) => '<option value="' + _esc(c.id) + '">' + _esc(c.name) + '</option>')
    .join('');
  box.innerHTML =
    '<div class="tt-modal-title" id="ttModalTitle">New project</div>' +
    '<div class="tt-field"><label for="ttProjectName">Name</label><input id="ttProjectName" type="text"></div>' +
    '<div class="tt-field"><label for="ttProjectClient">Client</label><select id="ttProjectClient">' +
    opts +
    '</select></div>' +
    '<div class="tt-field"><label><input type="checkbox" id="ttProjectBillable" checked> Billable</label></div>' +
    '<div class="tt-modal-actions">' +
    '<button type="button" class="tt-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="tt-btn" data-action="save-project">Save</button></div>';
  modal.hidden = false;
  modal.classList.add('open');
}

function _bindEvents(container) {
  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
  }
  _keydownHandler = function (e) {
    if (e.key === 'Escape') ttCloseModal();
  };
  document.addEventListener('keydown', _keydownHandler);

  container.onclick = async function (e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) {
      const tab = tabBtn.getAttribute('data-tab');
      if (tab === 'projects' || tab === 'clients') {
        if (!_canAdminCatalog()) return;
      }
      _tab = tab;
      container.querySelectorAll('.tt-tab').forEach(function (b) {
        const on = b.getAttribute('data-tab') === _tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      ttRenderFilters();
      ttRender();
      return;
    }

    const actionEl = t.closest('[data-action]');
    const action = actionEl && actionEl.getAttribute('data-action');
    const idx = actionEl ? Number(actionEl.getAttribute('data-idx')) : -1;

    if (action === 'retry') {
      ttLoadData();
      return;
    }
    if (action === 'apply-filters') {
      _filters.start = (_container.querySelector('#ttFilterStart') || {}).value || '';
      _filters.end = (_container.querySelector('#ttFilterEnd') || {}).value || '';
      _filters.projectId = (_container.querySelector('#ttFilterProject') || {}).value || '';
      _filters.clientId = (_container.querySelector('#ttFilterClient') || {}).value || '';
      ttLoadData();
      return;
    }
    if (t.id === 'ttAddBtn' || action === 'add-entry') {
      ttShowForm(null);
      return;
    }
    if (action === 'edit') {
      ttShowForm(_entries[idx]);
      return;
    }
    if (action === 'delete') {
      await ttDeleteEntry(idx);
      return;
    }
    if (action === 'approve') {
      await ttApproveEntry(idx);
      return;
    }
    if (action === 'close-modal') {
      ttCloseModal();
      return;
    }
    if (action === 'save-entry') {
      await ttSaveEntry();
      return;
    }
    if (action === 'add-client') {
      ttShowClientForm();
      return;
    }
    if (action === 'add-project') {
      ttShowProjectForm();
      return;
    }
    if (action === 'save-client') {
      await ttSaveClient();
      return;
    }
    if (action === 'save-project') {
      await ttSaveProject();
      return;
    }
    if (t.id === 'ttModal') {
      ttCloseModal();
    }
  };
}

registerModule('time_tracking', renderTimeTrackingPage);

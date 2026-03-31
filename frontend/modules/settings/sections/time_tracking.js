/**
 * modules/time_tracking/time_tracking.js
 * Time tracking: active timer, time entries, projects, weekly summary.
 * Pattern: renderTimeTrackingPage() → ttLoadData() → ttRenderStats()
 *          → ttRenderContent() → CRUD → ttCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _entries = [];
let _projects = [];
let _activeTimer = null;
let _tab = 'entries';  // 'entries' | 'projects'
let _search = '';
let _timerInterval = null;

const _mockEntries = [
  { id: 'tt1', project: 'BlokHR Frontend', task: 'Dashboard module', start: '2026-03-27T09:00:00', end: '2026-03-27T11:30:00', duration: 150, billable: true },
  { id: 'tt2', project: 'BlokHR Frontend', task: 'Leaves module',    start: '2026-03-27T13:00:00', end: '2026-03-27T16:00:00', duration: 180, billable: true },
  { id: 'tt3', project: 'Client Meeting',  task: 'Sprint review',     start: '2026-03-26T10:00:00', end: '2026-03-26T11:00:00', duration: 60,  billable: false },
  { id: 'tt4', project: 'BlokHR Backend',  task: 'API integration',   start: '2026-03-26T13:30:00', end: '2026-03-26T17:00:00', duration: 210, billable: true },
  { id: 'tt5', project: 'Internal',        task: 'Documentation',     start: '2026-03-25T09:00:00', end: '2026-03-25T10:30:00', duration: 90,  billable: false },
];

const _mockProjects = [
  { id: 'p1', name: 'BlokHR Frontend', color: '#f5a623', billable: true,  hourly_rate: 75, total_hours: 48.5, budget_hours: 80 },
  { id: 'p2', name: 'BlokHR Backend',  color: '#4a9eff', billable: true,  hourly_rate: 85, total_hours: 32.0, budget_hours: 60 },
  { id: 'p3', name: 'Client Meeting',  color: '#22c55e', billable: false, hourly_rate: 0,  total_hours: 8.5,  budget_hours: null },
  { id: 'p4', name: 'Internal',        color: '#a855f7', billable: false, hourly_rate: 0,  total_hours: 12.0, budget_hours: null },
];

export function renderTimeTrackingPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="tt-wrap">' +
      '<div class="tt-timer-bar" id="ttTimerBar"></div>' +
      '<div class="tt-toolbar">' +
        '<div class="tt-tabs" id="ttTabs">' +
          '<button class="tt-tab active" data-tab="entries">Entries</button>' +
          '<button class="tt-tab" data-tab="projects">Projects</button>' +
        '</div>' +
        '<input class="tt-search" id="ttSearch" placeholder="Search…" autocomplete="off">' +
        '<button class="tt-btn-start" id="ttStartBtn">&#9654; Start Timer</button>' +
      '</div>' +
      '<div id="ttStats" class="tt-stats"></div>' +
      '<div id="ttContent"></div>' +
      '<div class="tt-modal" id="ttModal"><div class="tt-modal-box" id="ttModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ttLoadData();
}

export async function ttLoadData() {
  const [entriesData, projectsData, activeData] = await Promise.all([
    api.get('/api/time-tracking'),
    api.get('/api/time-tracking/projects'),
    api.get('/api/time-tracking/active'),
  ]);
  _entries = (entriesData && !entriesData._error) ? (entriesData.entries || entriesData || []) : _mockEntries;
  if (!Array.isArray(_entries)) _entries = _mockEntries;
  _projects = (projectsData && !projectsData._error) ? (projectsData.projects || projectsData || []) : _mockProjects;
  if (!Array.isArray(_projects)) _projects = _mockProjects;
  _activeTimer = (activeData && !activeData._error && activeData.id) ? activeData : null;
  ttRenderStats();
  ttRenderActiveTimer();
  ttRenderContent();
}

export function ttRenderStats() {
  const el = _container && _container.querySelector('#ttStats');
  if (!el) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = _entries.filter(e => (e.start || '').startsWith(todayStr));
  const todayMins = todayEntries.reduce((s, e) => s + (e.duration || 0), 0);
  const weekMins = _entries.reduce((s, e) => s + (e.duration || 0), 0);
  const billableHrs = _entries.filter(e => e.billable).reduce((s, e) => s + (e.duration || 0), 0) / 60;
  el.innerHTML =
    _sc(_fmtDuration(todayMins), 'Today', 'var(--accent)') +
    _sc(_fmtDuration(weekMins), 'This Week', 'var(--status-in)') +
    _sc(billableHrs.toFixed(1) + 'h', 'Billable', 'var(--status-break)') +
    _sc(_projects.length, 'Projects', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="tt-stat"><div class="tt-stat-n" style="color:' + c + '">' + n + '</div><div class="tt-stat-l">' + l + '</div></div>';
}

export function ttRenderActiveTimer() {
  const bar = _container && _container.querySelector('#ttTimerBar');
  if (!bar) return;
  if (!_activeTimer) { bar.innerHTML = ''; return; }
  const elapsed = _elapsed(_activeTimer.start);
  bar.innerHTML =
    '<div class="tt-active-bar">' +
      '<div class="tt-active-dot"></div>' +
      '<div class="tt-active-info">' +
        '<span class="tt-active-proj">' + _esc(_activeTimer.project || 'No project') + '</span>' +
        ' &middot; ' +
        '<span class="tt-active-task">' + _esc(_activeTimer.task || 'No description') + '</span>' +
      '</div>' +
      '<div class="tt-active-time" id="ttElapsed">' + _fmtDuration(elapsed) + '</div>' +
      '<button class="tt-btn-stop" id="ttStopBtn">&#9646;&#9646; Stop</button>' +
    '</div>';
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(function () {
    const el = _container && _container.querySelector('#ttElapsed');
    if (el) el.textContent = _fmtDuration(_elapsed(_activeTimer.start));
  }, 1000);
}

export function ttRenderContent() {
  _tab === 'projects' ? _renderProjects() : _renderEntries();
}

function _renderEntries() {
  const el = _container && _container.querySelector('#ttContent');
  if (!el) return;
  let items = _entries;
  if (_search) items = items.filter(e => (e.project + ' ' + e.task).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="tt-empty"><div style="font-size:2rem">&#9201;</div><div>No time entries</div></div>';
    return;
  }

  // Group by date
  const groups = {};
  items.forEach(function (e) {
    const date = (e.start || '').split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(e);
  });

  let html = '<div class="tt-entries">';
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(function (date) {
    const dayMins = groups[date].reduce((s, e) => s + (e.duration || 0), 0);
    html += '<div class="tt-date-group">' +
      '<div class="tt-date-hdr"><span class="tt-date-label">' + _fmtDate(date) + '</span><span class="tt-date-total">' + _fmtDuration(dayMins) + '</span></div>';
    groups[date].forEach(function (e) {
      const proj = _projects.find(p => p.name === e.project);
      const color = proj ? proj.color : 'var(--accent)';
      html +=
        '<div class="tt-entry">' +
          '<div class="tt-entry-dot" style="background:' + color + '"></div>' +
          '<div class="tt-entry-info">' +
            '<div class="tt-entry-task">' + _esc(e.task || 'No description') + '</div>' +
            '<div class="tt-entry-proj" style="color:' + color + '">' + _esc(e.project || 'No project') + '</div>' +
          '</div>' +
          '<div class="tt-entry-right">' +
            '<div class="tt-entry-time">' + _fmtTime(e.start) + ' &ndash; ' + _fmtTime(e.end) + '</div>' +
            '<div class="tt-entry-dur">' + _fmtDuration(e.duration || 0) + '</div>' +
            (e.billable ? '<span class="tt-billable">$</span>' : '') +
          '</div>' +
          '<div class="tt-entry-actions">' +
            '<button data-action="edit-entry" data-id="' + _esc(e.id) + '" class="tt-icon-btn" title="Edit">&#9998;</button>' +
            '<button data-action="delete-entry" data-id="' + _esc(e.id) + '" class="tt-icon-btn danger" title="Delete">&#128465;</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderProjects() {
  const el = _container && _container.querySelector('#ttContent');
  if (!el) return;
  const items = _projects.filter(p => !_search || p.name.toLowerCase().includes(_search));
  if (!items.length) {
    el.innerHTML = '<div class="tt-empty"><div style="font-size:2rem">&#128193;</div><div>No projects</div></div>';
    return;
  }
  let html = '<div class="tt-proj-grid">';
  items.forEach(function (p, i) {
    const pct = p.budget_hours ? Math.min(100, Math.round((p.total_hours / p.budget_hours) * 100)) : 0;
    html +=
      '<div class="tt-proj-card" style="animation-delay:' + i * 0.04 + 's; --proj-color:' + (p.color || 'var(--accent)') + '">' +
        '<div class="tt-proj-hdr">' +
          '<div class="tt-proj-dot" style="background:' + (p.color || 'var(--accent)') + '"></div>' +
          '<div class="tt-proj-name">' + _esc(p.name) + '</div>' +
          '<div class="tt-proj-badges">' +
            (p.billable ? '<span class="tt-proj-badge billable">Billable</span>' : '<span class="tt-proj-badge">Internal</span>') +
          '</div>' +
        '</div>' +
        '<div class="tt-proj-hours">' +
          '<span class="tt-proj-h">' + p.total_hours.toFixed(1) + 'h</span>' +
          (p.budget_hours ? ' / ' + p.budget_hours + 'h budgeted' : ' logged') +
        '</div>' +
        (p.budget_hours ? '<div class="tt-proj-bar"><div class="tt-proj-fill" style="width:' + pct + '%;background:' + (p.color || 'var(--accent)') + '"></div></div>' : '') +
        (p.billable && p.hourly_rate ? '<div class="tt-proj-rate">$' + p.hourly_rate + '/h &rarr; $' + (p.total_hours * p.hourly_rate).toFixed(0) + ' earned</div>' : '') +
        '<div class="tt-proj-actions">' +
          '<button data-action="edit-proj" data-id="' + _esc(p.id) + '" class="tt-btn-sm">Edit</button>' +
          '<button data-action="delete-proj" data-id="' + _esc(p.id) + '" class="tt-btn-sm danger">Delete</button>' +
        '</div>' +
      '</div>';
  });
  html += '<div class="tt-proj-card tt-proj-add" id="ttAddProjCard">' +
    '<div class="tt-proj-add-icon">+</div>' +
    '<div class="tt-proj-add-lbl">New Project</div>' +
  '</div>';
  html += '</div>';
  el.innerHTML = html;
}

export function ttShowStartTimer() {
  const box = _container && _container.querySelector('#ttModalBox');
  if (!box) return;
  const projOpts = _projects.map(p => '<option value="' + _esc(p.name) + '">' + _esc(p.name) + '</option>').join('');
  box.innerHTML =
    '<div class="tt-modal-title">Start Timer</div>' +
    '<div class="tt-field"><label>Project</label><select id="ttFProj"><option value="">No project</option>' + projOpts + '</select></div>' +
    '<div class="tt-field"><label>Description</label><input type="text" id="ttFTask" placeholder="What are you working on?"></div>' +
    '<div class="tt-field"><label><input type="checkbox" id="ttFBill"> Billable</label></div>' +
    '<div class="tt-form-actions">' +
      '<button class="tt-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="tt-btn" id="ttStartTimerBtn">&#9654; Start</button>' +
    '</div>';
  _container.querySelector('#ttModal').classList.add('open');
  box.querySelector('#ttStartTimerBtn').addEventListener('click', async function () {
    const project = box.querySelector('#ttFProj').value;
    const task = (box.querySelector('#ttFTask').value || '').trim();
    const billable = box.querySelector('#ttFBill').checked;
    const body = { project, task, billable, start: new Date().toISOString() };
    const result = await api.post('/api/time-tracking/start', body);
    if (result && !result._error) { _activeTimer = result; }
    else { _activeTimer = { id: 'active-' + Date.now(), ...body }; }
    toast('Timer started', 'success');
    ttCloseModal(); ttRenderActiveTimer();
  });
}

export async function ttStopTimer() {
  if (!_activeTimer) return;
  const result = await api.post('/api/time-tracking/stop', { id: _activeTimer.id });
  if (result && !result._error) { toast('Timer stopped', 'success'); }
  else {
    const mins = _elapsed(_activeTimer.start);
    _entries.unshift({ id: 'tt' + Date.now(), project: _activeTimer.project, task: _activeTimer.task, start: _activeTimer.start, end: new Date().toISOString(), duration: mins, billable: _activeTimer.billable });
    toast('Timer stopped (demo)', 'success');
  }
  _activeTimer = null;
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  ttLoadData();
}

export function ttCloseModal() {
  const m = _container && _container.querySelector('#ttModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#ttTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.tt-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.tt-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    ttRenderContent();
  });
  const s = container.querySelector('#ttSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); ttRenderContent(); });
  const sb = container.querySelector('#ttStartBtn');
  if (sb) sb.addEventListener('click', () => ttShowStartTimer());
  const modal = container.querySelector('#ttModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) ttCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') ttCloseModal();
    else if (action === 'tt-stop' || btn.id === 'ttStopBtn') ttStopTimer();
    else if (action === 'delete-entry') { if (confirm('Delete this entry?')) { _entries = _entries.filter(x => x.id !== id); ttRenderStats(); ttRenderContent(); toast('Deleted (demo)', 'success'); } }
    else if (action === 'delete-proj') { if (confirm('Delete this project?')) { _projects = _projects.filter(p => p.id !== id); ttRenderContent(); toast('Deleted (demo)', 'success'); } }
  });
  container.addEventListener('click', function (e) {
    const stop = e.target.closest('#ttStopBtn');
    if (stop) ttStopTimer();
    const addProj = e.target.closest('#ttAddProjCard');
    if (addProj) _showProjForm(null);
  });
}

function _showProjForm(proj) {
  const isEdit = !!proj;
  const p = proj || {};
  const box = _container && _container.querySelector('#ttModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="tt-modal-title">' + (isEdit ? 'Edit' : 'New') + ' Project</div>' +
    '<div class="tt-field"><label>Name *</label><input type="text" id="ttFPN" value="' + _esc(p.name || '') + '"></div>' +
    '<div class="tt-field"><label>Color</label><input type="color" id="ttFPColor" value="' + (p.color || '#f5a623') + '"></div>' +
    '<div class="tt-field"><label><input type="checkbox" id="ttFPBill"' + (p.billable ? ' checked' : '') + '> Billable</label></div>' +
    '<div class="tt-field"><label>Hourly Rate ($)</label><input type="number" id="ttFPRate" value="' + (p.hourly_rate || 0) + '" min="0"></div>' +
    '<div class="tt-field"><label>Budget Hours</label><input type="number" id="ttFPBudget" value="' + (p.budget_hours || '') + '" min="0" placeholder="Optional"></div>' +
    '<div class="tt-form-actions">' +
      '<button class="tt-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="tt-btn" id="ttSaveProjBtn">' + (isEdit ? 'Update' : 'Create') + '</button>' +
    '</div>';
  _container.querySelector('#ttModal').classList.add('open');
  box.querySelector('#ttSaveProjBtn').addEventListener('click', async function () {
    const name = (box.querySelector('#ttFPN').value || '').trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const body = { name, color: box.querySelector('#ttFPColor').value, billable: box.querySelector('#ttFPBill').checked, hourly_rate: parseFloat(box.querySelector('#ttFPRate').value) || 0, budget_hours: parseFloat(box.querySelector('#ttFPBudget').value) || null, total_hours: p.total_hours || 0 };
    const result = isEdit ? await api.put('/api/time-tracking/projects/' + proj.id, body) : await api.post('/api/time-tracking/projects', body);
    if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); ttCloseModal(); ttLoadData(); return; }
    if (isEdit) { const i = _projects.findIndex(x => x.id === proj.id); if (i >= 0) Object.assign(_projects[i], body); }
    else _projects.push({ id: 'p' + Date.now(), ...body });
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
    ttCloseModal(); ttRenderContent();
  });
}

function _elapsed(startISO) {
  return Math.round((Date.now() - new Date(startISO).getTime()) / 60000);
}
function _fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? h + 'h ' + (m > 0 ? m + 'm' : '') : m + 'm';
}
function _fmtTime(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function _fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getEntries() { return _entries; }
export function _setEntries(list) { _entries = list; }
export function _getProjects() { return _projects; }
export function _setProjects(list) { _projects = list; }
export function _resetState() {
  _container = null; _entries = []; _projects = []; _activeTimer = null;
  _tab = 'entries'; _search = '';
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

registerModule('time_tracking', renderTimeTrackingPage);

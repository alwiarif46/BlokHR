/**
 * modules/workflows/workflows.js
 * Workflow builder: manual/trigger workflows, step CRUD, instances.
 * Pattern: renderWorkflowsPage() → wfLoadData() → wfRenderStats()
 *          → wfRender() → CRUD → wfCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _workflows = [];
let _instances = [];
let _tab = 'workflows';  // 'workflows' | 'instances'
let _search = '';

const _mockWorkflows = [
  { id: 'wf1', name: 'Employee Onboarding',        trigger: 'manual',         steps: 5, instances: 3, status: 'active',   description: 'New hire onboarding checklist' },
  { id: 'wf2', name: 'Equipment Request',           trigger: 'manual',         steps: 3, instances: 7, status: 'active',   description: 'Request and approval for equipment' },
  { id: 'wf3', name: 'Exit Clearance',              trigger: 'manual',         steps: 6, instances: 1, status: 'active',   description: 'Offboarding and asset clearance' },
  { id: 'wf4', name: 'Performance Review',          trigger: 'scheduled',      steps: 4, instances: 0, status: 'active',   description: 'Quarterly performance review cycle' },
  { id: 'wf5', name: 'Budget Approval',             trigger: 'manual',         steps: 3, instances: 2, status: 'inactive', description: 'Budget request approval flow' },
];

const _mockInstances = [
  { id: 'wi1', workflow: 'Employee Onboarding', workflow_id: 'wf1', started_by: 'admin@co.com', started_for: 'Priya Sharma', started_on: '2026-03-20', current_step: 3, total_steps: 5, status: 'in_progress' },
  { id: 'wi2', workflow: 'Equipment Request',   workflow_id: 'wf2', started_by: 'arif@co.com',  started_for: 'Arif Alwi',    started_on: '2026-03-25', current_step: 2, total_steps: 3, status: 'in_progress' },
  { id: 'wi3', workflow: 'Exit Clearance',      workflow_id: 'wf3', started_by: 'admin@co.com', started_for: 'Omar Hassan',  started_on: '2026-03-15', current_step: 6, total_steps: 6, status: 'completed' },
  { id: 'wi4', workflow: 'Employee Onboarding', workflow_id: 'wf1', started_by: 'admin@co.com', started_for: 'Bob Builder',  started_on: '2026-03-10', current_step: 5, total_steps: 5, status: 'completed' },
];

export function renderWorkflowsPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="wf-wrap">' +
      '<div class="wf-toolbar">' +
        '<div class="wf-tabs" id="wfTabs">' +
          '<button class="wf-tab active" data-tab="workflows">Workflows</button>' +
          '<button class="wf-tab" data-tab="instances">Running Instances</button>' +
        '</div>' +
        '<input class="wf-search" id="wfSearch" placeholder="Search…" autocomplete="off">' +
        (isAdmin ? '<button class="wf-btn" id="wfAddBtn">+ New Workflow</button>' : '') +
      '</div>' +
      '<div id="wfStats" class="wf-stats"></div>' +
      '<div id="wfContent"></div>' +
      '<div class="wf-modal" id="wfModal"><div class="wf-modal-box" id="wfModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  wfLoadData();
}

export async function wfLoadData() {
  const [wfData, instData] = await Promise.all([
    api.get('/api/workflows'),
    api.get('/api/workflows/instances'),
  ]);
  _workflows = (wfData && !wfData._error) ? (wfData.workflows || wfData || []) : _mockWorkflows;
  if (!Array.isArray(_workflows)) _workflows = _mockWorkflows;
  _instances = (instData && !instData._error) ? (instData.instances || instData || []) : _mockInstances;
  if (!Array.isArray(_instances)) _instances = _mockInstances;
  wfRenderStats();
  wfRender();
}

export function wfRenderStats() {
  const el = _container && _container.querySelector('#wfStats');
  if (!el) return;
  const active = _workflows.filter(w => w.status === 'active').length;
  const running = _instances.filter(i => i.status === 'in_progress').length;
  const completed = _instances.filter(i => i.status === 'completed').length;
  el.innerHTML =
    _sc(_workflows.length, 'Workflows', 'var(--accent)') +
    _sc(active, 'Active', 'var(--status-in)') +
    _sc(running, 'Running', 'var(--status-break)') +
    _sc(completed, 'Completed', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="wf-stat"><div class="wf-stat-n" style="color:' + c + '">' + n + '</div><div class="wf-stat-l">' + l + '</div></div>';
}

export function wfRender() {
  _tab === 'instances' ? _renderInstances() : _renderWorkflows();
}

function _renderWorkflows() {
  const el = _container && _container.querySelector('#wfContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _workflows.filter(w => !_search || w.name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="wf-empty"><div style="font-size:2rem">&#128336;</div><div>No workflows found</div></div>'; return; }
  let html = '<div class="wf-grid">';
  items.forEach(function (w, i) {
    html +=
      '<div class="wf-card' + (w.status !== 'active' ? ' wf-inactive' : '') + '" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="wf-card-hdr">' +
          '<div class="wf-card-name">' + _esc(w.name) + '</div>' +
          '<span class="wf-badge ' + (w.status === 'active' ? 'wf-active' : 'wf-off') + '">' + w.status + '</span>' +
        '</div>' +
        '<div class="wf-card-desc">' + _esc(w.description || '') + '</div>' +
        '<div class="wf-card-meta">' +
          '<span>&#128336; ' + w.steps + ' steps</span>' +
          '<span>&#128203; ' + w.instances + ' instances</span>' +
          '<span>&#9889; ' + _esc(w.trigger || 'manual') + '</span>' +
        '</div>' +
        '<div class="wf-card-actions">' +
          '<button data-action="start" data-id="' + _esc(w.id) + '" class="wf-btn-sm">&#9654; Start</button>' +
          (isAdmin ? '<button data-action="edit" data-id="' + _esc(w.id) + '" class="wf-btn-sm">Edit</button>' : '') +
          (isAdmin ? '<button data-action="delete" data-id="' + _esc(w.id) + '" class="wf-btn-sm danger">Delete</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderInstances() {
  const el = _container && _container.querySelector('#wfContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && (session.is_admin || session.is_manager);
  let items = _instances;
  if (_search) items = items.filter(i => (i.workflow + ' ' + i.started_for).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="wf-empty"><div style="font-size:2rem">&#128203;</div><div>No instances</div></div>'; return; }
  let html = '<div class="wf-inst-list">';
  items.forEach(function (inst, i) {
    const pct = inst.total_steps ? Math.round((inst.current_step / inst.total_steps) * 100) : 0;
    const statusColor = inst.status === 'completed' ? 'var(--status-in)' : inst.status === 'in_progress' ? 'var(--accent)' : 'var(--tx3)';
    html +=
      '<div class="wf-inst-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="wf-inst-info">' +
          '<div class="wf-inst-name">' + _esc(inst.workflow) + '</div>' +
          '<div class="wf-inst-for">For: ' + _esc(inst.started_for) + ' &middot; Started: ' + _fmtDate(inst.started_on) + '</div>' +
          '<div class="wf-inst-progress">' +
            '<div class="wf-prog-bar"><div class="wf-prog-fill" style="width:' + pct + '%;background:' + statusColor + '"></div></div>' +
            '<span>Step ' + inst.current_step + '/' + inst.total_steps + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="wf-inst-right">' +
          '<span class="wf-badge" style="background:' + statusColor + '20;color:' + statusColor + '">' + inst.status.replace(/_/g, ' ') + '</span>' +
          (inst.status === 'in_progress' && isAdmin
            ? '<div class="wf-inst-actions">' +
                '<button data-action="advance" data-id="' + _esc(inst.id) + '" class="wf-btn-sm">Advance</button>' +
                '<button data-action="cancel-inst" data-id="' + _esc(inst.id) + '" class="wf-btn-sm danger">Cancel</button>' +
              '</div>'
            : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function wfShowForm(workflow) {
  const isEdit = !!workflow;
  const w = workflow || {};
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="wf-modal-title">' + (isEdit ? 'Edit' : 'New') + ' Workflow</div>' +
    '<div class="wf-field"><label>Name *</label><input type="text" id="wfFName" value="' + _esc(w.name || '') + '"></div>' +
    '<div class="wf-field"><label>Description</label><textarea id="wfFDesc" style="min-height:50px">' + _esc(w.description || '') + '</textarea></div>' +
    '<div class="wf-field"><label>Trigger</label><select id="wfFTrig">' +
      '<option value="manual"' + (!w.trigger || w.trigger === 'manual' ? ' selected' : '') + '>Manual</option>' +
      '<option value="scheduled"' + (w.trigger === 'scheduled' ? ' selected' : '') + '>Scheduled</option>' +
      '<option value="event"' + (w.trigger === 'event' ? ' selected' : '') + '>Event-based</option>' +
    '</select></div>' +
    '<div class="wf-form-actions"><button class="wf-btn ghost" data-action="close-modal">Cancel</button><button class="wf-btn" id="wfSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  _container.querySelector('#wfModal').classList.add('open');
  box.querySelector('#wfSaveBtn').addEventListener('click', async function () {
    const name = (box.querySelector('#wfFName').value || '').trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const body = { name, description: (box.querySelector('#wfFDesc').value || '').trim(), trigger: box.querySelector('#wfFTrig').value, status: 'active', steps: w.steps || 0, instances: w.instances || 0 };
    const result = isEdit ? await api.put('/api/workflows/' + workflow.id, body) : await api.post('/api/workflows', body);
    if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); wfCloseModal(); wfLoadData(); return; }
    if (isEdit) { const i = _workflows.findIndex(x => x.id === workflow.id); if (i >= 0) Object.assign(_workflows[i], body); }
    else _workflows.push({ id: 'wf' + Date.now(), ...body });
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success'); wfCloseModal(); wfRenderStats(); wfRender();
  });
}

export function wfShowStartInstance(wfId) {
  const w = _workflows.find(x => x.id === wfId);
  if (!w) return;
  const name = prompt('Start workflow "' + w.name + '" for whom? (enter name)');
  if (!name) return;
  _instances.unshift({ id: 'wi' + Date.now(), workflow: w.name, workflow_id: wfId, started_by: (getSession() || {}).email || 'user', started_for: name, started_on: new Date().toISOString().split('T')[0], current_step: 1, total_steps: w.steps || 3, status: 'in_progress' });
  w.instances = (w.instances || 0) + 1;
  toast('Workflow started (demo)', 'success'); wfRenderStats(); wfRender();
}

export function wfCloseModal() {
  const m = _container && _container.querySelector('#wfModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#wfTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.wf-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.wf-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    wfRender();
  });
  const s = container.querySelector('#wfSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); wfRender(); });
  const ab = container.querySelector('#wfAddBtn');
  if (ab) ab.addEventListener('click', () => wfShowForm(null));
  const modal = container.querySelector('#wfModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) wfCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') wfCloseModal();
    else if (action === 'start') wfShowStartInstance(id);
    else if (action === 'edit') { const w = _workflows.find(x => x.id === id); if (w) wfShowForm(w); }
    else if (action === 'delete') { if (confirm('Delete this workflow?')) { _workflows = _workflows.filter(w => w.id !== id); wfRenderStats(); wfRender(); toast('Deleted (demo)', 'success'); } }
    else if (action === 'advance') {
      const inst = _instances.find(x => x.id === id);
      if (inst) { inst.current_step = Math.min(inst.current_step + 1, inst.total_steps); if (inst.current_step === inst.total_steps) inst.status = 'completed'; }
      wfRenderStats(); wfRender(); toast('Advanced (demo)', 'success');
    }
    else if (action === 'cancel-inst') { if (confirm('Cancel this instance?')) { const inst = _instances.find(x => x.id === id); if (inst) inst.status = 'cancelled'; wfRenderStats(); wfRender(); toast('Cancelled (demo)', 'success'); } }
  });
}

function _fmtDate(ds) { if (!ds) return ''; return new Date(ds.split('T')[0] + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getWorkflows() { return _workflows; }
export function _setWorkflows(list) { _workflows = list; }
export function _resetState() { _container = null; _workflows = []; _instances = []; _tab = 'workflows'; _search = ''; }

registerModule('workflows', renderWorkflowsPage);

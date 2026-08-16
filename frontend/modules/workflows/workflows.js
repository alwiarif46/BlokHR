/**
 * modules/workflows/workflows.js
 * Workflow builder — definitions, running instances, forms.
 * Pattern: renderWorkflowsPage() → wfLoadData() → wfRenderStats() → wfRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'event', label: 'Event' },
  { value: 'scheduled', label: 'Scheduled' },
];

const STEP_TYPES = [
  { value: 'approval', label: 'Approval' },
  { value: 'notification', label: 'Notification' },
  { value: 'create_task', label: 'Create task' },
  { value: 'update_field', label: 'Update field' },
  { value: 'conditional_branch', label: 'Conditional branch' },
  { value: 'delay', label: 'Delay' },
];

let _container = null;
let _tab = 'definitions';
let _workflows = [];
let _instances = [];
let _forms = [];
let _loadError = null;
let _featureOff = false;
let _saving = false;
let _editing = null;
let _editingForm = null;
let _draftSteps = [];

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _labelOf(list, value) {
  const found = list.find((x) => x.value === value);
  return found ? found.label : value || '—';
}

function _parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Normalize workflow definition row. */
export function _normalizeWorkflow(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const steps = _parseJson(raw.steps_json || raw.steps, []);
  const triggerConfig = _parseJson(raw.trigger_config_json || raw.triggerConfig, {});
  return {
    id: raw.id,
    name: raw.name || '',
    description: raw.description || '',
    triggerType: raw.trigger_type || raw.triggerType || 'manual',
    triggerConfig: triggerConfig && typeof triggerConfig === 'object' ? triggerConfig : {},
    steps: Array.isArray(steps) ? steps : [],
    active: raw.active === 1 || raw.active === true || raw.active === '1',
    createdBy: raw.created_by || raw.createdBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

/** Normalize workflow instance row. */
export function _normalizeInstance(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    workflowId: raw.workflow_id || raw.workflowId || '',
    triggerData: _parseJson(raw.trigger_data_json || raw.triggerData, {}),
    currentStep: Number(raw.current_step != null ? raw.current_step : raw.currentStep) || 0,
    status: raw.status || 'running',
    startedBy: raw.started_by || raw.startedBy || '',
    startedAt: raw.started_at || raw.startedAt || '',
    completedAt: raw.completed_at || raw.completedAt || '',
    stepHistory: _parseJson(raw.step_history_json || raw.stepHistory, []),
  };
}

/** Normalize form definition row. */
export function _normalizeForm(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const fields = _parseJson(raw.fields_json || raw.fieldsJson, []);
  return {
    id: raw.id,
    name: raw.name || '',
    fields: Array.isArray(fields) ? fields : [],
    workflowId: raw.workflow_id || raw.workflowId || '',
    createdBy: raw.created_by || raw.createdBy || '',
  };
}

function _workflowName(id) {
  const wf = _workflows.find((w) => w.id === id);
  return wf ? wf.name : id || '—';
}

export function renderWorkflowsPage(container) {
  _container = container;
  _tab = 'definitions';
  _editing = null;
  _editingForm = null;
  _draftSteps = [];
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="wf-wrap" id="wfWrap">' +
      '<div class="wf-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#9881;</span> Workflows</div>' +
        '<div class="wf-spacer"></div>' +
        '<button type="button" class="wf-btn" id="wfAddBtn" style="display:none">+ Add</button>' +
      '</div>' +
      '<div class="wf-tabs" id="wfTabs">' +
        '<button type="button" class="wf-tab active" data-tab="definitions">Definitions</button>' +
        '<button type="button" class="wf-tab" data-tab="instances">Instances</button>' +
        (admin ? '<button type="button" class="wf-tab" data-tab="forms">Forms</button>' : '') +
      '</div>' +
      '<div class="wf-stats" id="wfStats"></div>' +
      '<div id="wfContent"></div>' +
      '<div class="wf-modal" id="wfModal"><div class="wf-modal-box wide" id="wfModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _syncAddButton();
  wfLoadData();
}

function _syncAddButton() {
  const btn = _container && _container.querySelector('#wfAddBtn');
  if (!btn) return;
  const admin = _isAdmin();
  const show = admin && (_tab === 'definitions' || _tab === 'forms');
  btn.style.display = show ? '' : 'none';
  btn.textContent = _tab === 'forms' ? '+ Form' : '+ Workflow';
}

export async function wfLoadData() {
  _loadError = null;
  _featureOff = false;

  const [wfRes, instRes, formsRes] = await Promise.all([
    api.get('/api/workflows'),
    api.get('/api/workflow-instances'),
    _isAdmin() ? api.get('/api/workflow-forms') : Promise.resolve({ forms: [] }),
  ]);

  if (wfRes && wfRes._error) {
    _workflows = [];
    _loadError = wfRes.message || 'Could not load workflows';
    if (wfRes.status === 404) {
      _featureOff = true;
      _loadError = 'Workflows is disabled for this workspace';
    }
  } else {
    const rows = (wfRes && (wfRes.workflows || wfRes)) || [];
    _workflows = (Array.isArray(rows) ? rows : []).map(_normalizeWorkflow);
  }

  if (instRes && !instRes._error) {
    const rows = instRes.instances || [];
    _instances = (Array.isArray(rows) ? rows : []).map(_normalizeInstance);
  } else {
    _instances = [];
  }

  if (formsRes && !formsRes._error) {
    const rows = formsRes.forms || [];
    _forms = (Array.isArray(rows) ? rows : []).map(_normalizeForm);
  } else {
    _forms = [];
  }

  wfRenderStats();
  wfRender();
}

export function wfRenderStats() {
  const el = _container && _container.querySelector('#wfStats');
  if (!el) return;
  const running = _instances.filter((i) => i.status === 'running').length;
  const completed = _instances.filter((i) => i.status === 'completed').length;
  el.innerHTML =
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--accent)">' +
    _workflows.length +
    '</div><div class="wf-stat-label">Workflows</div></div>' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--status-in)">' +
    running +
    '</div><div class="wf-stat-label">Active Instances</div></div>' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--status-break)">' +
    completed +
    '</div><div class="wf-stat-label">Completed</div></div>' +
    '<div class="wf-stat"><div class="wf-stat-num" style="color:var(--tx2)">' +
    _forms.length +
    '</div><div class="wf-stat-label">Forms</div></div>';
}

function _empty(text) {
  return (
    '<div class="wf-empty"><div class="wf-empty-icon">&#9881;</div><div class="wf-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

export function wfRender() {
  const el = _container && _container.querySelector('#wfContent');
  if (!el) return;
  _syncAddButton();

  if (_featureOff) {
    el.innerHTML = _empty(_loadError || 'Workflows is disabled');
    return;
  }

  if (_tab === 'definitions') {
    if (_loadError && !_workflows.length) {
      el.innerHTML = _empty(_loadError);
      return;
    }
    if (!_workflows.length) {
      el.innerHTML = _empty(
        _isAdmin() ? 'No workflows yet — create one' : 'No workflows configured',
      );
      return;
    }
    el.innerHTML =
      '<div class="wf-grid">' + _workflows.map(_renderWorkflowCard).join('') + '</div>';
    return;
  }

  if (_tab === 'instances') {
    if (!_instances.length) {
      el.innerHTML = _empty('No workflow instances yet');
      return;
    }
    el.innerHTML =
      '<div class="wf-grid">' + _instances.map(_renderInstanceCard).join('') + '</div>';
    return;
  }

  if (_tab === 'forms') {
    if (!_forms.length) {
      el.innerHTML = _empty('No forms yet — create one');
      return;
    }
    el.innerHTML = '<div class="wf-grid">' + _forms.map(_renderFormCard).join('') + '</div>';
  }
}

function _renderWorkflowCard(item, i) {
  const admin = _isAdmin();
  let actions = '';
  if (item.active && item.triggerType === 'manual') {
    actions +=
      '<button type="button" data-action="trigger" data-idx="' + i + '">Run</button>';
  }
  if (admin) {
    actions +=
      '<button type="button" data-action="edit" data-idx="' +
      i +
      '">Edit</button>' +
      '<button type="button" data-action="toggle-active" data-idx="' +
      i +
      '">' +
      (item.active ? 'Deactivate' : 'Activate') +
      '</button>' +
      '<button type="button" class="danger" data-action="delete" data-idx="' +
      i +
      '">Delete</button>';
  }
  return (
    '<div class="wf-card" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="wf-card-title">' +
    _esc(item.name) +
    '</div>' +
    '<div class="wf-card-sub">' +
    _esc(_labelOf(TRIGGER_TYPES, item.triggerType)) +
    ' · ' +
    item.steps.length +
    ' step' +
    (item.steps.length === 1 ? '' : 's') +
    (item.description ? ' · ' + _esc(item.description) : '') +
    '</div>' +
    '<span class="wf-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
    _esc(item.active ? 'active' : 'inactive') +
    '</span>' +
    (actions ? '<div class="wf-card-actions">' + actions + '</div>' : '') +
    '</div>'
  );
}

function _renderInstanceCard(item, i) {
  const admin = _isAdmin();
  let actions = '';
  if (item.status === 'running') {
    actions +=
      '<button type="button" data-action="advance" data-idx="' +
      i +
      '">Advance</button>' +
      '<button type="button" class="danger" data-action="cancel" data-idx="' +
      i +
      '">Cancel</button>';
  }
  actions +=
    '<button type="button" data-action="view-instance" data-idx="' + i + '">Details</button>';
  return (
    '<div class="wf-card" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="wf-card-title">' +
    _esc(_workflowName(item.workflowId)) +
    '</div>' +
    '<div class="wf-card-sub">Step ' +
    _esc(String(item.currentStep)) +
    (item.startedBy ? ' · ' + _esc(item.startedBy) : '') +
    (item.startedAt ? ' · ' + _esc(String(item.startedAt).slice(0, 16)) : '') +
    '</div>' +
    '<span class="wf-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
    _esc(item.status) +
    '</span>' +
    (actions || admin
      ? '<div class="wf-card-actions">' + actions + '</div>'
      : '') +
    '</div>'
  );
}

function _renderFormCard(item, i) {
  return (
    '<div class="wf-card" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="wf-card-title">' +
    _esc(item.name) +
    '</div>' +
    '<div class="wf-card-sub">' +
    item.fields.length +
    ' field' +
    (item.fields.length === 1 ? '' : 's') +
    (item.workflowId ? ' · ' + _esc(_workflowName(item.workflowId)) : '') +
    '</div>' +
    '<div class="wf-card-actions">' +
    '<button type="button" data-action="submit-form" data-idx="' +
    i +
    '">Submit</button>' +
    '<button type="button" class="danger" data-action="delete-form" data-idx="' +
    i +
    '">Delete</button>' +
    '</div></div>'
  );
}

function _optionsHtml(list, selected) {
  return list
    .map(function (c) {
      return (
        '<option value="' +
        _esc(c.value) +
        '"' +
        (c.value === selected ? ' selected' : '') +
        '>' +
        _esc(c.label) +
        '</option>'
      );
    })
    .join('');
}

function _renderStepsEditor() {
  let html =
    '<div class="wf-field"><label>Steps</label><div id="wfStepsList" class="wf-steps">';
  if (!_draftSteps.length) {
    html += '<div class="wf-steps-empty">No steps yet — add an approval or notification step</div>';
  } else {
    _draftSteps.forEach(function (step, i) {
      html +=
        '<div class="wf-step-row" data-step-idx="' +
        i +
        '">' +
        '<select data-sf="type">' +
        _optionsHtml(STEP_TYPES, step.type || 'approval') +
        '</select>' +
        '<input type="text" data-sf="config" placeholder="Config JSON e.g. {&quot;role&quot;:&quot;manager&quot;}" value="' +
        _esc(JSON.stringify(step.config || {})) +
        '">' +
        '<input type="number" data-sf="deadline" placeholder="SLA hrs" value="' +
        _esc(step.deadline_hours != null ? String(step.deadline_hours) : '') +
        '" style="width:80px">' +
        '<button type="button" class="wf-btn ghost sm" data-action="remove-step" data-idx="' +
        i +
        '">Remove</button>' +
        '</div>';
    });
  }
  html +=
    '</div><button type="button" class="wf-btn ghost sm" data-action="add-step" style="margin-top:8px">+ Add step</button></div>';
  return html;
}

function _collectStepsFromDom() {
  const rows = _container.querySelectorAll('.wf-step-row');
  const steps = [];
  rows.forEach(function (row) {
    const type = (row.querySelector('[data-sf="type"]') || {}).value || 'approval';
    const configRaw = ((row.querySelector('[data-sf="config"]') || {}).value || '').trim();
    const deadlineRaw = ((row.querySelector('[data-sf="deadline"]') || {}).value || '').trim();
    let config = {};
    if (configRaw) {
      try {
        config = JSON.parse(configRaw);
      } catch {
        config = { note: configRaw };
      }
    }
    const step = { type: type, config: config };
    if (deadlineRaw) step.deadline_hours = Number(deadlineRaw);
    steps.push(step);
  });
  return steps;
}

export function wfShowForm(item) {
  if (!_isAdmin()) {
    toast('Admin access required', 'error');
    return;
  }
  _editing = item || null;
  _draftSteps = item && Array.isArray(item.steps) ? item.steps.map(function (s) {
    return {
      type: s.type || 'approval',
      config: s.config || {},
      deadline_hours: s.deadline_hours != null ? s.deadline_hours : s.deadlineHours,
    };
  }) : [];
  const isEdit = !!item;
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box) return;
  const triggerType = (item && item.triggerType) || 'manual';
  const eventName =
    (item && item.triggerConfig && (item.triggerConfig.eventName || item.triggerConfig.event)) ||
    '';
  box.innerHTML =
    '<div class="wf-modal-title">' +
    (isEdit ? 'Edit workflow' : 'Add workflow') +
    '</div>' +
    '<div class="wf-field"><label>Name *</label><input type="text" id="wfF_name" value="' +
    _esc((item && item.name) || '') +
    '"></div>' +
    '<div class="wf-field"><label>Description</label><textarea id="wfF_description" rows="2">' +
    _esc((item && item.description) || '') +
    '</textarea></div>' +
    '<div class="wf-row">' +
    '<div class="wf-field" style="flex:1"><label>Trigger</label><select id="wfF_trigger">' +
    _optionsHtml(TRIGGER_TYPES, triggerType) +
    '</select></div>' +
    '<div class="wf-field" style="flex:1" id="wfF_eventWrap"><label>Event name</label><input type="text" id="wfF_event" placeholder="e.g. member.created" value="' +
    _esc(eventName) +
    '"></div>' +
    '</div>' +
    _renderStepsEditor() +
    (isEdit
      ? '<div class="wf-field"><label><input type="checkbox" id="wfF_active"' +
        (item.active ? ' checked' : '') +
        '> Active</label></div>'
      : '') +
    '<div class="wf-form-actions">' +
    '<button type="button" class="wf-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="wf-btn" id="wfSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#wfModal');
  if (modal) modal.classList.add('open');
  _syncTriggerFields();
  box.querySelector('#wfF_trigger').addEventListener('change', _syncTriggerFields);
  box.querySelector('#wfSaveBtn').addEventListener('click', function () {
    _saveWorkflow();
  });
}

function _syncTriggerFields() {
  const trigger = (_container.querySelector('#wfF_trigger') || {}).value;
  const wrap = _container.querySelector('#wfF_eventWrap');
  if (wrap) wrap.style.display = trigger === 'event' ? '' : 'none';
}

function _refreshStepsEditor() {
  const list = _container.querySelector('#wfStepsList');
  if (!list) return;
  const parent = list.parentElement;
  if (!parent) return;
  const field = parent.closest('.wf-field') || parent;
  const html = _renderStepsEditor();
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  field.replaceWith(tmp.firstChild);
}

async function _saveWorkflow() {
  if (_saving) return;
  const name = ((_container.querySelector('#wfF_name') || {}).value || '').trim();
  if (!name) {
    toast('Name is required', 'error');
    return;
  }
  const triggerType = ((_container.querySelector('#wfF_trigger') || {}).value) || 'manual';
  const eventName = ((_container.querySelector('#wfF_event') || {}).value || '').trim();
  const steps = _collectStepsFromDom();
  const body = {
    name: name,
    description: ((_container.querySelector('#wfF_description') || {}).value || '').trim(),
    triggerType: triggerType,
    triggerConfig:
      triggerType === 'event' && eventName ? { eventName: eventName } : {},
    steps: steps,
  };
  if (_editing) {
    const activeEl = _container.querySelector('#wfF_active');
    if (activeEl) body.active = !!activeEl.checked;
  }
  _saving = true;
  try {
    let result;
    if (_editing && _editing.id) {
      result = await api.put('/api/workflows/' + _editing.id, body);
    } else {
      result = await api.post('/api/workflows', body);
    }
    if (result && result._error) {
      toast(result.message || 'Failed to save', 'error');
      return;
    }
    toast(_editing ? 'Updated' : 'Created', 'success');
    wfCloseModal();
    await wfLoadData();
  } finally {
    _saving = false;
  }
}

export function wfShowFormDefinition(item) {
  if (!_isAdmin()) {
    toast('Admin access required', 'error');
    return;
  }
  _editingForm = item || null;
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box) return;
  const fieldsJson =
    item && item.fields
      ? JSON.stringify(item.fields, null, 2)
      : '[\n  { "key": "notes", "label": "Notes", "type": "text" }\n]';
  const wfOpts =
    '<option value="">None</option>' +
    _workflows
      .map(function (w) {
        return (
          '<option value="' +
          _esc(w.id) +
          '"' +
          (item && item.workflowId === w.id ? ' selected' : '') +
          '>' +
          _esc(w.name) +
          '</option>'
        );
      })
      .join('');
  box.innerHTML =
    '<div class="wf-modal-title">' +
    (item ? 'Edit form' : 'Add form') +
    '</div>' +
    '<div class="wf-field"><label>Name *</label><input type="text" id="wfForm_name" value="' +
    _esc((item && item.name) || '') +
    '"></div>' +
    '<div class="wf-field"><label>Linked workflow</label><select id="wfForm_workflow">' +
    wfOpts +
    '</select></div>' +
    '<div class="wf-field"><label>Fields JSON *</label><textarea id="wfForm_fields" rows="8">' +
    _esc(fieldsJson) +
    '</textarea></div>' +
    '<div class="wf-form-actions">' +
    '<button type="button" class="wf-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="wf-btn" id="wfFormSaveBtn">Create</button></div>';
  const modal = _container.querySelector('#wfModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#wfFormSaveBtn').addEventListener('click', _saveForm);
}

async function _saveForm() {
  if (_saving) return;
  const name = ((_container.querySelector('#wfForm_name') || {}).value || '').trim();
  if (!name) {
    toast('Name is required', 'error');
    return;
  }
  const fieldsRaw = ((_container.querySelector('#wfForm_fields') || {}).value || '').trim();
  let fieldsJson = '[]';
  try {
    const parsed = JSON.parse(fieldsRaw || '[]');
    fieldsJson = JSON.stringify(parsed);
  } catch {
    toast('Fields must be valid JSON', 'error');
    return;
  }
  const workflowId = ((_container.querySelector('#wfForm_workflow') || {}).value) || undefined;
  _saving = true;
  try {
    const result = await api.post('/api/workflow-forms', {
      name: name,
      fieldsJson: fieldsJson,
      workflowId: workflowId || undefined,
    });
    if (result && result._error) {
      toast(result.message || 'Failed', 'error');
      return;
    }
    toast('Created', 'success');
    wfCloseModal();
    await wfLoadData();
  } finally {
    _saving = false;
  }
}

export function wfShowSubmitForm(form) {
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box || !form) return;
  let fieldsHtml = '';
  (form.fields || []).forEach(function (f) {
    const key = f.key || f.name || 'field';
    fieldsHtml +=
      '<div class="wf-field"><label>' +
      _esc(f.label || key) +
      '</label><input type="text" data-form-key="' +
      _esc(key) +
      '"></div>';
  });
  if (!fieldsHtml) {
    fieldsHtml =
      '<div class="wf-field"><label>Notes</label><textarea id="wfSubmit_notes" rows="3"></textarea></div>';
  }
  box.innerHTML =
    '<div class="wf-modal-title">Submit: ' +
    _esc(form.name) +
    '</div>' +
    fieldsHtml +
    '<div class="wf-form-actions">' +
    '<button type="button" class="wf-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="wf-btn" id="wfSubmitBtn">Submit</button></div>';
  _container.querySelector('#wfModal').classList.add('open');
  box.querySelector('#wfSubmitBtn').addEventListener('click', async function () {
    const data = {};
    box.querySelectorAll('[data-form-key]').forEach(function (input) {
      data[input.getAttribute('data-form-key')] = input.value;
    });
    const notes = _container.querySelector('#wfSubmit_notes');
    if (notes) data.notes = notes.value;
    const result = await api.post('/api/workflow-forms/' + form.id + '/submit', { data: data });
    if (result && result._error) {
      toast(result.message || 'Failed', 'error');
      return;
    }
    toast('Submitted', 'success');
    wfCloseModal();
  });
}

export function wfShowInstanceDetail(item) {
  const box = _container && _container.querySelector('#wfModalBox');
  if (!box || !item) return;
  const history = Array.isArray(item.stepHistory) ? item.stepHistory : [];
  let histHtml = '<div class="wf-history">';
  if (!history.length) {
    histHtml += '<div class="wf-steps-empty">No step history yet</div>';
  } else {
    history.forEach(function (h, i) {
      histHtml +=
        '<div class="wf-history-row"><strong>#' +
        (i + 1) +
        '</strong> ' +
        _esc(typeof h === 'string' ? h : JSON.stringify(h)) +
        '</div>';
    });
  }
  histHtml += '</div>';
  box.innerHTML =
    '<div class="wf-modal-title">Instance: ' +
    _esc(_workflowName(item.workflowId)) +
    '</div>' +
    '<div class="wf-card-sub" style="margin-bottom:12px">Status: ' +
    _esc(item.status) +
    ' · Step ' +
    _esc(String(item.currentStep)) +
    '</div>' +
    '<div class="wf-field"><label>History</label>' +
    histHtml +
    '</div>' +
    '<div class="wf-form-actions"><button type="button" class="wf-btn" data-action="close-modal">Close</button></div>';
  _container.querySelector('#wfModal').classList.add('open');
}

export async function wfDelete(idx) {
  if (!_isAdmin()) return;
  const item = _workflows[idx];
  if (!item) return;
  if (!(await confirmDialog({ message: 'Delete workflow "' + item.name + '"?', confirmLabel: 'Delete', danger: true }))) return;
  const result = await api.delete('/api/workflows/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function wfToggleActive(idx) {
  if (!_isAdmin()) return;
  const item = _workflows[idx];
  if (!item) return;
  const result = await api.put('/api/workflows/' + item.id, { active: !item.active });
  if (result && !result._error) {
    toast(item.active ? 'Deactivated' : 'Activated', 'success');
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function wfTrigger(idx) {
  const item = _workflows[idx];
  if (!item) return;
  const result = await api.post('/api/workflows/' + item.id + '/trigger', { triggerData: {} });
  if (result && !result._error) {
    toast('Workflow started', 'success');
    _tab = 'instances';
    _setActiveTab();
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to start', 'error');
}

async function wfAdvance(idx) {
  const item = _instances[idx];
  if (!item) return;
  const result = await api.post('/api/workflow-instances/' + item.id + '/advance', {});
  if (result && !result._error) {
    toast('Advanced', 'success');
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function wfCancel(idx) {
  const item = _instances[idx];
  if (!item) return;
  if (!(await confirmDialog({ message: 'Cancel this instance?', confirmLabel: 'Cancel instance', cancelLabel: 'Keep running', danger: true }))) return;
  const result = await api.post('/api/workflow-instances/' + item.id + '/cancel', {});
  if (result && !result._error) {
    toast('Cancelled', 'success');
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function wfDeleteForm(idx) {
  if (!_isAdmin()) return;
  const item = _forms[idx];
  if (!item) return;
  if (!(await confirmDialog({ message: 'Delete form "' + item.name + '"?', confirmLabel: 'Delete', danger: true }))) return;
  const result = await api.delete('/api/workflow-forms/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await wfLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export function wfCloseModal() {
  const modal = _container && _container.querySelector('#wfModal');
  if (modal) modal.classList.remove('open');
  _editing = null;
  _editingForm = null;
}

function _setActiveTab() {
  const tabs = _container && _container.querySelectorAll('.wf-tab');
  if (!tabs) return;
  tabs.forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#wfAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (_tab === 'forms') wfShowFormDefinition(null);
      else wfShowForm(null);
    });
  }

  const tabs = container.querySelector('#wfTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.wf-tab');
      if (!tab) return;
      _tab = tab.dataset.tab || 'definitions';
      _setActiveTab();
      wfRender();
    });
  }

  const modal = container.querySelector('#wfModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) wfCloseModal();
    });
  }

  const content = container.querySelector('#wfContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.idx, 10);
      if (action === 'edit') wfShowForm(_workflows[idx]);
      else if (action === 'delete') wfDelete(idx);
      else if (action === 'toggle-active') wfToggleActive(idx);
      else if (action === 'trigger') wfTrigger(idx);
      else if (action === 'advance') wfAdvance(idx);
      else if (action === 'cancel') wfCancel(idx);
      else if (action === 'view-instance') wfShowInstanceDetail(_instances[idx]);
      else if (action === 'submit-form') wfShowSubmitForm(_forms[idx]);
      else if (action === 'delete-form') wfDeleteForm(idx);
    });
  }

  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) {
      wfCloseModal();
      return;
    }
    const addStep = e.target.closest('[data-action="add-step"]');
    if (addStep) {
      _draftSteps = _collectStepsFromDom();
      _draftSteps.push({ type: 'approval', config: { role: 'manager' }, deadline_hours: 24 });
      _refreshStepsEditor();
      return;
    }
    const removeStep = e.target.closest('[data-action="remove-step"]');
    if (removeStep) {
      _draftSteps = _collectStepsFromDom();
      const i = parseInt(removeStep.dataset.idx, 10);
      _draftSteps.splice(i, 1);
      _refreshStepsEditor();
    }
  });
}

/* ── Test helpers ── */
export function _getData() {
  return _workflows;
}
export function _setData(d) {
  _workflows = Array.isArray(d) ? d.map(_normalizeWorkflow) : [];
}
export function _getWorkflows() {
  return _workflows;
}
export function _getInstances() {
  return _instances;
}
export function _getForms() {
  return _forms;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _resetState() {
  _container = null;
  _tab = 'definitions';
  _workflows = [];
  _instances = [];
  _forms = [];
  _loadError = null;
  _featureOff = false;
  _saving = false;
  _editing = null;
  _editingForm = null;
  _draftSteps = [];
}

registerModule('workflows', renderWorkflowsPage);

/**
 * sections/approvals.js
 * Approval Flows custom section — 5 entity tabs, step CRUD, reorder, escalation.
 * API: GET/PUT /api/approval-flows, POST/PUT/DELETE /api/approval-flows/:id/steps
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _flows = [];
let _activeTab = 'leave';
let _container = null;
let _abortController = null;

const ENTITY_LABELS = {
  expense: 'Expense',
  leave: 'Leave',
  overtime: 'Overtime',
  regularization: 'Regularization',
  timesheet: 'Timesheet',
};

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="ap-loading">Loading approval flows\u2026</div>';

  const data = await api.get('/api/approval-flows');
  if (!data || data._error) {
    container.innerHTML = '<div class="ap-error">Failed to load approval flows</div>';
    return;
  }

  _flows = data.flows || [];
  _renderUI();
}

export function destroy() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  _container = null;
  _flows = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  const tabs = Object.keys(ENTITY_LABELS);
  let html = '<div class="ap-wrap">';

  /* Tab bar */
  html += '<div class="ap-tabs">';
  tabs.forEach(function (t) {
    html +=
      '<button class="ap-tab' +
      (t === _activeTab ? ' active' : '') +
      '" data-ap-tab="' +
      t +
      '">' +
      ENTITY_LABELS[t] +
      '</button>';
  });
  html += '</div>';

  /* Active flow */
  const flow = _flows.find(function (f) {
    return f.entity_type === _activeTab;
  });
  html += '<div class="ap-body">';

  if (!flow) {
    html += '<div class="ap-empty">No flow found for ' + ENTITY_LABELS[_activeTab] + '</div>';
  } else {
    /* Escalation */
    html += '<div class="ap-escalation">';
    html +=
      '<label class="ap-esc-row"><input type="checkbox" id="apEscEnabled"' +
      (flow.auto_escalation_enabled ? ' checked' : '') +
      '>';
    html += '<span>Auto-escalation enabled</span></label>';
    html += '<div class="ap-field-row"><label>Escalate after (hrs)</label>';
    html +=
      '<input type="number" id="apEscHours" class="ap-input" min="1" max="168" value="' +
      (flow.auto_escalation_hours || 24) +
      '"></div>';
    html += '<button class="ap-btn" id="apSaveEsc">Save Escalation Settings</button>';
    html += '</div>';

    /* Steps */
    html += '<div class="ap-steps-title">Approval Steps</div>';
    html += '<div class="ap-steps" id="apSteps">';
    (flow.steps || []).forEach(function (step, i) {
      html += '<div class="ap-step" data-step-id="' + step.id + '">';
      html += '<span class="ap-step-level">T' + step.level + '</span>';
      html +=
        '<input type="text" class="ap-input ap-step-role" value="' +
        _esc(step.role) +
        '" placeholder="Role (manager, hr, admin)">';
      html +=
        '<input type="number" class="ap-input ap-step-hrs" min="1" max="168" value="' +
        (step.escalate_after_hours || 24) +
        '" title="Escalate after (hrs)">';
      html +=
        '<button class="ap-step-btn ap-step-save" data-step-id="' + step.id + '">Save</button>';
      if (i > 0) {
        html +=
          '<button class="ap-step-btn ap-step-up" data-step-id="' + step.id + '">\u2191</button>';
      }
      if (i < (flow.steps || []).length - 1) {
        html +=
          '<button class="ap-step-btn ap-step-dn" data-step-id="' + step.id + '">\u2193</button>';
      }
      html +=
        '<button class="ap-step-btn ap-step-del danger" data-step-id="' +
        step.id +
        '">\u2715</button>';
      html += '</div>';
    });
    html += '</div>';

    /* Add step */
    html += '<div class="ap-add-step">';
    html +=
      '<input type="text" id="apNewRole" class="ap-input" placeholder="New step role (e.g. manager)">';
    html += '<button class="ap-btn" id="apAddStep">+ Add Step</button>';
    html += '</div>';
  }

  html += '</div></div>';
  _container.innerHTML = html;
  _bindEvents(flow);
}

function _bindEvents(flow) {
  if (!_container) {
    return;
  }

  /* Tab switching */
  _container.querySelectorAll('.ap-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _activeTab = /** @type {HTMLElement} */ (btn).dataset.apTab;
      _renderUI();
    });
  });

  if (!flow) {
    return;
  }

  /* Save escalation */
  const saveEsc = _container.querySelector('#apSaveEsc');
  if (saveEsc) {
    saveEsc.addEventListener('click', async function () {
      const enabled = /** @type {HTMLInputElement} */ (_container.querySelector('#apEscEnabled'))
        .checked;
      const hours =
        parseInt(
          /** @type {HTMLInputElement} */ (_container.querySelector('#apEscHours')).value,
          10,
        ) || 24;
      const res = await api.put('/api/approval-flows/' + flow.id, {
        auto_escalation_enabled: enabled,
        auto_escalation_hours: hours,
      });
      if (res && !res._error) {
        toast('Escalation settings saved', 'success');
        const f = _flows.find(function (x) {
          return x.id === flow.id;
        });
        if (f) {
          f.auto_escalation_enabled = enabled;
          f.auto_escalation_hours = hours;
        }
      } else {
        toast((res && res.message) || 'Failed to save', 'error');
      }
    });
  }

  /* Step save */
  _container.querySelectorAll('.ap-step-save').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const stepId = /** @type {HTMLElement} */ (btn).dataset.stepId;
      const row = _container.querySelector('[data-step-id="' + stepId + '"]');
      if (!row) {
        return;
      }
      const role = /** @type {HTMLInputElement} */ (
        row.querySelector('.ap-step-role')
      ).value.trim();
      const hrs =
        parseInt(/** @type {HTMLInputElement} */ (row.querySelector('.ap-step-hrs')).value, 10) ||
        24;
      const res = await api.put('/api/approval-flows/' + flow.id + '/steps/' + stepId, {
        role: role,
        escalate_after_hours: hrs,
      });
      if (res && !res._error) {
        toast('Step saved', 'success');
        const step = (flow.steps || []).find(function (s) {
          return s.id === stepId;
        });
        if (step) {
          step.role = role;
          step.escalate_after_hours = hrs;
        }
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Step delete */
  _container.querySelectorAll('.ap-step-del').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const stepId = /** @type {HTMLElement} */ (btn).dataset.stepId;
      if (!confirm('Delete this step?')) {
        return;
      }
      const res = await api.delete('/api/approval-flows/' + flow.id + '/steps/' + stepId);
      if (res && !res._error) {
        toast('Step deleted', 'success');
        flow.steps = (flow.steps || []).filter(function (s) {
          return s.id !== stepId;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Step reorder up */
  _container.querySelectorAll('.ap-step-up').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const stepId = /** @type {HTMLElement} */ (btn).dataset.stepId;
      const steps = flow.steps || [];
      const idx = steps.findIndex(function (s) {
        return s.id === stepId;
      });
      if (idx <= 0) {
        return;
      }
      const newOrder = steps.map(function (s) {
        return s.id;
      });
      const tmp = newOrder[idx - 1];
      newOrder[idx - 1] = newOrder[idx];
      newOrder[idx] = tmp;
      await _reorder(flow.id, newOrder, flow);
    });
  });

  /* Step reorder down */
  _container.querySelectorAll('.ap-step-dn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const stepId = /** @type {HTMLElement} */ (btn).dataset.stepId;
      const steps = flow.steps || [];
      const idx = steps.findIndex(function (s) {
        return s.id === stepId;
      });
      if (idx < 0 || idx >= steps.length - 1) {
        return;
      }
      const newOrder = steps.map(function (s) {
        return s.id;
      });
      const tmp = newOrder[idx + 1];
      newOrder[idx + 1] = newOrder[idx];
      newOrder[idx] = tmp;
      await _reorder(flow.id, newOrder, flow);
    });
  });

  /* Add step */
  const addBtn = _container.querySelector('#apAddStep');
  if (addBtn) {
    addBtn.addEventListener('click', async function () {
      const roleInput = /** @type {HTMLInputElement} */ (_container.querySelector('#apNewRole'));
      const role = roleInput.value.trim();
      if (!role) {
        toast('Role is required', 'error');
        return;
      }
      const res = await api.post('/api/approval-flows/' + flow.id + '/steps', { role: role });
      if (res && !res._error) {
        toast('Step added', 'success');
        flow.steps = flow.steps || [];
        flow.steps.push({
          id: res.id || 'new-' + Date.now(),
          level: res.level,
          role: role,
          escalate_after_hours: 24,
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  }
}

async function _reorder(flowId, stepIds, flow) {
  const res = await api.put('/api/approval-flows/' + flowId + '/steps/reorder', {
    stepIds: stepIds,
  });
  if (res && !res._error) {
    /* Re-fetch flow to get updated levels */
    const data = await api.get('/api/approval-flows');
    if (data && !data._error) {
      _flows = data.flows || [];
      const updated = _flows.find(function (f) {
        return f.id === flowId;
      });
      if (updated) {
        Object.assign(flow, updated);
      }
    }
    _renderUI();
  } else {
    toast((res && res.message) || 'Reorder failed', 'error');
  }
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

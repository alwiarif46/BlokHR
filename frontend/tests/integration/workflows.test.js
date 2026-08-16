import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('workflows module', () => {
  /** @type {typeof import('../../modules/workflows/workflows.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiPut;
  let apiDelete;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/workflows') {
        return {
          workflows: [
            {
              id: 'w1',
              name: 'Leave Approval',
              description: 'Manager then HR',
              trigger_type: 'manual',
              trigger_config_json: '{}',
              steps_json: JSON.stringify([
                { type: 'approval', config: { role: 'manager' }, deadline_hours: 24 },
              ]),
              active: 1,
            },
          ],
        };
      }
      if (path === '/api/workflow-instances') {
        return {
          instances: [
            {
              id: 'i1',
              workflow_id: 'w1',
              current_step: 0,
              status: 'running',
              started_by: 'admin@test.com',
              started_at: '2026-08-01 10:00:00',
              step_history_json: '[]',
            },
          ],
        };
      }
      if (path === '/api/workflow-forms') {
        return {
          forms: [
            {
              id: 'f1',
              name: 'Onboarding intake',
              fields_json: JSON.stringify([{ key: 'notes', label: 'Notes', type: 'text' }]),
              workflow_id: 'w1',
            },
          ],
        };
      }
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/workflows') {
        return {
          workflow: {
            id: 'w-new',
            name: body.name,
            trigger_type: body.triggerType,
            steps_json: JSON.stringify(body.steps || []),
            active: 1,
          },
        };
      }
      if (path.endsWith('/trigger')) {
        return { instance: { id: 'i-new', workflow_id: 'w1', status: 'running', current_step: 0 } };
      }
      if (path.endsWith('/advance') || path.endsWith('/cancel')) return { success: true };
      if (path === '/api/workflow-forms') {
        return { form: { id: 'f-new', name: body.name, fields_json: body.fieldsJson } };
      }
      if (path.endsWith('/submit')) {
        return { submission: { id: 's1', form_id: 'f1' } };
      }
      return { success: true };
    });

    apiPut = vi.fn(async () => ({ success: true }));
    apiDelete = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete },
    }));

    mod = await import('../../modules/workflows/workflows.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads definitions, instances, and forms in parallel', async () => {
    mod.renderWorkflowsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Leave Approval');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/workflows');
    expect(apiGet).toHaveBeenCalledWith('/api/workflow-instances');
    expect(apiGet).toHaveBeenCalledWith('/api/workflow-forms');
    expect(mod._getWorkflows()[0].triggerType).toBe('manual');
    expect(mod._getWorkflows()[0].steps).toHaveLength(1);
    expect(mod._getInstances()[0].status).toBe('running');
  });

  it('creates a workflow with triggerType and steps', async () => {
    mod.renderWorkflowsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/workflows'));

    document.getElementById('wfAddBtn').click();
    document.getElementById('wfF_name').value = 'Expense chain';
    document.getElementById('wfF_trigger').value = 'manual';
    document.querySelector('[data-action="add-step"]').click();
    const row = document.querySelector('.wf-step-row');
    row.querySelector('[data-sf="type"]').value = 'approval';
    row.querySelector('[data-sf="config"]').value = '{"role":"manager"}';
    row.querySelector('[data-sf="deadline"]').value = '24';
    document.getElementById('wfSaveBtn').click();

    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const call = apiPost.mock.calls.find((c) => c[0] === '/api/workflows');
    expect(call).toBeTruthy();
    expect(call[1].name).toBe('Expense chain');
    expect(call[1].triggerType).toBe('manual');
    expect(call[1].steps[0].type).toBe('approval');
    expect(call[1].steps[0].config.role).toBe('manager');
    expect(call[1].steps[0].deadline_hours).toBe(24);
    expect(toastFn).toHaveBeenCalledWith('Created', 'success');
  });

  it('triggers a manual workflow and advances an instance', async () => {
    mod.renderWorkflowsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getWorkflows().length).toBe(1));

    document.querySelector('[data-action="trigger"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/workflows/w1/trigger', { triggerData: {} });
    });

    document.querySelector('[data-tab="instances"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Advance');
    });
    document.querySelector('[data-action="advance"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/workflow-instances/i1/advance', {});
    });
  });

  it('normalizes snake_case workflow and instance fields', () => {
    const wf = mod._normalizeWorkflow({
      id: 'x',
      name: 'T',
      trigger_type: 'event',
      trigger_config_json: '{"eventName":"member.created"}',
      steps_json: '[{"type":"notification","config":{}}]',
      active: 1,
    });
    expect(wf.triggerType).toBe('event');
    expect(wf.triggerConfig.eventName).toBe('member.created');
    expect(wf.steps[0].type).toBe('notification');
    expect(wf.active).toBe(true);

    const inst = mod._normalizeInstance({
      id: 'i',
      workflow_id: 'w',
      current_step: 2,
      status: 'completed',
      step_history_json: '[{"ok":true}]',
    });
    expect(inst.workflowId).toBe('w');
    expect(inst.currentStep).toBe(2);
    expect(inst.stepHistory[0].ok).toBe(true);
  });

  it('shows feature-off message when workflows API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/workflows') {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/workflow-instances') return { instances: [] };
      if (path === '/api/workflow-forms') return { forms: [] };
      return {};
    });

    mod.renderWorkflowsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled for this workspace/i);
    });
  });
});

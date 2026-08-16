import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('surveys module', () => {
  /** @type {typeof import('../../modules/surveys/surveys.js')} */
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
      if (path === '/api/surveys/pending') {
        return {
          surveys: [
            {
              id: 's-pending',
              title: 'Pulse check',
              status: 'active',
              audience: 'employee',
              anonymous: 1,
              target_group_ids: '',
              questions_json: JSON.stringify([
                { key: 'q1', label: 'How are you?', type: 'scale' },
              ]),
            },
          ],
        };
      }
      if (path === '/api/surveys') {
        return {
          surveys: [
            {
              id: 's1',
              title: 'Draft survey',
              status: 'draft',
              audience: 'employee',
              anonymous: 1,
              target_group_ids: '',
              questions_json: '[]',
            },
          ],
        };
      }
      if (path === '/api/settings') {
        return {
          groups: [
            { id: 'eng', name: 'Engineering' },
            { id: 'sales', name: 'Sales' },
          ],
        };
      }
      return {};
    });
    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/surveys') {
        return {
          survey: {
            id: 's-new',
            title: body.title,
            status: 'draft',
            audience: 'employee',
            target_group_ids: Array.isArray(body.targetGroupIds)
              ? body.targetGroupIds.join(',')
              : body.targetGroupIds || '',
            questions_json: JSON.stringify(body.questions || []),
          },
        };
      }
      if (path.endsWith('/respond')) {
        return { response: { id: 'r1', survey_id: 's-pending' } };
      }
      if (path.endsWith('/publish')) return { success: true };
      return { success: true };
    });
    apiPut = vi.fn(async () => ({ survey: { id: 's1', title: 'Updated' } }));
    apiDelete = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'admin@test.com', is_admin: true, role: 'admin' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: {
        get: apiGet,
        post: apiPost,
        put: apiPut,
        delete: apiDelete,
      },
    }));

    mod = await import('../../modules/surveys/surveys.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('renders pending surveys for the For me tab', async () => {
    mod.renderSurveysPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Pulse check');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/surveys/pending');
    expect(document.body.textContent).toContain('Respond');
  });

  it('creates a survey with group targeting and without Peer 360', async () => {
    mod.renderSurveysPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/settings'));

    document.getElementById('svAddBtn').click();
    expect(document.getElementById('svF_audience')).toBeNull();
    expect(document.body.textContent).not.toContain('Peer 360');

    const title = document.getElementById('svF_title');
    expect(title).toBeTruthy();
    title.value = 'New pulse';

    document.getElementById('svF_targetMode').value = 'groups';
    document.getElementById('svF_targetMode').dispatchEvent(new Event('change'));
    const eng = document.querySelector('input[name="svF_group"][value="eng"]');
    expect(eng).toBeTruthy();
    eng.checked = true;

    document.querySelector('[data-action="add-question"]').click();
    const row = document.querySelector('.sv-q-row');
    row.querySelector('[data-qf="key"]').value = 'sat';
    row.querySelector('[data-qf="label"]').value = 'Satisfaction';
    row.querySelector('[data-qf="type"]').value = 'scale';

    document.getElementById('svSaveBtn').click();
    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());

    const call = apiPost.mock.calls.find((c) => c[0] === '/api/surveys');
    expect(call).toBeTruthy();
    expect(call[1].title).toBe('New pulse');
    expect(call[1].questions[0].key).toBe('sat');
    expect(call[1].targetGroupIds).toEqual(['eng']);
    expect(call[1].audience).toBeUndefined();
    expect(call[1].peerAssignments).toBeUndefined();
    expect(toastFn).toHaveBeenCalledWith('Created', 'success');
  });

  it('submits a pending survey response', async () => {
    mod.renderSurveysPage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Respond'));

    document.querySelector('[data-action="take"]').click();
    expect(document.body.textContent).toContain('anonymous');
    document.getElementById('svA_q1').value = '4';
    document.querySelector('[data-action="submit-response"]').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/surveys/s-pending/respond',
        expect.objectContaining({ answers: { q1: 4 } }),
      );
    });
    expect(toastFn).toHaveBeenCalledWith('Submitted', 'success');
  });
});

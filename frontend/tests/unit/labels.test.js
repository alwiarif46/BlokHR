import { describe, it, expect, beforeEach, vi } from 'vitest';

const sseHandlers = {};
const apiGet = vi.fn();

vi.mock('../../shared/sse.js', () => ({
  onSSE: (event, cb) => {
    sseHandlers[event] = cb;
    return () => {
      delete sseHandlers[event];
    };
  },
}));

vi.mock('../../shared/api.js', () => ({
  api: {
    get: (...args) => apiGet(...args),
  },
}));

describe('labels.js', () => {
  /** @type {typeof import('../../shared/labels.js')} */
  let labels;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(sseHandlers).forEach((k) => delete sseHandlers[k]);
    apiGet.mockReset();
    labels = await import('../../shared/labels.js');
  });

  it('falls back through tenant → vertical defaults → key', () => {
    labels.initLabels(
      { settings_json: { terminology: { person: 'Teammate' } } },
      'hr',
    );
    expect(labels.t('person')).toBe('Teammate');
    expect(labels.t('group')).toBe('Department');
    expect(labels.t('unknown_label')).toBe('unknown_label');
  });

  it('uses school vertical defaults when tenant map is empty', () => {
    labels.initLabels({ settings_json: {} }, 'school');
    expect(labels.t('person')).toBe('Student');
    expect(labels.t('supervisor')).toBe('Class Teacher');
  });

  it('refreshes t() output when settings-update SSE fires', async () => {
    labels.initLabels({ settings_json: { terminology: { person: 'Employee' } } }, 'hr');
    expect(labels.t('person')).toBe('Employee');

    let changed = 0;
    labels.onLabelsChanged(() => {
      changed += 1;
    });

    apiGet.mockResolvedValue({
      tenant_settings: {
        settings_json: {
          terminology: { person: 'Associate', person_plural: 'Associates' },
        },
      },
    });

    expect(sseHandlers['settings-update']).toBeTypeOf('function');
    await sseHandlers['settings-update']({});
    expect(apiGet).toHaveBeenCalledWith('/api/settings');
    expect(labels.t('person')).toBe('Associate');
    expect(changed).toBeGreaterThanOrEqual(1);
  });
});

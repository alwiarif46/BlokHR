/**
 * tests/integration/webhooks.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../helpers/setup.js';

const _toasts = [];
const _apiCalls = [];

vi.mock('../../frontend/shared/api.js', () => ({
  api: Object.assign(async () => ({ _error: true }), {
    get:    async (p)    => { _apiCalls.push({ method: 'GET',    path: p }); return { _error: true }; },
    post:   async (p, b) => { _apiCalls.push({ method: 'POST',   path: p, body: b }); return { _error: true }; },
    put:    async (p, b) => { _apiCalls.push({ method: 'PUT',    path: p, body: b }); return { _error: true }; },
    delete: async (p)    => { _apiCalls.push({ method: 'DELETE', path: p }); return { _error: true }; },
  }),
  isMockMode: false,
}));

vi.mock('../../frontend/shared/session.js', () => ({
  getSession: vi.fn(() => ({ email: 'admin@co.com', name: 'Admin', is_admin: true })),
  saveSession: vi.fn(), clearSession: vi.fn(), loadSession: vi.fn(), updateSession: vi.fn(), setTenantId: vi.fn(),
}));

vi.mock('../../frontend/shared/toast.js', () => ({
  toast: vi.fn((msg, type) => _toasts.push({ msg, type })),
  setToastDuration: vi.fn(),
}));

vi.mock('../../frontend/shared/router.js', () => ({
  registerModule: vi.fn(), navigateTo: vi.fn(),
}));

const { getSession } = await import('../../frontend/shared/session.js');

import {
  renderWebhooksPage, whLoadData, whRenderStats, whRender,
  whShowForm, whTest, whDelete, whCloseModal,
  _getWebhooks, _setWebhooks, _resetState,
} from '../../frontend/modules/webhooks/webhooks.js';

describe('Webhooks module', () => {
  let container;

  beforeEach(() => {
    _resetState();
    _toasts.length = 0;
    _apiCalls.length = 0;
    vi.clearAllMocks();
    getSession.mockReturnValue({ email: 'admin@co.com', name: 'Admin', is_admin: true });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => { cleanupDOM(); });

  describe('renderWebhooksPage', () => {
    it('renders page skeleton', () => {
      renderWebhooksPage(container);
      expect(container.querySelector('#whStats')).toBeTruthy();
      expect(container.querySelector('#whContent')).toBeTruthy();
      expect(container.querySelector('#whModal')).toBeTruthy();
    });

    it('admin sees New Webhook button', () => {
      renderWebhooksPage(container);
      expect(container.querySelector('#whAddBtn')).toBeTruthy();
    });

    it('non-admin has no New Webhook button', () => {
      getSession.mockReturnValue({ email: 'emp@co.com', is_admin: false });
      renderWebhooksPage(container);
      expect(container.querySelector('#whAddBtn')).toBeNull();
    });
  });

  describe('whLoadData', () => {
    it('calls GET /api/webhooks', async () => {
      renderWebhooksPage(container);
      _apiCalls.length = 0;
      await whLoadData();
      expect(_apiCalls.some(c => c.method === 'GET' && c.path === '/api/webhooks')).toBe(true);
    });

    it('falls back to mock data on error', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      expect(_getWebhooks().length).toBeGreaterThan(0);
    });
  });

  describe('whRenderStats', () => {
    it('renders 4 stat cards', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      expect(container.querySelectorAll('.wh-stat').length).toBe(4);
    });

    it('counts active webhooks correctly', () => {
      _setWebhooks([
        { id: 'w1', name: 'A', url: 'https://a.com', events: ['clock.in'], active: true,  success_count: 10, fail_count: 0 },
        { id: 'w2', name: 'B', url: 'https://b.com', events: ['clock.in'], active: false, success_count: 5,  fail_count: 2 },
      ]);
      renderWebhooksPage(container);
      whRenderStats();
      const nums = [...container.querySelectorAll('.wh-stat-n')].map(el => el.textContent);
      expect(nums[0]).toBe('2'); // Total
      expect(nums[1]).toBe('1'); // Active
    });
  });

  describe('whRender', () => {
    it('shows empty state when no webhooks', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      _setWebhooks([]);
      whRender();
      expect(container.querySelector('.wh-empty')).toBeTruthy();
    });

    it('renders webhook rows', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      expect(container.querySelectorAll('.wh-row').length).toBeGreaterThan(0);
    });

    it('shows event badges', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      expect(container.querySelector('.wh-event')).toBeTruthy();
    });

    it('admin sees Test, Edit, Toggle, Delete buttons', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      expect(container.querySelector('[data-action="test"]')).toBeTruthy();
      expect(container.querySelector('[data-action="edit"]')).toBeTruthy();
      expect(container.querySelector('[data-action="toggle-wh"]')).toBeTruthy();
      expect(container.querySelector('[data-action="delete"]')).toBeTruthy();
    });

    it('non-admin sees no action buttons', async () => {
      getSession.mockReturnValue({ email: 'emp@co.com', is_admin: false });
      renderWebhooksPage(container);
      await whLoadData();
      expect(container.querySelector('[data-action="test"]')).toBeNull();
    });

    it('filters by search', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      _setWebhooks([
        { id: 'w1', name: 'Slack Alerts',   url: 'https://slack.com', events: ['clock.in'], active: true, success_count: 10, fail_count: 0 },
        { id: 'w2', name: 'HR Dashboard',   url: 'https://hr.com',    events: ['clock.in'], active: true, success_count: 5,  fail_count: 0 },
      ]);
      const s = container.querySelector('#whSearch');
      s.value = 'slack';
      s.dispatchEvent(new Event('input'));
      expect(container.querySelectorAll('.wh-row').length).toBe(1);
    });

    it('toggle-wh flips active status', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      _setWebhooks([{ id: 'w1', name: 'Test', url: 'https://a.com', events: ['clock.in'], active: true, success_count: 0, fail_count: 0 }]);
      whRender();
      container.querySelector('[data-action="toggle-wh"]').click();
      expect(_getWebhooks()[0].active).toBe(false);
    });
  });

  describe('whShowForm', () => {
    it('opens modal', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      expect(container.querySelector('#whModal').classList.contains('open')).toBe(true);
    });

    it('shows New title', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      expect(container.querySelector('.wh-modal-title').textContent).toContain('New');
    });

    it('pre-fills URL on edit', () => {
      renderWebhooksPage(container);
      whShowForm({ id: 'w1', name: 'Slack', url: 'https://slack.com/hook', events: ['clock.in'], active: true });
      expect(container.querySelector('#whFUrl').value).toBe('https://slack.com/hook');
    });

    it('rejects empty name', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      container.querySelector('#whFName').value = '';
      container.querySelector('#whFUrl').value  = 'https://example.com';
      container.querySelector('#whSaveBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('rejects empty URL', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      container.querySelector('#whFName').value = 'Test';
      container.querySelector('#whFUrl').value  = '';
      container.querySelector('#whSaveBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('rejects no events selected', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      container.querySelector('#whFName').value = 'Test';
      container.querySelector('#whFUrl').value  = 'https://example.com';
      // No checkboxes checked
      container.querySelector('#whSaveBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('creates webhook when valid', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      const before = _getWebhooks().length;
      whShowForm(null);
      container.querySelector('#whFName').value = 'My Hook';
      container.querySelector('#whFUrl').value  = 'https://example.com/hook';
      container.querySelector('input[name="whEv"]').checked = true;
      await container.querySelector('#whSaveBtn').click();
      expect(_getWebhooks().length).toBe(before + 1);
    });
  });

  describe('whTest', () => {
    it('shows success toast', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      await whTest('wh1');
      expect(_toasts.some(t => String(t.msg).includes('ping'))).toBe(true);
    });

    it('increments success_count in mock', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      _setWebhooks([{ id: 'wh1', name: 'Test', url: 'https://a.com', events: ['clock.in'], active: true, success_count: 5, fail_count: 0 }]);
      await whTest('wh1');
      expect(_getWebhooks()[0].success_count).toBe(6);
    });
  });

  describe('whDelete', () => {
    it('removes webhook from list', async () => {
      renderWebhooksPage(container);
      await whLoadData();
      _setWebhooks([{ id: 'wh1', name: 'Test', url: 'https://a.com', events: ['clock.in'], active: true, success_count: 0, fail_count: 0 }]);
      await whDelete('wh1');
      expect(_getWebhooks().find(w => w.id === 'wh1')).toBeUndefined();
    });
  });

  describe('whCloseModal', () => {
    it('removes open class', () => {
      renderWebhooksPage(container);
      whShowForm(null);
      whCloseModal();
      expect(container.querySelector('#whModal').classList.contains('open')).toBe(false);
    });
  });
});

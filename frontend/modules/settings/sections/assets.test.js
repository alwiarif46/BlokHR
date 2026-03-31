/**
 * tests/integration/assets.test.js
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
  getSession: vi.fn(() => ({ email: 'arif@co.com', name: 'Arif', is_admin: false })),
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
  renderAssetsPage, astLoadData, astRenderStats, astRender,
  astShowForm, astAssign, astReturn, astMaintenance, astCloseModal,
  _getAssets, _setAssets, _resetState,
} from '../../frontend/modules/assets/assets.js';

describe('Assets module', () => {
  let container;

  beforeEach(() => {
    _resetState();
    _toasts.length = 0;
    _apiCalls.length = 0;
    vi.clearAllMocks();
    getSession.mockReturnValue({ email: 'arif@co.com', name: 'Arif', is_admin: false });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => { cleanupDOM(); });

  describe('renderAssetsPage', () => {
    it('renders page skeleton', () => {
      renderAssetsPage(container);
      expect(container.querySelector('#astStats')).toBeTruthy();
      expect(container.querySelector('#astContent')).toBeTruthy();
      expect(container.querySelector('#astModal')).toBeTruthy();
    });

    it('renders 3 view tabs', () => {
      renderAssetsPage(container);
      const tabs = container.querySelectorAll('.ast-tab');
      expect(tabs.length).toBe(3);
      const tabNames = [...tabs].map(t => t.dataset.tab);
      expect(tabNames).toContain('all');
      expect(tabNames).toContain('mine');
      expect(tabNames).toContain('available');
    });

    it('shows Add button for admin', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      expect(container.querySelector('#astAddBtn')).toBeTruthy();
    });

    it('hides Add button for non-admin', () => {
      renderAssetsPage(container);
      expect(container.querySelector('#astAddBtn')).toBeNull();
    });
  });

  describe('astLoadData', () => {
    it('calls GET /api/assets', async () => {
      renderAssetsPage(container);
      _apiCalls.length = 0;
      await astLoadData();
      expect(_apiCalls.some(c => c.method === 'GET' && c.path === '/api/assets')).toBe(true);
    });

    it('falls back to mock data on error', async () => {
      renderAssetsPage(container);
      await astLoadData();
      expect(_getAssets().length).toBeGreaterThan(0);
    });
  });

  describe('astRenderStats', () => {
    it('renders 5 stat cards', async () => {
      renderAssetsPage(container);
      await astLoadData();
      const stats = container.querySelectorAll('.ast-stat');
      expect(stats.length).toBe(5);
    });

    it('counts available correctly', () => {
      _setAssets([
        { id: 'a1', name: 'Laptop', type: 'Laptop', status: 'available', value: 50000 },
        { id: 'a2', name: 'Phone',  type: 'Phone',  status: 'in_use',    value: 30000 },
        { id: 'a3', name: 'Tablet', type: 'Tablet', status: 'available', value: 20000 },
      ]);
      renderAssetsPage(container);
      astRenderStats();
      const nums = [...container.querySelectorAll('.ast-stat-n')].map(el => el.textContent);
      expect(nums[0]).toBe('3'); // Total
      expect(nums[1]).toBe('2'); // Available
      expect(nums[2]).toBe('1'); // In Use
    });
  });

  describe('astRender', () => {
    it('shows empty state when no assets', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([]);
      astRender();
      expect(container.querySelector('.ast-empty')).toBeTruthy();
    });

    it('renders asset cards', async () => {
      renderAssetsPage(container);
      await astLoadData();
      const cards = container.querySelectorAll('.ast-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('mine tab filters by current user', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([
        { id: 'a1', name: 'My Laptop', type: 'Laptop', status: 'in_use', assigned_to: 'arif@co.com', value: 50000 },
        { id: 'a2', name: 'Other',     type: 'Phone',  status: 'in_use', assigned_to: 'bob@co.com',  value: 30000 },
      ]);
      const mineTab = container.querySelector('[data-tab="mine"]');
      mineTab.click();
      const cards = container.querySelectorAll('.ast-card');
      expect(cards.length).toBe(1);
      expect(cards[0].querySelector('.ast-card-name').textContent).toContain('My Laptop');
    });

    it('available tab shows only available assets', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([
        { id: 'a1', name: 'Available Laptop', type: 'Laptop', status: 'available', value: 50000 },
        { id: 'a2', name: 'Used Phone',       type: 'Phone',  status: 'in_use',    value: 30000 },
      ]);
      container.querySelector('[data-tab="available"]').click();
      const cards = container.querySelectorAll('.ast-card');
      expect(cards.length).toBe(1);
    });

    it('filters by type', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([
        { id: 'a1', name: 'Laptop 1', type: 'Laptop', status: 'available', value: 50000 },
        { id: 'a2', name: 'Phone 1',  type: 'Phone',  status: 'available', value: 30000 },
      ]);
      const tf = container.querySelector('#astTypeFilter');
      tf.value = 'Laptop';
      tf.dispatchEvent(new Event('change'));
      const cards = container.querySelectorAll('.ast-card');
      expect(cards.length).toBe(1);
    });

    it('admin sees action buttons', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      _setAssets([{ id: 'a1', name: 'Laptop', type: 'Laptop', status: 'available', value: 50000 }]);
      renderAssetsPage(container);
      astRender();
      expect(container.querySelector('[data-action="assign"]')).toBeTruthy();
    });
  });

  describe('astShowForm', () => {
    it('opens modal for admin', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      astShowForm(null);
      expect(container.querySelector('#astModal').classList.contains('open')).toBe(true);
    });

    it('shows Add title for new', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      astShowForm(null);
      expect(container.querySelector('.ast-modal-title').textContent).toContain('Add');
    });

    it('pre-fills name on edit', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      astShowForm({ id: 'a1', name: 'MacBook Pro', type: 'Laptop', status: 'available', value: 100000 });
      expect(container.querySelector('#astFName').value).toBe('MacBook Pro');
    });

    it('rejects empty asset name', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      astShowForm(null);
      container.querySelector('#astFName').value = '';
      container.querySelector('#astSaveBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('adds asset on mock save', async () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      await astLoadData();
      const before = _getAssets().length;
      astShowForm(null);
      container.querySelector('#astFName').value = 'New Laptop';
      container.querySelector('#astFSerial').value = 'SN-001';
      container.querySelector('#astFValue').value = '75000';
      await container.querySelector('#astSaveBtn').click();
      expect(_getAssets().length).toBe(before + 1);
    });
  });

  describe('astReturn', () => {
    it('sets status to available in mock', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([{ id: 'a1', name: 'Laptop', type: 'Laptop', status: 'in_use', assigned_to: 'arif@co.com', value: 50000 }]);
      await astReturn('a1');
      const asset = _getAssets().find(a => a.id === 'a1');
      expect(asset.status).toBe('available');
      expect(asset.assigned_to).toBeNull();
    });
  });

  describe('astMaintenance', () => {
    it('sets status to maintenance in mock', async () => {
      renderAssetsPage(container);
      await astLoadData();
      _setAssets([{ id: 'a1', name: 'Laptop', type: 'Laptop', status: 'in_use', assigned_to: 'arif@co.com', value: 50000 }]);
      await astMaintenance('a1');
      expect(_getAssets().find(a => a.id === 'a1').status).toBe('maintenance');
    });
  });

  describe('astCloseModal', () => {
    it('closes the modal', () => {
      getSession.mockReturnValue({ email: 'admin@co.com', is_admin: true });
      renderAssetsPage(container);
      astShowForm(null);
      astCloseModal();
      expect(container.querySelector('#astModal').classList.contains('open')).toBe(false);
    });
  });
});

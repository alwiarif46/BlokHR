/**
 * tests/integration/org_chart.test.js
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
  renderOrgChartPage, ocLoadData, ocRenderStats, ocRender,
  ocShowDeptForm, ocShowPositionForm, ocDeleteDept, ocCloseModal,
  _getDepartments, _setDepartments, _getPositions, _setPositions, _resetState,
} from '../../frontend/modules/org_chart/org_chart.js';

describe('Org Chart module', () => {
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

  describe('renderOrgChartPage', () => {
    it('renders page skeleton', () => {
      renderOrgChartPage(container);
      expect(container.querySelector('#ocStats')).toBeTruthy();
      expect(container.querySelector('#ocContent')).toBeTruthy();
      expect(container.querySelector('#ocModal')).toBeTruthy();
    });

    it('renders 3 tabs', () => {
      renderOrgChartPage(container);
      const tabs = [...container.querySelectorAll('.oc-tab')].map(t => t.dataset.tab);
      expect(tabs).toEqual(['chart', 'departments', 'positions']);
    });

    it('admin sees Department and Position add buttons', () => {
      renderOrgChartPage(container);
      expect(container.querySelector('#ocAddDeptBtn')).toBeTruthy();
      expect(container.querySelector('#ocAddPosBtn')).toBeTruthy();
    });

    it('non-admin sees no add buttons', () => {
      getSession.mockReturnValue({ email: 'emp@co.com', is_admin: false });
      renderOrgChartPage(container);
      expect(container.querySelector('#ocAddDeptBtn')).toBeNull();
    });
  });

  describe('ocLoadData', () => {
    it('calls GET /api/org/departments', async () => {
      renderOrgChartPage(container);
      _apiCalls.length = 0;
      await ocLoadData();
      expect(_apiCalls.some(c => c.path === '/api/org/departments')).toBe(true);
    });

    it('calls GET /api/org/positions', async () => {
      renderOrgChartPage(container);
      _apiCalls.length = 0;
      await ocLoadData();
      expect(_apiCalls.some(c => c.path === '/api/org/positions')).toBe(true);
    });

    it('falls back to mock data on error', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      expect(_getDepartments().length).toBeGreaterThan(0);
      expect(_getPositions().length).toBeGreaterThan(0);
    });
  });

  describe('ocRenderStats', () => {
    it('renders 4 stat cards', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      expect(container.querySelectorAll('.oc-stat').length).toBe(4);
    });

    it('shows correct department count', () => {
      _setDepartments([
        { id: 'd1', name: 'Eng',   parent_id: null, headcount: 10 },
        { id: 'd2', name: 'Sales', parent_id: null, headcount: 5  },
      ]);
      _setPositions([]);
      renderOrgChartPage(container);
      ocRenderStats();
      const nums = [...container.querySelectorAll('.oc-stat-n')].map(el => el.textContent);
      expect(nums[0]).toBe('2'); // Departments
    });
  });

  describe('ocRender — chart tab', () => {
    it('renders root department cards', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      expect(container.querySelector('.oc-root-card')).toBeTruthy();
    });

    it('shows empty state when no departments', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      _setDepartments([]);
      ocRender();
      expect(container.querySelector('.oc-empty')).toBeTruthy();
    });

    it('renders child departments indented', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      expect(container.querySelector('.oc-tree-card')).toBeTruthy();
    });
  });

  describe('ocRender — departments tab', () => {
    it('renders department rows', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      container.querySelector('[data-tab="departments"]').click();
      expect(container.querySelectorAll('.oc-dept-row').length).toBeGreaterThan(0);
    });

    it('shows edit and delete for admin', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      container.querySelector('[data-tab="departments"]').click();
      expect(container.querySelector('[data-action="edit-dept"]')).toBeTruthy();
      expect(container.querySelector('[data-action="delete-dept"]')).toBeTruthy();
    });

    it('filters by search', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      _setDepartments([
        { id: 'd1', name: 'Engineering', parent_id: null, headcount: 18 },
        { id: 'd2', name: 'Sales',       parent_id: null, headcount: 10 },
      ]);
      container.querySelector('[data-tab="departments"]').click();
      const s = container.querySelector('#ocSearch');
      s.value = 'eng';
      s.dispatchEvent(new Event('input'));
      expect(container.querySelectorAll('.oc-dept-row').length).toBe(1);
    });
  });

  describe('ocRender — positions tab', () => {
    it('renders position rows', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      container.querySelector('[data-tab="positions"]').click();
      expect(container.querySelectorAll('.oc-pos-row').length).toBeGreaterThan(0);
    });

    it('shows level info', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      container.querySelector('[data-tab="positions"]').click();
      expect(container.querySelector('.oc-pos-meta').textContent).toContain('L');
    });
  });

  describe('ocShowDeptForm', () => {
    it('opens modal', () => {
      renderOrgChartPage(container);
      ocShowDeptForm(null);
      expect(container.querySelector('#ocModal').classList.contains('open')).toBe(true);
    });

    it('shows New Department title', () => {
      renderOrgChartPage(container);
      ocShowDeptForm(null);
      expect(container.querySelector('.oc-modal-title').textContent).toContain('New');
    });

    it('pre-fills name on edit', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      ocShowDeptForm({ id: 'd1', name: 'Engineering', parent_id: null, color: '#4a9eff' });
      expect(container.querySelector('#ocFDName').value).toBe('Engineering');
    });

    it('rejects empty name', () => {
      renderOrgChartPage(container);
      ocShowDeptForm(null);
      container.querySelector('#ocFDName').value = '';
      container.querySelector('#ocSaveDeptBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });

    it('adds department on mock save', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      const before = _getDepartments().length;
      ocShowDeptForm(null);
      container.querySelector('#ocFDName').value = 'New Dept';
      await container.querySelector('#ocSaveDeptBtn').click();
      expect(_getDepartments().length).toBe(before + 1);
    });
  });

  describe('ocShowPositionForm', () => {
    it('opens modal', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      ocShowPositionForm(null);
      expect(container.querySelector('#ocModal').classList.contains('open')).toBe(true);
    });

    it('rejects empty title', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      ocShowPositionForm(null);
      container.querySelector('#ocFPTitle').value = '';
      container.querySelector('#ocSavePosBtn').click();
      expect(_toasts.some(t => t.type === 'error')).toBe(true);
    });
  });

  describe('ocDeleteDept', () => {
    it('removes department from list', async () => {
      renderOrgChartPage(container);
      await ocLoadData();
      _setDepartments([{ id: 'd1', name: 'Test', parent_id: null, headcount: 0 }]);
      await ocDeleteDept('d1');
      expect(_getDepartments().find(d => d.id === 'd1')).toBeUndefined();
    });
  });

  describe('ocCloseModal', () => {
    it('closes modal', () => {
      renderOrgChartPage(container);
      ocShowDeptForm(null);
      ocCloseModal();
      expect(container.querySelector('#ocModal').classList.contains('open')).toBe(false);
    });
  });
});

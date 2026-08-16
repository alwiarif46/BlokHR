import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { answerPrompt } from '../helpers/dialog.js';

describe('assets module', () => {
  /** @type {typeof import('../../modules/assets/assets.js')} */
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
      if (path === '/api/assets' || path.startsWith('/api/assets?')) {
        return {
          assets: [
            {
              id: 'a1',
              asset_tag: 'LPT-001',
              asset_type: 'laptop',
              name: 'MacBook Pro',
              serial_number: 'SN-1',
              status: 'available',
              purchase_cost: 2500,
              location: 'HQ',
            },
            {
              id: 'a2',
              asset_tag: 'MON-001',
              asset_type: 'monitor',
              name: 'Dell Monitor',
              status: 'assigned',
              purchase_cost: 300,
            },
          ],
        };
      }
      if (path === '/api/assets/mine') {
        return {
          assignments: [
            {
              id: 'asg1',
              asset_id: 'a2',
              email: 'admin@test.com',
              assigned_date: '2026-08-01',
              asset_name: 'Dell Monitor',
              asset_type: 'monitor',
            },
          ],
        };
      }
      if (path === '/api/assets/maintenance-open') {
        return {
          records: [
            {
              id: 'm1',
              asset_id: 'a1',
              scheduled_date: '2026-09-01',
              cost: 100,
              notes: 'Service',
              asset_name: 'MacBook Pro',
              asset_tag: 'LPT-001',
            },
          ],
        };
      }
      if (path === '/api/assets/a1') {
        return {
          asset: {
            id: 'a1',
            asset_tag: 'LPT-001',
            asset_type: 'laptop',
            name: 'MacBook Pro',
            status: 'available',
            purchase_cost: 2500,
            purchase_date: '2024-01-01',
            depreciation_method: 'straight_line',
            useful_life_years: 3,
          },
          bookValue: 1800,
        };
      }
      if (path === '/api/assets/a1/history') return { history: [] };
      if (path === '/api/assets/a1/maintenance') return { records: [] };
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/assets') {
        return {
          asset: {
            id: 'a-new',
            name: body.name,
            asset_tag: body.assetTag,
            asset_type: body.assetType,
            status: 'available',
          },
        };
      }
      if (path.endsWith('/assign')) {
        return { assignment: { id: 'asg-new', email: body.email, asset_id: 'a1' } };
      }
      if (path.endsWith('/return')) return { success: true };
      if (path.endsWith('/maintenance')) {
        return { record: { id: 'm-new', asset_id: 'a1', scheduled_date: body.scheduledDate } };
      }
      if (path.includes('/maintenance/') && path.endsWith('/complete')) return { success: true };
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

    mod = await import('../../modules/assets/assets.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads inventory, mine, and open maintenance in parallel', async () => {
    mod.renderAssetsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('MacBook Pro');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/assets');
    expect(apiGet).toHaveBeenCalledWith('/api/assets/mine');
    expect(apiGet).toHaveBeenCalledWith('/api/assets/maintenance-open');
    expect(mod._getAssets()[0].assetTag).toBe('LPT-001');
    expect(mod._getAssets()[0].assetType).toBe('laptop');
    expect(mod._getMine()[0].assetName).toBe('Dell Monitor');
    expect(document.body.textContent).toContain('Assigned');
  });

  it('creates an asset with assetTag and assetType', async () => {
    mod.renderAssetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/assets'));

    document.getElementById('astAddBtn').click();
    document.getElementById('astF_name').value = 'ThinkPad';
    document.getElementById('astF_tag').value = 'LPT-002';
    document.getElementById('astF_type').value = 'laptop';
    document.getElementById('astF_serial').value = 'SN-99';
    document.getElementById('astSaveBtn').click();

    await vi.waitFor(() => expect(apiPost).toHaveBeenCalled());
    const call = apiPost.mock.calls.find((c) => c[0] === '/api/assets');
    expect(call).toBeTruthy();
    expect(call[1].name).toBe('ThinkPad');
    expect(call[1].assetTag).toBe('LPT-002');
    expect(call[1].assetType).toBe('laptop');
    expect(call[1].serialNumber).toBe('SN-99');
    expect(toastFn).toHaveBeenCalledWith('Created', 'success');
  });

  it('assigns an available asset and returns from My Assets', async () => {
    mod.renderAssetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getAssets().length).toBe(2));

    document.querySelector('[data-action="assign"]').click();
    document.getElementById('astF_email').value = 'alice@test.com';
    document.getElementById('astAssignBtn').click();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/assets/a1/assign', expect.objectContaining({
        email: 'alice@test.com',
      }));
    });

    document.querySelector('[data-tab="mine"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Dell Monitor');
    });

    document.querySelector('[data-action="return"]').click();
    await answerPrompt('good');
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/assets/assignments/asg1/return',
        { conditionOnReturn: 'good' },
      );
    });
  });

  it('normalizes snake_case asset and assignment fields', () => {
    const a = mod._normalizeAsset({
      id: 'x',
      asset_tag: 'T-1',
      asset_type: 'phone',
      name: 'Pixel',
      serial_number: 'S1',
      purchase_cost: 800,
      status: 'available',
      depreciation_method: 'none',
      useful_life_years: 2,
    });
    expect(a.assetTag).toBe('T-1');
    expect(a.assetType).toBe('phone');
    expect(a.serialNumber).toBe('S1');
    expect(a.purchaseCost).toBe(800);
    expect(a.depreciationMethod).toBe('none');
    expect(a.usefulLifeYears).toBe(2);

    const asg = mod._normalizeAssignment({
      id: 'asg',
      asset_id: 'a',
      email: 'u@t.com',
      assigned_date: '2026-01-01',
      asset_name: 'Phone',
      asset_type: 'phone',
    });
    expect(asg.assetId).toBe('a');
    expect(asg.assetName).toBe('Phone');
  });

  it('shows feature-off message when assets API returns 404', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/assets' || path.startsWith('/api/assets?')) {
        return { _error: true, status: 404, message: 'Not found' };
      }
      if (path === '/api/assets/mine') return { assignments: [] };
      if (path === '/api/assets/maintenance-open') return { records: [] };
      return {};
    });

    mod.renderAssetsPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toMatch(/disabled/i);
    });
  });

  it('switches to maintenance tab and completes a record', async () => {
    mod.renderAssetsPage(document.getElementById('root'));
    await vi.waitFor(() => expect(mod._getOpenMaintenance().length).toBe(1));

    document.querySelector('[data-tab="maintenance"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Complete');
    });
    document.querySelector('[data-action="complete-mnt"]').click();
    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/assets/maintenance/m1/complete', {});
    });
  });
});

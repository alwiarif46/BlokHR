import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('school API helper (F-01)', () => {
  /** @type {typeof import('../shared/api.js')} */
  let apiMod;

  beforeEach(async () => {
    vi.resetModules();
    apiMod = await import('../shared/api.js');
    apiMod.initApi({ base: 'http://localhost:8080', mockMode: false });
    apiMod.setSchoolTenantId('tenant-a');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exposes SCHOOL_SERVICES for all school packages', () => {
    expect(Object.keys(apiMod.SCHOOL_SERVICES).sort()).toEqual(
      [
        'school-academics',
        'school-assessment',
        'school-attendance',
        'school-compliance',
        'school-engagement',
        'school-fees',
        'school-identity',
        'school-library',
        'school-surveys',
        'school-timetable',
        'school-transport',
      ].sort(),
    );
    expect(apiMod.SCHOOL_SERVICES['school-identity']).toBe(3011);
    expect(apiMod.SCHOOL_SERVICES['school-compliance']).toBe(3019);
    expect(apiMod.SCHOOL_SERVICES['school-library']).toBe(3020);
    expect(apiMod.SCHOOL_SERVICES['school-surveys']).toBe(3022);
  });

  it('prefixes tenant-scoped paths under /svc/{service}/api/{domain}/{tenantId}', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = apiMod.api.school('school-attendance');
    await client.get('/reason-codes');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8080/svc/school-attendance/api/attendance/tenant-a/reason-codes',
    );

    await client.post('/reported-absences', { dates: [] });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://localhost:8080/svc/school-attendance/api/attendance/tenant-a/reported-absences',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('supports tenantScoped=false (no tenant segment)', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ packs: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = apiMod.api.school('school-identity', false);
    await client.get('/state-packs');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8080/svc/school-identity/api/identity/state-packs',
    );
  });

  it('passes through 401 via shared api (clears staff session)', async () => {
    const { saveSession, getSession, clearSession } = await import('../shared/session.js');
    clearSession();
    saveSession({ email: 'a@b.com', sessionToken: 'tok' });
    expect(getSession()?.sessionToken).toBe('tok');

    const fetchMock = vi.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'expired' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiMod.api.school('school-identity').get('/students');
    expect(res._error).toBe(true);
    expect(res.status).toBe(401);
    expect(getSession()).toBeNull();
  });

  it('rejects unknown service names', () => {
    expect(() => apiMod.api.school('school-unknown')).toThrow(/Unknown school service/);
  });

  it('prefixes school-library under /svc/school-library/api/library/{tenantId}', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ titles: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = apiMod.api.school('school-library');
    await client.get('/titles');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8080/svc/school-library/api/library/tenant-a/titles',
    );
  });
});

describe('school module group visibility (F-01)', () => {
  /** @type {typeof import('../shared/router.js')} */
  let router;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="sbNav">
        <div class="sb-divider hidden" data-flag-group="school_vertical"></div>
        <div class="sb-section-label hidden" data-flag-group="school_vertical">School</div>
        <div class="sb-item hidden" data-module="school_students" data-flag="school_vertical"></div>
        <div class="sb-item hidden" data-module="school_roll_call" data-flag="school_vertical"></div>
        <div class="sb-item" data-module="org_chart" data-flag="org_chart"></div>
      </div>
    `;
    router = await import('../shared/router.js');
    router._resetRouterState();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hides school group unless school_vertical is explicitly on', () => {
    router.applyFeatureFlags();
    expect(router.isSchoolModuleGroupVisible()).toBe(false);
    expect(
      document.querySelector('[data-module="school_students"]').classList.contains('hidden'),
    ).toBe(true);
    expect(
      document.querySelector('[data-flag-group="school_vertical"]').classList.contains('hidden'),
    ).toBe(true);

    // org_chart remains visible when flag unset (legacy opt-out semantics)
    expect(document.querySelector('[data-module="org_chart"]').classList.contains('hidden')).toBe(
      false,
    );
  });

  it('shows school group when school_vertical flag is true', async () => {
    const apiMod = await import('../shared/api.js');
    apiMod.initApi({ mockMode: true });
    // Seed flags via loadFeatureFlags path by setting through apply after mock
    // Directly exercise apply with injected state:
    await router.loadFeatureFlags();
    // mockMode returns null → empty flags; set manually through second load simulation
    const flags = router.getFeatureFlags();
    flags.school_vertical = true;
    router.applyFeatureFlags();

    expect(router.isSchoolModuleGroupVisible()).toBe(true);
    expect(
      document.querySelector('[data-module="school_students"]').classList.contains('hidden'),
    ).toBe(false);
    expect(router.SCHOOL_MODULE_GROUP).toContain('school_students');
    expect(router.SCHOOL_MODULE_GROUP).toContain('school_library');
    expect(router.SCHOOL_MODULE_GROUP).toContain('school_surveys');
    expect(router.SCHOOL_MODULE_GROUP).toHaveLength(8);
  });
});

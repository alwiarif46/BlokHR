import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  schoolRoleAllows,
  applySchoolRoleGates,
  canSchoolAdminOps,
  canAcademicsCourseWrite,
} from '../../shared/school-roles.js';

describe('school-roles L6 (P12-06)', () => {
  describe('schoolRoleAllows', () => {
    const cases = [
      { role: 'teacher', csv: 'teacher,school_admin', admin: false, ok: true },
      { role: 'office', csv: 'teacher,school_admin', admin: false, ok: false },
      { role: 'office', csv: 'office,school_admin', admin: false, ok: true },
      { role: 'school_admin', csv: 'school_admin', admin: false, ok: true },
      { role: 'teacher', csv: 'school_admin', admin: false, ok: false },
      { role: 'employee', csv: 'teacher,school_admin', admin: true, ok: true },
      { role: '', csv: 'teacher', admin: false, ok: false },
    ];
    it.each(cases)(
      '$role + admin=$admin on "$csv" → $ok',
      ({ role, csv, admin, ok }) => {
        expect(schoolRoleAllows(role, admin, csv)).toBe(ok);
      },
    );
  });

  describe('applySchoolRoleGates sidebar matrix', () => {
    /** @type {HTMLElement} */
    let root;

    beforeEach(() => {
      root = document.createElement('div');
      root.innerHTML = `
        <div data-module="school_roll_call" data-school-roles="teacher,school_admin"></div>
        <div data-module="school_academics" data-school-roles="teacher,school_admin"></div>
        <div data-module="school_hpc" data-school-roles="teacher,school_admin"></div>
        <div data-module="school_students" data-school-roles="office,school_admin"></div>
        <div data-module="school_attendance_admin" data-school-roles="office,school_admin"></div>
        <div data-module="school_library" data-school-roles="office,school_admin"></div>
        <div data-module="school_surveys" data-school-roles="school_admin"></div>
      `;
      document.body.appendChild(root);
    });

    afterEach(() => {
      root.remove();
    });

    const matrix = [
      {
        role: 'teacher',
        visible: ['school_roll_call', 'school_academics', 'school_hpc'],
        hidden: [
          'school_students',
          'school_attendance_admin',
          'school_library',
          'school_surveys',
        ],
      },
      {
        role: 'office',
        visible: ['school_students', 'school_attendance_admin', 'school_library'],
        hidden: ['school_roll_call', 'school_academics', 'school_hpc', 'school_surveys'],
      },
      {
        role: 'school_admin',
        visible: [
          'school_roll_call',
          'school_academics',
          'school_hpc',
          'school_students',
          'school_attendance_admin',
          'school_library',
          'school_surveys',
        ],
        hidden: [],
      },
      {
        role: 'admin',
        visible: [
          'school_roll_call',
          'school_academics',
          'school_hpc',
          'school_students',
          'school_attendance_admin',
          'school_library',
          'school_surveys',
        ],
        hidden: [],
        isAdmin: true,
      },
    ];

    it.each(matrix)('role=$role', ({ role, visible, hidden, isAdmin }) => {
      applySchoolRoleGates(root, {
        schoolRole: role === 'admin' ? 'admin' : role,
        isAdmin: !!isAdmin || role === 'admin',
      });
      visible.forEach(function (mod) {
        const el = root.querySelector('[data-module="' + mod + '"]');
        expect(el.style.display, mod + ' should show').not.toBe('none');
      });
      hidden.forEach(function (mod) {
        const el = root.querySelector('[data-module="' + mod + '"]');
        expect(el.style.display, mod + ' should hide').toBe('none');
      });
    });
  });

  it('canSchoolAdminOps / canAcademicsCourseWrite', () => {
    expect(canSchoolAdminOps('office', false)).toBe(false);
    expect(canSchoolAdminOps('teacher', false)).toBe(false);
    expect(canSchoolAdminOps('school_admin', false)).toBe(true);
    expect(canAcademicsCourseWrite('teacher', false)).toBe(false);
    expect(canAcademicsCourseWrite('school_admin', false)).toBe(true);
  });
});

describe('whoami → schoolRole (P12-06)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('stores schoolRole from /whoami staff response', async () => {
    const { saveSession, getSession, clearSession, updateSession } = await import(
      '../../shared/session.js'
    );
    clearSession();
    saveSession({ email: 't@x.com', sessionToken: 'tok' });

    const fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/whoami')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            principal: 'staff',
            email: 't@x.com',
            role: 'teacher',
            isAdmin: false,
            tenantId: 't1',
            memberId: 'm1',
          }),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ isAdmin: false }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const apiMod = await import('../../shared/api.js');
    apiMod.initApi({ base: 'http://localhost:8080', mockMode: false });
    const who = await apiMod.api.get('/whoami');
    expect(who.role).toBe('teacher');
    updateSession('schoolRole', who.role);
    expect(getSession().schoolRole).toBe('teacher');
  });

  it('degrades silently on whoami 404', async () => {
    const { saveSession, getSession, clearSession } = await import('../../shared/session.js');
    clearSession();
    saveSession({ email: 't@x.com', sessionToken: 'tok' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 404,
        ok: false,
        text: async () => JSON.stringify({ error: 'not_found' }),
      })),
    );

    const apiMod = await import('../../shared/api.js');
    apiMod.initApi({ base: 'http://localhost:8080', mockMode: false });
    const who = await apiMod.api.get('/whoami');
    expect(who._error).toBe(true);
    expect(who.status).toBe(404);
    expect(getSession().schoolRole).toBeUndefined();
  });
});

describe('403 toast mapping (P12-06)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('toasts generic message for role_denied / scope_unverifiable', async () => {
    const toastFn = vi.fn();
    vi.doMock('../../shared/toast.js', () => ({
      toast: toastFn,
      setToastDuration: () => {},
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 403,
        ok: false,
        text: async () => JSON.stringify({ error: 'role_denied' }),
      })),
    );

    const apiMod = await import('../../shared/api.js');
    apiMod.initApi({ base: 'http://localhost:8080', mockMode: false });
    const res = await apiMod.api.get('/svc/x');
    expect(res._error).toBe(true);
    expect(toastFn).toHaveBeenCalledWith("You don't have access to do this", 'error');

    toastFn.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 403,
        ok: false,
        text: async () => JSON.stringify({ error: 'scope_unverifiable' }),
      })),
    );
    await apiMod.api.get('/svc/y');
    expect(toastFn).toHaveBeenCalledWith("You don't have access to do this", 'error');
  });
});

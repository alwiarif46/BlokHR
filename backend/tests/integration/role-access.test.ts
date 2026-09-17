import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  rolesForVertical,
  isRoleForVertical,
  enforcementForModule,
  isWithinCeiling,
  RoleAccessService,
} from '../../src/services/role-access-service';
import { createTestApp } from '../helpers/setup';
import type { DatabaseEngine } from '../../src/db/engine';
import request from 'supertest';
import type { Express } from 'express';
import { runWithTenant } from '../../src/tenant/context';

describe('role-access unit', () => {
  it('rolesForVertical excludes cross-vertical roles', () => {
    expect(rolesForVertical('hr')).toEqual(['admin', 'manager', 'hr', 'employee']);
    expect(rolesForVertical('hr')).not.toContain('teacher');
    expect(rolesForVertical('school')).toContain('teacher');
    expect(rolesForVertical('school')).not.toContain('hr');
    expect(isRoleForVertical('teacher', 'hr')).toBe(false);
    expect(isRoleForVertical('manager', 'hr')).toBe(true);
  });

  it('derives enforcement from FEATURE_ROUTE_MAP', () => {
    expect(enforcementForModule('capture_admin')).toBe('api');
    expect(enforcementForModule('school_register')).toBe('api');
    expect(enforcementForModule('dashboard')).toBe('ui_only');
    expect(enforcementForModule('school_settings')).toBe('ui_only');
    expect(enforcementForModule('school_exams')).toBe('ui_only');
  });

  it('ceiling rejects parent for school_exams', () => {
    expect(isWithinCeiling('parent', 'school_exams')).toBe(false);
    expect(isWithinCeiling('teacher', 'school_exams')).toBe(true);
  });
});

describe('role-access integration', () => {
  let app: Express;
  let db: DatabaseEngine;
  let roleAccess: RoleAccessService;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];
  let directory: Awaited<ReturnType<typeof createTestApp>>['directory'];

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    roleAccess = setup.roleAccess;
    commercial = setup.commercial;
    directory = setup.directory;

    await runWithTenant('default', async () => {
      await db.run(`UPDATE tenant_settings SET settings_json = ? WHERE id = 'default'`, [
        JSON.stringify({ vertical: 'hr' }),
      ]);
      await db.run(
        `INSERT OR REPLACE INTO members (tenant_id, id, email, name, role, active, timezone, group_id)
         VALUES ('default', 'm-admin', 'admin@test.com', 'Admin', 'admin', 1, 'UTC', 'default')`,
      );
      await db.run(
        `INSERT OR REPLACE INTO members (tenant_id, id, email, name, role, active, timezone, group_id)
         VALUES ('default', 'm-emp', 'emp@test.com', 'Emp', 'employee', 1, 'UTC', 'default')`,
      );
      await db.run(
        `INSERT OR REPLACE INTO members (tenant_id, id, email, name, role, active, timezone, group_id)
         VALUES ('default', 'm-mgr', 'mgr@test.com', 'Mgr', 'manager', 1, 'UTC', 'default')`,
      );
      await db.run(`INSERT OR IGNORE INTO admins (tenant_id, email) VALUES ('default', 'admin@test.com')`);
      await roleAccess.refreshTenant('default');
    });
  });

  afterEach(async () => {
    if (commercial) await commercial.close();
    if (directory) await directory.close();
    if (db) await db.close();
  });

  function asUser(email: string, name = 'User') {
    return request(app)
      .get('/api/user-roles')
      .query({ email })
      .set('X-User-Email', email)
      .set('X-User-Name', name);
  }

  it('user-roles returns effectiveRole from members.role', async () => {
    const res = await asUser('emp@test.com');
    expect(res.status).toBe(200);
    expect(res.body.effectiveRole).toBe('employee');
    expect(res.body.isAdmin).toBe(false);
  });

  it('rejects wrong vertical role on PATCH', async () => {
    const res = await request(app)
      .patch('/api/members/m-emp/role')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({ role: 'teacher' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_role_for_vertical');
  });

  it('rejects last admin demotion', async () => {
    const res = await request(app)
      .patch('/api/members/m-admin/role')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({ role: 'employee' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('last_admin');
  });

  it('rejects enabling school_exams for parent via PUT', async () => {
    await runWithTenant('default', async () => {
      await db.run(`UPDATE tenant_settings SET settings_json = ? WHERE id = 'default'`, [
        JSON.stringify({ vertical: 'school' }),
      ]);
    });
    const res = await request(app)
      .put('/api/settings/role-access')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({ overrides: [{ role: 'parent', moduleKey: 'school_exams', visible: true }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('not_available_for_role');
  });

  it('hides leaves for manager → 403; employee path unaffected by manager override', async () => {
    const put = await request(app)
      .put('/api/settings/role-access')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({ overrides: [{ role: 'manager', moduleKey: 'leaves', visible: false }] });
    expect(put.status).toBe(200);

    const mgr = await request(app)
      .get('/api/leaves')
      .set('X-User-Email', 'mgr@test.com')
      .set('X-User-Name', 'Mgr');
    expect(mgr.status).toBe(403);
    expect(mgr.body.error).toBe('module_hidden_for_role');

    const admin = await request(app)
      .get('/api/leaves')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin');
    expect(admin.body.error).not.toBe('module_hidden_for_role');
  });

  it('hiding attendance does not block geo_fencing path (longest-prefix containment)', async () => {
    await request(app)
      .put('/api/settings/role-access')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({ overrides: [{ role: 'employee', moduleKey: 'attendance', visible: false }] });

    const geo = await request(app)
      .get('/api/clock/geo')
      .set('X-User-Email', 'emp@test.com')
      .set('X-User-Name', 'Emp');
    // Not module_hidden_for_role for attendance — geo_fencing owns this path
    expect(geo.body.error).not.toBe('module_hidden_for_role');
  });

  it('no member row ⇒ matrix allows (fail-open)', async () => {
    await runWithTenant('default', async () => {
      await db.run(`INSERT OR IGNORE INTO admins (tenant_id, email) VALUES ('default', 'orphan@test.com')`);
      await roleAccess.refreshTenant('default');
    });
    const res = await request(app)
      .get('/api/leaves')
      .set('X-User-Email', 'orphan@test.com')
      .set('X-User-Name', 'Orphan');
    expect(res.body.error).not.toBe('module_hidden_for_role');
  });
});

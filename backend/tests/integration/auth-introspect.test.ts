import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

const INTERNAL = 'test-internal-secret';

describe('POST /api/auth/introspect (P12-01)', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin User' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await db.run("UPDATE branding SET tenant_id = 'tenant-school-1' WHERE id = 1");
  });

  afterEach(async () => {
    await db.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    await request(app)
      .post('/api/auth/local/register')
      .send({ email, password })
      .set('X-User-Email', 'admin@shaavir.com');
    const res = await request(app).post('/api/auth/local').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.sessionToken).toBeTruthy();
    return res.body.sessionToken as string;
  }

  it('returns full claims matching user-roles for a valid token', async () => {
    const token = await loginAs('alice@shaavir.com', 'securepass123');
    await db.run(
      'INSERT INTO role_assignments (assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?)',
      ['alice@shaavir.com', 'manager', 'group', 'engineering'],
    );

    const roles = await request(app)
      .get('/api/user-roles?email=alice@shaavir.com')
      .set('X-User-Email', 'alice@shaavir.com');
    expect(roles.status).toBe(200);

    const res = await request(app)
      .post('/api/auth/introspect')
      .set('X-Blok-Internal', INTERNAL)
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.email).toBe('alice@shaavir.com');
    expect(res.body.name).toBe('Alice');
    expect(res.body.tenantId).toBe('tenant-school-1');
    expect(res.body.isAdmin).toBe(roles.body.isAdmin);
    expect(res.body.isGlobalManager).toBe(roles.body.isGlobalManager);
    expect(res.body.isGlobalHR).toBe(roles.body.isGlobalHR);
    expect(res.body.managerOf).toEqual(roles.body.managerOf);
    expect(res.body.hrOf).toEqual(roles.body.hrOf);
  });

  it('returns admin claims for an admin session', async () => {
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['admin@shaavir.com']);
    const token = await loginAs('admin@shaavir.com', 'adminpass99');

    const res = await request(app)
      .post('/api/auth/introspect')
      .set('X-Blok-Internal', INTERNAL)
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.isGlobalManager).toBe(true);
    expect(res.body.isGlobalHR).toBe(true);
  });

  it('returns active:false for a bad token', async () => {
    const res = await request(app)
      .post('/api/auth/introspect')
      .set('X-Blok-Internal', INTERNAL)
      .send({ token: 'not-a-real-session' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: false });
  });

  it('returns active:false for empty token', async () => {
    const res = await request(app)
      .post('/api/auth/introspect')
      .set('X-Blok-Internal', INTERNAL)
      .send({ token: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: false });
  });

  it('returns 401 when internal secret is missing', async () => {
    const token = await loginAs('alice@shaavir.com', 'securepass123');
    const res = await request(app).post('/api/auth/introspect').send({ token });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when internal secret is wrong', async () => {
    const token = await loginAs('alice@shaavir.com', 'securepass123');
    const res = await request(app)
      .post('/api/auth/introspect')
      .set('X-Blok-Internal', 'wrong-secret')
      .send({ token });
    expect(res.status).toBe(401);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('BD Meeting Module - RBAC & Security', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    // Seed tenant 1

    // Seed BD department group in tenant-a
    await db.run('INSERT INTO groups (id, name, tenant_id) VALUES (?, ?, ?)', ['bd-group', 'Business Development', 'tenant-a']);
    
    // Seed BD employee in tenant-a
    await seedMember(db, {
      email: 'bob@tenant-a.com',
      name: 'Bob BD',
      groupId: 'bd-group',
    });
    // The setup helper uses 'default' tenant, let's fix the tenant_id
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'bob@tenant-a.com']);

    // Regular employee
    await seedMember(db, { email: 'alice@tenant-a.com', name: 'Alice Eng' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'alice@tenant-a.com']);

    // Manager (reports_to)
    await seedMember(db, { email: 'mgr@tenant-a.com', name: 'Bob Mgr' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'mgr@tenant-a.com']);
    await db.run('UPDATE members SET reports_to = ? WHERE email = ? AND tenant_id = ?', ['mgr@tenant-a.com', 'bob@tenant-a.com', 'tenant-a']);

    // Manager (role_assignment)
    await seedMember(db, { email: 'rolemgr@tenant-a.com', name: 'Role Mgr' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'rolemgr@tenant-a.com']);
    await db.run('INSERT INTO role_assignments (tenant_id, assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?, ?)', 
      ['tenant-a', 'rolemgr@tenant-a.com', 'manager', 'group', 'bd-group']);

    // Scoped HR (inside scope)
    await seedMember(db, { email: 'hr-inside@tenant-a.com', name: 'HR Inside' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'hr-inside@tenant-a.com']);
    await db.run('INSERT INTO role_assignments (tenant_id, assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?, ?)', 
      ['tenant-a', 'hr-inside@tenant-a.com', 'hr', 'group', 'bd-group']);

    // Scoped HR (outside scope)
    await seedMember(db, { email: 'hr-outside@tenant-a.com', name: 'HR Outside' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'hr-outside@tenant-a.com']);
    await db.run('INSERT INTO role_assignments (tenant_id, assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?, ?)', 
      ['tenant-a', 'hr-outside@tenant-a.com', 'hr', 'group', 'other-group']);

    // Global HR / Admin
    await seedMember(db, { email: 'admin@tenant-a.com', name: 'Admin' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-a', 'admin@tenant-a.com']);
    await db.run('INSERT INTO admins (tenant_id, email) VALUES (?, ?)', ['tenant-a', 'admin@tenant-a.com']);

    // Tenant B Manager
    await seedMember(db, { email: 'mgr@tenant-b.com', name: 'Mgr B', groupId: 'bd-group' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['tenant-b', 'mgr@tenant-b.com']);
    await db.run('INSERT INTO admins (tenant_id, email) VALUES (?, ?)', ['tenant-b', 'mgr@tenant-b.com']);
  });

  afterEach(async () => {
    await db.close();
  });

  async function submitMeeting() {
    const res = await request(app)
      .post('/api/bd-meetings')
      .send({ client: 'Test Client', email: 'bob@tenant-a.com', date: '2026-10-01', time: '10:00', location: 'Zoom', notes: 'Initial chat' })
      .set('X-User-Email', 'bob@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    if (!res.body.meeting) console.error('BD CREATE ERR', res.body); return res.body.meeting.id;
  }

  it('valid manager qualify', async () => {
    const meetingId = await submitMeeting();
    const res = await request(app)
      .post('/api/bd-meetings/qualify')
      .send({ meetingId })
      .set('X-User-Email', 'mgr@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.body.success).toBe(true);
  });

  it('valid role-assignment manager qualify', async () => {
    const meetingId = await submitMeeting();
    const res = await request(app)
      .post('/api/bd-meetings/qualify')
      .send({ meetingId })
      .set('X-User-Email', 'rolemgr@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.body.success).toBe(true);
  });

  it('unauthorized employee qualify/reject', async () => {
    const meetingId = await submitMeeting();
    const res = await request(app)
      .post('/api/bd-meetings/qualify')
      .send({ meetingId })
      .set('X-User-Email', 'alice@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it('valid Admin/HR approval', async () => {
    const meetingId = await submitMeeting();
    await request(app).post('/api/bd-meetings/qualify').send({ meetingId }).set('X-User-Email', 'mgr@tenant-a.com').set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    
    const res = await request(app)
      .post('/api/bd-meetings/approve')
      .send({ meetingId })
      .set('X-User-Email', 'admin@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.body.success).toBe(true);
  });

  it('scoped HR inside scope', async () => {
    const meetingId = await submitMeeting();
    await request(app).post('/api/bd-meetings/qualify').send({ meetingId }).set('X-User-Email', 'mgr@tenant-a.com').set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    
    const res = await request(app)
      .post('/api/bd-meetings/approve')
      .send({ meetingId })
      .set('X-User-Email', 'hr-inside@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.body.success).toBe(true);
  });

  it('scoped HR outside scope', async () => {
    const meetingId = await submitMeeting();
    await request(app).post('/api/bd-meetings/qualify').send({ meetingId }).set('X-User-Email', 'mgr@tenant-a.com').set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    
    const res = await request(app)
      .post('/api/bd-meetings/approve')
      .send({ meetingId })
      .set('X-User-Email', 'hr-outside@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only Admin\/HR can final-approve/);
  });

  it('spoofed approverEmail', async () => {
    // Tries to send approverEmail in body, should be ignored and actor drawn from X-User-Email
    const meetingId = await submitMeeting();
    const res = await request(app)
      .post('/api/bd-meetings/qualify')
      .send({ meetingId, approverEmail: 'mgr@tenant-a.com' })
      .set('X-User-Email', 'alice@tenant-a.com') // Alice tries to spoof as mgr
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it('spoofed role', async () => {
    const meetingId = await submitMeeting();
    await request(app).post('/api/bd-meetings/qualify').send({ meetingId }).set('X-User-Email', 'mgr@tenant-a.com').set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    const res = await request(app)
      .post('/api/bd-meetings/approve')
      .send({ meetingId, role: 'admin' }) // sending spoofed role
      .set('X-User-Email', 'alice@tenant-a.com')
      .set('X-Blok-Tenant', 'tenant-a').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only Admin\/HR/);
  });

  it('cross-tenant BD access', async () => {
    const meetingId = await submitMeeting();
    const res = await request(app)
      .post('/api/bd-meetings/qualify')
      .send({ meetingId })
      .set('X-User-Email', 'mgr@tenant-b.com') // mgr in another tenant
      .set('X-Blok-Tenant', 'tenant-b').set('X-Blok-Internal', 'test-internal-secret'); // interacting on their own tenant context
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });
});

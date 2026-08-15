import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Settings & Roles Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob',
      groupId: 'bd',
      groupName: 'Business Development',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── GET /api/settings ──

  describe('GET /api/settings', () => {
    it('returns the full settings bundle', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.groups).toBeDefined();
      expect(res.body.members).toBeDefined();
      expect(res.body.admins).toBeDefined();
      expect(res.body.designations).toBeDefined();
      expect(res.body.memberTypes).toBeDefined();
      expect(res.body.lateRules).toBeDefined();
      expect(res.body.systemSettings).toBeDefined();
      expect(res.body.meetings).toBeDefined();
    });

    it('returns groups with camelCase field names', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      const eng = res.body.groups.find((g: Record<string, unknown>) => g.id === 'engineering');
      expect(eng).toBeDefined();
      expect(eng.name).toBe('Engineering');
      expect(eng.shiftStart).toBe('09:00');
      expect(eng.shiftEnd).toBe('18:00');
    });

    it('returns members with camelCase field names', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      const alice = res.body.members.find(
        (m: Record<string, unknown>) => m.email === 'alice@shaavir.com',
      );
      expect(alice).toBeDefined();
      expect(alice.name).toBe('Alice');
      expect(alice.group).toBe('engineering');
      expect(alice.active).toBe(true);
    });

    it('returns seeded member types', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      const types = res.body.memberTypes;
      expect(types.length).toBeGreaterThanOrEqual(1);
      const fte = types.find((t: Record<string, unknown>) => t.id === 'fte');
      expect(fte).toBeDefined();
      expect(fte.name).toBe('Full-Time Employee');
    });

    it('returns late rules with defaults', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.lateRules.graceMinutes).toBe(15);
      expect(res.body.lateRules.latesToDeduction).toBe(4);
    });

    it('returns system settings with defaults', async () => {
      const res = await request(app).get('/api/settings').set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.systemSettings.logicalDayChangeTime).toBe('06:00');
    });
  });

  // ── PUT /api/members/:id ──

  describe('PUT /api/members/:id', () => {
    it('updates a member by email', async () => {
      const res = await request(app)
        .put('/api/members/alice@shaavir.com')
        .send({ name: 'Alice Updated', designation: 'Senior Engineer' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const settings = await request(app)
        .get('/api/settings')
        .set('X-User-Email', 'alice@shaavir.com');
      const alice = settings.body.members.find(
        (m: Record<string, unknown>) => m.email === 'alice@shaavir.com',
      );
      expect(alice.name).toBe('Alice Updated');
      expect(alice.designation).toBe('Senior Engineer');
    });

    it('updates phone and bank details', async () => {
      const res = await request(app)
        .put('/api/members/alice@shaavir.com')
        .send({ phone: '9876543210', bankName: 'SBI', bankIfsc: 'SBIN0001234' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('updates photo as base64', async () => {
      const res = await request(app)
        .put('/api/members/alice@shaavir.com')
        .send({ photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('updates group assignment', async () => {
      const res = await request(app)
        .put('/api/members/alice@shaavir.com')
        .send({ group: 'bd' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const settings = await request(app)
        .get('/api/settings')
        .set('X-User-Email', 'alice@shaavir.com');
      const alice = settings.body.members.find(
        (m: Record<string, unknown>) => m.email === 'alice@shaavir.com',
      );
      expect(alice.group).toBe('bd');
    });

    it('returns error for nonexistent member', async () => {
      const res = await request(app)
        .put('/api/members/nobody@shaavir.com')
        .send({ name: 'Ghost' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('succeeds with empty body (no-op)', async () => {
      const res = await request(app)
        .put('/api/members/alice@shaavir.com')
        .send({})
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });
  });

  // ── GET /api/user-roles ──

  describe('GET /api/user-roles', () => {
    it('returns base roles for a regular member', async () => {
      const res = await request(app)
        .get('/api/user-roles?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(false);
      expect(res.body.isGlobalManager).toBe(false);
      expect(res.body.isGlobalHR).toBe(false);
      expect(res.body.managerOf).toEqual([]);
      expect(res.body.hrOf).toEqual([]);
    });

    it('returns admin + global roles for an admin', async () => {
      await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['admin@shaavir.com']);

      const res = await request(app)
        .get('/api/user-roles?email=admin@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.isAdmin).toBe(true);
      expect(res.body.isGlobalManager).toBe(true);
      expect(res.body.isGlobalHR).toBe(true);
    });

    it('returns scoped manager roles', async () => {
      await db.run(
        'INSERT INTO role_assignments (assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?)',
        ['alice@shaavir.com', 'manager', 'group', 'engineering'],
      );

      const res = await request(app)
        .get('/api/user-roles?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.isGlobalManager).toBe(false);
      expect(res.body.managerOf).toContain('engineering');
    });

    it('returns scoped HR roles', async () => {
      await db.run(
        'INSERT INTO role_assignments (assignee_email, role_type, scope_type, scope_value) VALUES (?, ?, ?, ?)',
        ['bob@shaavir.com', 'hr', 'global', ''],
      );

      const res = await request(app)
        .get('/api/user-roles?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.body.isGlobalHR).toBe(true);
    });

    it('rejects missing email param', async () => {
      const res = await request(app)
        .get('/api/user-roles')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('normalizes email to lowercase', async () => {
      const res = await request(app)
        .get('/api/user-roles?email=ALICE@Shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(false);
    });
  });

  // ── GET /api/pending-actions ──

  describe('GET /api/pending-actions', () => {
    it('returns zero counts when nothing pending', async () => {
      const res = await request(app)
        .get('/api/pending-actions')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.pendingLeaves).toBe(0);
      expect(res.body.pendingRegularizations).toBe(0);
      expect(res.body.pendingMeetings).toBe(0);
      expect(typeof res.body.pendingProfiles).toBe('number');
    });

    it('counts pending leaves', async () => {
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          personName: 'Alice',
          leaveType: 'Casual',
          kind: 'FullDay',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          reason: 'Personal',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(sub.status).toBe(200);

      const res = await request(app)
        .get('/api/pending-actions')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.pendingLeaves).toBe(1);
    });

    it('counts pending regularizations', async () => {
      await db.run(
        `INSERT INTO attendance_daily (email, name, date, status, first_in, total_worked_minutes, is_late, late_minutes, group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'alice@shaavir.com',
          'Alice',
          '2026-03-20',
          'out',
          '2026-03-20T10:00:00.000Z',
          480,
          0,
          0,
          'engineering',
        ],
      );

      await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:00',
          reason: 'Badge error',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/pending-actions')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.pendingRegularizations).toBe(1);
    });
  });

  // ── GET /api/pending-actions-detail ──

  describe('GET /api/pending-actions-detail', () => {
    it('returns empty arrays when nothing pending', async () => {
      const res = await request(app)
        .get('/api/pending-actions-detail')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.leaves).toEqual([]);
      expect(res.body.regularizations).toEqual([]);
      expect(res.body.meetings).toEqual([]);
      expect(Array.isArray(res.body.profiles)).toBe(true);
    });

    it('returns pending leave detail with correct fields', async () => {
      await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          personName: 'Alice',
          leaveType: 'Sick',
          kind: 'FullDay',
          startDate: '2026-04-05',
          endDate: '2026-04-05',
          reason: 'Flu',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/pending-actions-detail')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.leaves).toHaveLength(1);
      expect(res.body.leaves[0].email).toBe('alice@shaavir.com');
      expect(res.body.leaves[0].name).toBe('Alice');
      expect(res.body.leaves[0].type).toBe('Sick');
      expect(res.body.leaves[0].kind).toBe('FullDay');
    });
  });

  // ── GET /api/employee-of-month ──

  describe('GET /api/employee-of-month', () => {
    it('returns empty when not set', async () => {
      const res = await request(app)
        .get('/api/employee-of-month')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('');
      expect(res.body.email).toBe('');
    });

    it('returns EOM after system settings update', async () => {
      await db.run(
        'UPDATE system_settings SET employee_of_month_name = ?, employee_of_month_email = ? WHERE id = 1',
        ['Alice', 'alice@shaavir.com'],
      );

      const res = await request(app)
        .get('/api/employee-of-month')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.name).toBe('Alice');
      expect(res.body.email).toBe('alice@shaavir.com');
    });
  });
});

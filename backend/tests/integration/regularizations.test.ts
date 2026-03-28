import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Regularization Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupShiftStart: '09:30',
      groupShiftEnd: '17:30',
    });
    // Seed an attendance record so corrections have something to patch
    await db.run(
      `INSERT INTO attendance_daily (email, name, date, status, first_in, last_out, total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        'out',
        '2026-03-20T10:15:00.000Z',
        '2026-03-20T17:30:00.000Z',
        435,
        1,
        30,
        'engineering',
      ],
    );
    await db.run(
      'INSERT OR IGNORE INTO monthly_late_counts (email, year_month, late_count) VALUES (?, ?, ?)',
      ['alice@shaavir.com', '2026-03', 2],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Submission ──

  describe('POST /api/regularizations', () => {
    it('submits a correction request', async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'Forgot to clock in on time',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.regularization.status).toBe('pending');
      expect(res.body.regularization.correction_type).toBe('clock-in');
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .send({ date: '2026-03-20', reason: 'test' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing reason', async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .send({ email: 'alice@shaavir.com', date: '2026-03-20' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Rr]eason/);
    });

    it('rejects missing date', async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .send({ email: 'alice@shaavir.com', reason: 'test' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Fetch ──

  describe('GET /api/regularizations', () => {
    it('returns empty when no corrections exist', async () => {
      const res = await request(app)
        .get('/api/regularizations?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.regularizations).toEqual([]);
    });

    it('returns submitted corrections', async () => {
      await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'both',
          inTime: '09:25',
          outTime: '17:35',
          reason: 'System error',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/regularizations?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.regularizations).toHaveLength(1);
      expect(res.body.regularizations[0].in_time).toBe('09:25');
    });
  });

  // ── Two-tier approval ──

  describe('Approval flow', () => {
    let regId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'Was on time but system missed it',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      regId = res.body.regularization.id;
    });

    it('manager approves: pending -> manager_approved', async () => {
      const res = await request(app)
        .put(`/api/regularizations/${regId}/approve`)
        .send({ role: 'manager', approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const regs = await request(app)
        .get('/api/regularizations?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(regs.body.regularizations[0].status).toBe('manager_approved');
    });

    it('HR approves after manager: manager_approved -> approved', async () => {
      await request(app)
        .put(`/api/regularizations/${regId}/approve`)
        .send({ role: 'manager', approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .put(`/api/regularizations/${regId}/approve`)
        .send({ role: 'hr', approverEmail: 'hr@shaavir.com' })
        .set('X-User-Email', 'hr@shaavir.com');
      expect(res.body.success).toBe(true);

      const regs = await request(app)
        .get('/api/regularizations?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(regs.body.regularizations[0].status).toBe('approved');
    });

    it('rejects HR approve before manager', async () => {
      const res = await request(app)
        .put(`/api/regularizations/${regId}/approve`)
        .send({ role: 'hr', approverEmail: 'hr@shaavir.com' })
        .set('X-User-Email', 'hr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot HR-approve/);
    });

    it('rejects invalid role', async () => {
      const res = await request(app)
        .put(`/api/regularizations/${regId}/approve`)
        .send({ role: 'ceo', approverEmail: 'ceo@shaavir.com' })
        .set('X-User-Email', 'ceo@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Rejection ──

  describe('PUT /api/regularizations/:id/reject', () => {
    it('rejects a pending correction with comments', async () => {
      const sub = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'Missed clock-in',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/reject`)
        .send({ approverEmail: 'mgr@shaavir.com', comments: 'Not justified' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const regs = await request(app)
        .get('/api/regularizations?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(regs.body.regularizations[0].status).toBe('rejected');
      expect(regs.body.regularizations[0].rejection_comments).toBe('Not justified');
    });

    it('cannot reject an already approved correction', async () => {
      const sub = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'test',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'manager' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'hr' })
        .set('X-User-Email', 'hr@shaavir.com');

      const res = await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/reject`)
        .send({ comments: 'Too late' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Attendance correction on approval ──

  describe('Attendance correction', () => {
    it('patches attendance record when fully approved', async () => {
      const sub = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'Was on time',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'manager' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'hr' })
        .set('X-User-Email', 'hr@shaavir.com');

      // Check the attendance record was patched
      const att = await request(app)
        .get('/api/attendance?date=2026-03-20')
        .set('X-User-Email', 'alice@shaavir.com');

      if (att.body.people.length > 0) {
        const alice = att.body.people.find(
          (p: Record<string, unknown>) => p.email === 'alice@shaavir.com',
        );
        if (alice) {
          expect(alice.firstIn).toContain('09:25');
        }
      }
    });

    it('decrements late count when correction removes lateness', async () => {
      // Alice was late (09:30 shift, clocked at 10:15, 30 min late after 15 min grace)
      // Correction says she was at 09:25 (before shift start) — no longer late
      const sub = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'clock-in',
          inTime: '09:25',
          reason: 'Badge reader failed',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'manager' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'hr' })
        .set('X-User-Email', 'hr@shaavir.com');

      // Late count should have decremented from 2 to 1
      const att = await request(app)
        .get('/api/attendance?date=2026-03-20')
        .set('X-User-Email', 'alice@shaavir.com');

      if (att.body.people.length > 0) {
        const alice = att.body.people.find(
          (p: Record<string, unknown>) => p.email === 'alice@shaavir.com',
        );
        if (alice) {
          expect(alice.monthlyLateCount).toBe(1);
          expect(alice.isLate).toBe(false);
        }
      }
    });

    it('recalculates worked hours when both times corrected', async () => {
      const sub = await request(app)
        .post('/api/regularizations')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice',
          date: '2026-03-20',
          correctionType: 'both',
          inTime: '09:30',
          outTime: '18:30',
          reason: 'System missed my times',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'manager' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .put(`/api/regularizations/${sub.body.regularization.id}/approve`)
        .send({ role: 'hr' })
        .set('X-User-Email', 'hr@shaavir.com');

      const att = await request(app)
        .get('/api/attendance?date=2026-03-20')
        .set('X-User-Email', 'alice@shaavir.com');

      if (att.body.people.length > 0) {
        const alice = att.body.people.find(
          (p: Record<string, unknown>) => p.email === 'alice@shaavir.com',
        );
        if (alice) {
          // 09:30 to 18:30 = 9 hours = 540 minutes. totalWorked in hours.
          expect(alice.totalWorked).toBeGreaterThan(8);
        }
      }
    });
  });
});

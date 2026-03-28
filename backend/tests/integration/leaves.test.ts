import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Leave Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Submission ──

  describe('POST /api/leave-submit', () => {
    it('submits a leave request successfully', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personName: 'Alice',
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          kind: 'FullDay',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          reason: 'Personal work',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leave).toBeTruthy();
      expect(res.body.leave.status).toBe('Pending');
      expect(res.body.leave.days_requested).toBe(1);
      expect(res.body.paidType).toBe('paid');
    });

    it('calculates half-day as 0.5', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          kind: 'FirstHalf',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.leave.days_requested).toBe(0.5);
    });

    it('calculates multi-day leave', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          kind: 'FullDay',
          startDate: '2026-04-01',
          endDate: '2026-04-03',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.leave.days_requested).toBe(3);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({ personEmail: 'alice@shaavir.com' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects end date before start date', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-05',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/before start/i);
    });

    it('rejects unknown employee', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'nobody@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'nobody@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns unpaid for leave types marked unpaid', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Other',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.paidType).toBe('unpaid');
    });
  });

  // ── Fetch ──

  describe('GET /api/leaves', () => {
    it('returns empty array when no leaves', async () => {
      const res = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.leaves).toEqual([]);
    });

    it('returns submitted leaves', async () => {
      await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.leaves).toHaveLength(1);
      expect(res.body.leaves[0].leave_type).toBe('Casual');
    });

    it('rejects missing email', async () => {
      const res = await request(app).get('/api/leaves');
      expect(res.status).toBe(400);
    });
  });

  // ── Two-tier approval flow ──

  describe('Approval flow', () => {
    let leaveId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          reason: 'Test leave',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      leaveId = res.body.leave.id;
    });

    it('manager approves: Pending → Approved by Manager', async () => {
      const res = await request(app)
        .post('/api/leave-approve')
        .send({ leaveId, approverEmail: 'manager@shaavir.com' })
        .set('X-User-Email', 'manager@shaavir.com');
      expect(res.body.success).toBe(true);

      const leaves = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(leaves.body.leaves[0].status).toBe('Approved by Manager');
      expect(leaves.body.leaves[0].manager_approver_email).toBe('manager@shaavir.com');
    });

    it('HR approves after manager: Approved by Manager → Approved', async () => {
      await request(app)
        .post('/api/leave-approve')
        .send({ leaveId, approverEmail: 'manager@shaavir.com' })
        .set('X-User-Email', 'manager@shaavir.com');

      const res = await request(app)
        .post('/api/leave-hr-approve')
        .send({ leaveId, approverEmail: 'hr@shaavir.com' })
        .set('X-User-Email', 'hr@shaavir.com');
      expect(res.body.success).toBe(true);

      const leaves = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(leaves.body.leaves[0].status).toBe('Approved');
      expect(leaves.body.leaves[0].hr_approver_email).toBe('hr@shaavir.com');
    });

    it('rejects HR approve before manager approve', async () => {
      const res = await request(app)
        .post('/api/leave-hr-approve')
        .send({ leaveId, approverEmail: 'hr@shaavir.com' })
        .set('X-User-Email', 'hr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot HR-approve/);
    });

    it('rejects double manager approve', async () => {
      await request(app)
        .post('/api/leave-approve')
        .send({ leaveId, approverEmail: 'manager@shaavir.com' })
        .set('X-User-Email', 'manager@shaavir.com');

      const res = await request(app)
        .post('/api/leave-approve')
        .send({ leaveId, approverEmail: 'manager2@shaavir.com' })
        .set('X-User-Email', 'manager2@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Rejection ──

  describe('POST /api/leave-reject', () => {
    it('rejects a pending leave with reason', async () => {
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/leave-reject')
        .send({
          leaveId: sub.body.leave.id,
          approverEmail: 'manager@shaavir.com',
          reason: 'Team busy',
        })
        .set('X-User-Email', 'manager@shaavir.com');
      expect(res.body.success).toBe(true);

      const leaves = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(leaves.body.leaves[0].status).toBe('Rejected');
      expect(leaves.body.leaves[0].rejection_reason).toBe('Team busy');
    });

    it('cannot reject an already approved leave', async () => {
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      // Full approval
      await request(app)
        .post('/api/leave-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'manager@shaavir.com');
      await request(app)
        .post('/api/leave-hr-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'hr@shaavir.com');

      const res = await request(app)
        .post('/api/leave-reject')
        .send({ leaveId: sub.body.leave.id, reason: 'Nope' })
        .set('X-User-Email', 'manager@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Cancel / Delete ──

  describe('POST /api/leave-delete', () => {
    it('employee cancels their own pending leave', async () => {
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/leave-delete')
        .send({ leaveId: sub.body.leave.id, cancelledBy: 'alice@shaavir.com' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const leaves = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(leaves.body.leaves[0].status).toBe('Cancelled');
    });

    it('admin hard-deletes a leave', async () => {
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/leave-delete')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const leaves = await request(app)
        .get('/api/leaves?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(leaves.body.leaves).toHaveLength(0);
    });
  });

  // ── PTO Balance ──

  describe('GET /api/pto-balance', () => {
    it('returns zero balance for new employee', async () => {
      const res = await request(app)
        .get('/api/pto-balance?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.accrued).toBeTypeOf('number');
      expect(res.body.used).toBeTypeOf('number');
      expect(res.body.remaining).toBeTypeOf('number');
      expect(res.body.rate).toBeTypeOf('number');
      expect(res.body.tenureYears).toBeTypeOf('number');
    });

    it('reflects used PTO after approved leave', async () => {
      // Set up PTO balance
      await db.run(
        'INSERT INTO pto_balances (email, leave_type, year, accrued, used) VALUES (?, ?, ?, ?, ?)',
        ['alice@shaavir.com', 'Casual', 2026, 10, 0],
      );

      // Submit and fully approve
      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-02',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .post('/api/leave-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'manager@shaavir.com');
      await request(app)
        .post('/api/leave-hr-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'hr@shaavir.com');

      const res = await request(app)
        .get('/api/pto-balance?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.used).toBe(2);
    });

    it('reverses PTO when approved leave is deleted', async () => {
      await db.run(
        'INSERT INTO pto_balances (email, leave_type, year, accrued, used) VALUES (?, ?, ?, ?, ?)',
        ['alice@shaavir.com', 'Casual', 2026, 10, 0],
      );

      const sub = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: 'alice@shaavir.com',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        .set('X-User-Email', 'alice@shaavir.com');

      await request(app)
        .post('/api/leave-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'manager@shaavir.com');
      await request(app)
        .post('/api/leave-hr-approve')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'hr@shaavir.com');

      // Delete the approved leave
      await request(app)
        .post('/api/leave-delete')
        .send({ leaveId: sub.body.leave.id })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/pto-balance?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.used).toBe(0);
    });

    it('rejects missing email', async () => {
      const res = await request(app).get('/api/pto-balance');
      expect(res.status).toBe(400);
    });
  });
});

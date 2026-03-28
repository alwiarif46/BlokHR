import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('Configurable Leave Rules', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
  });

  afterEach(async () => {
    await db.close();
  });

  // ── List / Read ──

  describe('GET /api/leave-policies', () => {
    it('returns seeded default policies', async () => {
      const res = await request(app)
        .get('/api/leave-policies')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.policies.length).toBeGreaterThanOrEqual(6);
      const casual = res.body.policies.find(
        (p: Record<string, unknown>) => p.leaveType === 'Casual',
      );
      expect(casual).toBeDefined();
      expect(casual.method).toBe('flat');
      expect(casual.isPaid).toBe(true);
    });
  });

  describe('GET /api/leave-types', () => {
    it('returns distinct leave type names', async () => {
      const res = await request(app)
        .get('/api/leave-types')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.types).toContain('Casual');
      expect(res.body.types).toContain('Sick');
      expect(res.body.types).toContain('Earned');
    });
  });

  // ── Create ──

  describe('POST /api/leave-policies', () => {
    it('creates a flat policy', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Bereavement',
          memberTypeId: 'fte',
          method: 'flat',
          config: { accrualPerMonth: 0 },
          maxCarryForward: 0,
          isPaid: true,
          requiresApproval: true,
          maxConsecutiveDays: 5,
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.policy.leaveType).toBe('Bereavement');
      expect(res.body.policy.maxConsecutiveDays).toBe(5);
    });

    it('creates a tenure_bucket policy (Shaavir PTO)', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'PTO',
          memberTypeId: 'fte',
          method: 'tenure_bucket',
          config: {
            buckets: [
              { minMonths: 0, maxMonths: 12, accrualPerMonth: 1.0 },
              { minMonths: 12, maxMonths: 36, accrualPerMonth: 1.5 },
              { minMonths: 36, maxMonths: null, accrualPerMonth: 1.75 },
            ],
          },
          maxCarryForward: 5,
          allowNegative: true,
          negativeAction: 'lwp',
          sandwichPolicy: 'exclude_weekends',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.policy.method).toBe('tenure_bucket');
      expect(res.body.policy.maxCarryForward).toBe(5);
      expect(res.body.policy.allowNegative).toBe(true);
      expect(res.body.policy.negativeAction).toBe('lwp');
    });

    it('creates per_hours_worked policy', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Hourly PTO',
          memberTypeId: 'hourly',
          method: 'per_hours_worked',
          config: { hoursPerLeaveHour: 30 },
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('creates per_days_worked policy (Factories Act)', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Factory EL',
          memberTypeId: 'fte',
          method: 'per_days_worked',
          config: { daysPerLeaveDay: 20 },
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('creates annual_lump policy', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Floating Holiday',
          memberTypeId: 'fte',
          method: 'annual_lump',
          config: { annualDays: 3, grantDate: 'jan1' },
          maxCarryForward: 0,
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('creates unlimited policy', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Flexible PTO',
          memberTypeId: 'fte',
          method: 'unlimited',
          config: {},
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.policy.method).toBe('unlimited');
    });

    it('rejects missing leave type', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({ method: 'flat', config: { accrualPerMonth: 1 } })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid method', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({ leaveType: 'Bad', memberTypeId: 'fte', method: 'banana', config: {} })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/banana/);
    });

    it('rejects invalid flat config', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({ leaveType: 'Bad2', memberTypeId: 'fte', method: 'flat', config: {} })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/accrualPerMonth/);
    });

    it('rejects invalid tenure_bucket config (no buckets)', async () => {
      const res = await request(app)
        .post('/api/leave-policies')
        .send({ leaveType: 'Bad3', memberTypeId: 'fte', method: 'tenure_bucket', config: {} })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/buckets/);
    });

    it('rejects duplicate leave type + member type', async () => {
      // Casual/fte already exists from seeds
      const res = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Casual',
          memberTypeId: 'fte',
          method: 'flat',
          config: { accrualPerMonth: 1 },
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/);
    });
  });

  // ── Update ──

  describe('PUT /api/leave-policies/:id', () => {
    it('updates accrual method and config', async () => {
      const list = await request(app)
        .get('/api/leave-policies')
        .set('X-User-Email', 'admin@shaavir.com');
      const casualId = list.body.policies.find(
        (p: Record<string, unknown>) => p.leaveType === 'Casual',
      ).id;

      const res = await request(app)
        .put(`/api/leave-policies/${casualId}`)
        .send({ maxCarryForward: 3, medicalCertDays: 2 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const updated = await request(app)
        .get(`/api/leave-policies/${casualId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(updated.body.policy.maxCarryForward).toBe(3);
      expect(updated.body.policy.medicalCertDays).toBe(2);
    });

    it('rejects nonexistent policy', async () => {
      const res = await request(app)
        .put('/api/leave-policies/9999')
        .send({ maxCarryForward: 5 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Delete ──

  describe('DELETE /api/leave-policies/:id', () => {
    it('soft-deletes a policy', async () => {
      const create = await request(app)
        .post('/api/leave-policies')
        .send({
          leaveType: 'Temp',
          memberTypeId: 'intern',
          method: 'flat',
          config: { accrualPerMonth: 0.5 },
        })
        .set('X-User-Email', 'admin@shaavir.com');
      const id = create.body.policy.id;

      const del = await request(app)
        .delete(`/api/leave-policies/${id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(del.body.success).toBe(true);

      // Should not appear in active list
      const active = await request(app)
        .get('/api/leave-policies')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(
        active.body.policies.find((p: Record<string, unknown>) => p.id === id),
      ).toBeUndefined();

      // Should appear in admin all list
      const all = await request(app)
        .get('/api/leave-policies/all')
        .set('X-User-Email', 'admin@shaavir.com');
      const deleted = all.body.policies.find((p: Record<string, unknown>) => p.id === id);
      expect(deleted).toBeDefined();
      expect(deleted.active).toBe(false);
    });
  });

  // ── Clubbing Rules ──

  describe('Clubbing rules', () => {
    it('adds a clubbing rule (both directions)', async () => {
      const res = await request(app)
        .post('/api/leave-clubbing-rules')
        .send({ leaveTypeA: 'Casual', leaveTypeB: 'Earned', gapDays: 1 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const rules = await request(app)
        .get('/api/leave-clubbing-rules')
        .set('X-User-Email', 'admin@shaavir.com');
      // Both directions should exist
      const aToB = rules.body.rules.find(
        (r: Record<string, unknown>) => r.leaveTypeA === 'Casual' && r.leaveTypeB === 'Earned',
      );
      const bToA = rules.body.rules.find(
        (r: Record<string, unknown>) => r.leaveTypeA === 'Earned' && r.leaveTypeB === 'Casual',
      );
      expect(aToB).toBeDefined();
      expect(bToA).toBeDefined();
      expect(aToB.gapDays).toBe(1);
    });

    it('removes a clubbing rule (both directions)', async () => {
      await request(app)
        .post('/api/leave-clubbing-rules')
        .send({ leaveTypeA: 'Casual', leaveTypeB: 'Sick', gapDays: 0 })
        .set('X-User-Email', 'admin@shaavir.com');

      const del = await request(app)
        .delete('/api/leave-clubbing-rules')
        .send({ leaveTypeA: 'Casual', leaveTypeB: 'Sick' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(del.body.success).toBe(true);

      const rules = await request(app)
        .get('/api/leave-clubbing-rules')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(
        rules.body.rules.find(
          (r: Record<string, unknown>) =>
            (r.leaveTypeA === 'Casual' && r.leaveTypeB === 'Sick') ||
            (r.leaveTypeA === 'Sick' && r.leaveTypeB === 'Casual'),
        ),
      ).toBeUndefined();
    });

    it('rejects same-type clubbing rule', async () => {
      const res = await request(app)
        .post('/api/leave-clubbing-rules')
        .send({ leaveTypeA: 'Casual', leaveTypeB: 'Casual', gapDays: 0 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing leave types', async () => {
      const res = await request(app)
        .post('/api/leave-clubbing-rules')
        .send({ gapDays: 1 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });
});

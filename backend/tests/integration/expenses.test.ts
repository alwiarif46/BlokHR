import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Expenses Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await seedMember(db, { email: 'mgr@shaavir.com', name: 'Manager' });
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob' });
    await db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', ['default', 'admin@shaavir.com']);
    await db.run('UPDATE members SET reports_to = ? WHERE email = ?', [
      'mgr@shaavir.com',
      'alice@shaavir.com',
    ]);
  });

  afterEach(async () => {
    await db.close();
  });

  async function createDraft(
    overrides: Record<string, unknown> = {},
    email = 'alice@shaavir.com',
  ) {
    return request(app)
      .post('/api/expenses')
      .send({
        vendor: 'Uber',
        amount: 500,
        category: 'travel',
        receiptDate: '2026-08-01',
        description: 'Airport ride',
        ...overrides,
      })
      .set('X-User-Email', email);
  }

  describe('POST /api/expenses', () => {
    it('creates a draft expense', async () => {
      const res = await createDraft();
      expect(res.status).toBe(201);
      expect(res.body.expense.status).toBe('draft');
      expect(res.body.expense.vendor).toBe('Uber');
      expect(res.body.expense.email).toBe('alice@shaavir.com');
    });

    it('lists my expenses', async () => {
      await createDraft();
      await createDraft({ vendor: 'Lunch', amount: 200, category: 'meals' });
      const mine = await request(app)
        .get('/api/expenses/mine')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(mine.body.expenses).toHaveLength(2);
    });

    it('updates and deletes a draft', async () => {
      const created = await createDraft();
      const id = created.body.expense.id;

      const upd = await request(app)
        .put(`/api/expenses/${id}`)
        .send({ vendor: 'Ola', amount: 450 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(upd.body.success).toBe(true);

      const del = await request(app)
        .delete(`/api/expenses/${id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(del.body.success).toBe(true);
    });
  });

  describe('Policy enforcement on submit', () => {
    it('blocks submit when amount exceeds per-claim cap', async () => {
      await request(app)
        .put('/api/expense-policies/travel')
        .send({ maxAmountPerClaim: 100 })
        .set('X-User-Email', 'admin@shaavir.com');

      const created = await createDraft({ amount: 500 });
      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/per-claim/i);
    });

    it('blocks submit when monthly cap would be exceeded', async () => {
      await request(app)
        .put('/api/expense-policies/meals')
        .send({ monthlyCap: 300 })
        .set('X-User-Email', 'admin@shaavir.com');

      const first = await createDraft({
        vendor: 'Cafe',
        amount: 200,
        category: 'meals',
        receiptDate: '2026-08-05',
      });
      await request(app)
        .post(`/api/expenses/${first.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');

      const second = await createDraft({
        vendor: 'Dinner',
        amount: 150,
        category: 'meals',
        receiptDate: '2026-08-06',
      });
      const res = await request(app)
        .post(`/api/expenses/${second.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/monthly/i);
    });

    it('blocks submit when receipt is required but missing', async () => {
      await request(app)
        .put('/api/expense-policies/travel')
        .send({ requiresReceipt: true })
        .set('X-User-Email', 'admin@shaavir.com');

      const created = await createDraft({ amount: 50 });
      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/receipt/i);
    });
  });

  describe('Approval flow', () => {
    it('manager approves a submitted expense', async () => {
      const created = await createDraft();
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');

      const pending = await request(app)
        .get('/api/expenses/pending-approvals')
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(pending.body.expenses.length).toBeGreaterThanOrEqual(1);

      const approve = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/approve`)
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(approve.body.success).toBe(true);

      const detail = await request(app)
        .get(`/api/expenses/${created.body.expense.id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(detail.body.expense.status).toBe('approved');
      expect(detail.body.approvals).toHaveLength(1);
    });

    it('rejects non-approver with 403', async () => {
      const created = await createDraft();
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/approve`)
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(403);
    });

    it('rejects with reason', async () => {
      const created = await createDraft();
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/reject`)
        .send({ reason: 'Missing invoice' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const detail = await request(app)
        .get(`/api/expenses/${created.body.expense.id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(detail.body.expense.status).toBe('rejected');
      expect(detail.body.expense.rejection_reason).toBe('Missing invoice');
    });
  });

  describe('Reimburse', () => {
    it('admin reimburses an approved expense', async () => {
      const created = await createDraft();
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/approve`)
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/reimburse`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const detail = await request(app)
        .get(`/api/expenses/${created.body.expense.id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(detail.body.expense.status).toBe('reimbursed');
    });

    it('rejects reimburse from non-admin', async () => {
      const created = await createDraft();
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post(`/api/expenses/${created.body.expense.id}/approve`)
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post(`/api/expenses/${created.body.expense.id}/reimburse`)
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(403);
    });
  });

  describe('Policies', () => {
    it('updates a category policy', async () => {
      const res = await request(app)
        .put('/api/expense-policies/supplies')
        .send({ maxAmountPerClaim: 1000, monthlyCap: 5000, requiresReceipt: true })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/expense-policies')
        .set('X-User-Email', 'admin@shaavir.com');
      const supplies = list.body.policies.find(
        (p: { category: string }) => p.category === 'supplies',
      );
      expect(supplies.max_amount_per_claim).toBe(1000);
      expect(supplies.requires_receipt).toBe(1);
    });
  });

  describe('Legacy receipt aliases', () => {
    it('still supports POST /api/expenses/receipt', async () => {
      const res = await request(app)
        .post('/api/expenses/receipt')
        .send({ vendor: 'Cab', amount: 100, category: 'travel' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.receipt.status).toBe('draft');
    });
  });
});

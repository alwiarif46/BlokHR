import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('Webhook Receivers Module', () => {
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

  // ── Inbound webhooks ──

  describe('POST /api/webhooks/inbound/:source', () => {
    it('receives and processes a payroll webhook', async () => {
      const res = await request(app)
        .post('/api/webhooks/inbound/payroll')
        .set('x-event-type', 'salary_update')
        .send({ employee_id: 'alice@shaavir.com', new_salary: 50000 });

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(true);
      expect(res.body.id).toBeGreaterThan(0);
    });

    it('receives an hris webhook', async () => {
      const res = await request(app)
        .post('/api/webhooks/inbound/hris')
        .send({ event_type: 'employee_joined', email: 'new@shaavir.com', name: 'New Person' });

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(true);
    });

    it('receives a calendar webhook', async () => {
      const res = await request(app)
        .post('/api/webhooks/inbound/calendar')
        .send({ eventType: 'meeting_created', title: 'Sprint Planning' });

      expect(res.status).toBe(200);
    });

    it('receives an unknown source (logs only, 202)', async () => {
      const res = await request(app)
        .post('/api/webhooks/inbound/unknown-system')
        .send({ data: 'something' });

      expect(res.status).toBe(202);
      expect(res.body.processed).toBe(false);
    });

    it('logs the webhook payload in the database', async () => {
      await request(app)
        .post('/api/webhooks/inbound/erp')
        .send({ invoice_id: 'INV-001', amount: 50000 });

      const logs = await request(app).get('/api/webhooks/inbound?source=erp');
      expect(logs.body.total).toBe(1);
      expect(logs.body.entries[0].source).toBe('erp');
      expect(logs.body.entries[0].payload.invoice_id).toBe('INV-001');
    });

    it('extracts event_type from payload', async () => {
      await request(app)
        .post('/api/webhooks/inbound/payroll')
        .send({ event_type: 'bonus_paid', amount: 10000 });

      const logs = await request(app).get('/api/webhooks/inbound?source=payroll');
      expect(logs.body.entries[0].eventType).toBe('bonus_paid');
    });

    it('extracts event type from header fallback', async () => {
      await request(app)
        .post('/api/webhooks/inbound/custom')
        .set('x-event-type', 'custom_event')
        .send({ data: 'test' });

      const logs = await request(app).get('/api/webhooks/inbound?source=custom');
      expect(logs.body.entries[0].eventType).toBe('custom_event');
    });
  });

  // ── Query ──

  describe('GET /api/webhooks/inbound', () => {
    async function seedWebhooks(): Promise<void> {
      await request(app).post('/api/webhooks/inbound/payroll').send({ event_type: 'salary', data: 1 });
      await request(app).post('/api/webhooks/inbound/payroll').send({ event_type: 'bonus', data: 2 });
      await request(app).post('/api/webhooks/inbound/hris').send({ event_type: 'join', data: 3 });
    }

    it('lists all webhook logs', async () => {
      await seedWebhooks();
      const res = await request(app).get('/api/webhooks/inbound');
      expect(res.body.total).toBe(3);
    });

    it('filters by source', async () => {
      await seedWebhooks();
      const res = await request(app).get('/api/webhooks/inbound?source=payroll');
      expect(res.body.total).toBe(2);
    });

    it('filters by eventType', async () => {
      await seedWebhooks();
      const res = await request(app).get('/api/webhooks/inbound?eventType=bonus');
      expect(res.body.total).toBe(1);
    });

    it('filters by processed status', async () => {
      await seedWebhooks();
      // All known sources have handlers → all processed
      const res = await request(app).get('/api/webhooks/inbound?processed=true');
      expect(res.body.total).toBe(3);

      const unprocessed = await request(app).get('/api/webhooks/inbound?processed=false');
      expect(unprocessed.body.total).toBe(0);
    });

    it('supports pagination', async () => {
      await seedWebhooks();
      const page = await request(app).get('/api/webhooks/inbound?limit=2&offset=0');
      expect(page.body.entries).toHaveLength(2);
      expect(page.body.total).toBe(3);
    });
  });

  // ── Single entry ──

  describe('GET /api/webhooks/inbound/:id', () => {
    it('returns a single webhook log entry', async () => {
      const post = await request(app)
        .post('/api/webhooks/inbound/payroll')
        .send({ event_type: 'test', amount: 999 });

      const res = await request(app).get(`/api/webhooks/inbound/${post.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.source).toBe('payroll');
      expect(res.body.payload.amount).toBe(999);
    });

    it('returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/webhooks/inbound/99999');
      expect(res.status).toBe(404);
    });
  });

  // ── Replay ──

  describe('POST /api/webhooks/inbound/:id/replay', () => {
    it('replays a logged webhook', async () => {
      const post = await request(app)
        .post('/api/webhooks/inbound/payroll')
        .send({ event_type: 'replay_test' });

      const replay = await request(app)
        .post(`/api/webhooks/inbound/${post.body.id}/replay`);

      expect(replay.status).toBe(200);
      expect(replay.body.processed).toBe(true);
    });

    it('returns 400 for nonexistent replay', async () => {
      const res = await request(app).post('/api/webhooks/inbound/99999/replay');
      expect(res.status).toBe(400);
    });
  });

  // ── Stats ──

  describe('GET /api/webhooks/inbound/stats', () => {
    it('returns per-source statistics', async () => {
      await request(app).post('/api/webhooks/inbound/payroll').send({ data: 1 });
      await request(app).post('/api/webhooks/inbound/payroll').send({ data: 2 });
      await request(app).post('/api/webhooks/inbound/hris').send({ data: 3 });

      const res = await request(app).get('/api/webhooks/inbound/stats');
      expect(res.status).toBe(200);

      const payroll = res.body.stats.find((s: Record<string, unknown>) => s.source === 'payroll');
      expect(payroll.total).toBe(2);
      expect(payroll.processed).toBe(2);

      const hris = res.body.stats.find((s: Record<string, unknown>) => s.source === 'hris');
      expect(hris.total).toBe(1);
    });
  });

  // ── Sources discovery ──

  describe('GET /api/webhooks/sources', () => {
    it('lists known webhook sources', async () => {
      const res = await request(app).get('/api/webhooks/sources');
      expect(res.status).toBe(200);
      const ids = res.body.sources.map((s: Record<string, unknown>) => s.id);
      expect(ids).toContain('payroll');
      expect(ids).toContain('hris');
      expect(ids).toContain('calendar');
      expect(ids).toContain('erp');
      expect(ids).toContain('custom');
    });
  });
});

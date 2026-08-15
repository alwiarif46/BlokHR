import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Asset Management Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
  });

  afterEach(async () => { await db.close(); });

  describe('POST /api/assets', () => {
    it('creates an asset', async () => {
      const res = await request(app).post('/api/assets')
        .send({ name: 'MacBook Pro', assetTag: 'LPT-001', assetType: 'laptop', purchaseCost: 2500, purchaseDate: '2024-01-15' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.asset.name).toBe('MacBook Pro');
      expect(res.body.asset.status).toBe('available');
    });

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/assets')
        .send({ assetTag: 'X-001' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing assetTag', async () => {
      const res = await request(app).post('/api/assets')
        .send({ name: 'Laptop' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid asset type', async () => {
      const res = await request(app).post('/api/assets')
        .send({ name: 'Thing', assetTag: 'T-1', assetType: 'spacecraft' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/assets', () => {
    it('lists and filters assets', async () => {
      await request(app).post('/api/assets')
        .send({ name: 'Laptop', assetTag: 'L-1', assetType: 'laptop' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).post('/api/assets')
        .send({ name: 'Phone', assetTag: 'P-1', assetType: 'phone' }).set('X-User-Email', 'admin@shaavir.com');

      const all = await request(app).get('/api/assets').set('X-User-Email', 'admin@shaavir.com');
      expect(all.body.assets).toHaveLength(2);

      const laptops = await request(app).get('/api/assets?assetType=laptop').set('X-User-Email', 'admin@shaavir.com');
      expect(laptops.body.assets).toHaveLength(1);
    });
  });

  describe('Assignment flow', () => {
    let assetId: string;
    beforeEach(async () => {
      const a = await request(app).post('/api/assets')
        .send({ name: 'Dell Monitor', assetTag: 'MON-001', assetType: 'monitor' })
        .set('X-User-Email', 'admin@shaavir.com');
      assetId = a.body.asset.id;
    });

    it('assigns an asset to an employee', async () => {
      const res = await request(app).post(`/api/assets/${assetId}/assign`)
        .send({ email: 'alice@shaavir.com', conditionOnAssign: 'new' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.assignment.email).toBe('alice@shaavir.com');

      const asset = await request(app).get(`/api/assets/${assetId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(asset.body.asset.status).toBe('assigned');
    });

    it('rejects assigning an already-assigned asset', async () => {
      await request(app).post(`/api/assets/${assetId}/assign`)
        .send({ email: 'alice@shaavir.com' }).set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).post(`/api/assets/${assetId}/assign`)
        .send({ email: 'alice@shaavir.com' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not available/);
    });

    it('returns an asset and makes it available', async () => {
      const assign = await request(app).post(`/api/assets/${assetId}/assign`)
        .send({ email: 'alice@shaavir.com' }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).post(`/api/assets/assignments/${assign.body.assignment.id}/return`)
        .send({ conditionOnReturn: 'good' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const asset = await request(app).get(`/api/assets/${assetId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(asset.body.asset.status).toBe('available');
    });

    it('shows assigned assets for an employee', async () => {
      await request(app).post(`/api/assets/${assetId}/assign`)
        .send({ email: 'alice@shaavir.com' }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/assets/mine')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.assignments).toHaveLength(1);
      expect(res.body.assignments[0].asset_name).toBe('Dell Monitor');
    });
  });

  describe('Book value computation', () => {
    it('computes straight-line depreciation', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const a = await request(app).post('/api/assets')
        .send({ name: 'Server', assetTag: 'SRV-1', purchaseCost: 3000, purchaseDate: twoYearsAgo.toISOString().slice(0, 10), usefulLifeYears: 3 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get(`/api/assets/${a.body.asset.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      // 2 years of 3-year life = ~1000 remaining
      expect(res.body.bookValue).toBeLessThan(1500);
      expect(res.body.bookValue).toBeGreaterThan(500);
    });
  });

  describe('Maintenance', () => {
    it('schedules and completes maintenance', async () => {
      const a = await request(app).post('/api/assets')
        .send({ name: 'Printer', assetTag: 'PRT-1' }).set('X-User-Email', 'admin@shaavir.com');

      const sched = await request(app).post(`/api/assets/${a.body.asset.id}/maintenance`)
        .send({ scheduledDate: '2026-06-01', cost: 200, notes: 'Annual service' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(sched.status).toBe(201);

      await request(app).post(`/api/assets/maintenance/${sched.body.record.id}/complete`)
        .set('X-User-Email', 'admin@shaavir.com');

      const history = await request(app).get(`/api/assets/${a.body.asset.id}/maintenance`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(history.body.records).toHaveLength(1);
      expect(history.body.records[0].completed_date).toBeTruthy();
    });
  });
});

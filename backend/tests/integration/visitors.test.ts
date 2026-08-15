import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Visitor Management Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'host@shaavir.com', name: 'Host Employee' });
    await seedMember(db, { email: 'reception@shaavir.com', name: 'Reception' });
  });

  afterEach(async () => { await db.close(); });

  describe('POST /api/visitors', () => {
    it('pre-registers a visitor', async () => {
      const res = await request(app).post('/api/visitors')
        .send({ visitorName: 'John Doe', visitorCompany: 'Acme Corp', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01', purpose: 'Interview' })
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.visit.visitor_name).toBe('John Doe');
      expect(res.body.visit.status).toBe('pre_registered');
    });

    it('rejects missing visitor name', async () => {
      const res = await request(app).post('/api/visitors')
        .send({ hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid host', async () => {
      const res = await request(app).post('/api/visitors')
        .send({ visitorName: 'Jane', hostEmail: 'nobody@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Hh]ost/);
    });
  });

  describe('Check-in / Check-out flow', () => {
    let visitId: string;
    beforeEach(async () => {
      const v = await request(app).post('/api/visitors')
        .send({ visitorName: 'Jane Smith', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');
      visitId = v.body.visit.id;
    });

    it('checks in a visitor', async () => {
      const res = await request(app).post(`/api/visitors/${visitId}/check-in`)
        .send({ receptionNotes: 'Has laptop bag' })
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.body.success).toBe(true);

      const visit = await request(app).get(`/api/visitors/${visitId}`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(visit.body.visit.status).toBe('checked_in');
      expect(visit.body.visit.actual_checkin).toBeTruthy();
    });

    it('checks out a visitor', async () => {
      await request(app).post(`/api/visitors/${visitId}/check-in`)
        .set('X-User-Email', 'reception@shaavir.com');
      const res = await request(app).post(`/api/visitors/${visitId}/check-out`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.body.success).toBe(true);

      const visit = await request(app).get(`/api/visitors/${visitId}`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(visit.body.visit.status).toBe('checked_out');
    });

    it('rejects checking in an already checked-in visitor', async () => {
      await request(app).post(`/api/visitors/${visitId}/check-in`)
        .set('X-User-Email', 'reception@shaavir.com');
      const res = await request(app).post(`/api/visitors/${visitId}/check-in`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects checking out a pre-registered visitor', async () => {
      const res = await request(app).post(`/api/visitors/${visitId}/check-out`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('cancels a visit', async () => {
      const res = await request(app).post(`/api/visitors/${visitId}/cancel`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/visitors', () => {
    it('lists visits filtered by host', async () => {
      await request(app).post('/api/visitors')
        .send({ visitorName: 'A', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');

      const res = await request(app).get('/api/visitors?hostEmail=host@shaavir.com')
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.body.visits).toHaveLength(1);
    });
  });

  describe('GET /api/visitors/my-expected', () => {
    it('returns expected visitors for host', async () => {
      await request(app).post('/api/visitors')
        .send({ visitorName: 'Expected Guest', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');

      const res = await request(app).get('/api/visitors/my-expected')
        .set('X-User-Email', 'host@shaavir.com');
      expect(res.body.visits).toHaveLength(1);
    });
  });

  describe('GET /api/visitors/checked-in-count', () => {
    it('counts currently checked-in visitors', async () => {
      const v = await request(app).post('/api/visitors')
        .send({ visitorName: 'Counted', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');
      await request(app).post(`/api/visitors/${v.body.visit.id}/check-in`)
        .set('X-User-Email', 'reception@shaavir.com');

      const res = await request(app).get('/api/visitors/checked-in-count')
        .set('X-User-Email', 'reception@shaavir.com');
      expect(res.body.count).toBe(1);
    });
  });

  describe('NDA / Forms', () => {
    it('adds and retrieves a signed form', async () => {
      const v = await request(app).post('/api/visitors')
        .send({ visitorName: 'Signer', hostEmail: 'host@shaavir.com', expectedDate: '2026-04-01' })
        .set('X-User-Email', 'reception@shaavir.com');

      const form = await request(app).post(`/api/visitors/${v.body.visit.id}/forms`)
        .send({ formType: 'nda', signatureBase64: 'data:image/png;base64,abc123==' })
        .set('X-User-Email', 'reception@shaavir.com');
      expect(form.status).toBe(201);
      expect(form.body.form.form_type).toBe('nda');

      const forms = await request(app).get(`/api/visitors/${v.body.visit.id}/forms`)
        .set('X-User-Email', 'reception@shaavir.com');
      expect(forms.body.forms).toHaveLength(1);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import { ClockRepository } from '../../src/repositories/clock-repository';
import { SchedulerService } from '../../src/scheduler/scheduler-service';
import pino from 'pino';

const testLogger = pino({ level: 'silent' });

describe('Holiday Calendar Module', () => {
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
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Admin CRUD ──

  describe('GET /api/holidays', () => {
    it('returns seeded mandatory holidays for 2026', async () => {
      const res = await request(app).get('/api/holidays?year=2026');
      expect(res.status).toBe(200);
      expect(res.body.holidays.length).toBeGreaterThanOrEqual(3);
      const names = res.body.holidays.map((h: { name: string }) => h.name);
      expect(names).toContain('Republic Day');
      expect(names).toContain('Independence Day');
      expect(names).toContain('Gandhi Jayanti');
    });

    it('returns empty for a year with no holidays', async () => {
      const res = await request(app).get('/api/holidays?year=2020');
      expect(res.body.holidays).toHaveLength(0);
    });
  });

  describe('POST /api/holidays', () => {
    it('creates a mandatory holiday', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-11-04', name: 'Diwali', type: 'mandatory' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.holiday.name).toBe('Diwali');
      expect(res.body.holiday.type).toBe('mandatory');
      expect(res.body.holiday.year).toBe(2026);
    });

    it('creates an optional holiday', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-03-30', name: 'Holi', type: 'optional' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.holiday.type).toBe('optional');
    });

    it('creates a restricted holiday', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-04-10', name: 'Good Friday', type: 'restricted' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.holiday.type).toBe('restricted');
    });

    it('rejects missing date', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ name: 'No Date' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-12-25' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-12-25', name: 'Christmas', type: 'invalid' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects duplicate date+name', async () => {
      await request(app)
        .post('/api/holidays')
        .send({ date: '2026-12-25', name: 'Christmas' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-12-25', name: 'Christmas' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/);
    });
  });

  describe('PUT /api/holidays/:id', () => {
    it('updates a holiday name', async () => {
      const create = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-05-01', name: 'May Day' })
        .set('X-User-Email', 'admin@shaavir.com');
      const id = create.body.holiday.id;

      const res = await request(app)
        .put(`/api/holidays/${id}`)
        .send({ name: 'International Workers Day' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('rejects nonexistent ID', async () => {
      const res = await request(app)
        .put('/api/holidays/99999')
        .send({ name: 'Ghost' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/holidays/:id', () => {
    it('deletes a holiday', async () => {
      const create = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-06-01', name: 'Test Holiday' })
        .set('X-User-Email', 'admin@shaavir.com');
      const id = create.body.holiday.id;

      const res = await request(app)
        .delete(`/api/holidays/${id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      // No longer in the list
      const list = await request(app).get('/api/holidays?year=2026');
      expect(list.body.holidays.find((h: { id: number }) => h.id === id)).toBeUndefined();
    });
  });

  // ── Employee selection ──

  describe('Employee optional holiday selection', () => {
    let holiId: number;
    let easterMonday: number;
    let goodFriday: number;

    beforeEach(async () => {
      const h1 = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-03-30', name: 'Holi', type: 'optional' })
        .set('X-User-Email', 'admin@shaavir.com');
      holiId = h1.body.holiday.id;

      const h2 = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-04-06', name: 'Easter Monday', type: 'optional' })
        .set('X-User-Email', 'admin@shaavir.com');
      easterMonday = h2.body.holiday.id;

      const h3 = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-04-03', name: 'Good Friday', type: 'restricted' })
        .set('X-User-Email', 'admin@shaavir.com');
      goodFriday = h3.body.holiday.id;
    });

    it('employee selects an optional holiday', async () => {
      const res = await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: holiId })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const sel = await request(app)
        .get('/api/holidays/my-selections?year=2026')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(sel.body.selections).toHaveLength(1);
      expect(sel.body.selections[0].name).toBe('Holi');
    });

    it('employee can also select restricted holidays', async () => {
      const res = await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: goodFriday })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('rejects selecting a mandatory holiday', async () => {
      // Republic Day is mandatory (seeded)
      const list = await request(app).get('/api/holidays?year=2026');
      const rd = list.body.holidays.find((h: { name: string }) => h.name === 'Republic Day');

      const res = await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: rd.id })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Mm]andatory/);
    });

    it('enforces selection limit (default 2)', async () => {
      await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: holiId })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: easterMonday })
        .set('X-User-Email', 'alice@shaavir.com');

      // Third selection should fail
      const res = await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: goodFriday })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/2 optional/);
    });

    it('employee deselects a holiday', async () => {
      await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: holiId })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/holidays/deselect')
        .send({ holidayId: holiId })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const sel = await request(app)
        .get('/api/holidays/my-selections?year=2026')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(sel.body.selections).toHaveLength(0);
    });
  });

  // ── Integration endpoints ──

  describe('Integration endpoints', () => {
    it('is-holiday returns true for mandatory holiday date', async () => {
      const res = await request(app).get(
        '/api/holidays/is-holiday?date=2026-01-26&email=alice@shaavir.com',
      );
      expect(res.body.isHoliday).toBe(true);
    });

    it('is-holiday returns false for normal working day', async () => {
      const res = await request(app).get(
        '/api/holidays/is-holiday?date=2026-03-20&email=alice@shaavir.com',
      );
      expect(res.body.isHoliday).toBe(false);
    });

    it('is-holiday returns true for selected optional holiday', async () => {
      const h = await request(app)
        .post('/api/holidays')
        .send({ date: '2026-03-30', name: 'Holi', type: 'optional' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/holidays/select')
        .send({ holidayId: h.body.holiday.id })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app).get(
        '/api/holidays/is-holiday?date=2026-03-30&email=alice@shaavir.com',
      );
      expect(res.body.isHoliday).toBe(true);
    });

    it('business-days excludes weekends and mandatory holidays', async () => {
      // 2026-01-26 (Mon) is Republic Day, 2026-01-24 (Sat) and 2026-01-25 (Sun) are weekend
      // Mon Jan 19 to Fri Jan 30 = 10 weekdays, minus 1 holiday (Jan 26) = 9 business days
      const res = await request(app).get(
        '/api/holidays/business-days?start=2026-01-19&end=2026-01-30&email=alice@shaavir.com',
      );
      expect(res.body.businessDays).toBe(9);
    });
  });

  // ── Scheduler integration ──

  describe('Scheduler skips mandatory holidays', () => {
    it('absence marking skips Republic Day', async () => {
      const scheduler = new SchedulerService(db, new ClockRepository(db), null, testLogger);
      const result = await scheduler.markAbsences('2026-01-26');
      expect(result.absentCount).toBe(0); // Nobody marked absent on Republic Day
    });

    it('absence marking still works on normal days', async () => {
      const scheduler = new SchedulerService(db, new ClockRepository(db), null, testLogger);
      const result = await scheduler.markAbsences('2026-03-20');
      expect(result.absentCount).toBeGreaterThan(0);
    });
  });
});

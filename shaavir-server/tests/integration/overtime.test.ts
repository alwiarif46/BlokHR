import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Overtime Calculation Module', () => {
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

    // Set salary for OT pay calculation
    await db.run(
      "UPDATE members SET basic_salary = 50000, da = 5000 WHERE email = 'alice@shaavir.com'",
      [],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  /** Insert an attendance record (clocked out) with specific worked minutes. */
  async function clockOut(
    email: string,
    date: string,
    workedMinutes: number,
    groupId: string,
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, status_source, first_in, last_out,
          total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, 'out', 'manual', ?, ?, ?, 0, 0, ?)`,
      [
        email,
        'Alice',
        date,
        `${date}T03:30:00.000Z`,
        `${date}T${String(Math.floor((3.5 + workedMinutes / 60) % 24)).padStart(2, '0')}:30:00.000Z`,
        workedMinutes,
        groupId,
      ],
    );
  }

  // ── Auto-detection ──

  describe('POST /api/overtime/detect', () => {
    it('detects OT when worked > 540 min (9h shift)', async () => {
      // Alice worked 600 min = 10h on a weekday. Shift is 9h (540m). OT = 60 min.
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');

      const res = await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.detected).toBe(1);

      // Check the record
      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records).toHaveLength(1);
      expect(records.body.records[0].otMinutes).toBe(60);
      expect(records.body.records[0].otType).toBe('weekday');
      expect(records.body.records[0].multiplier).toBe(2);
      expect(records.body.records[0].status).toBe('pending');
    });

    it('does NOT detect OT when worked <= threshold', async () => {
      await clockOut('alice@shaavir.com', '2026-03-20', 540, 'engineering');

      const res = await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.detected).toBe(0);
    });

    it('detects holiday OT with higher multiplier', async () => {
      // Republic Day (Jan 26) is a seeded mandatory holiday
      await clockOut('alice@shaavir.com', '2026-01-26', 480, 'engineering');

      const res = await request(app)
        .post('/api/overtime/detect?date=2026-01-26')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.detected).toBe(1);

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].otType).toBe('holiday');
      expect(records.body.records[0].multiplier).toBe(3);
      expect(records.body.records[0].otMinutes).toBe(480); // All hours on holiday = OT
    });

    it('detects weekend OT (all worked hours are OT)', async () => {
      // Saturday March 21, 2026
      await clockOut('alice@shaavir.com', '2026-03-21', 300, 'engineering');

      const res = await request(app)
        .post('/api/overtime/detect?date=2026-03-21')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.detected).toBe(1);

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].otType).toBe('weekend');
      expect(records.body.records[0].otMinutes).toBe(300);
    });

    it('calculates OT pay using India formula', async () => {
      // Alice: basic 50000, DA 5000. Shift 9h.
      // Hourly = (50000+5000) / (26×9) = 234.83
      // OT rate = 2 × 234.83 = 469.66
      // OT pay = 469.66 × (60/60) = 469.66
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');

      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].otPay).toBeGreaterThan(0);
      expect(records.body.records[0].hourlyRate).toBeGreaterThan(200);
    });

    it('caps daily OT at configured max (240 min default)', async () => {
      // Alice worked 14h = 840 min. OT = 840-540 = 300, but max is 240.
      await clockOut('alice@shaavir.com', '2026-03-20', 840, 'engineering');

      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].otMinutes).toBe(240); // Capped
    });

    it('does nothing when OT is disabled', async () => {
      await db.run('UPDATE system_settings SET ot_enabled = 0 WHERE id = 1', []);
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');

      const res = await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.detected).toBe(0);
    });

    it('is idempotent — re-detecting same date upserts', async () => {
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');

      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records).toHaveLength(1); // Not duplicated
    });
  });

  // ── Manual logging ──

  describe('POST /api/overtime/log', () => {
    it('logs manual OT with pay calculated from salary', async () => {
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-20', otMinutes: 90 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.record.otMinutes).toBe(90);
      expect(res.body.record.source).toBe('manual');
      // Fix #2: pay should now be computed, not zero
      expect(res.body.record.otPay).toBeGreaterThan(0);
      expect(res.body.record.hourlyRate).toBeGreaterThan(200);
    });

    it('rejects zero minutes', async () => {
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-20', otMinutes: 0 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects weekday OT exceeding daily max', async () => {
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-20', otMinutes: 500 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceed/);
    });

    it('allows weekend OT exceeding daily max (full weekend = OT)', async () => {
      // Fix #3: weekend bypasses daily cap
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-21', otMinutes: 500, otType: 'weekend' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.record.otMinutes).toBe(500);
    });

    it('allows holiday OT exceeding daily max', async () => {
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-01-26', otMinutes: 480, otType: 'holiday' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.record.otMinutes).toBe(480);
      // Fix #4: holiday gets holiday multiplier (3×)
      expect(res.body.record.multiplier).toBe(3);
    });
  });

  // ── Quarterly cap ──

  describe('Quarterly cap enforcement', () => {
    it('caps auto-detected OT at quarterly limit', async () => {
      // Set a low quarterly cap for testing: 2 hours = 120 minutes
      await db.run('UPDATE system_settings SET ot_max_quarterly_hours = 2 WHERE id = 1', []);

      // First day: 90 min OT → allowed (90 < 120 cap)
      await clockOut('alice@shaavir.com', '2026-03-20', 630, 'engineering');
      const r1 = await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(r1.body.detected).toBe(1);

      // Second day: 90 min OT → only 30 allowed (120 - 90 = 30 remaining)
      await clockOut('alice@shaavir.com', '2026-03-23', 630, 'engineering');
      await request(app)
        .post('/api/overtime/detect?date=2026-03-23')
        .set('X-User-Email', 'admin@shaavir.com');

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com&startDate=2026-03-23&endDate=2026-03-23')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].otMinutes).toBe(30); // Capped to quarterly remainder
    });

    it('rejects manual OT when quarterly cap is exhausted', async () => {
      await db.run('UPDATE system_settings SET ot_max_quarterly_hours = 1 WHERE id = 1', []);

      // Use up 60 min of the 60 min (1 hour) cap
      await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-20', otMinutes: 60 })
        .set('X-User-Email', 'alice@shaavir.com');

      // Try to log more — should be rejected
      const res = await request(app)
        .post('/api/overtime/log')
        .send({ email: 'alice@shaavir.com', date: '2026-03-23', otMinutes: 30 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Qq]uarterly/);
    });
  });

  // ── Approval workflow ──

  describe('Approval workflow', () => {
    let recordId: number;

    beforeEach(async () => {
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');
      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      recordId = records.body.records[0].id;
    });

    it('lists pending OT records', async () => {
      const res = await request(app)
        .get('/api/overtime/pending')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.records.length).toBeGreaterThanOrEqual(1);
    });

    it('approves OT', async () => {
      const res = await request(app)
        .post(`/api/overtime/${recordId}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].status).toBe('approved');
    });

    it('rejects OT with reason', async () => {
      const res = await request(app)
        .post(`/api/overtime/${recordId}/reject`)
        .send({ approverEmail: 'admin@shaavir.com', reason: 'Not authorized' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(records.body.records[0].status).toBe('rejected');
      expect(records.body.records[0].rejectionReason).toBe('Not authorized');
    });

    it('cannot approve already-approved OT', async () => {
      await request(app)
        .post(`/api/overtime/${recordId}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .post(`/api/overtime/${recordId}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/pending/);
    });
  });

  // ── Summary ──

  describe('GET /api/overtime/summary', () => {
    it('returns correct totals', async () => {
      await clockOut('alice@shaavir.com', '2026-03-20', 600, 'engineering');
      await clockOut('alice@shaavir.com', '2026-03-23', 660, 'engineering');

      await request(app)
        .post('/api/overtime/detect?date=2026-03-20')
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/overtime/detect?date=2026-03-23')
        .set('X-User-Email', 'admin@shaavir.com');

      // Approve one
      const records = await request(app)
        .get('/api/overtime?email=alice@shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post(`/api/overtime/${records.body.records[0].id}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get(
          '/api/overtime/summary?email=alice@shaavir.com&startDate=2026-03-01&endDate=2026-03-31',
        )
        .set('X-User-Email', 'alice@shaavir.com');

      expect(res.body.totalOtMinutes).toBeGreaterThan(0);
      expect(res.body.totalOtHours).toBeGreaterThan(0);
      expect(res.body.approvedOtMinutes).toBeGreaterThan(0);
      expect(res.body.pendingCount).toBe(1);
    });
  });
});

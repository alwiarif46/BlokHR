import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import { ClockRepository } from '../../src/repositories/clock-repository';
import { SchedulerService } from '../../src/scheduler/scheduler-service';
import pino from 'pino';

/**
 * All shift times are IST (UTC+5:30). UTC conversions:
 *   09:00 IST = 03:30 UTC    18:00 IST = 12:30 UTC
 *   20:00 IST = 14:30 UTC    22:00 IST = 16:30 UTC
 *   23:30 IST = 18:00 UTC    00:30 IST+1 = 19:00 UTC
 *   06:00 IST+1 = 00:30 UTC+1   07:00 IST+1 = 01:30 UTC+1
 */

const testLogger = pino({ level: 'silent' });

describe('Scheduler Module', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    db = setup.db;

    // Seed members FIRST (this creates groups via INSERT OR IGNORE)
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob',
      groupId: 'nightops',
      groupName: 'Night Operations',
    });
    await seedMember(db, {
      email: 'carol@shaavir.com',
      name: 'Carol',
      groupId: 'afternoon',
      groupName: 'Afternoon Shift',
    });

    // THEN update groups with correct shifts + buffers (groups now exist)
    await db.run(
      "UPDATE groups SET shift_start = '09:00', shift_end = '18:00', cutoff_buffer_minutes = 120 WHERE id = 'engineering'",
      [],
    );
    await db.run(
      "UPDATE groups SET shift_start = '22:00', shift_end = '06:00', cutoff_buffer_minutes = 60 WHERE id = 'nightops'",
      [],
    );
    await db.run(
      "UPDATE groups SET shift_start = '14:00', shift_end = '23:00', cutoff_buffer_minutes = 90 WHERE id = 'afternoon'",
      [],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  function createScheduler(): SchedulerService {
    return new SchedulerService(db, new ClockRepository(db), null, testLogger);
  }

  async function clockIn(
    email: string,
    name: string,
    date: string,
    firstInUtc: string,
    groupId: string,
    status: string = 'in',
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, status_source, first_in, total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, ?, 'manual', ?, 0, 0, 0, ?)`,
      [email, name, date, status, firstInUtc, groupId],
    );
  }

  // ── AUTO-CUTOFF ──

  describe('Auto-Cutoff', () => {
    it('cuts off daytime employee after shift + buffer (20:30 IST > 20:00 IST cutoff)', async () => {
      // Alice: 09:00-18:00 IST, 120min buffer → cutoff 20:00 IST = 14:30 UTC
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      // Now: 20:30 IST = 15:00 UTC
      const result = await createScheduler().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
      expect(result.cutoffCount).toBe(1);
      const row = await db.get<{ status: string; status_source: string; [key: string]: unknown }>(
        'SELECT status, status_source FROM attendance_daily WHERE email = ? AND date = ?',
        ['alice@shaavir.com', '2026-03-20'],
      );
      expect(row?.status).toBe('out');
      expect(row?.status_source).toBe('auto-cutoff');
    });

    it('does NOT cut off if still within buffer (19:00 IST < 20:00 IST cutoff)', async () => {
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      // Now: 19:00 IST = 13:30 UTC → before 14:30 UTC cutoff
      const result = await createScheduler().autoCutoff(new Date('2026-03-20T13:30:00.000Z'));
      expect(result.cutoffCount).toBe(0);
    });

    it('handles overnight shift (Bob 22:00-06:00, cutoff 07:00 IST next day)', async () => {
      // Bob: 22:00 IST clock-in = 16:30 UTC; cutoff 07:00 IST+1 = 01:30 UTC+1
      await clockIn('bob@shaavir.com', 'Bob', '2026-03-20', '2026-03-20T16:30:00.000Z', 'nightops');
      // Now: 07:30 IST March 21 = 02:00 UTC March 21
      const result = await createScheduler().autoCutoff(new Date('2026-03-21T02:00:00.000Z'));
      expect(result.cutoffCount).toBe(1);
      const row = await db.get<{ status: string; [key: string]: unknown }>(
        'SELECT status FROM attendance_daily WHERE email = ? AND date = ?',
        ['bob@shaavir.com', '2026-03-20'],
      );
      expect(row?.status).toBe('out');
    });

    it('credits hours up to shift end only (Alice: 09:00→18:00 IST = 540 min)', async () => {
      // first_in 09:00 IST (03:30 UTC) → shift end 18:00 IST (12:30 UTC) = 540 min
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      await createScheduler().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
      const row = await db.get<{ total_worked_minutes: number; [key: string]: unknown }>(
        'SELECT total_worked_minutes FROM attendance_daily WHERE email = ? AND date = ?',
        ['alice@shaavir.com', '2026-03-20'],
      );
      expect(row?.total_worked_minutes).toBe(540);
    });

    it('respects per-group buffer (Carol cut off at 00:30 IST, Bob still in)', async () => {
      // Carol: 14:00-23:00, 90min buffer → cutoff 00:30 IST+1 = 19:00 UTC
      // Bob: 22:00-06:00, 60min buffer → cutoff 07:00 IST+1 = 01:30 UTC+1
      await clockIn('bob@shaavir.com', 'Bob', '2026-03-20', '2026-03-20T16:30:00.000Z', 'nightops');
      await clockIn(
        'carol@shaavir.com',
        'Carol',
        '2026-03-20',
        '2026-03-20T08:30:00.000Z',
        'afternoon',
      );
      // Now: 00:45 IST March 21 = 19:15 UTC March 20 → past Carol, before Bob
      const result = await createScheduler().autoCutoff(new Date('2026-03-20T19:15:00.000Z'));
      expect(result.cutoffCount).toBe(1); // Only Carol
      const bob = await db.get<{ status: string; [key: string]: unknown }>(
        'SELECT status FROM attendance_daily WHERE email = ? AND date = ?',
        ['bob@shaavir.com', '2026-03-20'],
      );
      expect(bob?.status).toBe('in');
    });

    it('does nothing when disabled', async () => {
      await db.run('UPDATE system_settings SET auto_cutoff_enabled = 0 WHERE id = 1', []);
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      const result = await createScheduler().autoCutoff(new Date('2026-03-20T23:00:00.000Z'));
      expect(result.cutoffCount).toBe(0);
    });

    it('adds clock_events timeline entry on cutoff', async () => {
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      await createScheduler().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
      const events = await db.all<{ event_type: string; source: string; [key: string]: unknown }>(
        'SELECT event_type, source FROM clock_events WHERE email = ? AND date = ?',
        ['alice@shaavir.com', '2026-03-20'],
      );
      const cutoffEvent = events.find((e) => e.source === 'auto-cutoff');
      expect(cutoffEvent).toBeDefined();
      expect(cutoffEvent?.event_type).toBe('out');
    });

    it('cuts off employees on break too', async () => {
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
        'break',
      );
      const result = await createScheduler().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
      expect(result.cutoffCount).toBe(1);
    });

    it('skips employee who manually clocked out at 23:30 IST (status already out)', async () => {
      await db.run(
        `INSERT OR REPLACE INTO attendance_daily
           (email, name, date, status, status_source, first_in, last_out,
            total_worked_minutes, is_late, late_minutes, group_id)
         VALUES (?, ?, ?, 'out', 'manual', ?, ?, 870, 0, 0, ?)`,
        [
          'alice@shaavir.com',
          'Alice',
          '2026-03-20',
          '2026-03-20T03:30:00.000Z',
          '2026-03-20T18:00:00.000Z',
          'engineering',
        ],
      );
      // Run well past cutoff — should NOT touch the record
      const result = await createScheduler().autoCutoff(new Date('2026-03-21T02:00:00.000Z'));
      expect(result.cutoffCount).toBe(0);
      const row = await db.get<{
        status_source: string;
        total_worked_minutes: number;
        [key: string]: unknown;
      }>(
        'SELECT status_source, total_worked_minutes FROM attendance_daily WHERE email = ? AND date = ?',
        ['alice@shaavir.com', '2026-03-20'],
      );
      expect(row?.status_source).toBe('manual');
      expect(row?.total_worked_minutes).toBe(870);
    });
  });

  // ── ABSENCE MARKING ──

  describe('Absence Marking', () => {
    it('marks employees without attendance as absent', async () => {
      const result = await createScheduler().markAbsences('2026-03-20');
      expect(result.absentCount).toBe(3);
    });

    it('skips employees who clocked in', async () => {
      await clockIn(
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        'engineering',
      );
      const result = await createScheduler().markAbsences('2026-03-20');
      expect(result.absentCount).toBe(2);
    });

    it('skips employees on approved leave', async () => {
      await db.run(
        `INSERT INTO leave_requests (id, person_name, person_email, leave_type, kind, start_date, end_date, days_requested, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'lv_test',
          'Alice',
          'alice@shaavir.com',
          'Casual',
          'FullDay',
          '2026-03-20',
          '2026-03-20',
          1,
          'Approved',
        ],
      );
      const result = await createScheduler().markAbsences('2026-03-20');
      expect(result.absentCount).toBe(2);
    });

    it('does nothing when disabled', async () => {
      await db.run('UPDATE system_settings SET absence_marking_enabled = 0 WHERE id = 1', []);
      const result = await createScheduler().markAbsences('2026-03-20');
      expect(result.absentCount).toBe(0);
    });
  });

  // ── PTO ACCRUAL ──

  describe('PTO Accrual', () => {
    it('accrues based on leave policies', async () => {
      await db.run("UPDATE members SET joining_date = '2024-01-01'", []);
      const result = await createScheduler().accruePto(3, 2026);
      expect(result.accrualCount).toBeGreaterThanOrEqual(6);
      const balance = await db.get<{ accrued: number; [key: string]: unknown }>(
        'SELECT accrued FROM pto_balances WHERE email = ? AND leave_type = ? AND year = ?',
        ['alice@shaavir.com', 'Casual', 2026],
      );
      expect(balance!.accrued).toBe(1.0);
    });

    it('applies tenure bucket rate', async () => {
      await db.run(
        "UPDATE members SET joining_date = '2023-01-01' WHERE email = 'alice@shaavir.com'",
        [],
      );
      await createScheduler().accruePto(3, 2026);
      const balance = await db.get<{ accrued: number; [key: string]: unknown }>(
        'SELECT accrued FROM pto_balances WHERE email = ? AND leave_type = ? AND year = ?',
        ['alice@shaavir.com', 'Earned', 2026],
      );
      expect(balance!.accrued).toBe(2.0);
    });

    it('accumulates across runs', async () => {
      await db.run(
        "UPDATE members SET joining_date = '2024-01-01' WHERE email = 'alice@shaavir.com'",
        [],
      );
      const s = createScheduler();
      await s.accruePto(1, 2026);
      await s.accruePto(2, 2026);
      const balance = await db.get<{ accrued: number; [key: string]: unknown }>(
        'SELECT accrued FROM pto_balances WHERE email = ? AND leave_type = ? AND year = ?',
        ['alice@shaavir.com', 'Casual', 2026],
      );
      expect(balance!.accrued).toBe(2.0);
    });
  });

  // ── PENDING REMINDERS ──

  describe('Pending Reminders', () => {
    it('counts zero pending on fresh install', async () => {
      const r = await createScheduler().getPendingReminders();
      expect(r.pendingLeaves).toBe(0);
    });

    it('counts pending leaves', async () => {
      await db.run(
        `INSERT INTO leave_requests (id, person_name, person_email, leave_type, kind, start_date, end_date, days_requested, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'lv1',
          'Alice',
          'alice@shaavir.com',
          'Casual',
          'FullDay',
          '2026-04-01',
          '2026-04-01',
          1,
          'Pending',
        ],
      );
      const r = await createScheduler().getPendingReminders();
      expect(r.pendingLeaves).toBe(1);
    });
  });
});

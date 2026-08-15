import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import { ClockRepository } from '../../src/repositories/clock-repository';
import { SchedulerService } from '../../src/scheduler/scheduler-service';
import pino from 'pino';

/**
 * 15 Edge-Case Auto-Cutoff Scenarios.
 *
 * ALL shift times are IST (UTC+5:30).
 * IST → UTC: subtract 5h30m (330 minutes).
 *
 * Naming convention for UTC times:
 *   09:00 IST = 03:30 UTC      12:00 IST = 06:30 UTC
 *   15:00 IST = 09:30 UTC      16:00 IST = 10:30 UTC
 *   16:30 IST = 11:00 UTC      18:00 IST = 12:30 UTC
 *   19:00 IST = 13:30 UTC      20:00 IST = 14:30 UTC
 *   20:30 IST = 15:00 UTC      21:15 IST = 15:45 UTC
 *   23:00 IST = 17:30 UTC      23:30 IST = 18:00 UTC
 *   23:59 IST = 18:29 UTC      00:00 IST+1 = 18:30 UTC
 *   00:30 IST+1 = 19:00 UTC    01:30 IST+1 = 20:00 UTC
 *   01:45 IST+1 = 20:15 UTC    02:00 IST+1 = 20:30 UTC
 *   02:15 IST+1 = 20:45 UTC    04:00 IST+1 = 22:30 UTC
 *   04:15 IST+1 = 22:45 UTC    05:15 IST+1 = 23:45 UTC
 */

const testLogger = pino({ level: 'silent' });

describe('Auto-Cutoff — 15 Edge Case Scenarios', () => {
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    db = setup.db;
  });

  afterEach(async () => {
    await db.close();
  });

  function sched(): SchedulerService {
    return new SchedulerService(db, new ClockRepository(db), null, testLogger);
  }

  /** Create a group with specific shift + buffer. */
  async function createGroup(
    id: string,
    name: string,
    start: string,
    end: string,
    buffer: number,
  ): Promise<void> {
    await db.run(
      'INSERT OR REPLACE INTO groups (id, name, shift_start, shift_end, cutoff_buffer_minutes) VALUES (?, ?, ?, ?, ?)',
      [id, name, start, end, buffer],
    );
  }

  /** Create a member in a group. */
  async function createMember(
    email: string,
    name: string,
    groupId: string,
    individualStart?: string,
    individualEnd?: string,
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO members
         (id, email, name, group_id, active, individual_shift_start, individual_shift_end)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [email, email, name, groupId, individualStart ?? null, individualEnd ?? null],
    );
  }

  /** Clock someone in with a specific UTC time on a logical date. */
  async function clockIn(
    email: string,
    name: string,
    date: string,
    firstInUtc: string,
    groupId: string,
    status = 'in',
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, status_source, first_in, total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, ?, 'manual', ?, 0, 0, 0, ?)`,
      [email, name, date, status, firstInUtc, groupId],
    );
  }

  /** Read the attendance record back. */
  async function getRecord(email: string, date: string) {
    return db.get<{
      status: string;
      status_source: string;
      total_worked_minutes: number;
      last_out: string;
      [key: string]: unknown;
    }>('SELECT * FROM attendance_daily WHERE email = ? AND date = ?', [email, date]);
  }

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 1: Standard daytime (09:00-18:00), forgot logout
  //  Buffer 120m → cutoff 20:00 IST. Now = 20:30 IST.
  //  Expected: cut off, credit 540 min (9h).
  // ═══════════════════════════════════════════════════════════════

  it('S1: Standard daytime 09:00-18:00, forgot logout, cut off at 20:30 IST', async () => {
    await createGroup('grp1', 'Day Shift', '09:00', '18:00', 120);
    await createMember('s1@test.com', 'S1', 'grp1');
    await clockIn('s1@test.com', 'S1', '2026-03-20', '2026-03-20T03:30:00.000Z', 'grp1');

    const r = await sched().autoCutoff(new Date('2026-03-20T15:00:00.000Z')); // 20:30 IST
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s1@test.com', '2026-03-20');
    expect(rec?.status).toBe('out');
    expect(rec?.status_source).toBe('auto-cutoff');
    expect(rec?.total_worked_minutes).toBe(540);
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 2: PM→AM shift (18:00-02:00), forgot logout
  //  Buffer 120m → cutoff 04:00 IST next day. Now = 04:15 IST.
  //  Expected: cut off, credit 480 min (8h).
  // ═══════════════════════════════════════════════════════════════

  it('S2: PM→AM shift 18:00-02:00, forgot logout, cut off at 04:15 IST next day', async () => {
    await createGroup('grp2', 'Evening Shift', '18:00', '02:00', 120);
    await createMember('s2@test.com', 'S2', 'grp2');
    // Clocked in 18:00 IST Mar 20 = 12:30 UTC Mar 20
    await clockIn('s2@test.com', 'S2', '2026-03-20', '2026-03-20T12:30:00.000Z', 'grp2');

    // 04:15 IST Mar 21 = 22:45 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T22:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s2@test.com', '2026-03-20');
    expect(rec?.status).toBe('out');
    expect(rec?.total_worked_minutes).toBe(480); // 18:00→02:00 = 8h = 480m
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 3: PM→AM shift, scheduler runs AT midnight
  //  Same 18:00-02:00 shift, buffer 120m → cutoff 04:00 IST.
  //  Now = 00:00 IST (midnight). NOT yet past cutoff.
  // ═══════════════════════════════════════════════════════════════

  it('S3: PM→AM shift 18:00-02:00, scheduler at midnight IST — NOT cut off yet', async () => {
    await createGroup('grp3', 'Evening Shift', '18:00', '02:00', 120);
    await createMember('s3@test.com', 'S3', 'grp3');
    await clockIn('s3@test.com', 'S3', '2026-03-20', '2026-03-20T12:30:00.000Z', 'grp3');

    // 00:00 IST Mar 21 = 18:30 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T18:30:00.000Z'));
    expect(r.cutoffCount).toBe(0);

    const rec = await getRecord('s3@test.com', '2026-03-20');
    expect(rec?.status).toBe('in'); // Still clocked in
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 4: Shift ends 23:30, forgot logout
  //  15:00-23:30, buffer 120m → cutoff 01:30 IST next day.
  //  Now = 01:45 IST next day.
  //  Expected: cut off, credit 510 min (8.5h).
  // ═══════════════════════════════════════════════════════════════

  it('S4: Shift ends 23:30, forgot logout, cut off at 01:45 IST next day', async () => {
    await createGroup('grp4', 'Late Shift', '15:00', '23:30', 120);
    await createMember('s4@test.com', 'S4', 'grp4');
    // Clocked in 15:00 IST = 09:30 UTC
    await clockIn('s4@test.com', 'S4', '2026-03-20', '2026-03-20T09:30:00.000Z', 'grp4');

    // 01:45 IST Mar 21 = 20:15 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T20:15:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s4@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(510); // 15:00→23:30 = 8h30m = 510m
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 5: Shift ends EXACTLY at midnight (00:00)
  //  16:00-00:00, buffer 120m → cutoff 02:00 IST next day.
  //  This is overnight because 0 <= 960 (16:00).
  //  Expected: cut off, credit 480 min (8h).
  // ═══════════════════════════════════════════════════════════════

  it('S5: Shift ends exactly at midnight (00:00), cut off at 02:15 IST next day', async () => {
    await createGroup('grp5', 'Till Midnight', '16:00', '00:00', 120);
    await createMember('s5@test.com', 'S5', 'grp5');
    // Clocked in 16:00 IST = 10:30 UTC
    await clockIn('s5@test.com', 'S5', '2026-03-20', '2026-03-20T10:30:00.000Z', 'grp5');

    // 02:15 IST Mar 21 = 20:45 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T20:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s5@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(480); // 16:00→00:00 = 8h
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 6: Shift ends 00:30
  //  16:30-00:30, buffer 60m → cutoff 01:30 IST next day.
  //  Now = 01:45 IST. Expected: cut off, credit 480 min.
  // ═══════════════════════════════════════════════════════════════

  it('S6: Shift ends 00:30, cut off at 01:45 IST next day', async () => {
    await createGroup('grp6', 'Just Past Midnight', '16:30', '00:30', 60);
    await createMember('s6@test.com', 'S6', 'grp6');
    // Clocked in 16:30 IST = 11:00 UTC
    await clockIn('s6@test.com', 'S6', '2026-03-20', '2026-03-20T11:00:00.000Z', 'grp6');

    // 01:45 IST Mar 21 = 20:15 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T20:15:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s6@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(480); // 16:30→00:30 = 8h
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 7: Early morning shift (04:00-12:00)
  //  Daytime, not overnight. Buffer 120m → cutoff 14:00 IST.
  //  Now = 14:15 IST. Expected: cut off, credit 480 min.
  // ═══════════════════════════════════════════════════════════════

  it('S7: Early morning shift 04:00-12:00, cut off at 14:15 IST', async () => {
    await createGroup('grp7', 'Dawn Shift', '04:00', '12:00', 120);
    await createMember('s7@test.com', 'S7', 'grp7');
    // Clocked in 04:00 IST Mar 20 = 22:30 UTC Mar 19
    await clockIn('s7@test.com', 'S7', '2026-03-20', '2026-03-19T22:30:00.000Z', 'grp7');

    // 14:15 IST Mar 20 = 08:45 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T08:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s7@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(480); // 04:00→12:00 = 8h
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 8: Midnight straddler (20:00-04:00)
  //  Buffer 60m → cutoff 05:00 IST next day.
  //  Now = 05:15 IST. Expected: cut off, credit 480 min.
  // ═══════════════════════════════════════════════════════════════

  it('S8: Midnight straddler 20:00-04:00, cut off at 05:15 IST next day', async () => {
    await createGroup('grp8', 'Night Owl', '20:00', '04:00', 60);
    await createMember('s8@test.com', 'S8', 'grp8');
    // Clocked in 20:00 IST Mar 20 = 14:30 UTC Mar 20
    await clockIn('s8@test.com', 'S8', '2026-03-20', '2026-03-20T14:30:00.000Z', 'grp8');

    // 05:15 IST Mar 21 = 23:45 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T23:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s8@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(480); // 20:00→04:00 = 8h
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 9: Two employees, same group, one logged out manually
  //  Both 09:00-18:00, buffer 120m. One is status=out, other is status=in.
  //  Expected: only the forgotten one gets cut off.
  // ═══════════════════════════════════════════════════════════════

  it('S9: Two employees, one logged out manually — only the other gets cut off', async () => {
    await createGroup('grp9', 'Day Shift', '09:00', '18:00', 120);
    await createMember('s9a@test.com', 'S9A-Forgot', 'grp9');
    await createMember('s9b@test.com', 'S9B-LoggedOut', 'grp9');

    // S9A: still "in"
    await clockIn('s9a@test.com', 'S9A-Forgot', '2026-03-20', '2026-03-20T03:30:00.000Z', 'grp9');
    // S9B: already clocked out at 18:15 IST
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, status_source, first_in, last_out, total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, 'out', 'manual', ?, ?, 555, 0, 0, ?)`,
      [
        's9b@test.com',
        'S9B-LoggedOut',
        '2026-03-20',
        '2026-03-20T03:30:00.000Z',
        '2026-03-20T12:45:00.000Z',
        'grp9',
      ],
    );

    const r = await sched().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
    expect(r.cutoffCount).toBe(1); // Only S9A

    expect((await getRecord('s9a@test.com', '2026-03-20'))?.status).toBe('out');
    expect((await getRecord('s9a@test.com', '2026-03-20'))?.status_source).toBe('auto-cutoff');
    expect((await getRecord('s9b@test.com', '2026-03-20'))?.status_source).toBe('manual');
    expect((await getRecord('s9b@test.com', '2026-03-20'))?.total_worked_minutes).toBe(555);
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 10: Individual shift override
  //  Group = 09:00-18:00 (120m buffer), but member has individual 10:00-19:00.
  //  Cutoff should use individual: 19:00 + 120m = 21:00 IST.
  //  Now = 21:15 IST. Expected: cut off, credit 540m (10:00→19:00).
  // ═══════════════════════════════════════════════════════════════

  it('S10: Individual shift override 10:00-19:00 over group 09:00-18:00', async () => {
    await createGroup('grp10', 'Day Shift', '09:00', '18:00', 120);
    await createMember('s10@test.com', 'S10', 'grp10', '10:00', '19:00');

    // Clocked in 10:00 IST = 04:30 UTC
    await clockIn('s10@test.com', 'S10', '2026-03-20', '2026-03-20T04:30:00.000Z', 'grp10');

    // 21:15 IST = 15:45 UTC → past 21:00 IST cutoff
    const r = await sched().autoCutoff(new Date('2026-03-20T15:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s10@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(540); // 10:00→19:00 = 9h
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 11: Idempotency — run before buffer, then after
  //  09:00-18:00, buffer 120m → cutoff 20:00 IST.
  //  First run at 19:30 IST (before) → 0 cutoffs.
  //  Second run at 20:30 IST (after) → 1 cutoff.
  //  Third run at 21:00 IST (already cut off) → 0 cutoffs.
  // ═══════════════════════════════════════════════════════════════

  it('S11: Idempotency — before buffer, after buffer, after already cut off', async () => {
    await createGroup('grp11', 'Day Shift', '09:00', '18:00', 120);
    await createMember('s11@test.com', 'S11', 'grp11');
    await clockIn('s11@test.com', 'S11', '2026-03-20', '2026-03-20T03:30:00.000Z', 'grp11');

    // Run 1: 19:30 IST = 14:00 UTC → before cutoff
    const r1 = await sched().autoCutoff(new Date('2026-03-20T14:00:00.000Z'));
    expect(r1.cutoffCount).toBe(0);

    // Run 2: 20:30 IST = 15:00 UTC → after cutoff
    const r2 = await sched().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
    expect(r2.cutoffCount).toBe(1);

    // Run 3: 21:00 IST = 15:30 UTC → already 'out', should skip
    const r3 = await sched().autoCutoff(new Date('2026-03-20T15:30:00.000Z'));
    expect(r3.cutoffCount).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 12: Stale record from 2 days ago
  //  The scheduler only queries today + yesterday. A record from
  //  2 days ago should NOT be picked up.
  // ═══════════════════════════════════════════════════════════════

  it('S12: Stale 2-day-old record is NOT picked up by scheduler', async () => {
    await createGroup('grp12', 'Day Shift', '09:00', '18:00', 120);
    await createMember('s12@test.com', 'S12', 'grp12');
    // Record from March 18 — 2 days before March 20
    await clockIn('s12@test.com', 'S12', '2026-03-18', '2026-03-18T03:30:00.000Z', 'grp12');

    // Scheduler runs March 20, 20:30 IST
    const r = await sched().autoCutoff(new Date('2026-03-20T15:00:00.000Z'));
    expect(r.cutoffCount).toBe(0);

    // Record still "in" — untouched
    const rec = await getRecord('s12@test.com', '2026-03-18');
    expect(rec?.status).toBe('in');
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 13: Shift ends 23:59
  //  16:00-23:59, buffer 120m → cutoff 01:59 IST next day.
  //  Now = 02:15 IST. Expected: cut off, credit 479m.
  // ═══════════════════════════════════════════════════════════════

  it('S13: Shift ends 23:59, cut off at 02:15 IST next day', async () => {
    await createGroup('grp13', 'Almost Midnight', '16:00', '23:59', 120);
    await createMember('s13@test.com', 'S13', 'grp13');
    // Clocked in 16:00 IST = 10:30 UTC
    await clockIn('s13@test.com', 'S13', '2026-03-20', '2026-03-20T10:30:00.000Z', 'grp13');

    // 02:15 IST Mar 21 = 20:45 UTC Mar 20
    const r = await sched().autoCutoff(new Date('2026-03-20T20:45:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s13@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(479); // 16:00→23:59 = 7h59m
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 14: Zero buffer — cutoff immediately at shift end
  //  09:00-18:00, buffer = 0m → cutoff at 18:00 IST.
  //  Now = 18:05 IST. Expected: cut off, credit 540m.
  // ═══════════════════════════════════════════════════════════════

  it('S14: Zero buffer — cutoff immediately at shift end 18:05 IST', async () => {
    await createGroup('grp14', 'Zero Buffer', '09:00', '18:00', 0);
    await createMember('s14@test.com', 'S14', 'grp14');
    await clockIn('s14@test.com', 'S14', '2026-03-20', '2026-03-20T03:30:00.000Z', 'grp14');

    // 18:05 IST = 12:35 UTC
    const r = await sched().autoCutoff(new Date('2026-03-20T12:35:00.000Z'));
    expect(r.cutoffCount).toBe(1);

    const rec = await getRecord('s14@test.com', '2026-03-20');
    expect(rec?.total_worked_minutes).toBe(540);
  });

  // ═══════════════════════════════════════════════════════════════
  //  SCENARIO 15: Huge buffer (480m = 8h)
  //  09:00-18:00, buffer 480m → cutoff 02:00 IST next day.
  //  Now = 01:30 IST next day = 20:00 UTC. NOT yet past cutoff.
  //  Expected: NOT cut off.
  // ═══════════════════════════════════════════════════════════════

  it('S15: Huge 8h buffer — NOT cut off at 01:30 IST next day', async () => {
    await createGroup('grp15', 'Giant Buffer', '09:00', '18:00', 480);
    await createMember('s15@test.com', 'S15', 'grp15');
    await clockIn('s15@test.com', 'S15', '2026-03-20', '2026-03-20T03:30:00.000Z', 'grp15');

    // 01:30 IST Mar 21 = 20:00 UTC Mar 20 → before 02:00 IST cutoff (20:30 UTC)
    const r = await sched().autoCutoff(new Date('2026-03-20T20:00:00.000Z'));
    expect(r.cutoffCount).toBe(0);

    const rec = await getRecord('s15@test.com', '2026-03-20');
    expect(rec?.status).toBe('in');
  });
});

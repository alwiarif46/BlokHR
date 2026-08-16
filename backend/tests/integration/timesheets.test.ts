import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Automated Timesheets Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'alice@shaavir.com';
  const MANAGER = 'manager@shaavir.com';
  const ADMIN = 'admin@shaavir.com';
  const OUTSIDER = 'bob@shaavir.com';
  // 2026-03-02 is a Monday
  const WEEK_START = '2026-03-02';
  const WEEK_END = '2026-03-08';
  const MONTH_START = '2026-03-01';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await seedMember(db, { email: MANAGER, name: 'Manager' });
    await seedMember(db, { email: ADMIN, name: 'Admin' });
    await seedMember(db, { email: OUTSIDER, name: 'Bob' });

    // Alice reports to the manager; the admin is authorized everywhere
    await db.run('UPDATE members SET reports_to = ? WHERE email = ?', [MANAGER, EMAIL]);
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [ADMIN]);
  });

  afterEach(async () => {
    await db.close();
  });

  /** Seed an attendance_daily row. */
  async function seedAttendance(
    email: string,
    date: string,
    status: string,
    workedMinutes: number,
    breakMinutes = 0,
    isLate = 0,
    lateMinutes = 0,
  ): Promise<void> {
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, total_worked_minutes, total_break_minutes,
          is_late, late_minutes, group_id)
       VALUES (?, 'Alice', ?, ?, ?, ?, ?, ?, 'engineering')`,
      [email, date, status, workedMinutes, breakMinutes, isLate, lateMinutes],
    );
  }

  /** Seed an approved leave request. */
  async function seedLeave(
    email: string,
    startDate: string,
    endDate: string,
    leaveType: string,
    kind: string,
    daysRequested: number,
  ): Promise<void> {
    const id = `leave-${Date.now()}-${Math.random()}`;
    await db.run(
      `INSERT INTO leave_requests
         (id, person_name, person_email, leave_type, kind, start_date, end_date,
          days_requested, status)
       VALUES (?, 'Alice', ?, ?, ?, ?, ?, ?, 'Approved')`,
      [id, email, leaveType, kind, startDate, endDate, daysRequested],
    );
  }

  /** Seed an approved overtime record. */
  async function seedOt(
    email: string,
    date: string,
    otMinutes: number,
    otPay: number,
    otType = 'weekday',
  ): Promise<void> {
    await db.run(
      `INSERT INTO overtime_records
         (email, date, shift_start, shift_end, actual_worked_minutes,
          standard_minutes, ot_minutes, ot_type, ot_pay, status)
       VALUES (?, ?, '09:00', '18:00', ?, 540, ?, ?, ?, 'approved')`,
      [email, date, 540 + otMinutes, otMinutes, otType, otPay],
    );
  }

  /** Seed a time entry. */
  async function seedTimeEntry(
    email: string,
    date: string,
    hours: number,
    billable: boolean,
  ): Promise<void> {
    await db.run(
      `INSERT INTO time_entries (email, project_id, date, hours, billable)
       VALUES (?, 'admin-overhead', ?, ?, ?)`,
      [email, date, hours, billable ? 1 : 0],
    );
  }

  // ── Generation ──

  describe('POST /api/timesheets/generate', () => {
    it('generates a weekly timesheet for a Monday–Sunday range', async () => {
      // Seed 5 workdays of attendance (Mon–Fri)
      for (let d = 2; d <= 6; d++) {
        await seedAttendance(EMAIL, `2026-03-0${d}`, 'out', 480);
      }

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(EMAIL);
      expect(res.body.period_type).toBe('weekly');
      expect(res.body.start_date).toBe(WEEK_START);
      expect(res.body.end_date).toBe(WEEK_END);
      expect(res.body.status).toBe('draft');
      expect(res.body.total_worked_minutes).toBe(2400);
      expect(res.body.total_present_days).toBe(5);
    });

    it('generates a monthly timesheet starting on the 1st', async () => {
      // Seed just one day of attendance
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'monthly', startDate: MONTH_START });

      expect(res.status).toBe(201);
      expect(res.body.period_type).toBe('monthly');
      expect(res.body.start_date).toBe(MONTH_START);
      expect(res.body.end_date).toBe('2026-03-31');
      expect(res.body.total_worked_minutes).toBe(480);
    });

    it('rejects duplicate generation for the same period', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already exists');
    });

    it('rejects weekly timesheet with non-Monday start', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: '2026-03-04' }); // Wednesday

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Monday');
    });

    it('rejects monthly timesheet with non-1st start', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'monthly', startDate: '2026-03-15' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('1st');
    });

    it('rejects invalid periodType', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'daily', startDate: WEEK_START });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('periodType');
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('generates an empty timesheet for a period with no data', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_worked_minutes).toBe(0);
      expect(res.body.total_present_days).toBe(0);
      // 5 workdays with no attendance → absent
      expect(res.body.total_absent_days).toBe(5);
    });
  });

  // ── Aggregation: leaves, OT, time entries, holidays ──

  describe('Data aggregation', () => {
    it('counts approved full-day leaves correctly', async () => {
      // Full day leave on Wed March 4
      await seedLeave(EMAIL, '2026-03-04', '2026-03-04', 'Casual', 'FullDay', 1);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_leave_days).toBe(1);
    });

    it('counts half-day leaves as 0.5', async () => {
      // Half day leave on Tue March 3 + attendance that day
      await seedLeave(EMAIL, '2026-03-03', '2026-03-03', 'Casual', 'FirstHalf', 0.5);
      await seedAttendance(EMAIL, '2026-03-03', 'out', 240);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_leave_days).toBe(0.5);
      // Still present (half-day work)
      expect(res.body.total_present_days).toBe(1);
      expect(res.body.total_worked_minutes).toBe(240);
    });

    it('rolls up approved overtime', async () => {
      await seedOt(EMAIL, '2026-03-02', 120, 5000, 'weekday');
      await seedOt(EMAIL, '2026-03-03', 60, 2500, 'weekday');

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_ot_minutes).toBe(180);
      expect(res.body.total_ot_pay).toBe(7500);
    });

    it('rolls up billable and non-billable time entries', async () => {
      await seedTimeEntry(EMAIL, '2026-03-02', 4, true);
      await seedTimeEntry(EMAIL, '2026-03-02', 2, false);
      await seedTimeEntry(EMAIL, '2026-03-03', 6, true);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_billable_hours).toBe(10);
      expect(res.body.total_non_billable_hours).toBe(2);
    });

    it('detects mandatory holidays', async () => {
      // Republic Day 2026-01-26 is already seeded — use a week that contains it
      // Seed a custom holiday within our test week instead
      await db.run(
        "INSERT INTO holidays (date, name, type, year) VALUES ('2026-03-05', 'Test Holiday', 'mandatory', 2026)",
        [],
      );

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_holiday_days).toBe(1);
      // 4 workdays absent (5 weekdays - 1 holiday)
      expect(res.body.total_absent_days).toBe(4);
    });

    it('counts late days', async () => {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 450, 0, 1, 15);
      await seedAttendance(EMAIL, '2026-03-03', 'out', 480, 0, 0, 0);
      await seedAttendance(EMAIL, '2026-03-04', 'out', 420, 0, 1, 30);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_late_days).toBe(2);
      expect(res.body.total_present_days).toBe(3);
    });

    it('tracks break minutes', async () => {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 450, 30);

      const res = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.total_break_minutes).toBe(30);
    });

    it('marks weekends correctly in entries', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const detail = await request(app).get(`/api/timesheets/${gen.body.id}`);

      expect(detail.status).toBe(200);
      const entries = detail.body.entries;
      expect(entries).toHaveLength(7);

      // Sat March 7 and Sun March 8 should be weekend
      const sat = entries.find((e: Record<string, unknown>) => e.date === '2026-03-07');
      const sun = entries.find((e: Record<string, unknown>) => e.date === '2026-03-08');
      expect(sat.day_type).toBe('weekend');
      expect(sun.day_type).toBe('weekend');

      // Mon March 2 should be workday
      const mon = entries.find((e: Record<string, unknown>) => e.date === '2026-03-02');
      expect(mon.day_type).toBe('workday');
    });
  });

  // ── Detail & List ──

  describe('GET /api/timesheets/:id', () => {
    it('returns timesheet with daily entries', async () => {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);

      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app).get(`/api/timesheets/${gen.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.timesheet.id).toBe(gen.body.id);
      expect(res.body.entries).toHaveLength(7);
      const mon = res.body.entries.find((e: Record<string, unknown>) => e.date === '2026-03-02');
      expect(mon.worked_minutes).toBe(480);
    });

    it('returns 404 for nonexistent ID', async () => {
      const res = await request(app).get('/api/timesheets/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/timesheets', () => {
    it('lists timesheets with email filter', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app).get(`/api/timesheets?email=${EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body.timesheets).toHaveLength(1);
      expect(res.body.timesheets[0].email).toBe(EMAIL);
    });

    it('filters by status', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app).get('/api/timesheets?status=submitted');
      expect(res.body.timesheets).toHaveLength(0);

      const drafts = await request(app).get('/api/timesheets?status=draft');
      expect(drafts.body.timesheets).toHaveLength(1);
    });
  });

  // ── Lifecycle: submit → approve ──

  describe('Full lifecycle', () => {
    it('generates → submits → approves', async () => {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);

      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      expect(gen.body.status).toBe('draft');

      const submit = await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });
      expect(submit.status).toBe(200);

      const approve = await request(app)
        .post(`/api/timesheets/${gen.body.id}/approve`)
        .send({ approverEmail: 'manager@shaavir.com' });
      expect(approve.status).toBe(200);

      // Verify final state
      const detail = await request(app).get(`/api/timesheets/${gen.body.id}`);
      expect(detail.body.timesheet.status).toBe('approved');
      expect(detail.body.timesheet.approved_by).toBe('manager@shaavir.com');
    });

    it('generates → submits → rejects → regenerates → resubmits', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });

      const reject = await request(app)
        .post(`/api/timesheets/${gen.body.id}/reject`)
        .send({ rejectorEmail: 'manager@shaavir.com', reason: 'Missing hours' });
      expect(reject.status).toBe(200);

      // Verify rejected state
      const afterReject = await request(app).get(`/api/timesheets/${gen.body.id}`);
      expect(afterReject.body.timesheet.status).toBe('rejected');
      expect(afterReject.body.timesheet.rejection_reason).toBe('Missing hours');

      // Now seed some attendance and regenerate
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);

      const regen = await request(app)
        .post(`/api/timesheets/${gen.body.id}/regenerate`);
      expect(regen.status).toBe(200);
      expect(regen.body.status).toBe('draft');
      expect(regen.body.total_worked_minutes).toBe(480);

      // Resubmit
      const resubmit = await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });
      expect(resubmit.status).toBe(200);
    });
  });

  // ── Immutability after approval ──

  describe('Immutability', () => {
    async function generateAndApprove(): Promise<string> {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });
      await request(app)
        .post(`/api/timesheets/${gen.body.id}/approve`)
        .send({ approverEmail: 'manager@shaavir.com' });
      return gen.body.id;
    }

    it('cannot regenerate an approved timesheet', async () => {
      const id = await generateAndApprove();
      const res = await request(app).post(`/api/timesheets/${id}/regenerate`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('approved');
    });

    it('cannot submit an approved timesheet', async () => {
      const id = await generateAndApprove();
      const res = await request(app)
        .post(`/api/timesheets/${id}/submit`)
        .send({ email: EMAIL });
      expect(res.status).toBe(400);
    });

    it('cannot reject an approved timesheet', async () => {
      const id = await generateAndApprove();
      const res = await request(app)
        .post(`/api/timesheets/${id}/reject`)
        .send({ rejectorEmail: 'manager@shaavir.com', reason: 'test' });
      expect(res.status).toBe(400);
    });
  });

  // ── Submit guards ──

  describe('Submit guards', () => {
    it('only the owner can submit', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: 'bob@shaavir.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('owner');
    });

    it('cannot submit an already submitted timesheet', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });

      const res = await request(app)
        .post(`/api/timesheets/${gen.body.id}/submit`)
        .send({ email: EMAIL });
      expect(res.status).toBe(400);
    });

    it('cannot approve a draft timesheet', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app)
        .post(`/api/timesheets/${gen.body.id}/approve`)
        .send({ approverEmail: 'manager@shaavir.com' });
      expect(res.status).toBe(400);
    });
  });

  // ── Approver authorization ──

  describe('Approver authorization', () => {
    async function generateAndSubmit(): Promise<string> {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      await request(app).post(`/api/timesheets/${gen.body.id}/submit`).send({ email: EMAIL });
      return gen.body.id as string;
    }

    it('rejects approval from an unrelated colleague', async () => {
      const id = await generateAndSubmit();
      const res = await request(app)
        .post(`/api/timesheets/${id}/approve`)
        .send({ approverEmail: OUTSIDER });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('manager');
    });

    it('rejects self-approval by the owner', async () => {
      const id = await generateAndSubmit();
      const res = await request(app)
        .post(`/api/timesheets/${id}/approve`)
        .send({ approverEmail: EMAIL });
      expect(res.status).toBe(403);
    });

    it('allows an admin to approve any timesheet', async () => {
      const id = await generateAndSubmit();
      const res = await request(app)
        .post(`/api/timesheets/${id}/approve`)
        .set('X-User-Email', ADMIN);
      expect(res.status).toBe(200);
    });

    it('lists only timesheets the caller may decide on', async () => {
      await generateAndSubmit();

      const forManager = await request(app)
        .get('/api/timesheets/pending-approvals')
        .set('X-User-Email', MANAGER);
      expect(forManager.status).toBe(200);
      expect(forManager.body.timesheets).toHaveLength(1);
      expect(forManager.body.timesheets[0].email).toBe(EMAIL);

      const forOutsider = await request(app)
        .get('/api/timesheets/pending-approvals')
        .set('X-User-Email', OUTSIDER);
      expect(forOutsider.body.timesheets).toHaveLength(0);
    });

    it('requires authentication for pending approvals', async () => {
      const res = await request(app).get('/api/timesheets/pending-approvals');
      expect(res.status).toBe(401);
    });
  });

  // ── Week view ──

  describe('GET /api/timesheets/week', () => {
    it('returns the week with daily entries attached', async () => {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app).get(`/api/timesheets/week?startDate=${WEEK_START}`);

      expect(res.status).toBe(200);
      expect(res.body.startDate).toBe(WEEK_START);
      expect(res.body.endDate).toBe(WEEK_END);
      expect(res.body.timesheets).toHaveLength(1);
      expect(res.body.timesheets[0].entries).toHaveLength(7);
      expect(res.body.timesheets[0].entries[0].date).toBe(WEEK_START);
    });

    it('snaps a mid-week date back to that week Monday', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      // 2026-03-05 is the Thursday of the same week
      const res = await request(app).get('/api/timesheets/week?startDate=2026-03-05');
      expect(res.body.startDate).toBe(WEEK_START);
      expect(res.body.timesheets).toHaveLength(1);
    });

    it('scopes to the caller when scope=mine', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: OUTSIDER, periodType: 'weekly', startDate: WEEK_START });

      const all = await request(app).get(`/api/timesheets/week?startDate=${WEEK_START}`);
      expect(all.body.timesheets).toHaveLength(2);

      const mine = await request(app)
        .get(`/api/timesheets/week?startDate=${WEEK_START}&scope=mine`)
        .set('X-User-Email', EMAIL);
      expect(mine.body.timesheets).toHaveLength(1);
      expect(mine.body.timesheets[0].email).toBe(EMAIL);
    });
  });

  // ── Team generation ──

  describe('POST /api/timesheets/generate-team', () => {
    it('generates one timesheet per active member', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate-team')
        .send({ periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.generated).toContain(EMAIL);
      expect(res.body.generated).toContain(MANAGER);
      expect(res.body.skipped).toHaveLength(0);
    });

    it('skips members that already have a timesheet instead of failing', async () => {
      await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app)
        .post('/api/timesheets/generate-team')
        .send({ periodType: 'weekly', startDate: WEEK_START });

      expect(res.status).toBe(201);
      expect(res.body.generated).not.toContain(EMAIL);
      expect(res.body.skipped.some((s: { email: string }) => s.email === EMAIL)).toBe(true);
    });

    it('rejects a non-Monday start for the whole batch', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate-team')
        .send({ periodType: 'weekly', startDate: '2026-03-04' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Monday');
    });

    it('honours an explicit member list', async () => {
      const res = await request(app)
        .post('/api/timesheets/generate-team')
        .send({ periodType: 'weekly', startDate: WEEK_START, emails: [EMAIL] });

      expect(res.body.generated).toEqual([EMAIL]);
    });
  });

  // ── Day adjustments ──

  describe('Day adjustments', () => {
    async function generateSheet(): Promise<string> {
      await seedAttendance(EMAIL, '2026-03-02', 'out', 480);
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      return gen.body.id as string;
    }

    it('overrides a day and recomputes the worked total', async () => {
      const id = await generateSheet();

      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 6, reason: 'Left early, pre-approved' });

      expect(res.status).toBe(200);

      const detail = await request(app).get(`/api/timesheets/${id}`);
      expect(detail.body.timesheet.total_worked_minutes).toBe(360);

      const monday = detail.body.entries.find(
        (e: { date: string }) => e.date === '2026-03-02',
      );
      // The derived value is preserved alongside the override
      expect(monday.worked_minutes).toBe(480);
      expect(monday.adjusted_minutes).toBe(360);
      expect(monday.adjustment_reason).toBe('Left early, pre-approved');
      expect(monday.adjusted_by).toBe(ADMIN);

      expect(detail.body.adjustments).toHaveLength(1);
      expect(detail.body.adjustments[0].action).toBe('adjusted');
      expect(detail.body.adjustments[0].previous_minutes).toBe(480);
      expect(detail.body.adjustments[0].new_minutes).toBe(360);
    });

    it('requires a reason', async () => {
      const id = await generateSheet();
      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 6, reason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reason');
    });

    it('rejects hours outside 0–24', async () => {
      const id = await generateSheet();
      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 30, reason: 'typo' });

      expect(res.status).toBe(400);
    });

    it('rejects an adjustment from a non-admin', async () => {
      const id = await generateSheet();
      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', MANAGER)
        .send({ date: '2026-03-02', hours: 6, reason: 'nope' });

      expect(res.status).toBe(403);
    });

    it('requires authentication', async () => {
      const id = await generateSheet();
      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .send({ date: '2026-03-02', hours: 6, reason: 'anon' });

      expect(res.status).toBe(401);
    });

    it('cannot adjust an approved timesheet', async () => {
      const id = await generateSheet();
      await request(app).post(`/api/timesheets/${id}/submit`).send({ email: EMAIL });
      await request(app).post(`/api/timesheets/${id}/approve`).set('X-User-Email', ADMIN);

      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 6, reason: 'too late' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('approved');
    });

    it('reverts an override back to the derived value', async () => {
      const id = await generateSheet();
      await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 6, reason: 'Left early' });

      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust/revert`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02' });

      expect(res.status).toBe(200);

      const detail = await request(app).get(`/api/timesheets/${id}`);
      expect(detail.body.timesheet.total_worked_minutes).toBe(480);
      const monday = detail.body.entries.find((e: { date: string }) => e.date === '2026-03-02');
      expect(monday.adjusted_minutes).toBeNull();
      expect(detail.body.adjustments).toHaveLength(2);
    });

    it('refuses to revert a day that was never adjusted', async () => {
      const id = await generateSheet();
      const res = await request(app)
        .post(`/api/timesheets/${id}/adjust/revert`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-03' });

      expect(res.status).toBe(400);
    });

    it('keeps overrides when the timesheet is regenerated', async () => {
      const id = await generateSheet();
      await request(app)
        .post(`/api/timesheets/${id}/adjust`)
        .set('X-User-Email', ADMIN)
        .send({ date: '2026-03-02', hours: 6, reason: 'Left early' });

      // Fresh attendance arrives for another day, then the sheet is refreshed
      await seedAttendance(EMAIL, '2026-03-03', 'out', 480);
      const regen = await request(app).post(`/api/timesheets/${id}/regenerate`);
      expect(regen.status).toBe(200);

      const detail = await request(app).get(`/api/timesheets/${id}`);
      const monday = detail.body.entries.find((e: { date: string }) => e.date === '2026-03-02');
      expect(monday.adjusted_minutes).toBe(360);
      expect(monday.adjustment_reason).toBe('Left early');
      // Monday override (360) + Tuesday derived (480)
      expect(detail.body.timesheet.total_worked_minutes).toBe(840);
    });
  });

  // ── Batch approvals go through the service ──

  describe('Batch approval', () => {
    it('applies the same guards and audit fields as the single-item route', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });
      await request(app).post(`/api/timesheets/${gen.body.id}/submit`).send({ email: EMAIL });

      const res = await request(app)
        .post('/api/approvals/batch')
        .set('X-User-Email', MANAGER)
        .send({ items: [{ type: 'timesheet', id: gen.body.id, action: 'approve' }] });

      expect(res.status).toBe(200);
      expect(res.body.results[0].success).toBe(true);

      const detail = await request(app).get(`/api/timesheets/${gen.body.id}`);
      expect(detail.body.timesheet.status).toBe('approved');
      // The raw-SQL path used to leave these empty
      expect(detail.body.timesheet.approved_by).toBe(MANAGER);
      expect(detail.body.timesheet.approved_at).toBeTruthy();
    });

    it('refuses a batch approval of a draft timesheet', async () => {
      const gen = await request(app)
        .post('/api/timesheets/generate')
        .send({ email: EMAIL, periodType: 'weekly', startDate: WEEK_START });

      const res = await request(app)
        .post('/api/approvals/batch')
        .set('X-User-Email', MANAGER)
        .send({ items: [{ type: 'timesheet', id: gen.body.id, action: 'approve' }] });

      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[0].error).toContain('draft');

      const detail = await request(app).get(`/api/timesheets/${gen.body.id}`);
      expect(detail.body.timesheet.status).toBe('draft');
    });
  });
});

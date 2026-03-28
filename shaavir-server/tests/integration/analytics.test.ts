import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Analytics & Reports Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  const ALICE = 'alice@shaavir.com';
  const BOB = 'bob@shaavir.com';
  const START = '2026-03-01';
  const END = '2026-03-31';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await seedMember(db, {
      email: ALICE,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await seedMember(db, {
      email: BOB,
      name: 'Bob',
      groupId: 'sales',
      groupName: 'Sales',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Seed helpers ──

  async function seedAttendance(
    email: string,
    date: string,
    status: string,
    workedMinutes: number,
    breakMinutes = 0,
    isLate = 0,
    lateMinutes = 0,
  ): Promise<void> {
    const name = email === ALICE ? 'Alice' : 'Bob';
    const groupId = email === ALICE ? 'engineering' : 'sales';
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily
         (email, name, date, status, total_worked_minutes, total_break_minutes,
          is_late, late_minutes, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, name, date, status, workedMinutes, breakMinutes, isLate, lateMinutes, groupId],
    );
  }

  async function seedLeave(
    email: string,
    startDate: string,
    endDate: string,
    leaveType: string,
    status: string,
    daysRequested: number,
  ): Promise<void> {
    const id = `leave-${Date.now()}-${Math.random()}`;
    const name = email === ALICE ? 'Alice' : 'Bob';
    await db.run(
      `INSERT INTO leave_requests
         (id, person_name, person_email, leave_type, kind, start_date, end_date,
          days_requested, status)
       VALUES (?, ?, ?, ?, 'FullDay', ?, ?, ?, ?)`,
      [id, name, email, leaveType, startDate, endDate, daysRequested, status],
    );
  }

  async function seedOt(
    email: string,
    date: string,
    otMinutes: number,
    otPay: number,
    otType = 'weekday',
    status = 'approved',
  ): Promise<void> {
    await db.run(
      `INSERT INTO overtime_records
         (email, date, shift_start, shift_end, actual_worked_minutes,
          standard_minutes, ot_minutes, ot_type, ot_pay, status)
       VALUES (?, ?, '09:00', '18:00', ?, 540, ?, ?, ?, ?)`,
      [email, date, 540 + otMinutes, otMinutes, otType, otPay, status],
    );
  }

  async function seedTimeEntry(
    email: string,
    date: string,
    hours: number,
    billable: boolean,
    projectId = 'admin-overhead',
  ): Promise<void> {
    await db.run(
      `INSERT INTO time_entries (email, project_id, date, hours, billable)
       VALUES (?, ?, ?, ?, ?)`,
      [email, projectId, date, hours, billable ? 1 : 0],
    );
  }

  // ── Attendance Overview ──

  describe('GET /api/analytics/attendance', () => {
    it('returns per-employee attendance breakdown for a date range', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(ALICE, '2026-03-03', 'out', 450, 0, 1, 15);
      await seedAttendance(ALICE, '2026-03-04', 'absent', 0);
      await seedAttendance(BOB, '2026-03-02', 'out', 500);

      const res = await request(app)
        .get(`/api/analytics/attendance?startDate=${START}&endDate=${END}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(2);

      const alice = res.body.employees.find(
        (e: Record<string, unknown>) => e.email === ALICE,
      );
      expect(alice.presentDays).toBe(2);
      expect(alice.absentDays).toBe(1);
      expect(alice.lateDays).toBe(1);
      expect(alice.totalWorkedMinutes).toBe(930);

      const bob = res.body.employees.find(
        (e: Record<string, unknown>) => e.email === BOB,
      );
      expect(bob.presentDays).toBe(1);

      expect(res.body.summary.totalEmployees).toBe(2);
    });

    it('filters by groupId', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(BOB, '2026-03-02', 'out', 500);

      const res = await request(app)
        .get(`/api/analytics/attendance?startDate=${START}&endDate=${END}&groupId=engineering`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(1);
      expect(res.body.employees[0].email).toBe(ALICE);
    });

    it('filters by email', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(BOB, '2026-03-02', 'out', 500);

      const res = await request(app)
        .get(`/api/analytics/attendance?startDate=${START}&endDate=${END}&email=${BOB}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(1);
      expect(res.body.employees[0].email).toBe(BOB);
    });

    it('computes avgWorkedHoursPerDay correctly', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(ALICE, '2026-03-03', 'out', 600);
      // avg = (480+600)/2 = 540 min = 9 hrs

      const res = await request(app)
        .get(`/api/analytics/attendance?startDate=${START}&endDate=${END}&email=${ALICE}`);

      expect(res.body.employees[0].avgWorkedHoursPerDay).toBe(9);
    });

    it('returns 400 without date range', async () => {
      const res = await request(app).get('/api/analytics/attendance');
      expect(res.status).toBe(400);
    });

    it('returns 400 when startDate > endDate', async () => {
      const res = await request(app)
        .get('/api/analytics/attendance?startDate=2026-04-01&endDate=2026-03-01');
      expect(res.status).toBe(400);
    });
  });

  // ── Leave Report ──

  describe('GET /api/analytics/leaves', () => {
    it('groups leaves by type and status', async () => {
      await seedLeave(ALICE, '2026-03-05', '2026-03-05', 'Casual', 'Approved', 1);
      await seedLeave(ALICE, '2026-03-10', '2026-03-10', 'Sick', 'Approved', 1);
      await seedLeave(BOB, '2026-03-12', '2026-03-13', 'Casual', 'Pending', 2);

      const res = await request(app)
        .get(`/api/analytics/leaves?startDate=${START}&endDate=${END}`);

      expect(res.status).toBe(200);
      expect(res.body.byTypeAndStatus.length).toBeGreaterThanOrEqual(2);
      expect(res.body.summary.totalRequests).toBe(3);
      expect(res.body.summary.totalDays).toBe(4);
      expect(res.body.summary.approvedDays).toBe(2);
    });

    it('provides employee-level approved leave breakdown', async () => {
      await seedLeave(ALICE, '2026-03-05', '2026-03-06', 'Casual', 'Approved', 2);
      await seedLeave(BOB, '2026-03-10', '2026-03-10', 'Casual', 'Approved', 1);

      const res = await request(app)
        .get(`/api/analytics/leaves?startDate=${START}&endDate=${END}`);

      expect(res.body.byEmployee).toHaveLength(2);
      const aliceLeave = res.body.byEmployee.find(
        (e: Record<string, unknown>) => e.email === ALICE,
      );
      expect(aliceLeave.total_days).toBe(2);
    });

    it('filters by group', async () => {
      await seedLeave(ALICE, '2026-03-05', '2026-03-05', 'Casual', 'Approved', 1);
      await seedLeave(BOB, '2026-03-10', '2026-03-10', 'Casual', 'Approved', 1);

      const res = await request(app)
        .get(`/api/analytics/leaves?startDate=${START}&endDate=${END}&groupId=sales`);

      // byEmployee should only have Bob (sales group)
      const filtered = res.body.byEmployee.filter(
        (e: Record<string, unknown>) => e.email === BOB,
      );
      expect(filtered).toHaveLength(1);
    });
  });

  // ── Overtime Report ──

  describe('GET /api/analytics/overtime', () => {
    it('aggregates OT by employee and type', async () => {
      await seedOt(ALICE, '2026-03-02', 120, 5000, 'weekday');
      await seedOt(ALICE, '2026-03-07', 480, 15000, 'weekend');
      await seedOt(BOB, '2026-03-03', 60, 2000, 'weekday');

      const res = await request(app)
        .get(`/api/analytics/overtime?startDate=${START}&endDate=${END}`);

      expect(res.status).toBe(200);
      // Alice has 2 types, Bob has 1
      expect(res.body.employees.length).toBeGreaterThanOrEqual(3);
      expect(res.body.summary.totalOtMinutes).toBe(660);
      expect(res.body.summary.totalOtPay).toBe(22000);
      expect(res.body.summary.totalRecords).toBe(3);
    });

    it('filters by employee', async () => {
      await seedOt(ALICE, '2026-03-02', 120, 5000);
      await seedOt(BOB, '2026-03-02', 60, 2000);

      const res = await request(app)
        .get(`/api/analytics/overtime?startDate=${START}&endDate=${END}&email=${ALICE}`);

      expect(res.body.employees).toHaveLength(1);
      expect(res.body.employees[0].email).toBe(ALICE);
    });

    it('computes totalOtHours correctly', async () => {
      await seedOt(ALICE, '2026-03-02', 90, 3000);

      const res = await request(app)
        .get(`/api/analytics/overtime?startDate=${START}&endDate=${END}&email=${ALICE}`);

      expect(res.body.employees[0].totalOtHours).toBe(1.5);
    });
  });

  // ── Department Dashboard ──

  describe('GET /api/analytics/departments', () => {
    it('returns per-department headcount and today snapshot', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(BOB, '2026-03-02', 'absent', 0);

      const res = await request(app)
        .get(`/api/analytics/departments?today=2026-03-02&startDate=${START}&endDate=${END}`);

      expect(res.status).toBe(200);
      expect(res.body.departments.length).toBeGreaterThanOrEqual(2);

      const eng = res.body.departments.find(
        (d: Record<string, unknown>) => d.groupId === 'engineering',
      );
      expect(eng.headcount).toBe(1);
      expect(eng.presentToday).toBe(1);

      const sales = res.body.departments.find(
        (d: Record<string, unknown>) => d.groupId === 'sales',
      );
      expect(sales.headcount).toBe(1);
      expect(sales.absentToday).toBe(1);

      expect(res.body.summary.totalHeadcount).toBe(2);
      expect(res.body.summary.totalPresent).toBe(1);
      expect(res.body.summary.totalAbsent).toBe(1);
    });

    it('works without explicit date range (defaults to current month)', async () => {
      const res = await request(app)
        .get('/api/analytics/departments?today=2026-03-15');

      expect(res.status).toBe(200);
      expect(res.body.periodStart).toBe('2026-03-01');
      expect(res.body.periodEnd).toBe('2026-03-15');
    });

    it('computes attendance rate for the period', async () => {
      // 3 days for Alice: 2 present, 1 absent
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(ALICE, '2026-03-03', 'out', 480);
      await seedAttendance(ALICE, '2026-03-04', 'absent', 0);

      const res = await request(app)
        .get('/api/analytics/departments?today=2026-03-04&startDate=2026-03-02&endDate=2026-03-04');

      const eng = res.body.departments.find(
        (d: Record<string, unknown>) => d.groupId === 'engineering',
      );
      // 2 present out of 3 records = 66.7%
      expect(eng.attendanceRate).toBe(66.7);
    });
  });

  // ── Utilization Report ──

  describe('GET /api/analytics/utilization', () => {
    it('computes billable vs non-billable hours per employee', async () => {
      await seedTimeEntry(ALICE, '2026-03-02', 6, true);
      await seedTimeEntry(ALICE, '2026-03-02', 2, false);
      await seedTimeEntry(BOB, '2026-03-02', 8, true);

      const res = await request(app)
        .get(`/api/analytics/utilization?startDate=${START}&endDate=${END}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(2);

      const alice = res.body.employees.find(
        (e: Record<string, unknown>) => e.email === ALICE,
      );
      expect(alice.totalHours).toBe(8);
      expect(alice.billableHours).toBe(6);
      expect(alice.nonBillableHours).toBe(2);
      expect(alice.utilizationPct).toBe(75);

      expect(res.body.summary.totalHours).toBe(16);
      expect(res.body.summary.overallUtilization).toBe(87.5);
    });

    it('filters by email', async () => {
      await seedTimeEntry(ALICE, '2026-03-02', 6, true);
      await seedTimeEntry(BOB, '2026-03-02', 8, true);

      const res = await request(app)
        .get(`/api/analytics/utilization?startDate=${START}&endDate=${END}&email=${ALICE}`);

      expect(res.body.employees).toHaveLength(1);
      expect(res.body.employees[0].email).toBe(ALICE);
    });

    it('handles zero hours without division error', async () => {
      const res = await request(app)
        .get(`/api/analytics/utilization?startDate=${START}&endDate=${END}&email=${ALICE}`);

      expect(res.status).toBe(200);
      expect(res.body.employees).toHaveLength(0);
      expect(res.body.summary.overallUtilization).toBe(0);
    });
  });

  // ── Attendance Trends ──

  describe('GET /api/analytics/trends', () => {
    it('returns daily trend data', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(BOB, '2026-03-02', 'absent', 0);
      await seedAttendance(ALICE, '2026-03-03', 'out', 480);
      await seedAttendance(BOB, '2026-03-03', 'out', 500);

      const res = await request(app)
        .get(`/api/analytics/trends?startDate=2026-03-02&endDate=2026-03-03`);

      expect(res.status).toBe(200);
      expect(res.body.daily).toHaveLength(2);

      const day1 = res.body.daily.find(
        (d: Record<string, unknown>) => d.date === '2026-03-02',
      );
      expect(day1.present_count).toBe(1);
      expect(day1.absent_count).toBe(1);
      expect(day1.total_members).toBe(2);

      const day2 = res.body.daily.find(
        (d: Record<string, unknown>) => d.date === '2026-03-03',
      );
      expect(day2.present_count).toBe(2);
    });

    it('supports monthly aggregation', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(ALICE, '2026-03-15', 'out', 480);

      const res = await request(app)
        .get(`/api/analytics/trends?startDate=${START}&endDate=${END}&groupBy=month`);

      expect(res.status).toBe(200);
      expect(res.body.aggregated).toHaveLength(1);
      expect(res.body.aggregated[0].period).toBe('2026-03');
    });

    it('supports weekly aggregation', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(ALICE, '2026-03-09', 'out', 480);

      const res = await request(app)
        .get(`/api/analytics/trends?startDate=${START}&endDate=${END}&groupBy=week`);

      expect(res.status).toBe(200);
      expect(res.body.aggregated).toBeDefined();
      expect(res.body.aggregated.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by group', async () => {
      await seedAttendance(ALICE, '2026-03-02', 'out', 480);
      await seedAttendance(BOB, '2026-03-02', 'out', 500);

      const res = await request(app)
        .get(`/api/analytics/trends?startDate=2026-03-02&endDate=2026-03-02&groupId=engineering`);

      expect(res.body.daily).toHaveLength(1);
      expect(res.body.daily[0].present_count).toBe(1);
      expect(res.body.daily[0].total_members).toBe(1);
    });

    it('rejects invalid groupBy', async () => {
      const res = await request(app)
        .get(`/api/analytics/trends?startDate=${START}&endDate=${END}&groupBy=quarter`);
      expect(res.status).toBe(400);
    });
  });

  // ── Input validation ──

  describe('Input validation', () => {
    it('rejects malformed dates', async () => {
      const res = await request(app)
        .get('/api/analytics/attendance?startDate=2026/03/01&endDate=2026-03-31');
      expect(res.status).toBe(400);
    });

    it('rejects missing endDate', async () => {
      const res = await request(app)
        .get('/api/analytics/utilization?startDate=2026-03-01');
      expect(res.status).toBe(400);
    });
  });
});

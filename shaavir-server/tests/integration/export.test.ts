import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('CSV Export (Gap 6)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'alice@shaavir.com';

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: EMAIL, name: 'Alice', groupId: 'eng', groupName: 'Engineering' });

    // Seed attendance daily records
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily (email, name, date, status, first_in, last_out, total_worked_minutes, is_late, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [EMAIL, 'Alice', '2026-03-01', 'out', '09:15', '18:00', 525, 1, 'eng'],
    );
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily (email, name, date, status, first_in, last_out, total_worked_minutes, is_late, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [EMAIL, 'Alice', '2026-03-02', 'out', '09:00', '18:00', 540, 0, 'eng'],
    );

    // Seed leave requests
    await db.run(
      `INSERT INTO leave_requests (id, person_email, person_name, leave_type, kind, start_date, end_date, days_requested, status, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['leave-1', EMAIL, 'Alice', 'Casual', 'FullDay', '2026-03-10', '2026-03-10', 1, 'Approved', 'Personal'],
    );
    await db.run(
      `INSERT INTO leave_requests (id, person_email, person_name, leave_type, kind, start_date, end_date, days_requested, status, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['leave-2', EMAIL, 'Alice', 'Sick', 'FullDay', '2026-03-15', '2026-03-15', 1, 'Pending', 'Flu'],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it('attendance export returns 200 with CSV content type', async () => {
    const res = await request(app)
      .get('/api/export/attendance?startDate=2026-03-01&endDate=2026-03-31')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Email,Name,Group,Date');
  });

  it('missing dates returns 400', async () => {
    const res = await request(app)
      .get('/api/export/attendance')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(400);
  });

  it('startDate > endDate returns 400', async () => {
    const res = await request(app)
      .get('/api/export/attendance?startDate=2026-12-01&endDate=2026-01-01')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(400);
  });

  it('filter by email returns only matching rows', async () => {
    const res = await request(app)
      .get(`/api/export/attendance?startDate=2026-03-01&endDate=2026-03-31&email=${EMAIL}`)
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 rows
  });

  it('leaves export returns 200 with correct CSV headers', async () => {
    const res = await request(app)
      .get('/api/export/leaves?startDate=2026-03-01&endDate=2026-03-31')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Email,Name,Type,Kind,Start,End');
  });

  it('leaves filter by status returns only matching leaves', async () => {
    const res = await request(app)
      .get('/api/export/leaves?startDate=2026-03-01&endDate=2026-03-31&status=Approved')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    const lines = res.text.split('\n').filter(l => l.trim());
    expect(lines.length).toBe(2); // header + 1 approved leave
  });

  it('lates export returns only is_late=1 rows', async () => {
    const res = await request(app)
      .get('/api/export/lates?startDate=2026-03-01&endDate=2026-03-31')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    const lines = res.text.split('\n').filter(l => l.trim());
    expect(lines.length).toBe(2); // header + 1 late event
  });

  it('CSV escaping for names with commas', async () => {
    // Add a member with comma in name
    await seedMember(db, { email: 'comma@shaavir.com', name: 'Last, First' });
    await db.run(
      `INSERT OR REPLACE INTO attendance_daily (email, name, date, status, first_in, last_out, total_worked_minutes, is_late, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['comma@shaavir.com', 'Last, First', '2026-03-05', 'out', '09:00', '18:00', 540, 0, 'engineering'],
    );

    const res = await request(app)
      .get('/api/export/attendance?startDate=2026-03-01&endDate=2026-03-31&email=comma@shaavir.com')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    expect(res.text).toContain('"Last, First"');
  });

  it('empty date range returns 200 with headers only', async () => {
    const res = await request(app)
      .get('/api/export/attendance?startDate=2025-01-01&endDate=2025-01-31')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    const lines = res.text.split('\n').filter(l => l.trim());
    expect(lines.length).toBe(1); // header only
  });

  it('regression — analytics endpoints still return JSON', async () => {
    // Analytics returns JSON, not CSV
    const res = await request(app)
      .get('/api/analytics/departments')
      .set('x-user-email', EMAIL);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('json');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('Tracked Meetings Module', () => {
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

  // ── Add Meeting ──

  describe('POST /api/meetings', () => {
    it('adds a meeting manually', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'Weekly Standup',
          joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
          client: 'Internal',
          purpose: 'Sprint sync',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meeting.name).toBe('Weekly Standup');
      expect(res.body.meeting.platform).toBe('teams');
    });

    it('detects Google Meet platform from join URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'Client Sync',
          joinUrl: 'https://meet.google.com/abc-defg-hij',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('google-meet');
    });

    it('detects Zoom platform from join URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'Zoom Call',
          joinUrl: 'https://us04web.zoom.us/j/123456789',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('zoom');
    });

    it('detects Webex platform from join URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'Webex Meeting',
          joinUrl: 'https://mycompany.webex.com/meet/john',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('webex');
    });

    it('detects GoToMeeting platform from join URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'GoTo Sync',
          joinUrl: 'https://www.gotomeeting.com/join/123456789',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('gotomeeting');
    });

    it('detects BlueJeans platform from join URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({
          name: 'BlueJeans Call',
          joinUrl: 'https://bluejeans.com/123456789',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('bluejeans');
    });

    it('defaults to manual platform when no URL', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ name: 'In-person Meeting', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.platform).toBe('manual');
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('trims name whitespace', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ name: '  Sprint Planning  ', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.name).toBe('Sprint Planning');
    });

    it('handles empty optional fields gracefully', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ name: 'Minimal Meeting' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meeting.join_url).toBe('');
      expect(res.body.meeting.client).toBe('');
      expect(res.body.meeting.purpose).toBe('');
    });

    it('uses identity email as fallback for addedBy', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .send({ name: 'Fallback Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meeting.added_by).toBe('admin@shaavir.com');
    });
  });

  // ── List Meetings ──

  describe('GET /api/meetings', () => {
    it('returns empty when no meetings exist', async () => {
      const res = await request(app).get('/api/meetings').set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meetings).toEqual([]);
    });

    it('returns added meetings', async () => {
      await request(app)
        .post('/api/meetings')
        .send({ name: 'Meeting A', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/meetings')
        .send({ name: 'Meeting B', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/meetings').set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.meetings).toHaveLength(2);
    });
  });

  // ── Update/Enrich Meeting ──

  describe('PUT /api/meetings/:id', () => {
    it('updates client and purpose', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'Client Call', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      const meetingId = created.body.meeting.id;

      const res = await request(app)
        .put(`/api/meetings/${meetingId}`)
        .send({ client: 'Acme Corp', purpose: 'Q2 Review' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app).get('/api/meetings').set('X-User-Email', 'admin@shaavir.com');
      const updated = list.body.meetings.find((m: Record<string, unknown>) => m.id === meetingId);
      expect(updated.client).toBe('Acme Corp');
      expect(updated.purpose).toBe('Q2 Review');
    });

    it('returns error for nonexistent meeting', async () => {
      const res = await request(app)
        .put('/api/meetings/nonexistent-id')
        .send({ client: 'Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('trims whitespace on client and purpose', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'Trim Test', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      await request(app)
        .put(`/api/meetings/${created.body.meeting.id}`)
        .send({ client: '  Acme  ', purpose: '  Review  ' })
        .set('X-User-Email', 'admin@shaavir.com');

      const list = await request(app).get('/api/meetings').set('X-User-Email', 'admin@shaavir.com');
      const m = list.body.meetings.find(
        (mt: Record<string, unknown>) => mt.id === created.body.meeting.id,
      );
      expect(m.client).toBe('Acme');
      expect(m.purpose).toBe('Review');
    });
  });

  // ── Attendance ──

  describe('GET /api/meetings/attendance', () => {
    it('returns empty attendance when no records exist', async () => {
      const res = await request(app)
        .get('/api/meetings/attendance')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.attendance).toEqual({});
    });

    it('returns attendance data grouped by meeting_id + session_date', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'Standup', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      const meetingId = created.body.meeting.id;

      // Seed attendance directly via DB (simulates webhook/sync ingest)
      await db.run(
        `INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, join_time, leave_time, total_seconds, late_minutes, credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'att1',
          meetingId,
          '2026-03-20',
          'alice@shaavir.com',
          'Alice',
          '09:00',
          '09:30',
          1800,
          0,
          100,
        ],
      );
      await db.run(
        `INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, join_time, leave_time, total_seconds, late_minutes, credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['att2', meetingId, '2026-03-20', 'bob@shaavir.com', 'Bob', '09:05', '09:30', 1500, 5, 50],
      );

      const res = await request(app)
        .get('/api/meetings/attendance')
        .set('X-User-Email', 'admin@shaavir.com');

      const key = `${meetingId}_2026-03-20`;
      expect(res.body.attendance[key]).toBeDefined();
      expect(res.body.attendance[key].date).toBe('2026-03-20');
      expect(res.body.attendance[key].records).toHaveLength(2);

      const alice = res.body.attendance[key].records.find(
        (r: Record<string, unknown>) => r.email === 'alice@shaavir.com',
      );
      expect(alice.displayName).toBe('Alice');
      expect(alice.totalSeconds).toBe(1800);
      expect(alice.lateMinutes).toBe(0);
      expect(alice.credit).toBe(100);
      expect(alice.duration).toBe('30m');

      const bob = res.body.attendance[key].records.find(
        (r: Record<string, unknown>) => r.email === 'bob@shaavir.com',
      );
      expect(bob.lateMinutes).toBe(5);
      expect(bob.credit).toBe(50);
    });
  });

  // ── Calendar Discovery ──

  describe('GET /api/meetings/discover-all', () => {
    it('returns empty arrays for all platforms when no credentials configured', async () => {
      const res = await request(app)
        .get(
          '/api/meetings/discover-all?userId=u1&googleEmail=e@g.com&zoomUserId=z1&webexEmail=w@w.com&gotoOrganizerKey=go1&bluejeansUserId=bj1',
        )
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.teams).toEqual([]);
      expect(res.body.google).toEqual([]);
      expect(res.body.zoom).toEqual([]);
      expect(res.body.webex).toEqual([]);
      expect(res.body.gotomeeting).toEqual([]);
      expect(res.body.bluejeans).toEqual([]);
    });

    it('returns empty arrays when no query params given', async () => {
      const res = await request(app)
        .get('/api/meetings/discover-all')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.teams).toEqual([]);
      expect(res.body.google).toEqual([]);
      expect(res.body.zoom).toEqual([]);
      expect(res.body.webex).toEqual([]);
      expect(res.body.gotomeeting).toEqual([]);
      expect(res.body.bluejeans).toEqual([]);
    });

    it('returns all six platform keys in response shape', async () => {
      const res = await request(app)
        .get('/api/meetings/discover-all')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(Object.keys(res.body).sort()).toEqual([
        'bluejeans',
        'google',
        'gotomeeting',
        'teams',
        'webex',
        'zoom',
      ]);
    });
  });

  // ── Attendance Sync ──

  describe('POST /api/meetings/:id/sync-attendance', () => {
    it('returns success with 0 count for manual platform meetings', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'In-person Sync', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/meetings/${created.body.meeting.id}/sync-attendance`)
        .send({ sessionDate: '2026-03-20' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
    });

    it('returns error for nonexistent meeting', async () => {
      const res = await request(app)
        .post('/api/meetings/nonexistent-id/sync-attendance')
        .send({ sessionDate: '2026-03-20' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('defaults sessionDate to today when not provided', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'Default Date Test', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/meetings/${created.body.meeting.id}/sync-attendance`)
        .send({})
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 0 count for platform meetings without credentials', async () => {
      // Add a Zoom meeting manually (no Zoom credentials configured in test)
      const created = await request(app)
        .post('/api/meetings')
        .send({
          name: 'Zoom Standup',
          joinUrl: 'https://us04web.zoom.us/j/123',
          addedBy: 'admin@shaavir.com',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(created.body.meeting.platform).toBe('zoom');

      const res = await request(app)
        .post(`/api/meetings/${created.body.meeting.id}/sync-attendance`)
        .send({ sessionDate: '2026-03-20' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
    });
  });

  // ── Attendance Upsert (via repository) ──

  describe('Attendance upsert behavior', () => {
    it('upserts attendance by unique constraint', async () => {
      const created = await request(app)
        .post('/api/meetings')
        .send({ name: 'Upsert Test', addedBy: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      const meetingId = created.body.meeting.id;

      // First insert
      await db.run(
        `INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, total_seconds, late_minutes, credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['u1', meetingId, '2026-03-20', 'alice@shaavir.com', 'Alice', 1200, 5, 50],
      );

      // Upsert with updated values
      await db.run(
        `INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, total_seconds, late_minutes, credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(meeting_id, session_date, email) DO UPDATE SET
           total_seconds = excluded.total_seconds,
           late_minutes = excluded.late_minutes,
           credit = excluded.credit`,
        ['u2', meetingId, '2026-03-20', 'alice@shaavir.com', 'Alice', 1800, 0, 100],
      );

      const res = await request(app)
        .get('/api/meetings/attendance')
        .set('X-User-Email', 'admin@shaavir.com');

      const key = `${meetingId}_2026-03-20`;
      expect(res.body.attendance[key].records).toHaveLength(1);
      expect(res.body.attendance[key].records[0].totalSeconds).toBe(1800);
      expect(res.body.attendance[key].records[0].credit).toBe(100);
    });
  });
});

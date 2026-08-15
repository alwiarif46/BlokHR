import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface TrackedMeeting {
  [key: string]: unknown;
  id: string;
  name: string;
  join_url: string;
  platform: string;
  client: string;
  purpose: string;
  enabled: number;
  added_by: string;
  transcript: string;
  recording: string;
  external_id: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendanceRecord {
  [key: string]: unknown;
  id: string;
  meeting_id: string;
  session_date: string;
  email: string;
  display_name: string;
  join_time: string;
  leave_time: string;
  total_seconds: number;
  late_minutes: number;
  credit: number;
  created_at: string;
}

/**
 * Tracked meeting repository — CRUD for meetings + attendance records.
 * Meetings are auto-discovered from Teams/Google Calendar or added manually.
 */
export class MeetingRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Meeting CRUD ──

  /** Create a tracked meeting. */
  async create(data: {
    name: string;
    joinUrl: string;
    platform: string;
    client: string;
    purpose: string;
    addedBy: string;
    externalId?: string;
  }): Promise<TrackedMeeting> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO tracked_meetings (id, name, join_url, platform, client, purpose, added_by, external_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.joinUrl,
        data.platform,
        data.client,
        data.purpose,
        data.addedBy,
        data.externalId ?? '',
      ],
    );
    const created = await this.db.get<TrackedMeeting>(
      'SELECT * FROM tracked_meetings WHERE id = ?',
      [id],
    );
    if (!created) throw new Error('Failed to create tracked meeting');
    return created;
  }

  /** Get all tracked meetings. */
  async getAll(): Promise<TrackedMeeting[]> {
    return this.db.all<TrackedMeeting>('SELECT * FROM tracked_meetings ORDER BY created_at DESC');
  }

  /** Get a tracked meeting by ID. */
  async getById(id: string): Promise<TrackedMeeting | null> {
    return this.db.get<TrackedMeeting>('SELECT * FROM tracked_meetings WHERE id = ?', [id]);
  }

  /** Find by external ID (for dedup during calendar sync). */
  async getByExternalId(externalId: string): Promise<TrackedMeeting | null> {
    if (!externalId) return null;
    return this.db.get<TrackedMeeting>('SELECT * FROM tracked_meetings WHERE external_id = ?', [
      externalId,
    ]);
  }

  /** Update tracked meeting fields (enrich, toggle, etc). */
  async update(
    id: string,
    fields: Partial<
      Pick<
        TrackedMeeting,
        'name' | 'client' | 'purpose' | 'enabled' | 'join_url' | 'transcript' | 'recording'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE tracked_meetings SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  // ── Attendance ──

  /**
   * Record attendance for a person in a meeting session.
   * Upserts by unique constraint (meeting_id + session_date + email).
   */
  async recordAttendance(data: {
    meetingId: string;
    sessionDate: string;
    email: string;
    displayName: string;
    joinTime: string;
    leaveTime: string;
    totalSeconds: number;
    lateMinutes: number;
    credit: number;
  }): Promise<MeetingAttendanceRecord> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO meeting_attendance (id, meeting_id, session_date, email, display_name, join_time, leave_time, total_seconds, late_minutes, credit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(meeting_id, session_date, email) DO UPDATE SET
         display_name = excluded.display_name,
         join_time = excluded.join_time,
         leave_time = excluded.leave_time,
         total_seconds = excluded.total_seconds,
         late_minutes = excluded.late_minutes,
         credit = excluded.credit`,
      [
        id,
        data.meetingId,
        data.sessionDate,
        data.email,
        data.displayName,
        data.joinTime,
        data.leaveTime,
        data.totalSeconds,
        data.lateMinutes,
        data.credit,
      ],
    );
    const record = await this.db.get<MeetingAttendanceRecord>(
      'SELECT * FROM meeting_attendance WHERE meeting_id = ? AND session_date = ? AND email = ?',
      [data.meetingId, data.sessionDate, data.email],
    );
    if (!record) throw new Error('Failed to record meeting attendance');
    return record;
  }

  /**
   * Get all attendance data grouped by meeting_id + session_date.
   * Returns the structure the frontend expects:
   *   { "{meetingId}_{date}": { date, records: [{ email, displayName, totalSeconds, lateMinutes, credit }] } }
   */
  async getAllAttendance(): Promise<
    Record<
      string,
      {
        date: string;
        records: Array<{
          email: string;
          displayName: string;
          totalSeconds: number;
          lateMinutes: number;
          duration: string;
          credit: number;
        }>;
      }
    >
  > {
    const rows = await this.db.all<MeetingAttendanceRecord>(
      'SELECT * FROM meeting_attendance ORDER BY session_date DESC, join_time ASC',
    );

    const grouped: Record<
      string,
      {
        date: string;
        records: Array<{
          email: string;
          displayName: string;
          totalSeconds: number;
          lateMinutes: number;
          duration: string;
          credit: number;
        }>;
      }
    > = {};

    for (const row of rows) {
      const key = `${row.meeting_id}_${row.session_date}`;
      if (!grouped[key]) {
        grouped[key] = { date: row.session_date, records: [] };
      }
      grouped[key].records.push({
        email: row.email,
        displayName: row.display_name,
        totalSeconds: row.total_seconds,
        lateMinutes: row.late_minutes,
        duration: row.total_seconds > 0 ? `${Math.round(row.total_seconds / 60)}m` : '',
        credit: row.credit,
      });
    }

    return grouped;
  }

  /** Get attendance records for a specific meeting. */
  async getAttendanceByMeeting(meetingId: string): Promise<MeetingAttendanceRecord[]> {
    return this.db.all<MeetingAttendanceRecord>(
      'SELECT * FROM meeting_attendance WHERE meeting_id = ? ORDER BY session_date DESC',
      [meetingId],
    );
  }
}

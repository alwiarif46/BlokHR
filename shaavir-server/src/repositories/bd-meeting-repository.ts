import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface BdMeeting {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  client: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  status: string;
  qualifier_email: string;
  approver_email: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

/**
 * BD Meeting repository — all meeting qualification/approval DB operations.
 * This module is exclusively for Business Development department members.
 */
export class BdMeetingRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Create a new BD meeting request. */
  async create(data: {
    email: string;
    name: string;
    client: string;
    date: string;
    time: string;
    location: string;
    notes: string;
  }): Promise<BdMeeting> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO bd_meetings (id, email, name, client, date, time, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.email, data.name, data.client, data.date, data.time, data.location, data.notes],
    );
    const created = await this.db.get<BdMeeting>('SELECT * FROM bd_meetings WHERE id = ?', [id]);
    if (!created) throw new Error('Failed to create BD meeting');
    return created;
  }

  /** Get BD meeting by ID. */
  async getById(id: string): Promise<BdMeeting | null> {
    return this.db.get<BdMeeting>('SELECT * FROM bd_meetings WHERE id = ?', [id]);
  }

  /** Get all BD meetings for an employee. */
  async getByEmail(email: string): Promise<BdMeeting[]> {
    return this.db.all<BdMeeting>(
      'SELECT * FROM bd_meetings WHERE email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  /** Update BD meeting fields. */
  async update(
    id: string,
    fields: Partial<
      Pick<BdMeeting, 'status' | 'qualifier_email' | 'approver_email' | 'rejection_reason'>
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE bd_meetings SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Count pending BD meetings (for pending actions widget). */
  async countPending(): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM bd_meetings WHERE status IN ('pending', 'qualified', 'notified')",
    );
    return row?.cnt ?? 0;
  }

  /** Get all pending BD meetings with details (for pending actions detail). */
  async getPendingDetail(): Promise<BdMeeting[]> {
    return this.db.all<BdMeeting>(
      "SELECT * FROM bd_meetings WHERE status IN ('pending', 'qualified', 'notified') ORDER BY created_at DESC",
    );
  }
}

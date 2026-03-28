import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface Regularization {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  date: string;
  correction_type: string;
  in_time: string;
  out_time: string;
  reason: string;
  status: string;
  manager_approver_email: string;
  hr_approver_email: string;
  rejection_comments: string;
  created_at: string;
  updated_at: string;
}

/**
 * Regularization repository — all attendance correction DB operations.
 */
export class RegularizationRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Create a new regularization request. */
  async create(data: {
    email: string;
    name: string;
    date: string;
    correctionType: string;
    inTime: string;
    outTime: string;
    reason: string;
  }): Promise<Regularization> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO regularizations (id, email, name, date, correction_type, in_time, out_time, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.email,
        data.name,
        data.date,
        data.correctionType,
        data.inTime,
        data.outTime,
        data.reason,
      ],
    );
    const created = await this.db.get<Regularization>(
      'SELECT * FROM regularizations WHERE id = ?',
      [id],
    );
    if (!created) throw new Error('Failed to create regularization');
    return created;
  }

  /** Get regularization by ID. */
  async getById(id: string): Promise<Regularization | null> {
    return this.db.get<Regularization>('SELECT * FROM regularizations WHERE id = ?', [id]);
  }

  /** Get all regularizations for an employee. */
  async getByEmail(email: string): Promise<Regularization[]> {
    return this.db.all<Regularization>(
      'SELECT * FROM regularizations WHERE email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  /** Update regularization fields. */
  async update(
    id: string,
    fields: Partial<
      Pick<
        Regularization,
        'status' | 'manager_approver_email' | 'hr_approver_email' | 'rejection_comments'
      >
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
    await this.db.run(`UPDATE regularizations SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Count pending regularizations (for pending actions). */
  async countPending(): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM regularizations WHERE status IN ('pending', 'manager_approved')",
    );
    return row?.cnt ?? 0;
  }

  /** Get all pending regularizations with details (for pending actions detail). */
  async getPendingDetail(): Promise<Regularization[]> {
    return this.db.all<Regularization>(
      "SELECT * FROM regularizations WHERE status IN ('pending', 'manager_approved') ORDER BY created_at DESC",
    );
  }
}

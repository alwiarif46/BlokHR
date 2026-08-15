import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface VisitorVisitRow {
  [key: string]: unknown;
  id: string;
  visitor_name: string;
  visitor_company: string;
  visitor_email: string;
  visitor_phone: string;
  host_email: string;
  purpose: string;
  expected_date: string;
  expected_time: string;
  expected_duration_minutes: number;
  actual_checkin: string | null;
  actual_checkout: string | null;
  reception_notes: string;
  badge_data_json: string;
  photo_file_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VisitorFormRow {
  [key: string]: unknown;
  id: string;
  visit_id: string;
  form_type: string;
  signature_base64: string;
  file_id: string | null;
  signed_at: string;
}

export class VisitorRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async createVisit(data: {
    visitorName: string;
    visitorCompany?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    hostEmail: string;
    purpose?: string;
    expectedDate: string;
    expectedTime?: string;
    expectedDurationMinutes?: number;
    createdBy: string;
  }): Promise<VisitorVisitRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO visitor_visits (id, visitor_name, visitor_company, visitor_email, visitor_phone,
        host_email, purpose, expected_date, expected_time, expected_duration_minutes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.visitorName,
        data.visitorCompany ?? '',
        data.visitorEmail ?? '',
        data.visitorPhone ?? '',
        data.hostEmail,
        data.purpose ?? '',
        data.expectedDate,
        data.expectedTime ?? '',
        data.expectedDurationMinutes ?? 60,
        data.createdBy,
      ],
    );
    const row = await this.db.get<VisitorVisitRow>('SELECT * FROM visitor_visits WHERE id = ?', [
      id,
    ]);
    if (!row) throw new Error('Failed to create visit');
    return row;
  }

  async getVisitById(id: string): Promise<VisitorVisitRow | null> {
    return this.db.get<VisitorVisitRow>('SELECT * FROM visitor_visits WHERE id = ?', [id]);
  }

  async listVisits(filters?: {
    hostEmail?: string;
    date?: string;
    status?: string;
  }): Promise<VisitorVisitRow[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters?.hostEmail) {
      conds.push('host_email = ?');
      params.push(filters.hostEmail);
    }
    if (filters?.date) {
      conds.push('expected_date = ?');
      params.push(filters.date);
    }
    if (filters?.status) {
      conds.push('status = ?');
      params.push(filters.status);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    return this.db.all<VisitorVisitRow>(
      `SELECT * FROM visitor_visits ${where} ORDER BY expected_date DESC, expected_time DESC`,
      params,
    );
  }

  async checkIn(id: string, receptionNotes?: string): Promise<void> {
    await this.db.run(
      "UPDATE visitor_visits SET status = 'checked_in', actual_checkin = datetime('now'), reception_notes = ?, updated_at = datetime('now') WHERE id = ?",
      [receptionNotes ?? '', id],
    );
  }

  async checkOut(id: string): Promise<void> {
    await this.db.run(
      "UPDATE visitor_visits SET status = 'checked_out', actual_checkout = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [id],
    );
  }

  async cancelVisit(id: string): Promise<void> {
    await this.db.run(
      "UPDATE visitor_visits SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?",
      [id],
    );
  }

  async updateVisit(
    id: string,
    fields: Partial<
      Pick<
        VisitorVisitRow,
        | 'visitor_name'
        | 'visitor_company'
        | 'visitor_email'
        | 'visitor_phone'
        | 'purpose'
        | 'expected_date'
        | 'expected_time'
        | 'expected_duration_minutes'
        | 'badge_data_json'
        | 'photo_file_id'
        | 'reception_notes'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE visitor_visits SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  // ── Forms ──
  async addForm(data: {
    visitId: string;
    formType?: string;
    signatureBase64?: string;
    fileId?: string | null;
  }): Promise<VisitorFormRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO visitor_forms (id, visit_id, form_type, signature_base64, file_id) VALUES (?, ?, ?, ?, ?)',
      [id, data.visitId, data.formType ?? 'nda', data.signatureBase64 ?? '', data.fileId ?? null],
    );
    const row = await this.db.get<VisitorFormRow>('SELECT * FROM visitor_forms WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to add form');
    return row;
  }

  async getFormsByVisit(visitId: string): Promise<VisitorFormRow[]> {
    return this.db.all<VisitorFormRow>(
      'SELECT * FROM visitor_forms WHERE visit_id = ? ORDER BY signed_at DESC',
      [visitId],
    );
  }

  /** Count visitors currently checked in (for dashboard). */
  async countCheckedIn(): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      "SELECT COUNT(*) AS cnt FROM visitor_visits WHERE status = 'checked_in'",
    );
    return row?.cnt ?? 0;
  }
}

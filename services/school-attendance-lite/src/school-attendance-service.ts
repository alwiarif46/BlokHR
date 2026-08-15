import { v4 as uuidv4 } from 'uuid';
import type { SchoolDb } from './db';

export type MarkStatus = 'present' | 'absent' | 'late';

export class SchoolAttendanceService {
  constructor(
    private readonly db: SchoolDb,
    private readonly tenantId: string = 'default',
  ) {}

  async createClass(name: string): Promise<{ id: string; name: string }> {
    const id = `cls_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await this.db.run('INSERT INTO classes (id, tenant_id, name) VALUES (?, ?, ?)', [
      id,
      this.tenantId,
      name.trim(),
    ]);
    return { id, name: name.trim() };
  }

  async listClasses(): Promise<Array<{ id: string; name: string }>> {
    const rows = await this.db.all<{ id: string; name: string }>(
      'SELECT id, name FROM classes WHERE tenant_id = ? ORDER BY name',
      [this.tenantId],
    );
    return rows;
  }

  async addStudent(classId: string, displayName: string, subjectRef?: string): Promise<{ id: string }> {
    const id = subjectRef?.trim() || `stu_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await this.db.run(
      'INSERT INTO students (id, tenant_id, class_id, display_name) VALUES (?, ?, ?, ?)',
      [id, this.tenantId, classId, displayName.trim()],
    );
    return { id };
  }

  async roster(classId: string): Promise<Array<{ id: string; displayName: string }>> {
    const rows = await this.db.all<{ id: string; display_name: string }>(
      'SELECT id, display_name FROM students WHERE tenant_id = ? AND class_id = ? AND active = 1 ORDER BY display_name',
      [this.tenantId, classId],
    );
    return rows.map((r) => ({ id: r.id, displayName: r.display_name }));
  }

  async createPeriod(classId: string, label: string, periodDate: string): Promise<{ id: string }> {
    const id = `prd_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await this.db.run(
      'INSERT INTO periods (id, tenant_id, class_id, label, period_date) VALUES (?, ?, ?, ?, ?)',
      [id, this.tenantId, classId, label.trim(), periodDate],
    );
    return { id };
  }

  async listPeriods(classId: string, periodDate?: string): Promise<Array<{ id: string; label: string; periodDate: string }>> {
    if (periodDate) {
      return this.db.all(
        'SELECT id, label, period_date as periodDate FROM periods WHERE tenant_id = ? AND class_id = ? AND period_date = ?',
        [this.tenantId, classId, periodDate],
      );
    }
    return this.db.all(
      'SELECT id, label, period_date as periodDate FROM periods WHERE tenant_id = ? AND class_id = ? ORDER BY period_date DESC',
      [this.tenantId, classId],
    );
  }

  /**
   * Upsert mark. Idempotent on idempotency_key.
   * Conflict: last-write-wins per (subject, period) with audit entry.
   */
  async mark(input: {
    periodId: string;
    subjectRef: string;
    status: MarkStatus;
    source?: string;
    idempotencyKey: string;
    actor?: string;
  }): Promise<{ success: boolean; replay?: boolean; error?: string }> {
    if (!input.idempotencyKey) return { success: false, error: 'idempotency_key required' };

    const byKey = await this.db.get<{ id: string }>(
      'SELECT id FROM marks WHERE tenant_id = ? AND idempotency_key = ?',
      [this.tenantId, input.idempotencyKey],
    );
    if (byKey) return { success: true, replay: true };

    const existing = await this.db.get<{ id: string; status: string }>(
      'SELECT id, status FROM marks WHERE tenant_id = ? AND period_id = ? AND subject_ref = ?',
      [this.tenantId, input.periodId, input.subjectRef],
    );

    const source = input.source || 'roll_call';
    if (existing) {
      await this.db.run(
        `UPDATE marks SET status = ?, source = ?, idempotency_key = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [input.status, source, input.idempotencyKey, existing.id],
      );
      await this.db.run(
        `INSERT INTO mark_audit (tenant_id, period_id, subject_ref, old_status, new_status, source, actor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          this.tenantId,
          input.periodId,
          input.subjectRef,
          existing.status,
          input.status,
          source,
          input.actor || '',
        ],
      );
      return { success: true };
    }

    const id = `mrk_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await this.db.run(
      `INSERT INTO marks (id, tenant_id, period_id, subject_ref, status, source, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, this.tenantId, input.periodId, input.subjectRef, input.status, source, input.idempotencyKey],
    );
    await this.db.run(
      `INSERT INTO mark_audit (tenant_id, period_id, subject_ref, old_status, new_status, source, actor)
       VALUES (?, ?, ?, '', ?, ?, ?)`,
      [this.tenantId, input.periodId, input.subjectRef, input.status, source, input.actor || ''],
    );
    return { success: true };
  }

  async marksForPeriod(periodId: string): Promise<Array<{ subjectRef: string; status: string; source: string }>> {
    const rows = await this.db.all<{ subject_ref: string; status: string; source: string }>(
      'SELECT subject_ref, status, source FROM marks WHERE tenant_id = ? AND period_id = ?',
      [this.tenantId, periodId],
    );
    return rows.map((r) => ({ subjectRef: r.subject_ref, status: r.status, source: r.source }));
  }

  /** Capture accelerator: matched → present. Never auto-absent on no_match. */
  async markFromCapture(input: {
    tenantId: string;
    subjectRef: string;
    periodId?: string;
    classId?: string;
    decision: string;
    source: string;
    idempotencyKey: string;
  }): Promise<void> {
    if (input.decision !== 'matched') return;
    if (!input.periodId) return;
    await this.mark({
      periodId: input.periodId,
      subjectRef: input.subjectRef,
      status: 'present',
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      actor: 'capture',
    });
  }

  /** Bundle for offline cache at teacher login. */
  async offlineBundle(classId: string, periodDate: string): Promise<{
    classId: string;
    roster: Array<{ id: string; displayName: string }>;
    periods: Array<{ id: string; label: string; periodDate: string }>;
  }> {
    const roster = await this.roster(classId);
    const periods = await this.listPeriods(classId, periodDate);
    return { classId, roster, periods };
  }
}

import type { SchoolEngagementSqlite } from '../db';
import type { DiaryAck, DiaryEntry, DiaryKind } from '../types';

interface DiaryEntryRow {
  id: string;
  tenant_id: string;
  section_ref: string;
  student_ref: string | null;
  entry_date: string;
  kind: string;
  body: string;
  attachment_refs_json: string | null;
  author_member_id: string;
  created_at: string;
  updated_at: string;
}

interface DiaryAckRow {
  id: string;
  tenant_id: string;
  entry_id: string;
  guardian_ref: string;
  student_ref: string;
  at: string;
}

function mapEntry(row: DiaryEntryRow): DiaryEntry {
  let attachmentRefs: string[] | null = null;
  if (row.attachment_refs_json) {
    try {
      const parsed = JSON.parse(row.attachment_refs_json) as unknown;
      attachmentRefs = Array.isArray(parsed)
        ? parsed.map((x) => String(x))
        : null;
    } catch {
      attachmentRefs = null;
    }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sectionRef: row.section_ref,
    studentRef: row.student_ref,
    entryDate: row.entry_date,
    kind: row.kind as DiaryKind,
    body: row.body,
    attachmentRefs,
    authorMemberId: row.author_member_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAck(row: DiaryAckRow): DiaryAck {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    entryId: row.entry_id,
    guardianRef: row.guardian_ref,
    studentRef: row.student_ref,
    at: row.at,
  };
}

export class DiaryRepository {
  constructor(private readonly db: SchoolEngagementSqlite) {}

  async insertEntry(e: {
    id: string;
    tenantId: string;
    sectionRef: string;
    studentRef: string | null;
    entryDate: string;
    kind: DiaryKind;
    body: string;
    attachmentRefs: string[] | null;
    authorMemberId: string;
    createdAt?: string;
  }): Promise<DiaryEntry> {
    const createdAt = e.createdAt ?? new Date().toISOString();
    await this.db.run(
      `INSERT INTO diary_entries (
         id, tenant_id, section_ref, student_ref, entry_date, kind, body,
         attachment_refs_json, author_member_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.tenantId,
        e.sectionRef,
        e.studentRef,
        e.entryDate,
        e.kind,
        e.body,
        e.attachmentRefs ? JSON.stringify(e.attachmentRefs) : null,
        e.authorMemberId,
        createdAt,
        createdAt,
      ],
    );
    return (await this.getEntry(e.tenantId, e.id))!;
  }

  async getEntry(tenantId: string, id: string): Promise<DiaryEntry | null> {
    const row = await this.db.get(
      'SELECT * FROM diary_entries WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapEntry(row as unknown as DiaryEntryRow) : null;
  }

  async updateEntry(
    tenantId: string,
    id: string,
    patch: { kind?: DiaryKind; body?: string; attachmentRefs?: string[] | null },
  ): Promise<DiaryEntry | null> {
    const existing = await this.getEntry(tenantId, id);
    if (!existing) return null;
    const kind = patch.kind ?? existing.kind;
    const body = patch.body ?? existing.body;
    const attachmentRefs =
      patch.attachmentRefs !== undefined
        ? patch.attachmentRefs
        : existing.attachmentRefs;
    await this.db.run(
      `UPDATE diary_entries SET kind = ?, body = ?, attachment_refs_json = ?,
       updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
      [
        kind,
        body,
        attachmentRefs ? JSON.stringify(attachmentRefs) : null,
        tenantId,
        id,
      ],
    );
    return this.getEntry(tenantId, id);
  }

  async deleteEntry(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getEntry(tenantId, id);
    if (!existing) return false;
    await this.db.run(
      'DELETE FROM diary_acks WHERE tenant_id = ? AND entry_id = ?',
      [tenantId, id],
    );
    await this.db.run('DELETE FROM diary_entries WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async listEntries(
    tenantId: string,
    filters: {
      sectionRef?: string;
      entryDate?: string;
      studentRef?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<DiaryEntry[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.sectionRef) {
      clauses.push('section_ref = ?');
      params.push(filters.sectionRef);
    }
    if (filters.entryDate) {
      clauses.push('entry_date = ?');
      params.push(filters.entryDate);
    }
    if (filters.studentRef) {
      clauses.push('student_ref = ?');
      params.push(filters.studentRef);
    }
    if (filters.from) {
      clauses.push('entry_date >= ?');
      params.push(filters.from);
    }
    if (filters.to) {
      clauses.push('entry_date <= ?');
      params.push(filters.to);
    }
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);
    params.push(limit, offset);
    const rows = await this.db.all(
      `SELECT * FROM diary_entries WHERE ${clauses.join(' AND ')}
       ORDER BY entry_date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );
    return (rows as unknown as DiaryEntryRow[]).map(mapEntry);
  }

  /**
   * Class-wide (student_ref IS NULL) for section + student-specific for child.
   */
  async listGuardianFeed(
    tenantId: string,
    sectionRef: string,
    studentRef: string,
    from: string,
    to: string,
    limit: number,
    offset: number,
  ): Promise<DiaryEntry[]> {
    const rows = await this.db.all(
      `SELECT * FROM diary_entries
       WHERE tenant_id = ?
         AND entry_date >= ? AND entry_date <= ?
         AND (
           (student_ref IS NULL AND section_ref = ?)
           OR student_ref = ?
         )
       ORDER BY entry_date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, from, to, sectionRef, studentRef, limit, offset],
    );
    return (rows as unknown as DiaryEntryRow[]).map(mapEntry);
  }

  async countAcks(tenantId: string, entryId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT count(*) as c FROM diary_acks WHERE tenant_id = ? AND entry_id = ?',
      [tenantId, entryId],
    );
    return row?.c ?? 0;
  }

  async findAck(
    tenantId: string,
    entryId: string,
    guardianRef: string,
    studentRef: string,
  ): Promise<DiaryAck | null> {
    const row = await this.db.get(
      `SELECT * FROM diary_acks
       WHERE tenant_id = ? AND entry_id = ? AND guardian_ref = ? AND student_ref = ?`,
      [tenantId, entryId, guardianRef, studentRef],
    );
    return row ? mapAck(row as unknown as DiaryAckRow) : null;
  }

  async insertAck(a: {
    id: string;
    tenantId: string;
    entryId: string;
    guardianRef: string;
    studentRef: string;
  }): Promise<DiaryAck> {
    await this.db.run(
      `INSERT INTO diary_acks (id, tenant_id, entry_id, guardian_ref, student_ref)
       VALUES (?, ?, ?, ?, ?)`,
      [a.id, a.tenantId, a.entryId, a.guardianRef, a.studentRef],
    );
    return (await this.findAck(a.tenantId, a.entryId, a.guardianRef, a.studentRef))!;
  }
}

import type { SchoolTimetableDb } from '../db';
import type {
  Allocation,
  CoverAssignment,
  CoverFairnessRow,
  CoverState,
  DayScheme,
  DaySchemeKind,
  Exclusion,
  ExclusionReason,
  ExclusionScope,
  PeriodDef,
  PeriodInstance,
  PeriodInstanceSource,
  PeriodInstanceStatus,
  PeriodInstanceWithMeta,
  PeriodLostReason,
  Section,
  Slot,
  SlotGridEntry,
  Subject,
  TeacherAbsence,
  Term,
} from '../types';

interface TermRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  academic_session_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
  updated_at: string;
}

interface DaySchemeRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  label: string;
  kind: string;
  cycle_length: number | null;
  periods_json: string;
  created_at: string;
  updated_at: string;
}

interface ExclusionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  date: string;
  scope: string;
  class_label: string | null;
  reason: string;
  label: string;
  created_at: string;
  updated_at: string;
}

function mapTerm(row: TermRow): Term {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicSessionId: row.academic_session_id,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDayScheme(row: DaySchemeRow): DayScheme {
  const raw = JSON.parse(row.periods_json) as Array<Record<string, unknown>>;
  const periods: PeriodDef[] = raw.map((p) => ({
    index: Number(p.index),
    label: String(p.label),
    startTime: String(p.start_time ?? p.startTime),
    endTime: String(p.end_time ?? p.endTime),
    isTeaching: Number(p.is_teaching ?? p.isTeaching ?? 0) === 1 || p.isTeaching === true,
  }));
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    kind: row.kind as DaySchemeKind,
    cycleLength: row.cycle_length,
    periods,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExclusion(row: ExclusionRow): Exclusion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    scope: row.scope as ExclusionScope,
    classLabel: row.class_label,
    reason: row.reason as ExclusionReason,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function periodsToJson(periods: PeriodDef[]): string {
  return JSON.stringify(
    periods.map((p) => ({
      index: p.index,
      label: p.label,
      start_time: p.startTime,
      end_time: p.endTime,
      is_teaching: p.isTeaching ? 1 : 0,
    })),
  );
}

export class TimetableRepository {
  constructor(private readonly db: SchoolTimetableDb) {}

  async listTerms(tenantId: string): Promise<Term[]> {
    const rows = await this.db.all<TermRow>(
      'SELECT * FROM terms WHERE tenant_id = ? ORDER BY starts_on ASC',
      [tenantId],
    );
    return rows.map(mapTerm);
  }

  async getTerm(tenantId: string, id: string): Promise<Term | null> {
    const row = await this.db.get<TermRow>(
      'SELECT * FROM terms WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapTerm(row) : null;
  }

  async insertTerm(t: Term): Promise<Term> {
    await this.db.run(
      `INSERT INTO terms (id, tenant_id, academic_session_id, label, starts_on, ends_on)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [t.id, t.tenantId, t.academicSessionId, t.label, t.startsOn, t.endsOn],
    );
    const created = await this.getTerm(t.tenantId, t.id);
    if (!created) throw new Error('Failed to read inserted term');
    return created;
  }

  async updateTerm(tenantId: string, id: string, next: Term): Promise<Term | null> {
    await this.db.run(
      `UPDATE terms SET academic_session_id = ?, label = ?, starts_on = ?, ends_on = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.academicSessionId, next.label, next.startsOn, next.endsOn, tenantId, id],
    );
    return this.getTerm(tenantId, id);
  }

  async deleteTerm(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getTerm(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM terms WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listDaySchemes(tenantId: string): Promise<DayScheme[]> {
    const rows = await this.db.all<DaySchemeRow>(
      'SELECT * FROM day_schemes WHERE tenant_id = ? ORDER BY label ASC',
      [tenantId],
    );
    return rows.map(mapDayScheme);
  }

  async getDayScheme(tenantId: string, id: string): Promise<DayScheme | null> {
    const row = await this.db.get<DaySchemeRow>(
      'SELECT * FROM day_schemes WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapDayScheme(row) : null;
  }

  async insertDayScheme(s: DayScheme): Promise<DayScheme> {
    await this.db.run(
      `INSERT INTO day_schemes (id, tenant_id, label, kind, cycle_length, periods_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.tenantId, s.label, s.kind, s.cycleLength, periodsToJson(s.periods)],
    );
    const created = await this.getDayScheme(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted day scheme');
    return created;
  }

  async updateDayScheme(tenantId: string, id: string, next: DayScheme): Promise<DayScheme | null> {
    await this.db.run(
      `UPDATE day_schemes SET label = ?, kind = ?, cycle_length = ?, periods_json = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.label, next.kind, next.cycleLength, periodsToJson(next.periods), tenantId, id],
    );
    return this.getDayScheme(tenantId, id);
  }

  async deleteDayScheme(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getDayScheme(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM day_schemes WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listExclusions(
    tenantId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<Exclusion[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (opts.from) {
      clauses.push('date >= ?');
      params.push(opts.from);
    }
    if (opts.to) {
      clauses.push('date <= ?');
      params.push(opts.to);
    }
    const rows = await this.db.all<ExclusionRow>(
      `SELECT * FROM exclusions WHERE ${clauses.join(' AND ')} ORDER BY date ASC, label ASC`,
      params,
    );
    return rows.map(mapExclusion);
  }

  async getExclusion(tenantId: string, id: string): Promise<Exclusion | null> {
    const row = await this.db.get<ExclusionRow>(
      'SELECT * FROM exclusions WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapExclusion(row) : null;
  }

  async insertExclusion(e: Exclusion): Promise<Exclusion> {
    await this.db.run(
      `INSERT INTO exclusions (id, tenant_id, date, scope, class_label, reason, label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.tenantId, e.date, e.scope, e.classLabel, e.reason, e.label],
    );
    const created = await this.getExclusion(e.tenantId, e.id);
    if (!created) throw new Error('Failed to read inserted exclusion');
    return created;
  }

  async updateExclusion(
    tenantId: string,
    id: string,
    next: Exclusion,
  ): Promise<Exclusion | null> {
    await this.db.run(
      `UPDATE exclusions SET date = ?, scope = ?, class_label = ?, reason = ?, label = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.date, next.scope, next.classLabel, next.reason, next.label, tenantId, id],
    );
    return this.getExclusion(tenantId, id);
  }

  async deleteExclusion(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getExclusion(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM exclusions WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listSections(tenantId: string): Promise<Section[]> {
    const rows = await this.db.all<SectionRow>(
      'SELECT * FROM sections WHERE tenant_id = ? ORDER BY class_label ASC, section ASC',
      [tenantId],
    );
    return rows.map(mapSection);
  }

  async getSection(tenantId: string, id: string): Promise<Section | null> {
    const row = await this.db.get<SectionRow>(
      'SELECT * FROM sections WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapSection(row) : null;
  }

  async findSectionByKey(
    tenantId: string,
    academicSessionId: string,
    classLabel: string,
    section: string,
  ): Promise<Section | null> {
    const row = await this.db.get<SectionRow>(
      `SELECT * FROM sections
       WHERE tenant_id = ? AND academic_session_id = ? AND class_label = ? AND section = ?`,
      [tenantId, academicSessionId, classLabel, section],
    );
    return row ? mapSection(row) : null;
  }

  async insertSection(s: Section): Promise<Section> {
    await this.db.run(
      `INSERT INTO sections (
         id, tenant_id, academic_session_id, class_label, section, day_scheme_id,
         class_teacher_member_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.tenantId,
        s.academicSessionId,
        s.classLabel,
        s.section,
        s.daySchemeId,
        s.classTeacherMemberId,
      ],
    );
    const created = await this.getSection(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted section');
    return created;
  }

  async updateSection(tenantId: string, id: string, next: Section): Promise<Section | null> {
    await this.db.run(
      `UPDATE sections SET academic_session_id = ?, class_label = ?, section = ?,
         day_scheme_id = ?, class_teacher_member_id = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.academicSessionId,
        next.classLabel,
        next.section,
        next.daySchemeId,
        next.classTeacherMemberId,
        tenantId,
        id,
      ],
    );
    return this.getSection(tenantId, id);
  }

  async deleteSection(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getSection(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM sections WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async countAllocationsForSection(tenantId: string, sectionId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM allocations WHERE tenant_id = ? AND section_id = ?',
      [tenantId, sectionId],
    );
    return Number(row?.c ?? 0);
  }

  async listSubjects(tenantId: string): Promise<Subject[]> {
    const rows = await this.db.all<SubjectRow>(
      'SELECT * FROM subjects WHERE tenant_id = ? ORDER BY code ASC',
      [tenantId],
    );
    return rows.map(mapSubject);
  }

  async getSubject(tenantId: string, id: string): Promise<Subject | null> {
    const row = await this.db.get<SubjectRow>(
      'SELECT * FROM subjects WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapSubject(row) : null;
  }

  async findSubjectByCode(tenantId: string, code: string): Promise<Subject | null> {
    const row = await this.db.get<SubjectRow>(
      'SELECT * FROM subjects WHERE tenant_id = ? AND code = ?',
      [tenantId, code],
    );
    return row ? mapSubject(row) : null;
  }

  async insertSubject(s: Subject): Promise<Subject> {
    await this.db.run(
      `INSERT INTO subjects (id, tenant_id, code, label, is_elective)
       VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.tenantId, s.code, s.label, s.isElective ? 1 : 0],
    );
    const created = await this.getSubject(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted subject');
    return created;
  }

  async updateSubject(tenantId: string, id: string, next: Subject): Promise<Subject | null> {
    await this.db.run(
      `UPDATE subjects SET code = ?, label = ?, is_elective = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.code, next.label, next.isElective ? 1 : 0, tenantId, id],
    );
    return this.getSubject(tenantId, id);
  }

  async deleteSubject(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getSubject(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM subjects WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async countAllocationsForSubject(tenantId: string, subjectId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM allocations WHERE tenant_id = ? AND subject_id = ?',
      [tenantId, subjectId],
    );
    return Number(row?.c ?? 0);
  }

  async listAllocations(tenantId: string): Promise<Allocation[]> {
    const rows = await this.db.all<AllocationRow>(
      'SELECT * FROM allocations WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    );
    return rows.map(mapAllocation);
  }

  async listAllocationsForTeacherInSection(
    tenantId: string,
    sectionId: string,
    teacherMemberId: string,
  ): Promise<Allocation[]> {
    const rows = await this.db.all<AllocationRow>(
      `SELECT * FROM allocations
       WHERE tenant_id = ? AND section_id = ? AND teacher_member_id = ?
       ORDER BY created_at ASC`,
      [tenantId, sectionId, teacherMemberId],
    );
    return rows.map(mapAllocation);
  }

  async findSectionsByRef(tenantId: string, sectionRef: string): Promise<Section[]> {
    const ref = sectionRef.trim();
    if (!ref) return [];
    const rows = await this.db.all<SectionRow>(
      `SELECT * FROM sections
       WHERE tenant_id = ?
         AND (
           id = ?
           OR (class_label || section) = ?
           OR lower(class_label || '-' || section) = lower(?)
           OR lower(class_label || '_' || section) = lower(?)
         )
       ORDER BY created_at ASC`,
      [tenantId, ref, ref, ref, ref],
    );
    return rows.map(mapSection);
  }

  async getAllocation(tenantId: string, id: string): Promise<Allocation | null> {
    const row = await this.db.get<AllocationRow>(
      'SELECT * FROM allocations WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapAllocation(row) : null;
  }

  async findAllocationBySectionSubject(
    tenantId: string,
    sectionId: string,
    subjectId: string,
  ): Promise<Allocation | null> {
    const row = await this.db.get<AllocationRow>(
      'SELECT * FROM allocations WHERE tenant_id = ? AND section_id = ? AND subject_id = ?',
      [tenantId, sectionId, subjectId],
    );
    return row ? mapAllocation(row) : null;
  }

  async insertAllocation(a: Allocation): Promise<Allocation> {
    await this.db.run(
      `INSERT INTO allocations (
         id, tenant_id, section_id, subject_id, teacher_member_id, periods_per_week, room
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.tenantId,
        a.sectionId,
        a.subjectId,
        a.teacherMemberId,
        a.periodsPerWeek,
        a.room,
      ],
    );
    const created = await this.getAllocation(a.tenantId, a.id);
    if (!created) throw new Error('Failed to read inserted allocation');
    return created;
  }

  async updateAllocation(
    tenantId: string,
    id: string,
    next: Allocation,
  ): Promise<Allocation | null> {
    await this.db.run(
      `UPDATE allocations SET section_id = ?, subject_id = ?, teacher_member_id = ?,
         periods_per_week = ?, room = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.sectionId,
        next.subjectId,
        next.teacherMemberId,
        next.periodsPerWeek,
        next.room,
        tenantId,
        id,
      ],
    );
    return this.getAllocation(tenantId, id);
  }

  async deleteAllocation(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getAllocation(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM allocations WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listSectionsBySession(tenantId: string, academicSessionId: string): Promise<Section[]> {
    const rows = await this.db.all<SectionRow>(
      `SELECT * FROM sections
       WHERE tenant_id = ? AND academic_session_id = ?
       ORDER BY class_label ASC, section ASC`,
      [tenantId, academicSessionId],
    );
    return rows.map(mapSection);
  }

  async listSlotsForSection(tenantId: string, sectionId: string): Promise<Slot[]> {
    const rows = await this.db.all<SlotRow>(
      `SELECT * FROM slots
       WHERE tenant_id = ? AND section_id = ?
       ORDER BY day_ref ASC, period_index ASC`,
      [tenantId, sectionId],
    );
    return rows.map(mapSlot);
  }

  async listSlotGridForSection(tenantId: string, sectionId: string): Promise<SlotGridEntry[]> {
    const rows = await this.db.all<SlotGridRow>(
      `SELECT s.*, a.subject_id, a.teacher_member_id, sub.code AS subject_code, sub.label AS subject_label
       FROM slots s
       JOIN allocations a ON a.id = s.allocation_id AND a.tenant_id = s.tenant_id
       JOIN subjects sub ON sub.id = a.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.section_id = ?
       ORDER BY s.day_ref ASC, s.period_index ASC`,
      [tenantId, sectionId],
    );
    return rows.map(mapSlotGrid);
  }

  async listSlotGridForTeacher(tenantId: string, teacherMemberId: string): Promise<SlotGridEntry[]> {
    const rows = await this.db.all<SlotGridRow>(
      `SELECT s.*, a.subject_id, a.teacher_member_id, sub.code AS subject_code, sub.label AS subject_label
       FROM slots s
       JOIN allocations a ON a.id = s.allocation_id AND a.tenant_id = s.tenant_id
       JOIN subjects sub ON sub.id = a.subject_id AND sub.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND a.teacher_member_id = ?
       ORDER BY s.day_ref ASC, s.period_index ASC, s.section_id ASC`,
      [tenantId, teacherMemberId],
    );
    return rows.map(mapSlotGrid);
  }

  async listSlotsForSessionExcludingSection(
    tenantId: string,
    academicSessionId: string,
    excludeSectionId: string,
  ): Promise<Array<Slot & { teacherMemberId: string; sectionId: string }>> {
    const rows = await this.db.all<SlotClashRow>(
      `SELECT s.*, a.teacher_member_id
       FROM slots s
       JOIN sections sec ON sec.id = s.section_id AND sec.tenant_id = s.tenant_id
       JOIN allocations a ON a.id = s.allocation_id AND a.tenant_id = s.tenant_id
       WHERE s.tenant_id = ?
         AND sec.academic_session_id = ?
         AND s.section_id != ?`,
      [tenantId, academicSessionId, excludeSectionId],
    );
    return rows.map((row) => ({
      ...mapSlot(row),
      teacherMemberId: row.teacher_member_id,
    }));
  }

  async replaceSectionSlots(tenantId: string, sectionId: string, slots: Slot[]): Promise<void> {
    await this.db.run('DELETE FROM slots WHERE tenant_id = ? AND section_id = ?', [
      tenantId,
      sectionId,
    ]);
    for (const slot of slots) {
      await this.db.run(
        `INSERT INTO slots (id, tenant_id, section_id, day_ref, period_index, allocation_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          slot.id,
          slot.tenantId,
          slot.sectionId,
          slot.dayRef,
          slot.periodIndex,
          slot.allocationId,
        ],
      );
    }
  }

  async getPeriodInstance(tenantId: string, id: string): Promise<PeriodInstance | null> {
    const row = await this.db.get<PeriodInstanceRow>(
      'SELECT * FROM period_instances WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapPeriodInstance(row) : null;
  }

  async findPeriodInstance(
    tenantId: string,
    sectionId: string,
    date: string,
    periodIndex: number,
  ): Promise<PeriodInstance | null> {
    const row = await this.db.get<PeriodInstanceRow>(
      `SELECT * FROM period_instances
       WHERE tenant_id = ? AND section_id = ? AND date = ? AND period_index = ?`,
      [tenantId, sectionId, date, periodIndex],
    );
    return row ? mapPeriodInstance(row) : null;
  }

  async listPeriodInstances(
    tenantId: string,
    sectionId: string,
    opts: { from?: string; to?: string; status?: string } = {},
  ): Promise<PeriodInstance[]> {
    const clauses = ['tenant_id = ?', 'section_id = ?'];
    const params: unknown[] = [tenantId, sectionId];
    if (opts.from) {
      clauses.push('date >= ?');
      params.push(opts.from);
    }
    if (opts.to) {
      clauses.push('date <= ?');
      params.push(opts.to);
    }
    if (opts.status) {
      clauses.push('status = ?');
      params.push(opts.status);
    }
    const rows = await this.db.all<PeriodInstanceRow>(
      `SELECT * FROM period_instances
       WHERE ${clauses.join(' AND ')}
       ORDER BY date ASC, period_index ASC`,
      params,
    );
    return rows.map(mapPeriodInstance);
  }

  async insertPeriodInstance(p: PeriodInstance): Promise<PeriodInstance> {
    await this.db.run(
      `INSERT INTO period_instances (
         id, tenant_id, section_id, date, period_index, allocation_id,
         status, lost_reason, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.tenantId,
        p.sectionId,
        p.date,
        p.periodIndex,
        p.allocationId,
        p.status,
        p.lostReason,
        p.source,
      ],
    );
    const created = await this.getPeriodInstance(p.tenantId, p.id);
    if (!created) throw new Error('Failed to read inserted period instance');
    return created;
  }

  async updatePeriodInstance(
    tenantId: string,
    id: string,
    next: PeriodInstance,
  ): Promise<PeriodInstance | null> {
    await this.db.run(
      `UPDATE period_instances SET
         allocation_id = ?, status = ?, lost_reason = ?, source = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.allocationId, next.status, next.lostReason, next.source, tenantId, id],
    );
    return this.getPeriodInstance(tenantId, id);
  }

  async listPeriodInstancesForTeacherOnDate(
    tenantId: string,
    teacherMemberId: string,
    date: string,
  ): Promise<PeriodInstanceWithMeta[]> {
    const rows = await this.db.all<PeriodInstanceMetaRow>(
      `SELECT pi.*, a.teacher_member_id, a.subject_id, sub.code AS subject_code, sub.label AS subject_label
       FROM period_instances pi
       JOIN allocations a ON a.id = pi.allocation_id AND a.tenant_id = pi.tenant_id
       JOIN subjects sub ON sub.id = a.subject_id AND sub.tenant_id = pi.tenant_id
       WHERE pi.tenant_id = ? AND pi.date = ? AND a.teacher_member_id = ?
       ORDER BY pi.period_index ASC`,
      [tenantId, date, teacherMemberId],
    );
    return rows.map(mapPeriodInstanceMeta);
  }

  async findPeriodInstanceAt(
    tenantId: string,
    date: string,
    periodIndex: number,
    teacherMemberId: string,
  ): Promise<PeriodInstance | null> {
    const row = await this.db.get<PeriodInstanceRow>(
      `SELECT pi.*
       FROM period_instances pi
       JOIN allocations a ON a.id = pi.allocation_id AND a.tenant_id = pi.tenant_id
       WHERE pi.tenant_id = ? AND pi.date = ? AND pi.period_index = ?
         AND a.teacher_member_id = ? AND pi.status != 'lost'`,
      [tenantId, date, periodIndex, teacherMemberId],
    );
    return row ? mapPeriodInstance(row) : null;
  }

  async insertTeacherAbsence(a: TeacherAbsence): Promise<TeacherAbsence> {
    await this.db.run(
      `INSERT INTO teacher_absences (
         id, tenant_id, teacher_member_id, date, period_indexes_json, reason
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.tenantId,
        a.teacherMemberId,
        a.date,
        a.periodIndexes == null ? null : JSON.stringify(a.periodIndexes),
        a.reason,
      ],
    );
    const created = await this.getTeacherAbsence(a.tenantId, a.id);
    if (!created) throw new Error('Failed to read inserted absence');
    return created;
  }

  async getTeacherAbsence(tenantId: string, id: string): Promise<TeacherAbsence | null> {
    const row = await this.db.get<TeacherAbsenceRow>(
      'SELECT * FROM teacher_absences WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapTeacherAbsence(row) : null;
  }

  async insertCoverAssignment(c: CoverAssignment): Promise<CoverAssignment> {
    await this.db.run(
      `INSERT INTO cover_assignments (
         id, tenant_id, absence_id, period_instance_id, cover_teacher_member_id,
         state, offered_at, responded_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.tenantId,
        c.absenceId,
        c.periodInstanceId,
        c.coverTeacherMemberId,
        c.state,
        c.offeredAt,
        c.respondedAt,
        c.notes,
      ],
    );
    const created = await this.getCoverAssignment(c.tenantId, c.id);
    if (!created) throw new Error('Failed to read inserted cover assignment');
    return created;
  }

  async getCoverAssignment(tenantId: string, id: string): Promise<CoverAssignment | null> {
    const row = await this.db.get<CoverAssignmentRow>(
      'SELECT * FROM cover_assignments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapCoverAssignment(row) : null;
  }

  async updateCoverAssignment(
    tenantId: string,
    id: string,
    next: CoverAssignment,
  ): Promise<CoverAssignment | null> {
    await this.db.run(
      `UPDATE cover_assignments SET
         cover_teacher_member_id = ?, state = ?, offered_at = ?, responded_at = ?,
         notes = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.coverTeacherMemberId,
        next.state,
        next.offeredAt,
        next.respondedAt,
        next.notes,
        tenantId,
        id,
      ],
    );
    return this.getCoverAssignment(tenantId, id);
  }

  async listCoverAssignments(
    tenantId: string,
    opts: { date?: string; state?: string } = {},
  ): Promise<CoverAssignment[]> {
    const clauses = ['c.tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (opts.state) {
      clauses.push('c.state = ?');
      params.push(opts.state);
    }
    if (opts.date) {
      clauses.push('pi.date = ?');
      params.push(opts.date);
    }
    const rows = await this.db.all<CoverAssignmentRow>(
      `SELECT c.*
       FROM cover_assignments c
       JOIN period_instances pi ON pi.id = c.period_instance_id AND pi.tenant_id = c.tenant_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY pi.date ASC, pi.period_index ASC`,
      params,
    );
    return rows.map(mapCoverAssignment);
  }

  async findAcceptedCoverAt(
    tenantId: string,
    date: string,
    periodIndex: number,
    coverTeacherMemberId: string,
  ): Promise<CoverAssignment | null> {
    const row = await this.db.get<CoverAssignmentRow>(
      `SELECT c.*
       FROM cover_assignments c
       JOIN period_instances pi ON pi.id = c.period_instance_id AND pi.tenant_id = c.tenant_id
       WHERE c.tenant_id = ? AND c.state = 'accepted'
         AND c.cover_teacher_member_id = ?
         AND pi.date = ? AND pi.period_index = ?`,
      [tenantId, coverTeacherMemberId, date, periodIndex],
    );
    return row ? mapCoverAssignment(row) : null;
  }

  async coverFairness(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<CoverFairnessRow[]> {
    const rows = await this.db.all<{ cover_teacher_member_id: string; c: number }>(
      `SELECT c.cover_teacher_member_id, COUNT(*) as c
       FROM cover_assignments c
       JOIN period_instances pi ON pi.id = c.period_instance_id AND pi.tenant_id = c.tenant_id
       WHERE c.tenant_id = ? AND c.state = 'accepted'
         AND c.cover_teacher_member_id IS NOT NULL
         AND pi.date >= ? AND pi.date <= ?
       GROUP BY c.cover_teacher_member_id
       ORDER BY c DESC, c.cover_teacher_member_id ASC`,
      [tenantId, from, to],
    );
    return rows.map((r) => ({
      teacherMemberId: r.cover_teacher_member_id,
      acceptedCount: Number(r.c),
    }));
  }
}

interface PeriodInstanceMetaRow extends PeriodInstanceRow {
  teacher_member_id: string;
  subject_id: string;
  subject_code: string;
  subject_label: string;
}

function mapPeriodInstanceMeta(row: PeriodInstanceMetaRow): PeriodInstanceWithMeta {
  return {
    ...mapPeriodInstance(row),
    teacherMemberId: row.teacher_member_id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectLabel: row.subject_label,
  };
}

interface TeacherAbsenceRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  teacher_member_id: string;
  date: string;
  period_indexes_json: string | null;
  reason: string;
  created_at: string;
}

function mapTeacherAbsence(row: TeacherAbsenceRow): TeacherAbsence {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    teacherMemberId: row.teacher_member_id,
    date: row.date,
    periodIndexes:
      row.period_indexes_json == null || row.period_indexes_json === ''
        ? null
        : (JSON.parse(row.period_indexes_json) as number[]),
    reason: row.reason,
    createdAt: row.created_at,
  };
}

interface CoverAssignmentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  absence_id: string;
  period_instance_id: string;
  cover_teacher_member_id: string | null;
  state: string;
  offered_at: string | null;
  responded_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapCoverAssignment(row: CoverAssignmentRow): CoverAssignment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    absenceId: row.absence_id,
    periodInstanceId: row.period_instance_id,
    coverTeacherMemberId: row.cover_teacher_member_id,
    state: row.state as CoverState,
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PeriodInstanceRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  section_id: string;
  date: string;
  period_index: number;
  allocation_id: string;
  status: string;
  lost_reason: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

function mapPeriodInstance(row: PeriodInstanceRow): PeriodInstance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sectionId: row.section_id,
    date: row.date,
    periodIndex: row.period_index,
    allocationId: row.allocation_id,
    status: row.status as PeriodInstanceStatus,
    lostReason: row.lost_reason as PeriodLostReason | null,
    source: row.source as PeriodInstanceSource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SlotRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  section_id: string;
  day_ref: string;
  period_index: number;
  allocation_id: string;
  created_at: string;
}

interface SlotGridRow extends SlotRow {
  subject_id: string;
  teacher_member_id: string;
  subject_code: string;
  subject_label: string;
}

interface SlotClashRow extends SlotRow {
  teacher_member_id: string;
}

function mapSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sectionId: row.section_id,
    dayRef: row.day_ref,
    periodIndex: row.period_index,
    allocationId: row.allocation_id,
    createdAt: row.created_at,
  };
}

function mapSlotGrid(row: SlotGridRow): SlotGridEntry {
  return {
    ...mapSlot(row),
    subjectId: row.subject_id,
    teacherMemberId: row.teacher_member_id,
    subjectCode: row.subject_code,
    subjectLabel: row.subject_label,
  };
}

interface SectionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  academic_session_id: string;
  class_label: string;
  section: string;
  day_scheme_id: string;
  class_teacher_member_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SubjectRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  is_elective: number;
  created_at: string;
  updated_at: string;
}

interface AllocationRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  section_id: string;
  subject_id: string;
  teacher_member_id: string;
  periods_per_week: number;
  room: string | null;
  created_at: string;
  updated_at: string;
}

function mapSection(row: SectionRow): Section {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicSessionId: row.academic_session_id,
    classLabel: row.class_label,
    section: row.section,
    daySchemeId: row.day_scheme_id,
    classTeacherMemberId: row.class_teacher_member_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    isElective: row.is_elective === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAllocation(row: AllocationRow): Allocation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sectionId: row.section_id,
    subjectId: row.subject_id,
    teacherMemberId: row.teacher_member_id,
    periodsPerWeek: row.periods_per_week,
    room: row.room,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

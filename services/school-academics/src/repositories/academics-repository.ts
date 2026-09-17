import type { SchoolAcademicsDb } from '../db';
import { currentAcademicsDb } from '../db-context';
import type {
  Course,
  CourseBoard,
  CrosswalkRelation,
  LearningOutcome,
  LessonBody,
  LessonKind,
  LessonPlan,
  LessonProvenance,
  LessonState,
  ListLessonsFilters,
  ListOutcomesFilters,
  OutcomeCrosswalk,
  OutcomeFramework,
  Topic,
  TopicDelivery,
  DeliverySource,
  Unit,
  UnitOutcomeDepth,
  UnitOutcomeField,
  UnitOutcomeTag,
  Assignment,
  Submission,
  SubmissionState,
} from '../types';

interface OutcomeRow extends Record<string, unknown> {
  id: string;
  tenant_id: string | null;
  code: string;
  class_label: string;
  subject_code: string;
  description: string;
  framework: string;
  created_at: string;
}

function mapOutcome(row: OutcomeRow): LearningOutcome {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    classLabel: row.class_label,
    subjectCode: row.subject_code,
    description: row.description,
    framework: row.framework as OutcomeFramework,
    createdAt: row.created_at,
  };
}

interface CrosswalkRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  from_outcome_id: string;
  to_outcome_id: string;
  relation: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function mapCrosswalk(row: CrosswalkRow): OutcomeCrosswalk {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fromOutcomeId: row.from_outcome_id,
    toOutcomeId: row.to_outcome_id,
    relation: row.relation as CrosswalkRelation,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AcademicsRepository {
  constructor(private readonly fallbackDb: SchoolAcademicsDb) {}

  private get db(): SchoolAcademicsDb {
    return currentAcademicsDb(this.fallbackDb);
  }

  async listOutcomes(
    tenantId: string,
    filters: ListOutcomesFilters,
  ): Promise<LearningOutcome[]> {
    const clauses = ['(tenant_id IS NULL OR tenant_id = ?)'];
    const params: unknown[] = [tenantId];
    if (filters.classLabel) {
      clauses.push('class_label = ?');
      params.push(filters.classLabel);
    }
    if (filters.subjectCode) {
      clauses.push('subject_code = ?');
      params.push(filters.subjectCode);
    }
    if (filters.framework) {
      clauses.push('framework = ?');
      params.push(filters.framework);
    }
    if (filters.q) {
      clauses.push('(code LIKE ? OR description LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like);
    }
    const rows = await this.db.all<OutcomeRow>(
      `SELECT * FROM learning_outcomes
       WHERE ${clauses.join(' AND ')}
       ORDER BY class_label ASC, subject_code ASC, code ASC`,
      params,
    );
    return rows.map(mapOutcome);
  }

  async getOutcome(id: string, tenantId?: string | null): Promise<LearningOutcome | null> {
    if (tenantId === undefined) {
      const row = await this.db.get<OutcomeRow>(
        'SELECT * FROM learning_outcomes WHERE id = ?',
        [id],
      );
      return row ? mapOutcome(row) : null;
    }
    if (tenantId === null) {
      const row = await this.db.get<OutcomeRow>(
        'SELECT * FROM learning_outcomes WHERE id = ? AND tenant_id IS NULL',
        [id],
      );
      return row ? mapOutcome(row) : null;
    }
    const row = await this.db.get<OutcomeRow>(
      'SELECT * FROM learning_outcomes WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)',
      [id, tenantId],
    );
    return row ? mapOutcome(row) : null;
  }

  async findOutcomeByScopeCode(
    tenantId: string | null,
    code: string,
  ): Promise<LearningOutcome | null> {
    if (tenantId == null) {
      const row = await this.db.get<OutcomeRow>(
        `SELECT * FROM learning_outcomes WHERE tenant_id IS NULL AND code = ?`,
        [code],
      );
      return row ? mapOutcome(row) : null;
    }
    const row = await this.db.get<OutcomeRow>(
      `SELECT * FROM learning_outcomes WHERE tenant_id = ? AND code = ?`,
      [tenantId, code],
    );
    return row ? mapOutcome(row) : null;
  }

  async insertOutcome(o: LearningOutcome): Promise<LearningOutcome> {
    await this.db.run(
      `INSERT INTO learning_outcomes (
         id, tenant_id, code, class_label, subject_code, description, framework
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        o.id,
        o.tenantId,
        o.code,
        o.classLabel,
        o.subjectCode,
        o.description,
        o.framework,
      ],
    );
    const created = await this.getOutcome(o.id);
    if (!created) throw new Error('Failed to read inserted outcome');
    return created;
  }

  async listCrosswalk(tenantId: string): Promise<OutcomeCrosswalk[]> {
    const rows = await this.db.all<CrosswalkRow>(
      `SELECT * FROM outcome_crosswalk WHERE tenant_id = ? ORDER BY created_at ASC`,
      [tenantId],
    );
    return rows.map(mapCrosswalk);
  }

  async getCrosswalk(tenantId: string, id: string): Promise<OutcomeCrosswalk | null> {
    const row = await this.db.get<CrosswalkRow>(
      'SELECT * FROM outcome_crosswalk WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapCrosswalk(row) : null;
  }

  async insertCrosswalk(c: OutcomeCrosswalk): Promise<OutcomeCrosswalk> {
    await this.db.run(
      `INSERT INTO outcome_crosswalk (
         id, tenant_id, from_outcome_id, to_outcome_id, relation, note
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.tenantId, c.fromOutcomeId, c.toOutcomeId, c.relation, c.note],
    );
    const created = await this.getCrosswalk(c.tenantId, c.id);
    if (!created) throw new Error('Failed to read inserted crosswalk');
    return created;
  }

  async updateCrosswalk(
    tenantId: string,
    id: string,
    next: OutcomeCrosswalk,
  ): Promise<OutcomeCrosswalk | null> {
    await this.db.run(
      `UPDATE outcome_crosswalk SET
         relation = ?, note = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.relation, next.note, tenantId, id],
    );
    return this.getCrosswalk(tenantId, id);
  }

  async deleteCrosswalk(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getCrosswalk(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM outcome_crosswalk WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async listCourses(tenantId: string): Promise<Course[]> {
    const rows = await this.db.all<CourseRow>(
      `SELECT * FROM courses WHERE tenant_id = ? ORDER BY class_label ASC, label ASC`,
      [tenantId],
    );
    return rows.map(mapCourse);
  }

  async getCourse(tenantId: string, id: string): Promise<Course | null> {
    const row = await this.db.get<CourseRow>(
      'SELECT * FROM courses WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapCourse(row) : null;
  }

  async insertCourse(c: Course): Promise<Course> {
    await this.db.run(
      `INSERT INTO courses (
         id, tenant_id, academic_session_id, board, subject_code, class_label, label
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.tenantId,
        c.academicSessionId,
        c.board,
        c.subjectCode,
        c.classLabel,
        c.label,
      ],
    );
    const created = await this.getCourse(c.tenantId, c.id);
    if (!created) throw new Error('Failed to read inserted course');
    return created;
  }

  async updateCourse(tenantId: string, id: string, next: Course): Promise<Course | null> {
    await this.db.run(
      `UPDATE courses SET
         academic_session_id = ?, board = ?, subject_code = ?, class_label = ?,
         label = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.academicSessionId,
        next.board,
        next.subjectCode,
        next.classLabel,
        next.label,
        tenantId,
        id,
      ],
    );
    return this.getCourse(tenantId, id);
  }

  async deleteCourse(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getCourse(tenantId, id);
    if (!existing) return false;
    const units = await this.listUnitsForCourse(tenantId, id);
    for (const u of units) {
      await this.deleteUnit(tenantId, u.id);
    }
    await this.db.run('DELETE FROM courses WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listUnitsForCourse(tenantId: string, courseId: string): Promise<Unit[]> {
    const rows = await this.db.all<UnitRow>(
      `SELECT * FROM units
       WHERE tenant_id = ? AND course_id = ?
       ORDER BY sequence ASC`,
      [tenantId, courseId],
    );
    return rows.map(mapUnit);
  }

  async getUnit(tenantId: string, id: string): Promise<Unit | null> {
    const row = await this.db.get<UnitRow>(
      'SELECT * FROM units WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapUnit(row) : null;
  }

  async maxUnitSequence(tenantId: string, courseId: string): Promise<number> {
    const row = await this.db.get<{ m: number | null }>(
      `SELECT MAX(sequence) as m FROM units WHERE tenant_id = ? AND course_id = ?`,
      [tenantId, courseId],
    );
    return Number(row?.m ?? 0);
  }

  async insertUnit(u: Unit): Promise<Unit> {
    await this.db.run(
      `INSERT INTO units (
         id, tenant_id, course_id, sequence, label, planned_weeks,
         planned_start_week, summary
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.id,
        u.tenantId,
        u.courseId,
        u.sequence,
        u.label,
        u.plannedWeeks,
        u.plannedStartWeek,
        u.summary,
      ],
    );
    const created = await this.getUnit(u.tenantId, u.id);
    if (!created) throw new Error('Failed to read inserted unit');
    return created;
  }

  async updateUnit(tenantId: string, id: string, next: Unit): Promise<Unit | null> {
    await this.db.run(
      `UPDATE units SET
         sequence = ?, label = ?, planned_weeks = ?, planned_start_week = ?,
         summary = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.sequence,
        next.label,
        next.plannedWeeks,
        next.plannedStartWeek,
        next.summary,
        tenantId,
        id,
      ],
    );
    return this.getUnit(tenantId, id);
  }

  async deleteUnit(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getUnit(tenantId, id);
    if (!existing) return false;
    const topics = await this.listTopicsForUnit(tenantId, id);
    for (const t of topics) {
      await this.deleteTopic(tenantId, t.id);
    }
    await this.db.run('DELETE FROM unit_outcomes WHERE tenant_id = ? AND unit_id = ?', [
      tenantId,
      id,
    ]);
    await this.db.run('DELETE FROM units WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listTopicsForUnit(tenantId: string, unitId: string): Promise<Topic[]> {
    const rows = await this.db.all<TopicRow>(
      `SELECT * FROM topics
       WHERE tenant_id = ? AND unit_id = ?
       ORDER BY sequence ASC`,
      [tenantId, unitId],
    );
    return rows.map(mapTopic);
  }

  async getTopic(tenantId: string, id: string): Promise<Topic | null> {
    const row = await this.db.get<TopicRow>(
      'SELECT * FROM topics WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapTopic(row) : null;
  }

  async maxTopicSequence(tenantId: string, unitId: string): Promise<number> {
    const row = await this.db.get<{ m: number | null }>(
      `SELECT MAX(sequence) as m FROM topics WHERE tenant_id = ? AND unit_id = ?`,
      [tenantId, unitId],
    );
    return Number(row?.m ?? 0);
  }

  async insertTopic(t: Topic): Promise<Topic> {
    await this.db.run(
      `INSERT INTO topics (
         id, tenant_id, unit_id, sequence, label, estimated_periods
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [t.id, t.tenantId, t.unitId, t.sequence, t.label, t.estimatedPeriods],
    );
    const created = await this.getTopic(t.tenantId, t.id);
    if (!created) throw new Error('Failed to read inserted topic');
    return created;
  }

  async updateTopic(tenantId: string, id: string, next: Topic): Promise<Topic | null> {
    await this.db.run(
      `UPDATE topics SET
         sequence = ?, label = ?, estimated_periods = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.sequence, next.label, next.estimatedPeriods, tenantId, id],
    );
    return this.getTopic(tenantId, id);
  }

  async deleteTopic(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getTopic(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM topics WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async listUnitOutcomes(tenantId: string, unitId: string): Promise<UnitOutcomeTag[]> {
    const rows = await this.db.all<UnitOutcomeRow>(
      `SELECT * FROM unit_outcomes WHERE tenant_id = ? AND unit_id = ?`,
      [tenantId, unitId],
    );
    return rows.map(mapUnitOutcome);
  }

  async getUnitOutcome(
    tenantId: string,
    unitId: string,
    outcomeId: string,
    field: UnitOutcomeField,
  ): Promise<UnitOutcomeTag | null> {
    const row = await this.db.get<UnitOutcomeRow>(
      `SELECT * FROM unit_outcomes
       WHERE tenant_id = ? AND unit_id = ? AND outcome_id = ? AND field = ?`,
      [tenantId, unitId, outcomeId, field],
    );
    return row ? mapUnitOutcome(row) : null;
  }

  async insertUnitOutcome(t: UnitOutcomeTag): Promise<UnitOutcomeTag> {
    await this.db.run(
      `INSERT INTO unit_outcomes (unit_id, outcome_id, tenant_id, field, depth)
       VALUES (?, ?, ?, ?, ?)`,
      [t.unitId, t.outcomeId, t.tenantId, t.field, t.depth],
    );
    const created = await this.getUnitOutcome(t.tenantId, t.unitId, t.outcomeId, t.field);
    if (!created) throw new Error('Failed to read inserted unit outcome');
    return created;
  }

  async deleteUnitOutcome(
    tenantId: string,
    unitId: string,
    outcomeId: string,
    field: UnitOutcomeField,
  ): Promise<boolean> {
    const existing = await this.getUnitOutcome(tenantId, unitId, outcomeId, field);
    if (!existing) return false;
    await this.db.run(
      `DELETE FROM unit_outcomes
       WHERE tenant_id = ? AND unit_id = ? AND outcome_id = ? AND field = ?`,
      [tenantId, unitId, outcomeId, field],
    );
    return true;
  }

  async listLessonOutcomes(tenantId: string, lessonPlanId: string): Promise<string[]> {
    const rows = await this.db.all<{ outcome_id: string }>(
      `SELECT outcome_id FROM lesson_outcomes
       WHERE tenant_id = ? AND lesson_plan_id = ?
       ORDER BY outcome_id ASC`,
      [tenantId, lessonPlanId],
    );
    return rows.map((r) => r.outcome_id);
  }

  async replaceLessonOutcomes(
    tenantId: string,
    lessonPlanId: string,
    outcomeIds: string[],
  ): Promise<void> {
    await this.db.run(
      'DELETE FROM lesson_outcomes WHERE tenant_id = ? AND lesson_plan_id = ?',
      [tenantId, lessonPlanId],
    );
    for (const outcomeId of outcomeIds) {
      await this.db.run(
        `INSERT INTO lesson_outcomes (lesson_plan_id, outcome_id, tenant_id)
         VALUES (?, ?, ?)`,
        [lessonPlanId, outcomeId, tenantId],
      );
    }
  }

  async getLessonPlan(tenantId: string, id: string): Promise<LessonPlan | null> {
    const row = await this.db.get<LessonRow>(
      'SELECT * FROM lesson_plans WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    if (!row) return null;
    const outcomeIds = await this.listLessonOutcomes(tenantId, id);
    return mapLesson(row, outcomeIds);
  }

  async insertLessonPlan(l: LessonPlan): Promise<LessonPlan> {
    await this.db.run(
      `INSERT INTO lesson_plans (
         id, tenant_id, course_id, unit_id, topic_id, teacher_member_id, week_start,
         title, body_json, kind, state, reviewed_by, review_note, provenance
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        l.id,
        l.tenantId,
        l.courseId,
        l.unitId,
        l.topicId,
        l.teacherMemberId,
        l.weekStart,
        l.title,
        JSON.stringify(l.body ?? {}),
        l.kind,
        l.state,
        l.reviewedBy,
        l.reviewNote,
        l.provenance,
      ],
    );
    await this.replaceLessonOutcomes(l.tenantId, l.id, l.outcomeIds);
    const created = await this.getLessonPlan(l.tenantId, l.id);
    if (!created) throw new Error('Failed to read inserted lesson');
    return created;
  }

  async updateLessonPlan(tenantId: string, id: string, next: LessonPlan): Promise<LessonPlan | null> {
    await this.db.run(
      `UPDATE lesson_plans SET
         course_id = ?, unit_id = ?, topic_id = ?, teacher_member_id = ?, week_start = ?,
         title = ?, body_json = ?, kind = ?, state = ?, reviewed_by = ?, review_note = ?,
         provenance = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.courseId,
        next.unitId,
        next.topicId,
        next.teacherMemberId,
        next.weekStart,
        next.title,
        JSON.stringify(next.body ?? {}),
        next.kind,
        next.state,
        next.reviewedBy,
        next.reviewNote,
        next.provenance,
        tenantId,
        id,
      ],
    );
    await this.replaceLessonOutcomes(tenantId, id, next.outcomeIds);
    return this.getLessonPlan(tenantId, id);
  }

  async listLessonPlans(
    tenantId: string,
    filters: ListLessonsFilters,
  ): Promise<LessonPlan[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.teacherMemberId) {
      clauses.push('teacher_member_id = ?');
      params.push(filters.teacherMemberId);
    }
    if (filters.weekStart) {
      clauses.push('week_start = ?');
      params.push(filters.weekStart);
    }
    if (filters.state) {
      clauses.push('state = ?');
      params.push(filters.state);
    }
    if (filters.courseId) {
      clauses.push('course_id = ?');
      params.push(filters.courseId);
    }
    const rows = await this.db.all<LessonRow>(
      `SELECT * FROM lesson_plans
       WHERE ${clauses.join(' AND ')}
       ORDER BY week_start ASC, title ASC, id ASC`,
      params,
    );
    const out: LessonPlan[] = [];
    for (const row of rows) {
      const outcomeIds = await this.listLessonOutcomes(tenantId, row.id);
      out.push(mapLesson(row, outcomeIds));
    }
    return out;
  }

  async listStaleSubmitted(
    tenantId: string,
    olderThanIso: string,
  ): Promise<LessonPlan[]> {
    const rows = await this.db.all<LessonRow>(
      `SELECT * FROM lesson_plans
       WHERE tenant_id = ?
         AND state = 'submitted'
         AND reviewed_by IS NULL
         AND updated_at <= ?
       ORDER BY updated_at ASC`,
      [tenantId, olderThanIso],
    );
    const out: LessonPlan[] = [];
    for (const row of rows) {
      const outcomeIds = await this.listLessonOutcomes(tenantId, row.id);
      out.push(mapLesson(row, outcomeIds));
    }
    return out;
  }

  async getDelivery(tenantId: string, id: string): Promise<TopicDelivery | null> {
    const row = await this.db.get<DeliveryRow>(
      'SELECT * FROM topic_delivery WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapDelivery(row) : null;
  }

  async findDeliveryByTopicPeriod(
    tenantId: string,
    topicId: string,
    periodInstanceId: string,
  ): Promise<TopicDelivery | null> {
    const row = await this.db.get<DeliveryRow>(
      `SELECT * FROM topic_delivery
       WHERE tenant_id = ? AND topic_id = ? AND period_instance_id = ?`,
      [tenantId, topicId, periodInstanceId],
    );
    return row ? mapDelivery(row) : null;
  }

  async insertDelivery(d: TopicDelivery): Promise<TopicDelivery> {
    await this.db.run(
      `INSERT INTO topic_delivery (
         id, tenant_id, topic_id, period_instance_id, section_ref, date,
         teacher_member_id, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id,
        d.tenantId,
        d.topicId,
        d.periodInstanceId,
        d.sectionRef,
        d.date,
        d.teacherMemberId,
        d.source,
      ],
    );
    const created = await this.getDelivery(d.tenantId, d.id);
    if (!created) throw new Error('Failed to read inserted delivery');
    return created;
  }

  async updateDeliverySource(
    tenantId: string,
    id: string,
    source: DeliverySource,
    teacherMemberId: string,
    date: string,
    sectionRef: string,
  ): Promise<TopicDelivery | null> {
    await this.db.run(
      `UPDATE topic_delivery SET
         source = ?, teacher_member_id = ?, date = ?, section_ref = ?
       WHERE tenant_id = ? AND id = ?`,
      [source, teacherMemberId, date, sectionRef, tenantId, id],
    );
    return this.getDelivery(tenantId, id);
  }

  async deleteDelivery(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getDelivery(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM topic_delivery WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async listDeliveriesForTopics(
    tenantId: string,
    topicIds: string[],
    sectionRef: string,
  ): Promise<TopicDelivery[]> {
    if (topicIds.length === 0) return [];
    const placeholders = topicIds.map(() => '?').join(',');
    const rows = await this.db.all<DeliveryRow>(
      `SELECT * FROM topic_delivery
       WHERE tenant_id = ?
         AND section_ref = ?
         AND topic_id IN (${placeholders})
       ORDER BY date ASC, created_at ASC`,
      [tenantId, sectionRef, ...topicIds],
    );
    return rows.map(mapDelivery);
  }

  async countDeliveriesForTopics(tenantId: string, topicIds: string[]): Promise<number> {
    if (topicIds.length === 0) return 0;
    const placeholders = topicIds.map(() => '?').join(',');
    const row = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM topic_delivery
       WHERE tenant_id = ? AND topic_id IN (${placeholders})`,
      [tenantId, ...topicIds],
    );
    return Number(row?.c ?? 0);
  }

  async getAssignment(tenantId: string, id: string): Promise<Assignment | null> {
    const row = await this.db.get<AssignmentRow>(
      'SELECT * FROM assignments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapAssignment(row) : null;
  }

  async listAssignments(tenantId: string, courseId?: string): Promise<Assignment[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (courseId) {
      clauses.push('course_id = ?');
      params.push(courseId);
    }
    const rows = await this.db.all<AssignmentRow>(
      `SELECT * FROM assignments WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(mapAssignment);
  }

  async listAssignmentsBySectionRef(
    tenantId: string,
    sectionRef: string,
  ): Promise<Assignment[]> {
    const rows = await this.db.all<AssignmentRow>(
      `SELECT * FROM assignments
       WHERE tenant_id = ? AND section_ref = ?
       ORDER BY due_at ASC, created_at ASC`,
      [tenantId, sectionRef],
    );
    return rows.map(mapAssignment);
  }

  async insertAssignment(a: Assignment): Promise<Assignment> {
    await this.db.run(
      `INSERT INTO assignments (
         id, tenant_id, course_id, section_ref, topic_id, title, instructions,
         max_points, due_at, assigned_by, attachment_refs_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.tenantId,
        a.courseId,
        a.sectionRef,
        a.topicId,
        a.title,
        a.instructions,
        a.maxPoints,
        a.dueAt,
        a.assignedBy,
        JSON.stringify(a.attachmentRefs),
      ],
    );
    const created = await this.getAssignment(a.tenantId, a.id);
    if (!created) throw new Error('Failed to read inserted assignment');
    return created;
  }

  async getSubmission(tenantId: string, id: string): Promise<Submission | null> {
    const row = await this.db.get<SubmissionRow>(
      'SELECT * FROM submissions WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapSubmission(row) : null;
  }

  async listSubmissionsForAssignment(
    tenantId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    const rows = await this.db.all<SubmissionRow>(
      `SELECT * FROM submissions
       WHERE tenant_id = ? AND assignment_id = ?
       ORDER BY student_id ASC`,
      [tenantId, assignmentId],
    );
    return rows.map(mapSubmission);
  }

  async insertSubmission(s: Submission): Promise<Submission> {
    await this.db.run(
      `INSERT INTO submissions (
         id, tenant_id, assignment_id, student_id, state, late, missing, excused,
         draft_grade, assigned_grade, feedback, attachment_refs_json,
         turned_in_at, returned_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.tenantId,
        s.assignmentId,
        s.studentId,
        s.state,
        s.late ? 1 : 0,
        s.missing ? 1 : 0,
        s.excused ? 1 : 0,
        s.draftGrade,
        s.assignedGrade,
        s.feedback,
        JSON.stringify(s.attachmentRefs),
        s.turnedInAt,
        s.returnedAt,
      ],
    );
    const created = await this.getSubmission(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted submission');
    return created;
  }

  async updateSubmission(tenantId: string, id: string, next: Submission): Promise<Submission | null> {
    await this.db.run(
      `UPDATE submissions SET
         state = ?, late = ?, missing = ?, excused = ?, draft_grade = ?,
         assigned_grade = ?, feedback = ?, attachment_refs_json = ?,
         turned_in_at = ?, returned_at = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.state,
        next.late ? 1 : 0,
        next.missing ? 1 : 0,
        next.excused ? 1 : 0,
        next.draftGrade,
        next.assignedGrade,
        next.feedback,
        JSON.stringify(next.attachmentRefs),
        next.turnedInAt,
        next.returnedAt,
        tenantId,
        id,
      ],
    );
    return this.getSubmission(tenantId, id);
  }

  async findOutcomeByCodeVisible(
    tenantId: string,
    code: string,
  ): Promise<{ id: string; code: string } | null> {
    const row = await this.db.get<{ id: string; code: string }>(
      `SELECT id, code FROM learning_outcomes
       WHERE code = ? AND (tenant_id IS NULL OR tenant_id = ?)
       ORDER BY CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END
       LIMIT 1`,
      [code, tenantId],
    );
    return row ?? null;
  }

  async findCourseByKey(
    tenantId: string,
    academicSessionId: string,
    board: CourseBoard,
    subjectCode: string,
    classLabel: string,
  ): Promise<Course | null> {
    const row = await this.db.get<CourseRow>(
      `SELECT * FROM courses
       WHERE tenant_id = ? AND academic_session_id = ? AND board = ?
         AND subject_code = ? AND class_label = ?
       LIMIT 1`,
      [tenantId, academicSessionId, board, subjectCode, classLabel],
    );
    return row ? mapCourse(row) : null;
  }

  async insertInstalledPack(row: {
    id: string;
    tenantId: string;
    packId: string;
    packStatusAtInstall: string;
    academicSessionId: string;
    courseIdsJson: string;
    installedBy: string;
  }): Promise<InstalledPackRow> {
    await this.db.run(
      `INSERT INTO installed_packs (
         id, tenant_id, pack_id, pack_status_at_install, academic_session_id,
         course_ids_json, installed_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.packId,
        row.packStatusAtInstall,
        row.academicSessionId,
        row.courseIdsJson,
        row.installedBy,
      ],
    );
    const created = await this.getInstalledPack(row.tenantId, row.id);
    if (!created) throw new Error('Failed to read installed pack');
    return created;
  }

  async getInstalledPack(tenantId: string, id: string): Promise<InstalledPackRow | null> {
    const row = await this.db.get<InstalledPackDbRow>(
      'SELECT * FROM installed_packs WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapInstalledPack(row) : null;
  }

  async listInstalledPacks(tenantId: string): Promise<InstalledPackRow[]> {
    const rows = await this.db.all<InstalledPackDbRow>(
      `SELECT * FROM installed_packs WHERE tenant_id = ? ORDER BY installed_at DESC`,
      [tenantId],
    );
    return rows.map(mapInstalledPack);
  }
}

export interface InstalledPackRow {
  id: string;
  tenantId: string;
  packId: string;
  packStatusAtInstall: string;
  academicSessionId: string;
  courseIds: string[];
  installedBy: string;
  installedAt: string;
}

interface InstalledPackDbRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  pack_id: string;
  pack_status_at_install: string;
  academic_session_id: string;
  course_ids_json: string;
  installed_by: string;
  installed_at: string;
}

function mapInstalledPack(row: InstalledPackDbRow): InstalledPackRow {
  let courseIds: string[] = [];
  try {
    const parsed = JSON.parse(row.course_ids_json) as unknown;
    if (Array.isArray(parsed)) courseIds = parsed.map((x) => String(x));
  } catch {
    courseIds = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    packId: row.pack_id,
    packStatusAtInstall: row.pack_status_at_install,
    academicSessionId: row.academic_session_id,
    courseIds,
    installedBy: row.installed_by,
    installedAt: row.installed_at,
  };
}

interface AssignmentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  course_id: string;
  section_ref: string;
  topic_id: string | null;
  title: string;
  instructions: string | null;
  max_points: number | null;
  due_at: string;
  assigned_by: string;
  attachment_refs_json: string;
  created_at: string;
}

function mapAssignment(row: AssignmentRow): Assignment {
  let attachmentRefs: string[] = [];
  try {
    const parsed = JSON.parse(row.attachment_refs_json) as unknown;
    if (Array.isArray(parsed)) attachmentRefs = parsed.map((x) => String(x));
  } catch {
    attachmentRefs = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    sectionRef: row.section_ref,
    topicId: row.topic_id,
    title: row.title,
    instructions: row.instructions,
    maxPoints: row.max_points,
    dueAt: row.due_at,
    assignedBy: row.assigned_by,
    attachmentRefs,
    createdAt: row.created_at,
  };
}

interface SubmissionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  assignment_id: string;
  student_id: string;
  state: string;
  late: number;
  missing: number;
  excused: number;
  draft_grade: number | null;
  assigned_grade: number | null;
  feedback: string | null;
  attachment_refs_json: string;
  turned_in_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSubmission(row: SubmissionRow): Submission {
  let attachmentRefs: string[] = [];
  try {
    const parsed = JSON.parse(row.attachment_refs_json) as unknown;
    if (Array.isArray(parsed)) attachmentRefs = parsed.map((x) => String(x));
  } catch {
    attachmentRefs = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    state: row.state as SubmissionState,
    late: row.late === 1,
    missing: row.missing === 1,
    excused: row.excused === 1,
    draftGrade: row.draft_grade,
    assignedGrade: row.assigned_grade,
    feedback: row.feedback,
    attachmentRefs,
    turnedInAt: row.turned_in_at,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface DeliveryRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  topic_id: string;
  period_instance_id: string;
  section_ref: string;
  date: string;
  teacher_member_id: string;
  source: string;
  created_at: string;
}

function mapDelivery(row: DeliveryRow): TopicDelivery {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    topicId: row.topic_id,
    periodInstanceId: row.period_instance_id,
    sectionRef: row.section_ref,
    date: row.date,
    teacherMemberId: row.teacher_member_id,
    source: row.source as DeliverySource,
    createdAt: row.created_at,
  };
}

interface LessonRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  course_id: string;
  unit_id: string;
  topic_id: string | null;
  teacher_member_id: string;
  week_start: string;
  title: string;
  body_json: string;
  kind: string;
  state: string;
  reviewed_by: string | null;
  review_note: string | null;
  provenance: string;
  created_at: string;
  updated_at: string;
}

function mapLesson(row: LessonRow, outcomeIds: string[]): LessonPlan {
  let body: LessonBody = {};
  try {
    const parsed = JSON.parse(row.body_json) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as LessonBody;
    }
  } catch {
    body = {};
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    unitId: row.unit_id,
    topicId: row.topic_id,
    teacherMemberId: row.teacher_member_id,
    weekStart: row.week_start,
    title: row.title,
    body,
    kind: row.kind as LessonKind,
    state: row.state as LessonState,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    provenance: row.provenance as LessonProvenance,
    outcomeIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CourseRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  academic_session_id: string;
  board: string;
  subject_code: string;
  class_label: string;
  label: string;
  created_at: string;
  updated_at: string;
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicSessionId: row.academic_session_id,
    board: row.board as CourseBoard,
    subjectCode: row.subject_code,
    classLabel: row.class_label,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface UnitRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  course_id: string;
  sequence: number;
  label: string;
  planned_weeks: number;
  planned_start_week: number | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

function mapUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    sequence: row.sequence,
    label: row.label,
    plannedWeeks: row.planned_weeks,
    plannedStartWeek: row.planned_start_week,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface TopicRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  unit_id: string;
  sequence: number;
  label: string;
  estimated_periods: number;
  created_at: string;
  updated_at: string;
}

function mapTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    unitId: row.unit_id,
    sequence: row.sequence,
    label: row.label,
    estimatedPeriods: row.estimated_periods,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface UnitOutcomeRow extends Record<string, unknown> {
  unit_id: string;
  outcome_id: string;
  tenant_id: string;
  field: string;
  depth: string;
  created_at: string;
}

function mapUnitOutcome(row: UnitOutcomeRow): UnitOutcomeTag {
  return {
    unitId: row.unit_id,
    outcomeId: row.outcome_id,
    tenantId: row.tenant_id,
    field: row.field as UnitOutcomeField,
    depth: row.depth as UnitOutcomeDepth,
    createdAt: row.created_at,
  };
}

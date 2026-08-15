import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { AcademicsRepository } from '../repositories/academics-repository';
import type {
  AssertDeliveryInput,
  Assignment,
  AssignmentStats,
  Course,
  CourseBoard,
  CourseCoverage,
  CourseTree,
  CourseTreeUnit,
  CreateAssignmentInput,
  CreateCourseInput,
  CreateCrosswalkInput,
  CreateLessonInput,
  CreateOutcomeInput,
  CreateTopicInput,
  CreateUnitInput,
  CrosswalkRelation,
  InferDeliveryInput,
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
  PatchCourseInput,
  PatchCrosswalkInput,
  PatchLessonInput,
  PatchTopicInput,
  PatchUnitInput,
  ReviewLessonInput,
  Submission,
  SubmissionState,
  SyllabusExportPayload,
  SyllabusImportPayload,
  SyllabusUnitImport,
  TagUnitOutcomeInput,
  Topic,
  TopicDelivery,
  Unit,
  UnitCoverage,
  UnitOutcomeDepth,
  UnitOutcomeField,
  UnitOutcomeTag,
} from '../types';
import {
  computeVariance,
  type VarianceInstanceInput,
  type VarianceReport,
} from './variance';

type ServiceError = { error: string; status: number; errors?: string[] };

const FRAMEWORKS = new Set<OutcomeFramework>(['ncert', 'cbse_cbe', 'custom']);
const RELATIONS = new Set<CrosswalkRelation>(['equivalent', 'partial', 'prerequisite']);
const BOARDS = new Set<CourseBoard>(['cbse', 'icse', 'state', 'ib', 'cambridge']);
const FIELDS = new Set<UnitOutcomeField>(['activity', 'assessment', 'resource']);
const DEPTHS = new Set<UnitOutcomeDepth>(['introduced', 'reinforced', 'mastered']);
const LESSON_KINDS = new Set<LessonKind>(['personal', 'exemplar']);
const LESSON_STATES = new Set<LessonState>([
  'draft',
  'submitted',
  'approved',
  'changes_requested',
]);
const LESSON_PROVENANCE = new Set<LessonProvenance>([
  'human',
  'ai_assisted',
  'ai_generated',
]);
const CUSTOM_PREFIX = 'CUST.';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AcademicsService {
  constructor(
    private readonly repo: AcademicsRepository,
    private readonly events: EventPublisher,
  ) {}

  async listOutcomes(
    tenantId: string,
    filters: ListOutcomesFilters,
  ): Promise<{ outcomes: LearningOutcome[] }> {
    const outcomes = await this.repo.listOutcomes(tenantId, filters);
    return { outcomes };
  }

  async createOutcome(
    tenantId: string,
    input: CreateOutcomeInput,
  ): Promise<{ outcome?: LearningOutcome; error?: ServiceError }> {
    const code = (input.code || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const subjectCode = (input.subjectCode || '').trim();
    const description = (input.description || '').trim();
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!code.startsWith(CUSTOM_PREFIX)) {
      return {
        error: { error: `custom outcome code must start with ${CUSTOM_PREFIX}`, status: 400 },
      };
    }
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    if (!description) return { error: { error: 'description is required', status: 400 } };

    const framework: OutcomeFramework =
      input.framework && FRAMEWORKS.has(input.framework) ? input.framework : 'custom';
    if (framework !== 'custom') {
      return { error: { error: 'tenant outcomes must use framework custom', status: 400 } };
    }

    const dup = await this.repo.findOutcomeByScopeCode(tenantId, code);
    if (dup) return { error: { error: 'code already exists for tenant', status: 409 } };

    const outcome = await this.repo.insertOutcome({
      id: uuidv4(),
      tenantId,
      code,
      classLabel,
      subjectCode,
      description,
      framework: 'custom',
      createdAt: '',
    });

    await this.events.publish({
      type: 'school.outcome.created',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: { outcome_id: outcome.id, code: outcome.code },
    });

    return { outcome };
  }

  async listCrosswalk(
    tenantId: string,
  ): Promise<{ crosswalk: OutcomeCrosswalk[] }> {
    return { crosswalk: await this.repo.listCrosswalk(tenantId) };
  }

  async createCrosswalk(
    tenantId: string,
    input: CreateCrosswalkInput,
  ): Promise<{ crosswalk?: OutcomeCrosswalk; error?: ServiceError }> {
    const fromOutcomeId = (input.fromOutcomeId || '').trim();
    const toOutcomeId = (input.toOutcomeId || '').trim();
    if (!fromOutcomeId || !toOutcomeId) {
      return { error: { error: 'from_outcome_id and to_outcome_id are required', status: 400 } };
    }
    if (fromOutcomeId === toOutcomeId) {
      return { error: { error: 'from and to must differ', status: 400 } };
    }
    if (!RELATIONS.has(input.relation)) {
      return {
        error: { error: 'relation must be equivalent, partial, or prerequisite', status: 400 },
      };
    }
    const from = await this.repo.getOutcome(fromOutcomeId);
    const to = await this.repo.getOutcome(toOutcomeId);
    if (!from || !to) {
      return { error: { error: 'outcome not found', status: 404 } };
    }
    if (!outcomeVisibleToTenant(from, tenantId) || !outcomeVisibleToTenant(to, tenantId)) {
      return { error: { error: 'outcome not found', status: 404 } };
    }

    const crosswalk = await this.repo.insertCrosswalk({
      id: uuidv4(),
      tenantId,
      fromOutcomeId,
      toOutcomeId,
      relation: input.relation,
      note: input.note != null ? String(input.note) : null,
      createdAt: '',
      updatedAt: '',
    });
    return { crosswalk };
  }

  async patchCrosswalk(
    tenantId: string,
    id: string,
    input: PatchCrosswalkInput,
  ): Promise<{ crosswalk?: OutcomeCrosswalk; error?: ServiceError }> {
    const current = await this.repo.getCrosswalk(tenantId, id);
    if (!current) return { error: { error: 'crosswalk not found', status: 404 } };
    let relation = current.relation;
    let note = current.note;
    if (input.relation !== undefined) {
      if (!RELATIONS.has(input.relation)) {
        return {
          error: { error: 'relation must be equivalent, partial, or prerequisite', status: 400 },
        };
      }
      relation = input.relation;
    }
    if (input.note !== undefined) {
      note = input.note == null ? null : String(input.note);
    }
    const crosswalk = await this.repo.updateCrosswalk(tenantId, id, {
      ...current,
      relation,
      note,
    });
    return { crosswalk: crosswalk! };
  }

  async deleteCrosswalk(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteCrosswalk(tenantId, id);
    if (!deleted) return { error: { error: 'crosswalk not found', status: 404 } };
    return { ok: true };
  }

  async listCourses(tenantId: string): Promise<{ courses: Course[] }> {
    return { courses: await this.repo.listCourses(tenantId) };
  }

  async createCourse(
    tenantId: string,
    input: CreateCourseInput,
  ): Promise<{ course?: Course; error?: ServiceError }> {
    const academicSessionId = (input.academicSessionId || '').trim();
    const subjectCode = (input.subjectCode || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const label = (input.label || '').trim();
    if (!academicSessionId) {
      return { error: { error: 'academic_session_id is required', status: 400 } };
    }
    if (!BOARDS.has(input.board)) {
      return {
        error: { error: 'board must be cbse, icse, state, ib, or cambridge', status: 400 },
      };
    }
    if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    const course = await this.repo.insertCourse({
      id: uuidv4(),
      tenantId,
      academicSessionId,
      board: input.board,
      subjectCode,
      classLabel,
      label,
      createdAt: '',
      updatedAt: '',
    });
    return { course };
  }

  async getCourse(
    tenantId: string,
    id: string,
  ): Promise<{ course?: Course; error?: ServiceError }> {
    const course = await this.repo.getCourse(tenantId, id);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    return { course };
  }

  async patchCourse(
    tenantId: string,
    id: string,
    input: PatchCourseInput,
  ): Promise<{ course?: Course; error?: ServiceError }> {
    const current = await this.repo.getCourse(tenantId, id);
    if (!current) return { error: { error: 'course not found', status: 404 } };
    let academicSessionId = current.academicSessionId;
    let board = current.board;
    let subjectCode = current.subjectCode;
    let classLabel = current.classLabel;
    let label = current.label;
    if (input.academicSessionId !== undefined) {
      academicSessionId = String(input.academicSessionId).trim();
      if (!academicSessionId) {
        return { error: { error: 'academic_session_id is required', status: 400 } };
      }
    }
    if (input.board !== undefined) {
      if (!BOARDS.has(input.board)) {
        return {
          error: { error: 'board must be cbse, icse, state, ib, or cambridge', status: 400 },
        };
      }
      board = input.board;
    }
    if (input.subjectCode !== undefined) {
      subjectCode = String(input.subjectCode).trim();
      if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    }
    if (input.classLabel !== undefined) {
      classLabel = String(input.classLabel).trim();
      if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    }
    if (input.label !== undefined) {
      label = String(input.label).trim();
      if (!label) return { error: { error: 'label is required', status: 400 } };
    }
    const course = await this.repo.updateCourse(tenantId, id, {
      ...current,
      academicSessionId,
      board,
      subjectCode,
      classLabel,
      label,
    });
    return { course: course! };
  }

  async deleteCourse(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteCourse(tenantId, id);
    if (!deleted) return { error: { error: 'course not found', status: 404 } };
    return { ok: true };
  }

  async getCourseTree(
    tenantId: string,
    courseId: string,
  ): Promise<{ tree?: CourseTree; error?: ServiceError }> {
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    const units = await this.repo.listUnitsForCourse(tenantId, courseId);
    const treeUnits: CourseTreeUnit[] = [];
    for (const unit of units) {
      const topics = await this.repo.listTopicsForUnit(tenantId, unit.id);
      const outcomes = await this.repo.listUnitOutcomes(tenantId, unit.id);
      treeUnits.push({ ...unit, topics, outcomes });
    }
    return { tree: { ...course, units: treeUnits } };
  }

  async createUnit(
    tenantId: string,
    courseId: string,
    input: CreateUnitInput,
  ): Promise<{ unit?: Unit; error?: ServiceError }> {
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    const label = (input.label || '').trim();
    const plannedWeeks = Number(input.plannedWeeks);
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!Number.isFinite(plannedWeeks) || plannedWeeks <= 0) {
      return { error: { error: 'planned_weeks must be a positive number', status: 400 } };
    }
    let sequence =
      input.sequence !== undefined
        ? Number(input.sequence)
        : (await this.repo.maxUnitSequence(tenantId, courseId)) + 1;
    if (!Number.isInteger(sequence) || sequence < 1) {
      return { error: { error: 'sequence must be a positive integer', status: 400 } };
    }
    const plannedStartWeek =
      input.plannedStartWeek === undefined || input.plannedStartWeek === null
        ? null
        : Number(input.plannedStartWeek);
    if (plannedStartWeek != null && (!Number.isInteger(plannedStartWeek) || plannedStartWeek < 1)) {
      return { error: { error: 'planned_start_week must be a positive integer', status: 400 } };
    }
    const unit = await this.repo.insertUnit({
      id: uuidv4(),
      tenantId,
      courseId,
      sequence,
      label,
      plannedWeeks,
      plannedStartWeek,
      summary: input.summary != null ? String(input.summary) : null,
      createdAt: '',
      updatedAt: '',
    });
    return { unit };
  }

  async patchUnit(
    tenantId: string,
    unitId: string,
    input: PatchUnitInput,
  ): Promise<{ unit?: Unit; error?: ServiceError }> {
    const current = await this.repo.getUnit(tenantId, unitId);
    if (!current) return { error: { error: 'unit not found', status: 404 } };
    let label = current.label;
    let plannedWeeks = current.plannedWeeks;
    let plannedStartWeek = current.plannedStartWeek;
    let summary = current.summary;
    if (input.label !== undefined) {
      label = String(input.label).trim();
      if (!label) return { error: { error: 'label is required', status: 400 } };
    }
    if (input.plannedWeeks !== undefined) {
      plannedWeeks = Number(input.plannedWeeks);
      if (!Number.isFinite(plannedWeeks) || plannedWeeks <= 0) {
        return { error: { error: 'planned_weeks must be a positive number', status: 400 } };
      }
    }
    if (input.plannedStartWeek !== undefined) {
      if (input.plannedStartWeek === null) {
        plannedStartWeek = null;
      } else {
        plannedStartWeek = Number(input.plannedStartWeek);
        if (!Number.isInteger(plannedStartWeek) || plannedStartWeek < 1) {
          return {
            error: { error: 'planned_start_week must be a positive integer', status: 400 },
          };
        }
      }
    }
    if (input.summary !== undefined) {
      summary = input.summary == null ? null : String(input.summary);
    }
    const unit = await this.repo.updateUnit(tenantId, unitId, {
      ...current,
      label,
      plannedWeeks,
      plannedStartWeek,
      summary,
    });
    return { unit: unit! };
  }

  async deleteUnit(
    tenantId: string,
    unitId: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteUnit(tenantId, unitId);
    if (!deleted) return { error: { error: 'unit not found', status: 404 } };
    return { ok: true };
  }

  async reorderUnits(
    tenantId: string,
    courseId: string,
    orderedIds: string[],
  ): Promise<{ units?: Unit[]; error?: ServiceError }> {
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    const existing = await this.repo.listUnitsForCourse(tenantId, courseId);
    if (orderedIds.length !== existing.length) {
      return { error: { error: 'ordered_ids must include every unit exactly once', status: 400 } };
    }
    const byId = new Map(existing.map((u) => [u.id, u]));
    for (const id of orderedIds) {
      if (!byId.has(id)) {
        return { error: { error: 'ordered_ids contains unknown unit', status: 400 } };
      }
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      return { error: { error: 'ordered_ids must be unique', status: 400 } };
    }
    // Two-pass to avoid unique sequence conflicts
    for (let i = 0; i < orderedIds.length; i++) {
      const u = byId.get(orderedIds[i])!;
      await this.repo.updateUnit(tenantId, u.id, { ...u, sequence: -(i + 1) });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const u = byId.get(orderedIds[i])!;
      await this.repo.updateUnit(tenantId, u.id, { ...u, sequence: i + 1 });
    }
    return { units: await this.repo.listUnitsForCourse(tenantId, courseId) };
  }

  async createTopic(
    tenantId: string,
    unitId: string,
    input: CreateTopicInput,
  ): Promise<{ topic?: Topic; error?: ServiceError }> {
    const unit = await this.repo.getUnit(tenantId, unitId);
    if (!unit) return { error: { error: 'unit not found', status: 404 } };
    const label = (input.label || '').trim();
    if (!label) return { error: { error: 'label is required', status: 400 } };
    const estimatedPeriods =
      input.estimatedPeriods === undefined ? 1 : Number(input.estimatedPeriods);
    if (!Number.isInteger(estimatedPeriods) || estimatedPeriods < 1) {
      return { error: { error: 'estimated_periods must be a positive integer', status: 400 } };
    }
    const sequence =
      input.sequence !== undefined
        ? Number(input.sequence)
        : (await this.repo.maxTopicSequence(tenantId, unitId)) + 1;
    if (!Number.isInteger(sequence) || sequence < 1) {
      return { error: { error: 'sequence must be a positive integer', status: 400 } };
    }
    const topic = await this.repo.insertTopic({
      id: uuidv4(),
      tenantId,
      unitId,
      sequence,
      label,
      estimatedPeriods,
      createdAt: '',
      updatedAt: '',
    });
    return { topic };
  }

  async patchTopic(
    tenantId: string,
    topicId: string,
    input: PatchTopicInput,
  ): Promise<{ topic?: Topic; error?: ServiceError }> {
    const current = await this.repo.getTopic(tenantId, topicId);
    if (!current) return { error: { error: 'topic not found', status: 404 } };
    let label = current.label;
    let estimatedPeriods = current.estimatedPeriods;
    if (input.label !== undefined) {
      label = String(input.label).trim();
      if (!label) return { error: { error: 'label is required', status: 400 } };
    }
    if (input.estimatedPeriods !== undefined) {
      estimatedPeriods = Number(input.estimatedPeriods);
      if (!Number.isInteger(estimatedPeriods) || estimatedPeriods < 1) {
        return {
          error: { error: 'estimated_periods must be a positive integer', status: 400 },
        };
      }
    }
    const topic = await this.repo.updateTopic(tenantId, topicId, {
      ...current,
      label,
      estimatedPeriods,
    });
    return { topic: topic! };
  }

  async deleteTopic(
    tenantId: string,
    topicId: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteTopic(tenantId, topicId);
    if (!deleted) return { error: { error: 'topic not found', status: 404 } };
    return { ok: true };
  }

  async tagUnitOutcome(
    tenantId: string,
    unitId: string,
    input: TagUnitOutcomeInput,
  ): Promise<{ tag?: UnitOutcomeTag; error?: ServiceError }> {
    const unit = await this.repo.getUnit(tenantId, unitId);
    if (!unit) return { error: { error: 'unit not found', status: 404 } };
    const outcomeId = (input.outcomeId || '').trim();
    if (!outcomeId) return { error: { error: 'outcome_id is required', status: 400 } };
    if (!FIELDS.has(input.field)) {
      return {
        error: { error: 'field must be activity, assessment, or resource', status: 400 },
      };
    }
    const depth: UnitOutcomeDepth =
      input.depth && DEPTHS.has(input.depth) ? input.depth : 'introduced';
    if (input.depth !== undefined && !DEPTHS.has(input.depth)) {
      return {
        error: { error: 'depth must be introduced, reinforced, or mastered', status: 400 },
      };
    }
    const outcome = await this.repo.getOutcome(outcomeId);
    if (!outcome || !(outcome.tenantId == null || outcome.tenantId === tenantId)) {
      return { error: { error: 'outcome not found', status: 404 } };
    }
    // Assessment requires activity on the same unit for the same outcome.
    if (input.field === 'assessment') {
      const activity = await this.repo.getUnitOutcome(
        tenantId,
        unitId,
        outcomeId,
        'activity',
      );
      if (!activity) {
        return {
          error: {
            error: 'assessment requires activity tag for the same outcome on the unit',
            status: 400,
          },
        };
      }
    }
    const existing = await this.repo.getUnitOutcome(
      tenantId,
      unitId,
      outcomeId,
      input.field,
    );
    if (existing) {
      return { error: { error: 'outcome already tagged for this field', status: 409 } };
    }
    const tag = await this.repo.insertUnitOutcome({
      unitId,
      outcomeId,
      tenantId,
      field: input.field,
      depth,
      createdAt: '',
    });
    return { tag };
  }

  async untagUnitOutcome(
    tenantId: string,
    unitId: string,
    outcomeId: string,
    field: UnitOutcomeField,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    if (!FIELDS.has(field)) {
      return {
        error: { error: 'field must be activity, assessment, or resource', status: 400 },
      };
    }
    // Untagging activity while assessment remains is not allowed.
    if (field === 'activity') {
      const assessment = await this.repo.getUnitOutcome(
        tenantId,
        unitId,
        outcomeId,
        'assessment',
      );
      if (assessment) {
        return {
          error: {
            error: 'cannot remove activity while assessment tag exists',
            status: 400,
          },
        };
      }
    }
    const deleted = await this.repo.deleteUnitOutcome(tenantId, unitId, outcomeId, field);
    if (!deleted) return { error: { error: 'tag not found', status: 404 } };
    return { ok: true };
  }

  async createLesson(
    tenantId: string,
    input: CreateLessonInput,
  ): Promise<{ lesson?: LessonPlan; error?: ServiceError }> {
    const courseId = (input.courseId || '').trim();
    const unitId = (input.unitId || '').trim();
    const teacherMemberId = (input.teacherMemberId || '').trim();
    const weekStart = (input.weekStart || '').trim();
    const title = (input.title || '').trim();
    if (!courseId) return { error: { error: 'course_id is required', status: 400 } };
    if (!unitId) return { error: { error: 'unit_id is required', status: 400 } };
    if (!teacherMemberId) {
      return { error: { error: 'teacher_member_id is required', status: 400 } };
    }
    if (!ISO_DATE.test(weekStart)) {
      return { error: { error: 'week_start must be an ISO date', status: 400 } };
    }
    if (!title) return { error: { error: 'title is required', status: 400 } };

    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    const unit = await this.repo.getUnit(tenantId, unitId);
    if (!unit || unit.courseId !== courseId) {
      return { error: { error: 'unit not found for course', status: 404 } };
    }
    const topicId =
      input.topicId === undefined || input.topicId === null
        ? null
        : String(input.topicId).trim();
    if (topicId) {
      const topic = await this.repo.getTopic(tenantId, topicId);
      if (!topic || topic.unitId !== unitId) {
        return { error: { error: 'topic not found for unit', status: 404 } };
      }
    }
    const kind: LessonKind =
      input.kind && LESSON_KINDS.has(input.kind) ? input.kind : 'personal';
    if (input.kind !== undefined && !LESSON_KINDS.has(input.kind)) {
      return { error: { error: 'kind must be personal or exemplar', status: 400 } };
    }
    const provenance: LessonProvenance =
      input.provenance && LESSON_PROVENANCE.has(input.provenance)
        ? input.provenance
        : 'human';
    if (input.provenance !== undefined && !LESSON_PROVENANCE.has(input.provenance)) {
      return {
        error: { error: 'provenance must be human, ai_assisted, or ai_generated', status: 400 },
      };
    }
    const outcomeIds = await this.validateLessonOutcomes(
      tenantId,
      input.outcomeIds ?? [],
    );
    if ('error' in outcomeIds) return { error: outcomeIds.error };

    const lesson = await this.repo.insertLessonPlan({
      id: uuidv4(),
      tenantId,
      courseId,
      unitId,
      topicId,
      teacherMemberId,
      weekStart,
      title,
      body: normalizeLessonBody(input.body),
      kind,
      state: 'draft',
      reviewedBy: null,
      reviewNote: null,
      provenance,
      outcomeIds: outcomeIds.ids,
      createdAt: '',
      updatedAt: '',
    });
    return { lesson };
  }

  async listLessons(
    tenantId: string,
    filters: ListLessonsFilters,
  ): Promise<{ lessons?: LessonPlan[]; error?: ServiceError }> {
    if (filters.state && !LESSON_STATES.has(filters.state)) {
      return { error: { error: 'invalid state', status: 400 } };
    }
    return { lessons: await this.repo.listLessonPlans(tenantId, filters) };
  }

  async getLesson(
    tenantId: string,
    id: string,
  ): Promise<{ lesson?: LessonPlan; error?: ServiceError }> {
    const lesson = await this.repo.getLessonPlan(tenantId, id);
    if (!lesson) return { error: { error: 'lesson not found', status: 404 } };
    return { lesson };
  }

  async patchLesson(
    tenantId: string,
    id: string,
    input: PatchLessonInput,
  ): Promise<{ lesson?: LessonPlan; error?: ServiceError }> {
    const current = await this.repo.getLessonPlan(tenantId, id);
    if (!current) return { error: { error: 'lesson not found', status: 404 } };
    if (current.state === 'submitted' || current.state === 'approved') {
      return { error: { error: 'lesson is not editable in this state', status: 409 } };
    }
    // draft and changes_requested are editable
    let title = current.title;
    let body = current.body;
    let topicId = current.topicId;
    let kind = current.kind;
    let provenance = current.provenance;
    let outcomeIds = current.outcomeIds;

    if (input.title !== undefined) {
      title = String(input.title).trim();
      if (!title) return { error: { error: 'title is required', status: 400 } };
    }
    if (input.body !== undefined) body = normalizeLessonBody(input.body);
    if (input.topicId !== undefined) {
      if (input.topicId === null) {
        topicId = null;
      } else {
        topicId = String(input.topicId).trim();
        const topic = await this.repo.getTopic(tenantId, topicId);
        if (!topic || topic.unitId !== current.unitId) {
          return { error: { error: 'topic not found for unit', status: 404 } };
        }
      }
    }
    if (input.kind !== undefined) {
      if (!LESSON_KINDS.has(input.kind)) {
        return { error: { error: 'kind must be personal or exemplar', status: 400 } };
      }
      kind = input.kind;
    }
    if (input.provenance !== undefined) {
      if (!LESSON_PROVENANCE.has(input.provenance)) {
        return {
          error: {
            error: 'provenance must be human, ai_assisted, or ai_generated',
            status: 400,
          },
        };
      }
      provenance = input.provenance;
    }
    if (input.outcomeIds !== undefined) {
      const validated = await this.validateLessonOutcomes(tenantId, input.outcomeIds);
      if ('error' in validated) return { error: validated.error };
      outcomeIds = validated.ids;
    }

    const lesson = await this.repo.updateLessonPlan(tenantId, id, {
      ...current,
      title,
      body,
      topicId,
      kind,
      provenance,
      outcomeIds,
      // Editing a changes_requested lesson stays changes_requested until re-submit
      state: current.state,
    });
    return { lesson: lesson! };
  }

  async submitWeek(
    tenantId: string,
    teacherMemberId: string,
    weekStart: string,
  ): Promise<{ lessons?: LessonPlan[]; error?: ServiceError }> {
    const teacher = (teacherMemberId || '').trim();
    const week = (weekStart || '').trim();
    if (!teacher) return { error: { error: 'teacher_member_id is required', status: 400 } };
    if (!ISO_DATE.test(week)) {
      return { error: { error: 'week_start must be an ISO date', status: 400 } };
    }
    const drafts = await this.repo.listLessonPlans(tenantId, {
      teacherMemberId: teacher,
      weekStart: week,
      state: 'draft',
    });
    const toSubmit = drafts;
    const submitted: LessonPlan[] = [];
    for (const lesson of toSubmit) {
      const updated = await this.repo.updateLessonPlan(tenantId, lesson.id, {
        ...lesson,
        state: 'submitted',
        reviewedBy: null,
        reviewNote: null,
      });
      if (updated) submitted.push(updated);
    }

    await this.events.publish({
      type: 'school.lessons.week_submitted',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        teacher_member_id: teacher,
        week_start: week,
        count: submitted.length,
        lesson_ids: submitted.map((l) => l.id),
      },
    });

    return { lessons: submitted };
  }

  async reviewLesson(
    tenantId: string,
    id: string,
    input: ReviewLessonInput,
  ): Promise<{ lesson?: LessonPlan; error?: ServiceError }> {
    const current = await this.repo.getLessonPlan(tenantId, id);
    if (!current) return { error: { error: 'lesson not found', status: 404 } };
    if (current.state !== 'submitted') {
      return { error: { error: 'only submitted lessons can be reviewed', status: 409 } };
    }
    const decidedBy = (input.reviewedBy || '').trim();
    if (!decidedBy) return { error: { error: 'reviewed_by is required', status: 400 } };
    if (input.decision !== 'approved' && input.decision !== 'changes_requested') {
      return {
        error: { error: 'decision must be approved or changes_requested', status: 400 },
      };
    }
    const note =
      input.reviewNote != null ? String(input.reviewNote).trim() : '';
    if (input.decision === 'changes_requested' && !note) {
      return { error: { error: 'review_note is required for changes_requested', status: 400 } };
    }
    const lesson = await this.repo.updateLessonPlan(tenantId, id, {
      ...current,
      state: input.decision,
      reviewedBy: decidedBy,
      reviewNote: note || null,
    });
    return { lesson: lesson! };
  }

  async reviewSample(
    tenantId: string,
    weekStart: string,
    pct: number,
  ): Promise<{ lessons?: LessonPlan[]; error?: ServiceError }> {
    const week = (weekStart || '').trim();
    if (!ISO_DATE.test(week)) {
      return { error: { error: 'week_start must be an ISO date', status: 400 } };
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { error: { error: 'pct must be between 0 and 100', status: 400 } };
    }
    const approved = await this.repo.listLessonPlans(tenantId, {
      weekStart: week,
      state: 'approved',
    });
    const sorted = [...approved].sort((a, b) => a.id.localeCompare(b.id));
    const selected = selectDeterministicSample(sorted, `${tenantId}|${week}`, pct);
    return { lessons: selected };
  }

  async listStaleLessons(
    tenantId: string,
    days: number,
  ): Promise<{ lessons?: LessonPlan[]; error?: ServiceError }> {
    if (!Number.isInteger(days) || days < 1) {
      return { error: { error: 'days must be a positive integer', status: 400 } };
    }
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    // SQLite datetime('now') is UTC-ish without Z — compare using ISO strings that sort.
    const cutoffSqlite = cutoff.slice(0, 19).replace('T', ' ');
    return { lessons: await this.repo.listStaleSubmitted(tenantId, cutoffSqlite) };
  }

  async assertDelivery(
    tenantId: string,
    input: AssertDeliveryInput,
  ): Promise<{ delivery?: TopicDelivery; error?: ServiceError }> {
    const topicId = (input.topicId || '').trim();
    const periodInstanceId = (input.periodInstanceId || '').trim();
    const sectionRef = (input.sectionRef || '').trim();
    const date = (input.date || '').trim();
    const teacherMemberId = (input.teacherMemberId || '').trim();
    if (!topicId) return { error: { error: 'topic_id is required', status: 400 } };
    if (!periodInstanceId) {
      return { error: { error: 'period_instance_id is required', status: 400 } };
    }
    if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be an ISO date', status: 400 } };
    }
    if (!teacherMemberId) {
      return { error: { error: 'teacher_member_id is required', status: 400 } };
    }
    const topic = await this.repo.getTopic(tenantId, topicId);
    if (!topic) return { error: { error: 'topic not found', status: 404 } };

    const existing = await this.repo.findDeliveryByTopicPeriod(
      tenantId,
      topicId,
      periodInstanceId,
    );
    if (existing) {
      if (existing.source === 'asserted') {
        return { error: { error: 'delivery already asserted', status: 409 } };
      }
      // Asserted wins over inferred
      const upgraded = await this.repo.updateDeliverySource(
        tenantId,
        existing.id,
        'asserted',
        teacherMemberId,
        date,
        sectionRef,
      );
      return { delivery: upgraded! };
    }

    const delivery = await this.repo.insertDelivery({
      id: uuidv4(),
      tenantId,
      topicId,
      periodInstanceId,
      sectionRef,
      date,
      teacherMemberId,
      source: 'asserted',
      createdAt: '',
    });
    return { delivery };
  }

  async deleteDelivery(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const existing = await this.repo.getDelivery(tenantId, id);
    if (!existing) return { error: { error: 'delivery not found', status: 404 } };
    const createdMs = Date.parse(normalizeSqliteTimestamp(existing.createdAt));
    if (Number.isNaN(createdMs) || Date.now() - createdMs > 48 * 3600_000) {
      return { error: { error: 'undo window closed', status: 409 } };
    }
    await this.repo.deleteDelivery(tenantId, id);
    return { ok: true };
  }

  async inferDelivery(
    tenantId: string,
    input: InferDeliveryInput,
  ): Promise<{ delivery?: TopicDelivery; created?: boolean; error?: ServiceError }> {
    const topicId = (input.topicId || '').trim();
    const sectionRef = (input.sectionRef || '').trim();
    const date = (input.date || '').trim();
    const ref = (input.ref || '').trim();
    if (input.kind !== 'assessment' && input.kind !== 'resource') {
      return { error: { error: 'kind must be assessment or resource', status: 400 } };
    }
    if (!topicId) return { error: { error: 'topic_id is required', status: 400 } };
    if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be an ISO date', status: 400 } };
    }
    if (!ref) return { error: { error: 'ref is required', status: 400 } };
    const topic = await this.repo.getTopic(tenantId, topicId);
    if (!topic) return { error: { error: 'topic not found', status: 404 } };

    const source =
      input.kind === 'assessment' ? 'inferred_assessment' : 'inferred_resource';
    const existing = await this.repo.findDeliveryByTopicPeriod(tenantId, topicId, ref);
    if (existing) {
      // Asserted always wins — do not downgrade or duplicate
      return { delivery: existing, created: false };
    }

    const delivery = await this.repo.insertDelivery({
      id: uuidv4(),
      tenantId,
      topicId,
      periodInstanceId: ref,
      sectionRef,
      date,
      teacherMemberId: (input.teacherMemberId || '').trim() || 'system:infer',
      source,
      createdAt: '',
    });
    return { delivery, created: true };
  }

  async getCourseCoverage(
    tenantId: string,
    courseId: string,
    sectionRef: string,
  ): Promise<{ coverage?: CourseCoverage; error?: ServiceError }> {
    const section = (sectionRef || '').trim();
    if (!section) return { error: { error: 'section_ref is required', status: 400 } };
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };

    const units = await this.repo.listUnitsForCourse(tenantId, courseId);
    const unitCoverages: UnitCoverage[] = [];

    for (const unit of units) {
      const topics = await this.repo.listTopicsForUnit(tenantId, unit.id);
      const topicIds = topics.map((t) => t.id);
      const deliveries = await this.repo.listDeliveriesForTopics(
        tenantId,
        topicIds,
        section,
      );
      const deliveredTopicIds = new Set(deliveries.map((d) => d.topicId));
      const topicsTotal = topics.length;
      const topicsDelivered = deliveredTopicIds.size;
      const pct =
        topicsTotal === 0 ? 0 : Math.round((topicsDelivered / topicsTotal) * 1000) / 10;
      const dates = deliveries.map((d) => d.date).sort();
      const firstDeliveryDate = dates.length ? dates[0]! : null;
      const lastDeliveryDate = dates.length ? dates[dates.length - 1]! : null;
      const unitDelivered = topicsDelivered > 0;

      const tags = await this.repo.listUnitOutcomes(tenantId, unit.id);
      const byOutcome = new Map<
        string,
        { hasActivity: boolean; hasAssessment: boolean }
      >();
      for (const tag of tags) {
        const cur = byOutcome.get(tag.outcomeId) ?? {
          hasActivity: false,
          hasAssessment: false,
        };
        if (tag.field === 'activity') cur.hasActivity = true;
        if (tag.field === 'assessment') cur.hasAssessment = true;
        byOutcome.set(tag.outcomeId, cur);
      }
      const outcomes = [...byOutcome.entries()].map(([outcomeId, flags]) => ({
        outcomeId,
        coveredActivity: flags.hasActivity && unitDelivered,
        coveredAssessment: flags.hasAssessment && unitDelivered,
      }));

      unitCoverages.push({
        unitId: unit.id,
        label: unit.label,
        topicsTotal,
        topicsDelivered,
        pct,
        firstDeliveryDate,
        lastDeliveryDate,
        outcomes,
      });
    }

    return {
      coverage: {
        courseId,
        sectionRef: section,
        units: unitCoverages,
      },
    };
  }

  async getCourseVariance(
    tenantId: string,
    courseId: string,
    input: {
      sectionRef: string;
      instances: VarianceInstanceInput[];
      targetDate?: string | null;
      asOfDate?: string | null;
    },
  ): Promise<{ report?: VarianceReport; error?: ServiceError }> {
    const sectionRef = (input.sectionRef || '').trim();
    if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    if (input.targetDate != null && input.targetDate !== '') {
      if (!ISO_DATE.test(String(input.targetDate))) {
        return { error: { error: 'target_date must be an ISO date', status: 400 } };
      }
    }
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };

    const units = await this.repo.listUnitsForCourse(tenantId, courseId);
    const allTopics = [];
    for (const u of units) {
      allTopics.push(...(await this.repo.listTopicsForUnit(tenantId, u.id)));
    }
    const topicIds = allTopics.map((t) => t.id);
    const deliveries = await this.repo.listDeliveriesForTopics(
      tenantId,
      topicIds,
      sectionRef,
    );

    const report = computeVariance(
      units.map((u) => ({
        id: u.id,
        label: u.label,
        plannedWeeks: u.plannedWeeks,
        plannedStartWeek: u.plannedStartWeek,
        sequence: u.sequence,
      })),
      allTopics.map((t) => ({
        id: t.id,
        unitId: t.unitId,
        sequence: t.sequence,
      })),
      deliveries.map((d) => ({ topicId: d.topicId, date: d.date })),
      input.instances ?? [],
      {
        targetDate: input.targetDate ?? null,
        asOfDate: input.asOfDate ?? null,
      },
    );
    return { report };
  }

  async createAssignment(
    tenantId: string,
    input: CreateAssignmentInput,
  ): Promise<{
    assignment?: Assignment;
    submissions?: Submission[];
    error?: ServiceError;
  }> {
    const courseId = (input.courseId || '').trim();
    const sectionRef = (input.sectionRef || '').trim();
    const title = (input.title || '').trim();
    const dueAt = (input.dueAt || '').trim();
    const assignedBy = (input.assignedBy || '').trim();
    if (!courseId) return { error: { error: 'course_id is required', status: 400 } };
    if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    if (!title) return { error: { error: 'title is required', status: 400 } };
    if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
      return { error: { error: 'due_at must be a valid ISO timestamp', status: 400 } };
    }
    if (!assignedBy) return { error: { error: 'assigned_by is required', status: 400 } };
    const studentIds = [...new Set((input.studentIds ?? []).map((s) => String(s).trim()).filter(Boolean))];
    if (studentIds.length === 0) {
      return { error: { error: 'student_ids is required', status: 400 } };
    }
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };

    let topicId: string | null = null;
    if (input.topicId != null && String(input.topicId).trim() !== '') {
      topicId = String(input.topicId).trim();
      const topic = await this.repo.getTopic(tenantId, topicId);
      if (!topic) return { error: { error: 'topic not found', status: 404 } };
    }

    let maxPoints: number | null =
      input.maxPoints === undefined || input.maxPoints === null
        ? null
        : Number(input.maxPoints);
    if (maxPoints != null && (!Number.isFinite(maxPoints) || maxPoints < 0)) {
      return { error: { error: 'max_points must be a non-negative number', status: 400 } };
    }
    if (maxPoints === 0) maxPoints = null;

    const assignment = await this.repo.insertAssignment({
      id: uuidv4(),
      tenantId,
      courseId,
      sectionRef,
      topicId,
      title,
      instructions: input.instructions != null ? String(input.instructions) : null,
      maxPoints,
      dueAt,
      assignedBy,
      attachmentRefs: (input.attachmentRefs ?? []).map((x) => String(x)),
      createdAt: '',
    });

    const submissions: Submission[] = [];
    for (const studentId of studentIds) {
      const sub = await this.repo.insertSubmission({
        id: uuidv4(),
        tenantId,
        assignmentId: assignment.id,
        studentId,
        state: 'assigned',
        late: false,
        missing: false,
        excused: false,
        draftGrade: null,
        assignedGrade: null,
        feedback: null,
        attachmentRefs: [],
        turnedInAt: null,
        returnedAt: null,
        createdAt: '',
        updatedAt: '',
      });
      submissions.push(sub);
    }

    if (topicId) {
      const date = dueAt.slice(0, 10);
      await this.inferDelivery(tenantId, {
        kind: 'resource',
        topicId,
        sectionRef,
        date: ISO_DATE.test(date) ? date : new Date().toISOString().slice(0, 10),
        ref: assignment.id,
        teacherMemberId: assignedBy,
      });
    }

    return { assignment, submissions };
  }

  async getAssignment(
    tenantId: string,
    id: string,
  ): Promise<{ assignment?: Assignment; error?: ServiceError }> {
    const assignment = await this.repo.getAssignment(tenantId, id);
    if (!assignment) return { error: { error: 'assignment not found', status: 404 } };
    return { assignment };
  }

  async listSubmissions(
    tenantId: string,
    assignmentId: string,
  ): Promise<{ submissions?: Submission[]; error?: ServiceError }> {
    const assignment = await this.repo.getAssignment(tenantId, assignmentId);
    if (!assignment) return { error: { error: 'assignment not found', status: 404 } };
    return {
      submissions: await this.repo.listSubmissionsForAssignment(tenantId, assignmentId),
    };
  }

  async turnInSubmission(
    tenantId: string,
    id: string,
  ): Promise<{ submission?: Submission; error?: ServiceError }> {
    const current = await this.repo.getSubmission(tenantId, id);
    if (!current) return { error: { error: 'submission not found', status: 404 } };
    if (current.state !== 'assigned' && current.state !== 'reclaimed') {
      return { error: { error: 'submission cannot be turned in from this state', status: 409 } };
    }
    const assignment = await this.repo.getAssignment(tenantId, current.assignmentId);
    if (!assignment) return { error: { error: 'assignment not found', status: 404 } };
    const now = new Date().toISOString();
    const late = Date.parse(now) > Date.parse(assignment.dueAt);
    const submission = await this.repo.updateSubmission(tenantId, id, {
      ...current,
      state: 'turned_in',
      late,
      missing: false,
      turnedInAt: now,
    });
    return { submission: submission! };
  }

  async reclaimSubmission(
    tenantId: string,
    id: string,
  ): Promise<{ submission?: Submission; error?: ServiceError }> {
    const current = await this.repo.getSubmission(tenantId, id);
    if (!current) return { error: { error: 'submission not found', status: 404 } };
    if (current.state !== 'turned_in') {
      return { error: { error: 'only turned_in submissions can be reclaimed', status: 409 } };
    }
    const submission = await this.repo.updateSubmission(tenantId, id, {
      ...current,
      state: 'reclaimed',
      turnedInAt: null,
    });
    return { submission: submission! };
  }

  async gradeSubmission(
    tenantId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<{ submission?: Submission; error?: ServiceError }> {
    if (body.assigned_grade !== undefined || body.assignedGrade !== undefined) {
      return { error: { error: 'setting assigned_grade directly is not allowed', status: 400 } };
    }
    const current = await this.repo.getSubmission(tenantId, id);
    if (!current) return { error: { error: 'submission not found', status: 404 } };
    if (body.draft_grade === undefined && body.draftGrade === undefined) {
      return { error: { error: 'draft_grade is required', status: 400 } };
    }
    const draftGrade = Number(body.draft_grade ?? body.draftGrade);
    if (!Number.isFinite(draftGrade)) {
      return { error: { error: 'draft_grade must be a number', status: 400 } };
    }
    const submission = await this.repo.updateSubmission(tenantId, id, {
      ...current,
      draftGrade,
    });
    return { submission: submission! };
  }

  async returnSubmission(
    tenantId: string,
    id: string,
    feedback?: string | null,
  ): Promise<{ submission?: Submission; error?: ServiceError }> {
    const current = await this.repo.getSubmission(tenantId, id);
    if (!current) return { error: { error: 'submission not found', status: 404 } };
    if (current.draftGrade == null) {
      return { error: { error: 'draft_grade required before return', status: 400 } };
    }
    const submission = await this.repo.updateSubmission(tenantId, id, {
      ...current,
      state: 'returned',
      assignedGrade: current.draftGrade,
      feedback: feedback != null ? String(feedback) : current.feedback,
      returnedAt: new Date().toISOString(),
    });
    return { submission: submission! };
  }

  async setSubmissionExcused(
    tenantId: string,
    id: string,
    excused: boolean,
  ): Promise<{ submission?: Submission; error?: ServiceError }> {
    const current = await this.repo.getSubmission(tenantId, id);
    if (!current) return { error: { error: 'submission not found', status: 404 } };
    const submission = await this.repo.updateSubmission(tenantId, id, {
      ...current,
      excused,
    });
    return { submission: submission! };
  }

  async getAssignmentStats(
    tenantId: string,
    assignmentId: string,
  ): Promise<{ stats?: AssignmentStats; error?: ServiceError }> {
    const assignment = await this.repo.getAssignment(tenantId, assignmentId);
    if (!assignment) return { error: { error: 'assignment not found', status: 404 } };
    const subs = await this.repo.listSubmissionsForAssignment(tenantId, assignmentId);
    const counts: Record<SubmissionState, number> = {
      assigned: 0,
      turned_in: 0,
      returned: 0,
      reclaimed: 0,
    };
    let excusedCount = 0;
    const grades: number[] = [];
    for (const s of subs) {
      counts[s.state] += 1;
      if (s.excused) {
        excusedCount += 1;
        continue;
      }
      if (s.assignedGrade != null) grades.push(s.assignedGrade);
    }
    grades.sort((a, b) => a - b);
    const mean =
      grades.length === 0
        ? null
        : Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) / 100;
    const median =
      grades.length === 0
        ? null
        : grades.length % 2 === 1
          ? grades[(grades.length - 1) / 2]!
          : Math.round(
              ((grades[grades.length / 2 - 1]! + grades[grades.length / 2]!) / 2) * 100,
            ) / 100;
    return {
      stats: {
        mean,
        median,
        counts,
        excusedCount,
        gradedCount: grades.length,
      },
    };
  }

  async sweepMissing(
    tenantId: string,
    assignmentId: string,
  ): Promise<{ updated?: Submission[]; error?: ServiceError }> {
    const assignment = await this.repo.getAssignment(tenantId, assignmentId);
    if (!assignment) return { error: { error: 'assignment not found', status: 404 } };
    if (Date.parse(new Date().toISOString()) <= Date.parse(assignment.dueAt)) {
      return { updated: [] };
    }
    const graded = assignment.maxPoints != null && assignment.maxPoints > 0;
    const subs = await this.repo.listSubmissionsForAssignment(tenantId, assignmentId);
    const updated: Submission[] = [];
    for (const s of subs) {
      if (s.state !== 'assigned' && s.state !== 'reclaimed') continue;
      if (s.excused) continue;
      const next = await this.repo.updateSubmission(tenantId, s.id, {
        ...s,
        missing: true,
        draftGrade: graded ? 0 : s.draftGrade,
      });
      if (next) updated.push(next);
    }
    return { updated };
  }

  async exportSyllabus(
    tenantId: string,
    courseId: string,
  ): Promise<{ export?: SyllabusExportPayload; error?: ServiceError }> {
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };
    const units = await this.repo.listUnitsForCourse(tenantId, courseId);
    const outUnits: SyllabusExportPayload['units'] = [];
    for (const unit of units) {
      const topics = await this.repo.listTopicsForUnit(tenantId, unit.id);
      const tags = await this.repo.listUnitOutcomes(tenantId, unit.id);
      const codes = new Set<string>();
      for (const tag of tags) {
        const outcome = await this.repo.getOutcome(tag.outcomeId);
        if (outcome) codes.add(outcome.code);
      }
      outUnits.push({
        label: unit.label,
        planned_weeks: unit.plannedWeeks,
        planned_start_week: unit.plannedStartWeek,
        summary: unit.summary,
        topics: topics.map((t) => ({
          label: t.label,
          estimated_periods: t.estimatedPeriods,
        })),
        outcome_codes: [...codes].sort(),
      });
    }
    return { export: { units: outUnits } };
  }

  async importSyllabus(
    tenantId: string,
    courseId: string,
    payload: SyllabusImportPayload | Record<string, unknown>,
  ): Promise<{
    export?: SyllabusExportPayload;
    warnings?: string[];
    error?: ServiceError;
  }> {
    const course = await this.repo.getCourse(tenantId, courseId);
    if (!course) return { error: { error: 'course not found', status: 404 } };

    const raw = payload as Record<string, unknown>;
    const unitsRaw = Array.isArray(raw.units) ? raw.units : null;
    if (!unitsRaw) {
      return { error: { error: 'units array required', status: 400, errors: ['units'] } };
    }

    const unitsIn: SyllabusUnitImport[] = [];
    const errors: string[] = [];
    unitsRaw.forEach((row, ui) => {
      if (!row || typeof row !== 'object') {
        errors.push(`units[${ui}]: invalid`);
        return;
      }
      const u = row as Record<string, unknown>;
      const label = String(u.label ?? '').trim();
      if (!label) errors.push(`units[${ui}].label required`);
      const weeks = Number(u.planned_weeks ?? u.plannedWeeks);
      if (!Number.isFinite(weeks) || weeks <= 0) {
        errors.push(`units[${ui}].planned_weeks must be positive`);
      }
      const topicsRaw = Array.isArray(u.topics) ? u.topics : null;
      if (!topicsRaw || topicsRaw.length === 0) {
        errors.push(`units[${ui}].topics required`);
      }
      const topics: SyllabusUnitImport['topics'] = [];
      if (topicsRaw) {
        topicsRaw.forEach((tRow, ti) => {
          const t = (tRow ?? {}) as Record<string, unknown>;
          const tLabel = String(t.label ?? '').trim();
          if (!tLabel) errors.push(`units[${ui}].topics[${ti}].label required`);
          let estimatedPeriods: number | undefined;
          if (t.estimated_periods !== undefined || t.estimatedPeriods !== undefined) {
            const p = Number(t.estimated_periods ?? t.estimatedPeriods);
            if (!Number.isInteger(p) || p < 1) {
              errors.push(`units[${ui}].topics[${ti}].estimated_periods invalid`);
            } else {
              estimatedPeriods = p;
            }
          }
          topics.push({ label: tLabel, estimatedPeriods });
        });
      }
      let plannedStartWeek: number | null | undefined;
      if (u.planned_start_week !== undefined || u.plannedStartWeek !== undefined) {
        const rawStart = u.planned_start_week ?? u.plannedStartWeek;
        plannedStartWeek = rawStart === null ? null : Number(rawStart);
      }
      const codesRaw = (u.outcome_codes ?? u.outcomeCodes) as unknown;
      const outcomeCodes = Array.isArray(codesRaw)
        ? codesRaw.map((c) => String(c).trim()).filter(Boolean)
        : undefined;
      unitsIn.push({
        label,
        plannedWeeks: weeks,
        plannedStartWeek,
        summary: u.summary != null ? String(u.summary) : null,
        topics,
        outcomeCodes,
      });
    });
    if (errors.length > 0) {
      return { error: { error: 'validation_failed', status: 400, errors } };
    }

    const existingUnits = await this.repo.listUnitsForCourse(tenantId, courseId);
    const mode = raw.mode === 'replace' ? 'replace' : 'append';
    if (existingUnits.length > 0 && mode !== 'replace') {
      return {
        error: {
          error: 'course is not empty; pass mode replace to overwrite',
          status: 409,
        },
      };
    }
    if (mode === 'replace' && existingUnits.length > 0) {
      const topicIds: string[] = [];
      for (const u of existingUnits) {
        const topics = await this.repo.listTopicsForUnit(tenantId, u.id);
        topicIds.push(...topics.map((t) => t.id));
      }
      const deliveryCount = await this.repo.countDeliveriesForTopics(tenantId, topicIds);
      if (deliveryCount > 0) {
        return {
          error: {
            error: 'cannot replace syllabus while topic delivery rows exist',
            status: 409,
          },
        };
      }
      for (const u of existingUnits) {
        await this.repo.deleteUnit(tenantId, u.id);
      }
    }

    const warnings: string[] = [];
    for (const u of unitsIn) {
      const created = await this.createUnit(tenantId, courseId, {
        label: u.label,
        plannedWeeks: u.plannedWeeks,
        plannedStartWeek: u.plannedStartWeek ?? null,
        summary: u.summary ?? null,
      });
      if (created.error || !created.unit) {
        return {
          error: {
            error: created.error?.error ?? 'unit create failed',
            status: created.error?.status ?? 400,
            errors: [created.error?.error ?? 'unit create failed'],
          },
        };
      }
      for (const t of u.topics) {
        const topic = await this.createTopic(tenantId, created.unit.id, {
          label: t.label,
          estimatedPeriods: t.estimatedPeriods,
        });
        if (topic.error) {
          return {
            error: {
              error: topic.error.error,
              status: topic.error.status,
              errors: [topic.error.error],
            },
          };
        }
      }
      const codes = u.outcomeCodes ?? [];
      for (const code of codes) {
        const found = await this.repo.findOutcomeByCodeVisible(tenantId, code);
        if (!found) {
          warnings.push(`unknown outcome code: ${code}`);
          continue;
        }
        const tag = await this.tagUnitOutcome(tenantId, created.unit.id, {
          outcomeId: found.id,
          field: 'activity',
          depth: 'introduced',
        });
        if (tag.error && tag.error.status !== 409) {
          warnings.push(`could not tag ${code}: ${tag.error.error}`);
        }
      }
    }

    const exported = await this.exportSyllabus(tenantId, courseId);
    return { export: exported.export, warnings };
  }

  private async validateLessonOutcomes(
    tenantId: string,
    outcomeIds: string[],
  ): Promise<{ ids: string[] } | { error: ServiceError }> {
    const unique = [...new Set(outcomeIds.map((id) => String(id).trim()).filter(Boolean))];
    for (const id of unique) {
      const o = await this.repo.getOutcome(id);
      if (!o || !(o.tenantId == null || o.tenantId === tenantId)) {
        return { error: { error: 'outcome not found', status: 404 } };
      }
    }
    return { ids: unique };
  }
}

function normalizeLessonBody(body: LessonBody | undefined): LessonBody {
  const src = body && typeof body === 'object' ? body : {};
  return {
    objectives: src.objectives ?? null,
    activities: src.activities ?? null,
    materials: src.materials ?? null,
    assessment_check: src.assessment_check ?? null,
  };
}

function normalizeSqliteTimestamp(value: string): string {
  if (value.includes('T')) return value;
  return value.replace(' ', 'T') + 'Z';
}

/**
 * Deterministic pseudo-random sample: seed = tenantId|week.
 * Stable across runs for the same approved set.
 */
export function selectDeterministicSample<T extends { id: string }>(
  items: T[],
  seed: string,
  pct: number,
): T[] {
  if (items.length === 0 || pct <= 0) return [];
  const target = Math.max(1, Math.round((items.length * pct) / 100));
  const scored = items.map((item) => ({
    item,
    score: hashToUnit(`${seed}|${item.id}`),
  }));
  scored.sort((a, b) => a.score - b.score || a.item.id.localeCompare(b.item.id));
  return scored.slice(0, Math.min(target, items.length)).map((s) => s.item);
}

function hashToUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function outcomeVisibleToTenant(o: LearningOutcome, tenantId: string): boolean {
  return o.tenantId == null || o.tenantId === tenantId;
}

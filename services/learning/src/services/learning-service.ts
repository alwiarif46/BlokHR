import type { LearningRepository } from '../repositories/learning-repository';
import type {
  Course,
  CourseLesson,
  Enrollment,
  EnrollmentWithCourse,
  Skill,
  EmployeeSkill,
  CourseSkill,
  TrainingBudget,
  ExternalTrainingRequest,
  CompletionReport,
  ComplianceRow,
  ServiceError,
  LessonProgress,
} from '../types';

const VALID_FORMATS = ['video', 'doc', 'link', 'scorm', 'classroom', 'other'];
const VALID_RECURRENCES = ['none', 'annual', 'biannual', 'quarterly'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];
const VALID_STATUSES = ['draft', 'published', 'archived'];
const VALID_LESSON_TYPES = ['video', 'doc', 'link', 'scorm', 'quiz', 'classroom'];
const VALID_PROFICIENCIES = ['beginner', 'intermediate', 'advanced', 'expert'];

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: ServiceError };

function err(error: string, status: number): ServiceError {
  return { error, status };
}

function daysFromRecurrence(recurrence: string): number | null {
  switch (recurrence) {
    case 'annual':
      return 365;
    case 'biannual':
      return 182;
    case 'quarterly':
      return 90;
    case 'none':
      return null;
    default:
      return null;
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export class LearningService {
  constructor(private readonly repo: LearningRepository) {}

  // ── Courses ──

  async createCourse(
    tenantId: string,
    input: Record<string, unknown>,
    actorEmail: string,
  ): Promise<Result<Course>> {
    const title = String(input.title ?? '').trim();
    if (!title) return { error: err('title is required', 400) };

    const format = input.format !== undefined ? String(input.format) : 'doc';
    if (!VALID_FORMATS.includes(format)) {
      return { error: err(`Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`, 400) };
    }
    const recurrence = input.recurrence !== undefined ? String(input.recurrence) : 'none';
    if (!VALID_RECURRENCES.includes(recurrence)) {
      return {
        error: err(`Invalid recurrence. Must be one of: ${VALID_RECURRENCES.join(', ')}`, 400),
      };
    }
    const level = input.level !== undefined ? String(input.level) : 'beginner';
    if (!VALID_LEVELS.includes(level)) {
      return { error: err(`Invalid level. Must be one of: ${VALID_LEVELS.join(', ')}`, 400) };
    }
    const status = input.status !== undefined ? String(input.status) : 'draft';
    if (!VALID_STATUSES.includes(status)) {
      return { error: err(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400) };
    }

    const course = await this.repo.createCourse({
      tenantId,
      title,
      description: input.description !== undefined ? String(input.description) : '',
      category: input.category !== undefined ? String(input.category) : 'general',
      level,
      durationMinutes:
        input.durationMinutes !== undefined
          ? Number(input.durationMinutes)
          : input.duration_minutes !== undefined
            ? Number(input.duration_minutes)
            : 60,
      format,
      mandatory: Boolean(input.mandatory),
      recurrence,
      contentUrl:
        input.contentUrl !== undefined
          ? String(input.contentUrl)
          : input.content_url !== undefined
            ? String(input.content_url)
            : '',
      fileId:
        input.fileId !== undefined
          ? (input.fileId as string | null)
          : input.file_id !== undefined
            ? (input.file_id as string | null)
            : null,
      thumbnailUrl:
        input.thumbnailUrl !== undefined
          ? String(input.thumbnailUrl)
          : input.thumbnail_url !== undefined
            ? String(input.thumbnail_url)
            : '',
      passScore:
        input.passScore !== undefined
          ? (input.passScore as number | null)
          : input.pass_score !== undefined
            ? (input.pass_score as number | null)
            : null,
      validForDays:
        input.validForDays !== undefined
          ? (input.validForDays as number | null)
          : input.valid_for_days !== undefined
            ? (input.valid_for_days as number | null)
            : null,
      autoAssignGroupIds:
        input.autoAssignGroupIds !== undefined
          ? String(input.autoAssignGroupIds)
          : input.auto_assign_group_ids !== undefined
            ? String(input.auto_assign_group_ids)
            : '',
      autoAssignMemberTypes:
        input.autoAssignMemberTypes !== undefined
          ? String(input.autoAssignMemberTypes)
          : input.auto_assign_member_types !== undefined
            ? String(input.auto_assign_member_types)
            : '',
      status,
      createdBy: actorEmail,
    });
    return { data: course };
  }

  async updateCourse(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Result<{ success: true }>> {
    const existing = await this.repo.getCourseById(tenantId, id);
    if (!existing) return { error: err('Course not found', 404) };

    const fields: Parameters<LearningRepository['updateCourse']>[2] = {};
    if (input.title !== undefined) fields.title = String(input.title).trim();
    if (input.description !== undefined) fields.description = String(input.description);
    if (input.category !== undefined) fields.category = String(input.category);
    if (input.level !== undefined) {
      if (!VALID_LEVELS.includes(String(input.level))) {
        return { error: err(`Invalid level. Must be one of: ${VALID_LEVELS.join(', ')}`, 400) };
      }
      fields.level = String(input.level);
    }
    if (input.durationMinutes !== undefined || input.duration_minutes !== undefined) {
      fields.duration_minutes = Number(input.durationMinutes ?? input.duration_minutes);
    }
    if (input.format !== undefined) {
      if (!VALID_FORMATS.includes(String(input.format))) {
        return { error: err(`Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`, 400) };
      }
      fields.format = String(input.format);
    }
    if (input.mandatory !== undefined) fields.mandatory = input.mandatory ? 1 : 0;
    if (input.recurrence !== undefined) {
      if (!VALID_RECURRENCES.includes(String(input.recurrence))) {
        return {
          error: err(`Invalid recurrence. Must be one of: ${VALID_RECURRENCES.join(', ')}`, 400),
        };
      }
      fields.recurrence = String(input.recurrence);
    }
    if (input.contentUrl !== undefined || input.content_url !== undefined) {
      fields.content_url = String(input.contentUrl ?? input.content_url);
    }
    if (input.fileId !== undefined || input.file_id !== undefined) {
      fields.file_id = (input.fileId ?? input.file_id) as string | null;
    }
    if (input.thumbnailUrl !== undefined || input.thumbnail_url !== undefined) {
      fields.thumbnail_url = String(input.thumbnailUrl ?? input.thumbnail_url);
    }
    if (input.passScore !== undefined || input.pass_score !== undefined) {
      fields.pass_score = (input.passScore ?? input.pass_score) as number | null;
    }
    if (input.validForDays !== undefined || input.valid_for_days !== undefined) {
      fields.valid_for_days = (input.validForDays ?? input.valid_for_days) as number | null;
    }
    if (input.autoAssignGroupIds !== undefined || input.auto_assign_group_ids !== undefined) {
      fields.auto_assign_group_ids = String(
        input.autoAssignGroupIds ?? input.auto_assign_group_ids,
      );
    }
    if (
      input.autoAssignMemberTypes !== undefined ||
      input.auto_assign_member_types !== undefined
    ) {
      fields.auto_assign_member_types = String(
        input.autoAssignMemberTypes ?? input.auto_assign_member_types,
      );
    }
    if (input.status !== undefined) {
      if (!VALID_STATUSES.includes(String(input.status))) {
        return { error: err(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400) };
      }
      fields.status = String(input.status);
    }

    await this.repo.updateCourse(tenantId, id, fields);
    return { data: { success: true } };
  }

  async publishCourse(
    tenantId: string,
    id: string,
  ): Promise<Result<{ success: true }>> {
    const existing = await this.repo.getCourseById(tenantId, id);
    if (!existing) return { error: err('Course not found', 404) };
    await this.repo.updateCourse(tenantId, id, { status: 'published' });
    return { data: { success: true } };
  }

  async deleteCourse(
    tenantId: string,
    id: string,
  ): Promise<Result<{ success: true }>> {
    const existing = await this.repo.getCourseById(tenantId, id);
    if (!existing) return { error: err('Course not found', 404) };
    await this.repo.deleteCourse(tenantId, id);
    return { data: { success: true } };
  }

  async getCourse(
    tenantId: string,
    id: string,
  ): Promise<Result<{ course: Course; lessons: CourseLesson[]; skills: CourseSkill[] }>> {
    const course = await this.repo.getCourseById(tenantId, id);
    if (!course) return { error: err('Course not found', 404) };
    const lessons = await this.repo.listLessons(tenantId, id);
    const skills = await this.repo.getCourseSkills(tenantId, id);
    return { data: { course, lessons, skills } };
  }

  async listCourses(
    tenantId: string,
    filters?: { category?: string; mandatory?: boolean; status?: string; includeDrafts?: boolean },
  ): Promise<Course[]> {
    if (filters?.status) {
      return this.repo.listCourses(tenantId, {
        category: filters.category,
        mandatory: filters.mandatory,
        status: filters.status,
      });
    }
    if (filters?.includeDrafts) {
      return this.repo.listCourses(tenantId, {
        category: filters.category,
        mandatory: filters.mandatory,
      });
    }
    return this.repo.listCourses(tenantId, {
      category: filters?.category,
      mandatory: filters?.mandatory,
      status: 'published',
    });
  }

  // ── Lessons ──

  async createLesson(
    tenantId: string,
    courseId: string,
    input: Record<string, unknown>,
  ): Promise<Result<CourseLesson>> {
    const course = await this.repo.getCourseById(tenantId, courseId);
    if (!course) return { error: err('Course not found', 404) };
    const title = String(input.title ?? '').trim();
    if (!title) return { error: err('title is required', 400) };
    const type = input.type !== undefined ? String(input.type) : 'doc';
    if (!VALID_LESSON_TYPES.includes(type)) {
      return {
        error: err(`Invalid type. Must be one of: ${VALID_LESSON_TYPES.join(', ')}`, 400),
      };
    }
    const maxPos = await this.repo.maxLessonPosition(tenantId, courseId);
    const lesson = await this.repo.createLesson({
      tenantId,
      courseId,
      position: maxPos + 1,
      title,
      description: input.description !== undefined ? String(input.description) : '',
      type,
      contentUrl:
        input.contentUrl !== undefined
          ? String(input.contentUrl)
          : input.content_url !== undefined
            ? String(input.content_url)
            : '',
      fileId:
        input.fileId !== undefined
          ? (input.fileId as string | null)
          : input.file_id !== undefined
            ? (input.file_id as string | null)
            : null,
      durationMinutes:
        input.durationMinutes !== undefined
          ? Number(input.durationMinutes)
          : input.duration_minutes !== undefined
            ? Number(input.duration_minutes)
            : 0,
      required: input.required === false || input.required === 0 ? false : true,
    });
    return { data: lesson };
  }

  async updateLesson(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Result<{ success: true }>> {
    const existing = await this.repo.getLessonById(tenantId, id);
    if (!existing) return { error: err('Lesson not found', 404) };
    const fields: Parameters<LearningRepository['updateLesson']>[2] = {};
    if (input.title !== undefined) fields.title = String(input.title).trim();
    if (input.description !== undefined) fields.description = String(input.description);
    if (input.type !== undefined) {
      if (!VALID_LESSON_TYPES.includes(String(input.type))) {
        return {
          error: err(`Invalid type. Must be one of: ${VALID_LESSON_TYPES.join(', ')}`, 400),
        };
      }
      fields.type = String(input.type);
    }
    if (input.contentUrl !== undefined || input.content_url !== undefined) {
      fields.content_url = String(input.contentUrl ?? input.content_url);
    }
    if (input.fileId !== undefined || input.file_id !== undefined) {
      fields.file_id = (input.fileId ?? input.file_id) as string | null;
    }
    if (input.durationMinutes !== undefined || input.duration_minutes !== undefined) {
      fields.duration_minutes = Number(input.durationMinutes ?? input.duration_minutes);
    }
    if (input.required !== undefined) fields.required = input.required ? 1 : 0;
    await this.repo.updateLesson(tenantId, id, fields);
    return { data: { success: true } };
  }

  async deleteLesson(
    tenantId: string,
    id: string,
  ): Promise<Result<{ success: true }>> {
    const existing = await this.repo.getLessonById(tenantId, id);
    if (!existing) return { error: err('Lesson not found', 404) };
    await this.repo.deleteLesson(tenantId, id);
    return { data: { success: true } };
  }

  async reorderLessons(
    tenantId: string,
    courseId: string,
    orderedIds: string[],
  ): Promise<Result<{ success: true }>> {
    const course = await this.repo.getCourseById(tenantId, courseId);
    if (!course) return { error: err('Course not found', 404) };
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { error: err('orderedIds is required', 400) };
    }
    const existing = await this.repo.listLessons(tenantId, courseId);
    const existingIds = new Set(existing.map((l) => l.id));
    if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id))) {
      return { error: err('orderedIds must include every lesson exactly once', 400) };
    }
    await this.repo.reorderLessons(tenantId, courseId, orderedIds);
    return { data: { success: true } };
  }

  // ── Enrollment ──

  async enroll(
    tenantId: string,
    courseId: string,
    email: string,
    enrolledBy: string,
  ): Promise<Result<Enrollment>> {
    const course = await this.repo.getCourseById(tenantId, courseId);
    if (!course) return { error: err('Course not found', 404) };
    if (course.status !== 'published') {
      return { error: err('Course is not published', 400) };
    }
    const existing = await this.repo.getEnrollment(tenantId, courseId, email);
    if (existing) return { error: err('Already enrolled in this course', 400) };

    const enrollment = await this.repo.enroll({
      tenantId,
      courseId,
      email: email.toLowerCase().trim(),
      enrolledBy,
    });
    return { data: enrollment };
  }

  async getMyEnrollments(
    tenantId: string,
    email: string,
  ): Promise<
    Array<
      EnrollmentWithCourse & {
        lessons: Array<CourseLesson & { progress: LessonProgress | null }>;
      }
    >
  > {
    const enrollments = await this.repo.getEnrollmentsByEmail(tenantId, email);
    const result = [];
    for (const enrollment of enrollments) {
      const lessons = await this.repo.listLessons(tenantId, enrollment.courseId);
      const progress = await this.repo.listLessonProgress(tenantId, enrollment.id);
      const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
      result.push({
        ...enrollment,
        lessons: lessons.map((lesson) => ({
          ...lesson,
          progress: byLesson.get(lesson.id) ?? null,
        })),
      });
    }
    return result;
  }

  async completeLesson(
    tenantId: string,
    enrollmentId: string,
    lessonId: string,
    actorEmail: string,
    timeSpentSeconds?: number,
  ): Promise<Result<{ enrollment: Enrollment; progress: LessonProgress }>> {
    const enrollment = await this.repo.getEnrollmentById(tenantId, enrollmentId);
    if (!enrollment) return { error: err('Enrollment not found', 404) };
    if (enrollment.email !== actorEmail.toLowerCase().trim()) {
      return { error: err('Forbidden', 403) };
    }
    if (enrollment.status === 'completed') {
      return { error: err('Already completed', 400) };
    }

    const lesson = await this.repo.getLessonById(tenantId, lessonId);
    if (!lesson || lesson.courseId !== enrollment.courseId) {
      return { error: err('Lesson not found', 404) };
    }

    const now = new Date().toISOString();
    const progress = await this.repo.upsertLessonProgress({
      tenantId,
      enrollmentId,
      lessonId,
      status: 'completed',
      completedAt: now,
      timeSpentSeconds,
    });

    if (enrollment.status === 'enrolled') {
      await this.repo.updateEnrollment(tenantId, enrollmentId, {
        status: 'in_progress',
        started_at: now,
      });
    }

    const lessons = await this.repo.listLessons(tenantId, enrollment.courseId);
    const allProgress = await this.repo.listLessonProgress(tenantId, enrollmentId);
    const completedIds = new Set(
      allProgress.filter((p) => p.status === 'completed').map((p) => p.lessonId),
    );
    const required = lessons.filter((l) => l.required);
    const requiredDone = required.filter((l) => completedIds.has(l.id)).length;
    const totalRequired = required.length;
    const progressPct =
      totalRequired === 0
        ? lessons.length > 0 && completedIds.size === lessons.length
          ? 100
          : Math.round((completedIds.size / Math.max(lessons.length, 1)) * 100)
        : Math.round((requiredDone / totalRequired) * 100);

    const updateFields: Parameters<LearningRepository['updateEnrollment']>[2] = {
      progress_pct: progressPct,
    };

    if (progressPct >= 100) {
      updateFields.status = 'completed';
      updateFields.completed_at = now;
      const course = await this.repo.getCourseById(tenantId, enrollment.courseId);
      if (course) {
        const days = course.validForDays ?? daysFromRecurrence(course.recurrence);
        if (days) updateFields.expires_at = addDays(now, days);
      }
      await this.grantCourseSkills(tenantId, enrollment.courseId, enrollment.email, enrollmentId);
    }

    await this.repo.updateEnrollment(tenantId, enrollmentId, updateFields);
    const updated = await this.repo.getEnrollmentById(tenantId, enrollmentId);
    if (!updated) return { error: err('Enrollment not found', 404) };
    return { data: { enrollment: updated, progress } };
  }

  private async grantCourseSkills(
    tenantId: string,
    courseId: string,
    email: string,
    enrollmentId: string,
  ): Promise<void> {
    const courseSkills = await this.repo.getCourseSkills(tenantId, courseId);
    for (const cs of courseSkills) {
      await this.repo.setEmployeeSkill({
        tenantId,
        email,
        skillId: cs.skillId,
        proficiency: cs.proficiencyGranted,
        source: 'course_completion',
        sourceId: enrollmentId,
      });
    }
  }

  async getCourseEnrollments(tenantId: string, courseId: string): Promise<Enrollment[]> {
    return this.repo.getEnrollmentsByCourse(tenantId, courseId);
  }

  async getCompletionReport(tenantId: string, courseId: string): Promise<CompletionReport> {
    const course = await this.repo.getCourseById(tenantId, courseId);
    const enrollments = await this.repo.getEnrollmentsByCourse(tenantId, courseId);
    const completed = enrollments.filter((e) => e.status === 'completed').length;
    const inProgress = enrollments.filter((e) => e.status === 'in_progress').length;
    return {
      courseTitle: course?.title ?? '',
      totalEnrolled: enrollments.length,
      completed,
      inProgress,
      completionRate:
        enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0,
    };
  }

  async getComplianceReport(tenantId: string): Promise<ComplianceRow[]> {
    const courses = await this.repo.listCourses(tenantId, { status: 'published' });
    const now = new Date().toISOString();
    const rows: ComplianceRow[] = [];
    for (const course of courses) {
      if (!course.mandatory) continue;
      const enrollments = await this.repo.getEnrollmentsByCourse(tenantId, course.id);
      const completed = enrollments.filter((e) => e.status === 'completed').length;
      const overdue = enrollments.filter((e) => {
        if (e.status === 'completed') return false;
        if (e.dueDate && e.dueDate < now) return true;
        if (e.expiresAt && e.expiresAt < now) return true;
        return false;
      }).length;
      rows.push({
        courseId: course.id,
        courseTitle: course.title,
        mandatory: true,
        totalEnrolled: enrollments.length,
        completed,
        overdue,
        completionRate:
          enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0,
      });
    }
    return rows;
  }

  // ── Skills ──

  async createSkill(
    tenantId: string,
    input: { name?: string; category?: string },
  ): Promise<Result<Skill>> {
    const name = String(input.name ?? '').trim();
    if (!name) return { error: err('name is required', 400) };
    try {
      const skill = await this.repo.createSkill({
        tenantId,
        name,
        category: input.category,
      });
      return { data: skill };
    } catch {
      return { error: err('Skill already exists', 409) };
    }
  }

  async listSkills(tenantId: string): Promise<Skill[]> {
    return this.repo.listSkills(tenantId);
  }

  async getEmployeeSkills(tenantId: string, email: string): Promise<EmployeeSkill[]> {
    return this.repo.getEmployeeSkills(tenantId, email);
  }

  async setEmployeeSkill(
    tenantId: string,
    input: { email?: string; skillId?: string; proficiency?: string },
  ): Promise<Result<{ success: true }>> {
    if (!input.email || !input.skillId || !input.proficiency) {
      return { error: err('email, skillId, and proficiency are required', 400) };
    }
    if (!VALID_PROFICIENCIES.includes(input.proficiency)) {
      return {
        error: err(
          `Invalid proficiency. Must be one of: ${VALID_PROFICIENCIES.join(', ')}`,
          400,
        ),
      };
    }
    const skill = await this.repo.getSkillById(tenantId, input.skillId);
    if (!skill) return { error: err('Skill not found', 404) };
    await this.repo.setEmployeeSkill({
      tenantId,
      email: input.email.toLowerCase().trim(),
      skillId: input.skillId,
      proficiency: input.proficiency,
      source: 'manual',
    });
    return { data: { success: true } };
  }

  async linkCourseSkill(
    tenantId: string,
    courseId: string,
    skillId: string,
    proficiency: string,
  ): Promise<Result<{ success: true }>> {
    const course = await this.repo.getCourseById(tenantId, courseId);
    if (!course) return { error: err('Course not found', 404) };
    const skill = await this.repo.getSkillById(tenantId, skillId);
    if (!skill) return { error: err('Skill not found', 404) };
    if (!VALID_PROFICIENCIES.includes(proficiency)) {
      return {
        error: err(
          `Invalid proficiency. Must be one of: ${VALID_PROFICIENCIES.join(', ')}`,
          400,
        ),
      };
    }
    await this.repo.linkCourseSkill(tenantId, courseId, skillId, proficiency);
    return { data: { success: true } };
  }

  async getCourseSkills(tenantId: string, courseId: string): Promise<CourseSkill[]> {
    return this.repo.getCourseSkills(tenantId, courseId);
  }

  // ── Budgets ──

  async setBudget(
    tenantId: string,
    input: {
      groupId?: string;
      year?: number;
      annualBudget?: number;
      perEmployeeCap?: number;
    },
  ): Promise<Result<TrainingBudget>> {
    if (!input.groupId || input.year === undefined || input.annualBudget === undefined) {
      return { error: err('groupId, year, and annualBudget are required', 400) };
    }
    const budget = await this.repo.setBudget({
      tenantId,
      groupId: input.groupId,
      year: input.year,
      annualBudget: input.annualBudget,
      perEmployeeCap: input.perEmployeeCap,
    });
    return { data: budget };
  }

  async getBudget(
    tenantId: string,
    groupId: string,
    year: number,
  ): Promise<TrainingBudget | null> {
    return this.repo.getBudget(tenantId, groupId, year);
  }

  async listBudgets(tenantId: string, year: number): Promise<TrainingBudget[]> {
    return this.repo.listBudgets(tenantId, year);
  }

  // ── External requests ──

  async submitExternalRequest(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<Result<ExternalTrainingRequest>> {
    const email = String(input.email ?? '')
      .toLowerCase()
      .trim();
    const title = String(input.title ?? '').trim();
    if (!email) return { error: err('email is required', 400) };
    if (!title) return { error: err('title is required', 400) };

    const cost = input.cost !== undefined ? Number(input.cost) : 0;
    const groupId =
      input.groupId !== undefined
        ? String(input.groupId)
        : input.group_id !== undefined
          ? String(input.group_id)
          : '';

    if (cost > 0 && groupId) {
      const year = new Date().getFullYear();
      const budget = await this.repo.getBudget(tenantId, groupId, year);
      if (budget) {
        const remaining = budget.annualBudget - budget.spent;
        if (cost > remaining) {
          return {
            error: err(`Exceeds remaining department budget (${remaining} available)`, 400),
          };
        }
        if (budget.perEmployeeCap > 0 && cost > budget.perEmployeeCap) {
          return {
            error: err(`Exceeds per-employee cap (${budget.perEmployeeCap})`, 400),
          };
        }
      }
    }

    const req = await this.repo.createExternalRequest({
      tenantId,
      email,
      name: String(input.name ?? email),
      title,
      provider: input.provider !== undefined ? String(input.provider) : '',
      cost,
      startDate:
        input.startDate !== undefined
          ? String(input.startDate)
          : input.start_date !== undefined
            ? String(input.start_date)
            : '',
      endDate:
        input.endDate !== undefined
          ? String(input.endDate)
          : input.end_date !== undefined
            ? String(input.end_date)
            : '',
      reason: input.reason !== undefined ? String(input.reason) : '',
    });
    return { data: req };
  }

  async approveExternalRequest(
    tenantId: string,
    id: string,
    role: string,
    approverEmail: string,
    groupId?: string,
  ): Promise<Result<{ success: true }>> {
    const req = await this.repo.getExternalRequestById(tenantId, id);
    if (!req) return { error: err('Request not found', 404) };

    if (role === 'manager') {
      if (req.status !== 'pending') {
        return { error: err(`Cannot manager-approve with status "${req.status}"`, 400) };
      }
      await this.repo.updateExternalRequest(tenantId, id, {
        status: 'manager_approved',
        manager_email: approverEmail,
      });
    } else if (role === 'hr') {
      if (req.status !== 'manager_approved') {
        return { error: err('Cannot HR-approve before manager approval', 400) };
      }
      await this.repo.updateExternalRequest(tenantId, id, {
        status: 'approved',
        hr_email: approverEmail,
      });
      if (groupId && req.cost > 0) {
        await this.repo.addSpend(tenantId, groupId, new Date().getFullYear(), req.cost);
      }
    } else {
      return { error: err('Role must be "manager" or "hr"', 400) };
    }
    return { data: { success: true } };
  }

  async rejectExternalRequest(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<Result<{ success: true }>> {
    const req = await this.repo.getExternalRequestById(tenantId, id);
    if (!req) return { error: err('Request not found', 404) };
    if (req.status === 'approved' || req.status === 'rejected') {
      return { error: err(`Cannot reject with status "${req.status}"`, 400) };
    }
    await this.repo.updateExternalRequest(tenantId, id, {
      status: 'rejected',
      rejection_reason: reason,
    });
    return { data: { success: true } };
  }

  async getExternalRequestsByEmail(
    tenantId: string,
    email: string,
  ): Promise<ExternalTrainingRequest[]> {
    return this.repo.getExternalRequestsByEmail(tenantId, email);
  }

  async listExternalRequests(
    tenantId: string,
    status?: string,
  ): Promise<ExternalTrainingRequest[]> {
    return this.repo.listExternalRequests(tenantId, status);
  }
}

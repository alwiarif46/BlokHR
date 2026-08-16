import { v4 as uuidv4 } from 'uuid';
import type { LearningDb } from '../db';
import type {
  Course,
  CourseLesson,
  CourseLevel,
  CourseFormat,
  CourseStatus,
  Recurrence,
  LessonType,
  Enrollment,
  EnrollmentWithCourse,
  LessonProgress,
  Skill,
  EmployeeSkill,
  CourseSkill,
  TrainingBudget,
  ExternalTrainingRequest,
  Proficiency,
} from '../types';

interface CourseRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  duration_minutes: number;
  format: string;
  mandatory: number;
  recurrence: string;
  content_url: string;
  file_id: string | null;
  thumbnail_url: string;
  pass_score: number | null;
  valid_for_days: number | null;
  auto_assign_group_ids: string;
  auto_assign_member_types: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface LessonRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  course_id: string;
  position: number;
  title: string;
  description: string;
  type: string;
  content_url: string;
  file_id: string | null;
  duration_minutes: number;
  required: number;
  created_at: string;
  updated_at: string;
}

interface EnrollmentRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  course_id: string;
  email: string;
  status: string;
  progress_pct: number;
  score: number | null;
  enrolled_by: string;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  expires_at: string | null;
  certificate_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    category: row.category,
    level: row.level as CourseLevel,
    durationMinutes: row.duration_minutes,
    format: row.format as CourseFormat,
    mandatory: row.mandatory === 1,
    recurrence: row.recurrence as Recurrence,
    contentUrl: row.content_url,
    fileId: row.file_id,
    thumbnailUrl: row.thumbnail_url,
    passScore: row.pass_score,
    validForDays: row.valid_for_days,
    autoAssignGroupIds: row.auto_assign_group_ids,
    autoAssignMemberTypes: row.auto_assign_member_types,
    status: row.status as CourseStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLesson(row: LessonRow): CourseLesson {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    position: row.position,
    title: row.title,
    description: row.description,
    type: row.type as LessonType,
    contentUrl: row.content_url,
    fileId: row.file_id,
    durationMinutes: row.duration_minutes,
    required: row.required === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    email: row.email,
    status: row.status as Enrollment['status'],
    progressPct: row.progress_pct,
    score: row.score,
    enrolledBy: row.enrolled_by,
    enrolledAt: row.enrolled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    dueDate: row.due_date,
    expiresAt: row.expires_at,
    certificateId: row.certificate_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class LearningRepository {
  constructor(private readonly db: LearningDb) {}

  // ── Courses ──

  async createCourse(data: {
    tenantId: string;
    title: string;
    description?: string;
    category?: string;
    level?: string;
    durationMinutes?: number;
    format?: string;
    mandatory?: boolean;
    recurrence?: string;
    contentUrl?: string;
    fileId?: string | null;
    thumbnailUrl?: string;
    passScore?: number | null;
    validForDays?: number | null;
    autoAssignGroupIds?: string;
    autoAssignMemberTypes?: string;
    status?: string;
    createdBy: string;
  }): Promise<Course> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO courses (
        id, tenant_id, title, description, category, level, duration_minutes, format,
        mandatory, recurrence, content_url, file_id, thumbnail_url, pass_score, valid_for_days,
        auto_assign_group_ids, auto_assign_member_types, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.tenantId,
        data.title,
        data.description ?? '',
        data.category ?? 'general',
        data.level ?? 'beginner',
        data.durationMinutes ?? 60,
        data.format ?? 'doc',
        data.mandatory ? 1 : 0,
        data.recurrence ?? 'none',
        data.contentUrl ?? '',
        data.fileId ?? null,
        data.thumbnailUrl ?? '',
        data.passScore ?? null,
        data.validForDays ?? null,
        data.autoAssignGroupIds ?? '',
        data.autoAssignMemberTypes ?? '',
        data.status ?? 'draft',
        data.createdBy,
      ],
    );
    const created = await this.getCourseById(data.tenantId, id);
    if (!created) throw new Error('Failed to create course');
    return created;
  }

  async getCourseById(tenantId: string, id: string): Promise<Course | null> {
    const row = await this.db.get<CourseRow>(
      'SELECT * FROM courses WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapCourse(row) : null;
  }

  async listCourses(
    tenantId: string,
    filters?: { category?: string; mandatory?: boolean; status?: string },
  ): Promise<Course[]> {
    const conditions = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.mandatory !== undefined) {
      conditions.push('mandatory = ?');
      params.push(filters.mandatory ? 1 : 0);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    const rows = await this.db.all<CourseRow>(
      `SELECT * FROM courses WHERE ${conditions.join(' AND ')} ORDER BY title ASC`,
      params,
    );
    return rows.map(mapCourse);
  }

  async updateCourse(
    tenantId: string,
    id: string,
    fields: Partial<{
      title: string;
      description: string;
      category: string;
      level: string;
      duration_minutes: number;
      format: string;
      mandatory: number;
      recurrence: string;
      content_url: string;
      file_id: string | null;
      thumbnail_url: string;
      pass_score: number | null;
      valid_for_days: number | null;
      auto_assign_group_ids: string;
      auto_assign_member_types: string;
      status: string;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE courses SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  async deleteCourse(tenantId: string, id: string): Promise<void> {
    await this.db.run('DELETE FROM courses WHERE tenant_id = ? AND id = ?', [tenantId, id]);
  }

  // ── Lessons ──

  async createLesson(data: {
    tenantId: string;
    courseId: string;
    position: number;
    title: string;
    description?: string;
    type?: string;
    contentUrl?: string;
    fileId?: string | null;
    durationMinutes?: number;
    required?: boolean;
  }): Promise<CourseLesson> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO course_lessons (
        id, tenant_id, course_id, position, title, description, type,
        content_url, file_id, duration_minutes, required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.tenantId,
        data.courseId,
        data.position,
        data.title,
        data.description ?? '',
        data.type ?? 'doc',
        data.contentUrl ?? '',
        data.fileId ?? null,
        data.durationMinutes ?? 0,
        data.required === false ? 0 : 1,
      ],
    );
    const created = await this.getLessonById(data.tenantId, id);
    if (!created) throw new Error('Failed to create lesson');
    return created;
  }

  async getLessonById(tenantId: string, id: string): Promise<CourseLesson | null> {
    const row = await this.db.get<LessonRow>(
      'SELECT * FROM course_lessons WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapLesson(row) : null;
  }

  async listLessons(tenantId: string, courseId: string): Promise<CourseLesson[]> {
    const rows = await this.db.all<LessonRow>(
      'SELECT * FROM course_lessons WHERE tenant_id = ? AND course_id = ? ORDER BY position ASC',
      [tenantId, courseId],
    );
    return rows.map(mapLesson);
  }

  async updateLesson(
    tenantId: string,
    id: string,
    fields: Partial<{
      title: string;
      description: string;
      type: string;
      content_url: string;
      file_id: string | null;
      duration_minutes: number;
      required: number;
      position: number;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE course_lessons SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  async deleteLesson(tenantId: string, id: string): Promise<void> {
    await this.db.run('DELETE FROM course_lessons WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
  }

  async maxLessonPosition(tenantId: string, courseId: string): Promise<number> {
    const row = await this.db.get<{ mx: number | null; [key: string]: unknown }>(
      'SELECT MAX(position) AS mx FROM course_lessons WHERE tenant_id = ? AND course_id = ?',
      [tenantId, courseId],
    );
    return row?.mx ?? -1;
  }

  async reorderLessons(
    tenantId: string,
    courseId: string,
    orderedIds: string[],
  ): Promise<void> {
    // Two-phase to avoid UNIQUE(course_id, position) collisions
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.run(
        `UPDATE course_lessons SET position = ?, updated_at = datetime('now')
         WHERE tenant_id = ? AND course_id = ? AND id = ?`,
        [10000 + i, tenantId, courseId, orderedIds[i]],
      );
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.run(
        `UPDATE course_lessons SET position = ?, updated_at = datetime('now')
         WHERE tenant_id = ? AND course_id = ? AND id = ?`,
        [i, tenantId, courseId, orderedIds[i]],
      );
    }
  }

  // ── Enrollments ──

  async enroll(data: {
    tenantId: string;
    courseId: string;
    email: string;
    enrolledBy: string;
    dueDate?: string | null;
  }): Promise<Enrollment> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO enrollments (id, tenant_id, course_id, email, enrolled_by, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.tenantId, data.courseId, data.email, data.enrolledBy, data.dueDate ?? null],
    );
    const row = await this.getEnrollmentById(data.tenantId, id);
    if (!row) throw new Error('Failed to create enrollment');
    return row;
  }

  async getEnrollment(
    tenantId: string,
    courseId: string,
    email: string,
  ): Promise<Enrollment | null> {
    const row = await this.db.get<EnrollmentRow>(
      'SELECT * FROM enrollments WHERE tenant_id = ? AND course_id = ? AND email = ?',
      [tenantId, courseId, email],
    );
    return row ? mapEnrollment(row) : null;
  }

  async getEnrollmentById(tenantId: string, id: string): Promise<Enrollment | null> {
    const row = await this.db.get<EnrollmentRow>(
      'SELECT * FROM enrollments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapEnrollment(row) : null;
  }

  async getEnrollmentsByEmail(
    tenantId: string,
    email: string,
  ): Promise<EnrollmentWithCourse[]> {
    const rows = await this.db.all<
      EnrollmentRow & {
        course_title: string;
        course_category: string;
        course_format: string;
        course_mandatory: number;
      }
    >(
      `SELECT e.*, c.title AS course_title, c.category AS course_category,
              c.format AS course_format, c.mandatory AS course_mandatory
       FROM enrollments e INNER JOIN courses c ON c.id = e.course_id
       WHERE e.tenant_id = ? AND e.email = ? ORDER BY e.enrolled_at DESC`,
      [tenantId, email],
    );
    return rows.map((row) => ({
      ...mapEnrollment(row),
      courseTitle: row.course_title,
      courseCategory: row.course_category,
      courseFormat: row.course_format,
      courseMandatory: row.course_mandatory === 1,
    }));
  }

  async getEnrollmentsByCourse(tenantId: string, courseId: string): Promise<Enrollment[]> {
    const rows = await this.db.all<EnrollmentRow>(
      'SELECT * FROM enrollments WHERE tenant_id = ? AND course_id = ? ORDER BY enrolled_at DESC',
      [tenantId, courseId],
    );
    return rows.map(mapEnrollment);
  }

  async updateEnrollment(
    tenantId: string,
    id: string,
    fields: Partial<{
      status: string;
      progress_pct: number;
      score: number | null;
      started_at: string | null;
      completed_at: string | null;
      due_date: string | null;
      expires_at: string | null;
      certificate_id: string | null;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE enrollments SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  // ── Lesson progress ──

  async upsertLessonProgress(data: {
    tenantId: string;
    enrollmentId: string;
    lessonId: string;
    status: string;
    completedAt?: string | null;
    timeSpentSeconds?: number;
  }): Promise<LessonProgress> {
    const existing = await this.db.get<{ id: string; [key: string]: unknown }>(
      'SELECT id FROM lesson_progress WHERE enrollment_id = ? AND lesson_id = ?',
      [data.enrollmentId, data.lessonId],
    );
    if (existing) {
      await this.db.run(
        `UPDATE lesson_progress SET status = ?, completed_at = ?,
         time_spent_seconds = COALESCE(?, time_spent_seconds),
         updated_at = datetime('now') WHERE id = ?`,
        [
          data.status,
          data.completedAt ?? null,
          data.timeSpentSeconds ?? null,
          existing.id,
        ],
      );
      const row = await this.getLessonProgressById(data.tenantId, existing.id);
      if (!row) throw new Error('Failed to update lesson progress');
      return row;
    }
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO lesson_progress (
        id, tenant_id, enrollment_id, lesson_id, status, completed_at, time_spent_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.tenantId,
        data.enrollmentId,
        data.lessonId,
        data.status,
        data.completedAt ?? null,
        data.timeSpentSeconds ?? 0,
      ],
    );
    const row = await this.getLessonProgressById(data.tenantId, id);
    if (!row) throw new Error('Failed to create lesson progress');
    return row;
  }

  async getLessonProgressById(tenantId: string, id: string): Promise<LessonProgress | null> {
    const row = await this.db.get<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      enrollment_id: string;
      lesson_id: string;
      status: string;
      completed_at: string | null;
      time_spent_seconds: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM lesson_progress WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      enrollmentId: row.enrollment_id,
      lessonId: row.lesson_id,
      status: row.status as LessonProgress['status'],
      completedAt: row.completed_at,
      timeSpentSeconds: row.time_spent_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listLessonProgress(
    tenantId: string,
    enrollmentId: string,
  ): Promise<LessonProgress[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      enrollment_id: string;
      lesson_id: string;
      status: string;
      completed_at: string | null;
      time_spent_seconds: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM lesson_progress WHERE tenant_id = ? AND enrollment_id = ?', [
      tenantId,
      enrollmentId,
    ]);
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      enrollmentId: row.enrollment_id,
      lessonId: row.lesson_id,
      status: row.status as LessonProgress['status'],
      completedAt: row.completed_at,
      timeSpentSeconds: row.time_spent_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ── Skills ──

  async createSkill(data: {
    tenantId: string;
    name: string;
    category?: string;
  }): Promise<Skill> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO skills (id, tenant_id, name, category) VALUES (?, ?, ?, ?)',
      [id, data.tenantId, data.name, data.category ?? 'general'],
    );
    const row = await this.db.get<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      name: string;
      category: string;
      created_at: string;
    }>('SELECT * FROM skills WHERE tenant_id = ? AND id = ?', [data.tenantId, id]);
    if (!row) throw new Error('Failed to create skill');
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      category: row.category,
      createdAt: row.created_at,
    };
  }

  async listSkills(tenantId: string): Promise<Skill[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      name: string;
      category: string;
      created_at: string;
    }>('SELECT * FROM skills WHERE tenant_id = ? ORDER BY name ASC', [tenantId]);
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      category: row.category,
      createdAt: row.created_at,
    }));
  }

  async getSkillById(tenantId: string, id: string): Promise<Skill | null> {
    const row = await this.db.get<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      name: string;
      category: string;
      created_at: string;
    }>('SELECT * FROM skills WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      category: row.category,
      createdAt: row.created_at,
    };
  }

  async setEmployeeSkill(data: {
    tenantId: string;
    email: string;
    skillId: string;
    proficiency: string;
    source?: string;
    sourceId?: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO employee_skills (tenant_id, email, skill_id, proficiency, source, source_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, email, skill_id) DO UPDATE SET
         proficiency = excluded.proficiency,
         source = excluded.source,
         source_id = excluded.source_id,
         updated_at = datetime('now')`,
      [
        data.tenantId,
        data.email,
        data.skillId,
        data.proficiency,
        data.source ?? 'manual',
        data.sourceId ?? '',
      ],
    );
  }

  async getEmployeeSkills(tenantId: string, email: string): Promise<EmployeeSkill[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      id: number;
      tenant_id: string;
      email: string;
      skill_id: string;
      proficiency: string;
      source: string;
      source_id: string;
      updated_at: string;
      skill_name: string;
      skill_category: string;
    }>(
      `SELECT es.*, s.name AS skill_name, s.category AS skill_category
       FROM employee_skills es INNER JOIN skills s ON s.id = es.skill_id
       WHERE es.tenant_id = ? AND es.email = ? ORDER BY s.name ASC`,
      [tenantId, email],
    );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      skillId: row.skill_id,
      proficiency: row.proficiency as Proficiency,
      source: row.source,
      sourceId: row.source_id,
      updatedAt: row.updated_at,
      skillName: row.skill_name,
      skillCategory: row.skill_category,
    }));
  }

  async linkCourseSkill(
    tenantId: string,
    courseId: string,
    skillId: string,
    proficiencyGranted: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO course_skills (tenant_id, course_id, skill_id, proficiency_granted)
       VALUES (?, ?, ?, ?)`,
      [tenantId, courseId, skillId, proficiencyGranted],
    );
  }

  async getCourseSkills(tenantId: string, courseId: string): Promise<CourseSkill[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      skill_id: string;
      skill_name: string;
      proficiency_granted: string;
    }>(
      `SELECT cs.skill_id, s.name AS skill_name, cs.proficiency_granted
       FROM course_skills cs INNER JOIN skills s ON s.id = cs.skill_id
       WHERE cs.tenant_id = ? AND cs.course_id = ?`,
      [tenantId, courseId],
    );
    return rows.map((row) => ({
      skillId: row.skill_id,
      skillName: row.skill_name,
      proficiencyGranted: row.proficiency_granted as Proficiency,
    }));
  }

  // ── Budgets ──

  async setBudget(data: {
    tenantId: string;
    groupId: string;
    year: number;
    annualBudget: number;
    perEmployeeCap?: number;
  }): Promise<TrainingBudget> {
    await this.db.run(
      `INSERT INTO training_budgets (tenant_id, group_id, year, annual_budget, per_employee_cap)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, group_id, year) DO UPDATE SET
         annual_budget = excluded.annual_budget,
         per_employee_cap = excluded.per_employee_cap,
         updated_at = datetime('now')`,
      [
        data.tenantId,
        data.groupId,
        data.year,
        data.annualBudget,
        data.perEmployeeCap ?? 0,
      ],
    );
    const row = await this.getBudget(data.tenantId, data.groupId, data.year);
    if (!row) throw new Error('Failed to set budget');
    return row;
  }

  async getBudget(
    tenantId: string,
    groupId: string,
    year: number,
  ): Promise<TrainingBudget | null> {
    const row = await this.db.get<{
      [key: string]: unknown;
      id: number;
      tenant_id: string;
      group_id: string;
      year: number;
      annual_budget: number;
      spent: number;
      per_employee_cap: number;
      updated_at: string;
    }>(
      'SELECT * FROM training_budgets WHERE tenant_id = ? AND group_id = ? AND year = ?',
      [tenantId, groupId, year],
    );
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      groupId: row.group_id,
      year: row.year,
      annualBudget: row.annual_budget,
      spent: row.spent,
      perEmployeeCap: row.per_employee_cap,
      updatedAt: row.updated_at,
    };
  }

  async listBudgets(tenantId: string, year: number): Promise<TrainingBudget[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      id: number;
      tenant_id: string;
      group_id: string;
      year: number;
      annual_budget: number;
      spent: number;
      per_employee_cap: number;
      updated_at: string;
    }>('SELECT * FROM training_budgets WHERE tenant_id = ? AND year = ? ORDER BY group_id', [
      tenantId,
      year,
    ]);
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      groupId: row.group_id,
      year: row.year,
      annualBudget: row.annual_budget,
      spent: row.spent,
      perEmployeeCap: row.per_employee_cap,
      updatedAt: row.updated_at,
    }));
  }

  async addSpend(
    tenantId: string,
    groupId: string,
    year: number,
    amount: number,
  ): Promise<void> {
    await this.db.run(
      `UPDATE training_budgets SET spent = spent + ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND group_id = ? AND year = ?`,
      [amount, tenantId, groupId, year],
    );
  }

  // ── External requests ──

  async createExternalRequest(data: {
    tenantId: string;
    email: string;
    name: string;
    title: string;
    provider?: string;
    cost?: number;
    startDate?: string;
    endDate?: string;
    reason?: string;
  }): Promise<ExternalTrainingRequest> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO external_training_requests (
        id, tenant_id, email, name, title, provider, cost, start_date, end_date, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.tenantId,
        data.email,
        data.name,
        data.title,
        data.provider ?? '',
        data.cost ?? 0,
        data.startDate ?? '',
        data.endDate ?? '',
        data.reason ?? '',
      ],
    );
    const row = await this.getExternalRequestById(data.tenantId, id);
    if (!row) throw new Error('Failed to create external training request');
    return row;
  }

  async getExternalRequestById(
    tenantId: string,
    id: string,
  ): Promise<ExternalTrainingRequest | null> {
    const row = await this.db.get<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      email: string;
      name: string;
      title: string;
      provider: string;
      cost: number;
      start_date: string;
      end_date: string;
      reason: string;
      status: string;
      manager_email: string;
      hr_email: string;
      rejection_reason: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM external_training_requests WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      title: row.title,
      provider: row.provider,
      cost: row.cost,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status as ExternalTrainingRequest['status'],
      managerEmail: row.manager_email,
      hrEmail: row.hr_email,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getExternalRequestsByEmail(
    tenantId: string,
    email: string,
  ): Promise<ExternalTrainingRequest[]> {
    const rows = await this.db.all<{
      [key: string]: unknown;
      id: string;
      tenant_id: string;
      email: string;
      name: string;
      title: string;
      provider: string;
      cost: number;
      start_date: string;
      end_date: string;
      reason: string;
      status: string;
      manager_email: string;
      hr_email: string;
      rejection_reason: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM external_training_requests WHERE tenant_id = ? AND email = ?
       ORDER BY created_at DESC`,
      [tenantId, email],
    );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      title: row.title,
      provider: row.provider,
      cost: row.cost,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status as ExternalTrainingRequest['status'],
      managerEmail: row.manager_email,
      hrEmail: row.hr_email,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listExternalRequests(
    tenantId: string,
    status?: string,
  ): Promise<ExternalTrainingRequest[]> {
    const rows = status
      ? await this.db.all<{
          [key: string]: unknown;
          id: string;
          tenant_id: string;
          email: string;
          name: string;
          title: string;
          provider: string;
          cost: number;
          start_date: string;
          end_date: string;
          reason: string;
          status: string;
          manager_email: string;
          hr_email: string;
          rejection_reason: string;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT * FROM external_training_requests WHERE tenant_id = ? AND status = ?
           ORDER BY created_at DESC`,
          [tenantId, status],
        )
      : await this.db.all<{
          [key: string]: unknown;
          id: string;
          tenant_id: string;
          email: string;
          name: string;
          title: string;
          provider: string;
          cost: number;
          start_date: string;
          end_date: string;
          reason: string;
          status: string;
          manager_email: string;
          hr_email: string;
          rejection_reason: string;
          created_at: string;
          updated_at: string;
        }>(
          `SELECT * FROM external_training_requests WHERE tenant_id = ?
           ORDER BY created_at DESC`,
          [tenantId],
        );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      title: row.title,
      provider: row.provider,
      cost: row.cost,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status as ExternalTrainingRequest['status'],
      managerEmail: row.manager_email,
      hrEmail: row.hr_email,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateExternalRequest(
    tenantId: string,
    id: string,
    fields: Partial<{
      status: string;
      manager_email: string;
      hr_email: string;
      rejection_reason: string;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE external_training_requests SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }
}

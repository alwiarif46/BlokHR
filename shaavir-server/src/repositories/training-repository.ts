import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface CourseRow {
  [key: string]: unknown;
  id: string;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  format: string;
  mandatory: number;
  recurrence: string;
  content_url: string;
  file_id: string | null;
  auto_assign_group_ids: string;
  auto_assign_member_types: string;
  active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentRow {
  [key: string]: unknown;
  id: string;
  course_id: string;
  email: string;
  status: string;
  progress_pct: number;
  score: number | null;
  enrolled_by: string;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  certificate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillRow {
  [key: string]: unknown;
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export interface EmployeeSkillRow {
  [key: string]: unknown;
  id: number;
  email: string;
  skill_id: string;
  proficiency: string;
  source: string;
  source_id: string;
  updated_at: string;
}

export interface TrainingBudgetRow {
  [key: string]: unknown;
  id: number;
  group_id: string;
  year: number;
  annual_budget: number;
  spent: number;
  per_employee_cap: number;
  updated_at: string;
}

export interface ExternalTrainingRequestRow {
  [key: string]: unknown;
  id: string;
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
}

export interface EnrollmentWithCourseRow extends EnrollmentRow {
  course_title: string;
  course_category: string;
  course_format: string;
}

export interface EmployeeSkillWithNameRow extends EmployeeSkillRow {
  skill_name: string;
  skill_category: string;
}

export class TrainingRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Courses ──

  async createCourse(data: {
    title: string;
    description?: string;
    category?: string;
    durationMinutes?: number;
    format?: string;
    mandatory?: boolean;
    recurrence?: string;
    contentUrl?: string;
    fileId?: string | null;
    autoAssignGroupIds?: string;
    autoAssignMemberTypes?: string;
    createdBy: string;
  }): Promise<CourseRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO courses (id, title, description, category, duration_minutes, format, mandatory,
        recurrence, content_url, file_id, auto_assign_group_ids, auto_assign_member_types, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description ?? '',
        data.category ?? 'general',
        data.durationMinutes ?? 60,
        data.format ?? 'doc',
        data.mandatory ? 1 : 0,
        data.recurrence ?? 'none',
        data.contentUrl ?? '',
        data.fileId ?? null,
        data.autoAssignGroupIds ?? '',
        data.autoAssignMemberTypes ?? '',
        data.createdBy,
      ],
    );
    const row = await this.getCourseById(id);
    if (!row) throw new Error('Failed to create course');
    return row;
  }

  async getCourseById(id: string): Promise<CourseRow | null> {
    return this.db.get<CourseRow>('SELECT * FROM courses WHERE id = ?', [id]);
  }

  async listCourses(filters?: {
    category?: string;
    mandatory?: boolean;
    active?: boolean;
  }): Promise<CourseRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.mandatory !== undefined) {
      conditions.push('mandatory = ?');
      params.push(filters.mandatory ? 1 : 0);
    }
    if (filters?.active !== undefined) {
      conditions.push('active = ?');
      params.push(filters.active ? 1 : 0);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.all<CourseRow>(`SELECT * FROM courses ${where} ORDER BY title ASC`, params);
  }

  async updateCourse(
    id: string,
    fields: Partial<
      Pick<
        CourseRow,
        | 'title'
        | 'description'
        | 'category'
        | 'duration_minutes'
        | 'format'
        | 'mandatory'
        | 'recurrence'
        | 'content_url'
        | 'file_id'
        | 'auto_assign_group_ids'
        | 'auto_assign_member_types'
        | 'active'
      >
    >,
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
    vals.push(id);
    await this.db.run(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteCourse(id: string): Promise<void> {
    await this.db.run('DELETE FROM courses WHERE id = ?', [id]);
  }

  // ── Enrollments ──

  async enroll(data: {
    courseId: string;
    email: string;
    enrolledBy: string;
  }): Promise<EnrollmentRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO enrollments (id, course_id, email, enrolled_by) VALUES (?, ?, ?, ?)',
      [id, data.courseId, data.email, data.enrolledBy],
    );
    const row = await this.db.get<EnrollmentRow>('SELECT * FROM enrollments WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create enrollment');
    return row;
  }

  async getEnrollment(courseId: string, email: string): Promise<EnrollmentRow | null> {
    return this.db.get<EnrollmentRow>(
      'SELECT * FROM enrollments WHERE course_id = ? AND email = ?',
      [courseId, email],
    );
  }

  async getEnrollmentById(id: string): Promise<EnrollmentRow | null> {
    return this.db.get<EnrollmentRow>('SELECT * FROM enrollments WHERE id = ?', [id]);
  }

  async getEnrollmentsByEmail(email: string): Promise<EnrollmentWithCourseRow[]> {
    return this.db.all<EnrollmentWithCourseRow>(
      `SELECT e.*, c.title AS course_title, c.category AS course_category, c.format AS course_format
       FROM enrollments e INNER JOIN courses c ON c.id = e.course_id
       WHERE e.email = ? ORDER BY e.enrolled_at DESC`,
      [email],
    );
  }

  async getEnrollmentsByCourse(courseId: string): Promise<EnrollmentRow[]> {
    return this.db.all<EnrollmentRow>(
      'SELECT * FROM enrollments WHERE course_id = ? ORDER BY enrolled_at DESC',
      [courseId],
    );
  }

  async updateEnrollment(
    id: string,
    fields: Partial<
      Pick<
        EnrollmentRow,
        'status' | 'progress_pct' | 'score' | 'started_at' | 'completed_at' | 'certificate_id'
      >
    >,
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
    vals.push(id);
    await this.db.run(`UPDATE enrollments SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async countCompletions(courseId: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      "SELECT COUNT(*) AS cnt FROM enrollments WHERE course_id = ? AND status = 'completed'",
      [courseId],
    );
    return row?.cnt ?? 0;
  }

  // ── Skills ──

  async createSkill(data: { name: string; category?: string }): Promise<SkillRow> {
    const id = uuidv4();
    await this.db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [
      id,
      data.name,
      data.category ?? 'general',
    ]);
    const row = await this.db.get<SkillRow>('SELECT * FROM skills WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create skill');
    return row;
  }

  async listSkills(): Promise<SkillRow[]> {
    return this.db.all<SkillRow>('SELECT * FROM skills ORDER BY name ASC');
  }

  async getSkillById(id: string): Promise<SkillRow | null> {
    return this.db.get<SkillRow>('SELECT * FROM skills WHERE id = ?', [id]);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.db.run('DELETE FROM skills WHERE id = ?', [id]);
  }

  async setEmployeeSkill(data: {
    email: string;
    skillId: string;
    proficiency: string;
    source?: string;
    sourceId?: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO employee_skills (email, skill_id, proficiency, source, source_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email, skill_id) DO UPDATE SET proficiency = excluded.proficiency,
       source = excluded.source, source_id = excluded.source_id, updated_at = datetime('now')`,
      [data.email, data.skillId, data.proficiency, data.source ?? 'manual', data.sourceId ?? ''],
    );
  }

  async getEmployeeSkills(email: string): Promise<EmployeeSkillWithNameRow[]> {
    return this.db.all<EmployeeSkillWithNameRow>(
      `SELECT es.*, s.name AS skill_name, s.category AS skill_category
       FROM employee_skills es INNER JOIN skills s ON s.id = es.skill_id
       WHERE es.email = ? ORDER BY s.name ASC`,
      [email],
    );
  }

  async linkCourseSkill(
    courseId: string,
    skillId: string,
    proficiencyGranted: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO course_skills (course_id, skill_id, proficiency_granted)
       VALUES (?, ?, ?)`,
      [courseId, skillId, proficiencyGranted],
    );
  }

  async getCourseSkills(
    courseId: string,
  ): Promise<
    { skill_id: string; skill_name: string; proficiency_granted: string; [key: string]: unknown }[]
  > {
    return this.db.all(
      `SELECT cs.skill_id, s.name AS skill_name, cs.proficiency_granted
       FROM course_skills cs INNER JOIN skills s ON s.id = cs.skill_id
       WHERE cs.course_id = ?`,
      [courseId],
    );
  }

  // ── Budgets ──

  async setBudget(data: {
    groupId: string;
    year: number;
    annualBudget: number;
    perEmployeeCap?: number;
  }): Promise<TrainingBudgetRow> {
    await this.db.run(
      `INSERT INTO training_budgets (group_id, year, annual_budget, per_employee_cap)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(group_id, year) DO UPDATE SET annual_budget = excluded.annual_budget,
       per_employee_cap = excluded.per_employee_cap, updated_at = datetime('now')`,
      [data.groupId, data.year, data.annualBudget, data.perEmployeeCap ?? 0],
    );
    const row = await this.db.get<TrainingBudgetRow>(
      'SELECT * FROM training_budgets WHERE group_id = ? AND year = ?',
      [data.groupId, data.year],
    );
    if (!row) throw new Error('Failed to set budget');
    return row;
  }

  async getBudget(groupId: string, year: number): Promise<TrainingBudgetRow | null> {
    return this.db.get<TrainingBudgetRow>(
      'SELECT * FROM training_budgets WHERE group_id = ? AND year = ?',
      [groupId, year],
    );
  }

  async addSpend(groupId: string, year: number, amount: number): Promise<void> {
    await this.db.run(
      "UPDATE training_budgets SET spent = spent + ?, updated_at = datetime('now') WHERE group_id = ? AND year = ?",
      [amount, groupId, year],
    );
  }

  // ── External training requests ──

  async createExternalRequest(data: {
    email: string;
    name: string;
    title: string;
    provider?: string;
    cost?: number;
    startDate?: string;
    endDate?: string;
    reason?: string;
  }): Promise<ExternalTrainingRequestRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO external_training_requests (id, email, name, title, provider, cost, start_date, end_date, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
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
    const row = await this.db.get<ExternalTrainingRequestRow>(
      'SELECT * FROM external_training_requests WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create external training request');
    return row;
  }

  async getExternalRequestById(id: string): Promise<ExternalTrainingRequestRow | null> {
    return this.db.get<ExternalTrainingRequestRow>(
      'SELECT * FROM external_training_requests WHERE id = ?',
      [id],
    );
  }

  async getExternalRequestsByEmail(email: string): Promise<ExternalTrainingRequestRow[]> {
    return this.db.all<ExternalTrainingRequestRow>(
      'SELECT * FROM external_training_requests WHERE email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  async listExternalRequests(status?: string): Promise<ExternalTrainingRequestRow[]> {
    if (status) {
      return this.db.all<ExternalTrainingRequestRow>(
        'SELECT * FROM external_training_requests WHERE status = ? ORDER BY created_at DESC',
        [status],
      );
    }
    return this.db.all<ExternalTrainingRequestRow>(
      'SELECT * FROM external_training_requests ORDER BY created_at DESC',
    );
  }

  async updateExternalRequest(
    id: string,
    fields: Partial<
      Pick<ExternalTrainingRequestRow, 'status' | 'manager_email' | 'hr_email' | 'rejection_reason'>
    >,
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
    vals.push(id);
    await this.db.run(
      `UPDATE external_training_requests SET ${sets.join(', ')} WHERE id = ?`,
      vals,
    );
  }
}

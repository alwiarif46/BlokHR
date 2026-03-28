import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import {
  TrainingRepository,
  type CourseRow,
  type EnrollmentRow,
  type EnrollmentWithCourseRow,
  type SkillRow,
  type EmployeeSkillWithNameRow,
  type TrainingBudgetRow,
  type ExternalTrainingRequestRow,
} from '../repositories/training-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string | null;
  member_type_id: string;
  active: number;
}

const VALID_FORMATS = ['video', 'doc', 'link', 'scorm', 'classroom', 'other'];
const VALID_RECURRENCES = ['none', 'annual', 'biannual', 'quarterly'];
const VALID_PROFICIENCIES = ['beginner', 'intermediate', 'advanced', 'expert'];

export class TrainingService {
  private readonly repo: TrainingRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
  ) {
    this.repo = new TrainingRepository(db);
  }

  // ── Courses ──

  async createCourse(
    data: {
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
    },
    actorEmail: string,
  ): Promise<ServiceResult<CourseRow>> {
    if (!data.title?.trim()) return { success: false, error: 'Course title is required' };
    if (data.format && !VALID_FORMATS.includes(data.format)) {
      return {
        success: false,
        error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`,
      };
    }
    if (data.recurrence && !VALID_RECURRENCES.includes(data.recurrence)) {
      return {
        success: false,
        error: `Invalid recurrence. Must be one of: ${VALID_RECURRENCES.join(', ')}`,
      };
    }

    const course = await this.repo.createCourse({
      ...data,
      title: data.title.trim(),
      createdBy: actorEmail,
    });
    this.logger.info(
      { courseId: course.id, title: course.title, actor: actorEmail },
      'Course created',
    );
    this.logAudit('course', course.id, 'created', actorEmail, { title: course.title });
    return { success: true, data: course };
  }

  async updateCourse(
    id: string,
    fields: Record<string, unknown>,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getCourseById(id);
    if (!existing) return { success: false, error: 'Course not found' };
    await this.repo.updateCourse(id, fields as Parameters<typeof this.repo.updateCourse>[1]);
    this.logAudit('course', id, 'updated', actorEmail, fields);
    return { success: true };
  }

  async deleteCourse(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getCourseById(id);
    if (!existing) return { success: false, error: 'Course not found' };
    await this.repo.deleteCourse(id);
    this.logAudit('course', id, 'deleted', actorEmail, { title: existing.title });
    return { success: true };
  }

  async getCourseById(id: string): Promise<CourseRow | null> {
    return this.repo.getCourseById(id);
  }
  async listCourses(filters?: {
    category?: string;
    mandatory?: boolean;
    active?: boolean;
  }): Promise<CourseRow[]> {
    return this.repo.listCourses(filters);
  }

  // ── Enrollment ──

  async enroll(
    courseId: string,
    email: string,
    enrolledBy: string,
  ): Promise<ServiceResult<EnrollmentRow>> {
    const course = await this.repo.getCourseById(courseId);
    if (!course) return { success: false, error: 'Course not found' };
    if (!course.active) return { success: false, error: 'Course is not active' };

    const member = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    const existing = await this.repo.getEnrollment(courseId, email);
    if (existing) return { success: false, error: 'Already enrolled in this course' };

    const enrollment = await this.repo.enroll({ courseId, email, enrolledBy });
    this.logger.info({ enrollmentId: enrollment.id, courseId, email, enrolledBy }, 'Enrolled');
    this.logAudit('enrollment', enrollment.id, 'created', enrolledBy, { courseId, email });
    return { success: true, data: enrollment };
  }

  async updateProgress(
    enrollmentId: string,
    progress: number,
    score?: number,
    actorEmail?: string,
  ): Promise<ServiceResult> {
    const enrollment = await this.repo.getEnrollmentById(enrollmentId);
    if (!enrollment) return { success: false, error: 'Enrollment not found' };
    if (enrollment.status === 'completed') return { success: false, error: 'Already completed' };

    const clamped = Math.max(0, Math.min(100, progress));
    const fields: Record<string, unknown> = { progress_pct: clamped };
    if (enrollment.status === 'enrolled') {
      fields.status = 'in_progress';
      fields.started_at = new Date().toISOString();
    }
    if (score !== undefined) fields.score = score;
    if (clamped === 100) {
      fields.status = 'completed';
      fields.completed_at = new Date().toISOString();
    }

    await this.repo.updateEnrollment(
      enrollmentId,
      fields as Parameters<typeof this.repo.updateEnrollment>[1],
    );

    // On completion, grant skills linked to the course
    if (clamped === 100) {
      await this.grantCourseSkills(enrollment.course_id, enrollment.email, enrollmentId);
    }

    this.logAudit('enrollment', enrollmentId, 'progress_updated', actorEmail ?? enrollment.email, {
      progress: clamped,
    });
    return { success: true };
  }

  private async grantCourseSkills(
    courseId: string,
    email: string,
    enrollmentId: string,
  ): Promise<void> {
    const courseSkills = await this.repo.getCourseSkills(courseId);
    for (const cs of courseSkills) {
      await this.repo.setEmployeeSkill({
        email,
        skillId: cs.skill_id,
        proficiency: cs.proficiency_granted,
        source: 'course_completion',
        sourceId: enrollmentId,
      });
    }
  }

  async getMyEnrollments(email: string): Promise<EnrollmentWithCourseRow[]> {
    return this.repo.getEnrollmentsByEmail(email);
  }

  async getCourseEnrollments(courseId: string): Promise<EnrollmentRow[]> {
    return this.repo.getEnrollmentsByCourse(courseId);
  }

  // ── Skills ──

  async createSkill(
    data: { name: string; category?: string },
    actorEmail: string,
  ): Promise<ServiceResult<SkillRow>> {
    if (!data.name?.trim()) return { success: false, error: 'Skill name is required' };
    const skill = await this.repo.createSkill({ name: data.name.trim(), category: data.category });
    this.logAudit('skill', skill.id, 'created', actorEmail, { name: skill.name });
    return { success: true, data: skill };
  }

  async listSkills(): Promise<SkillRow[]> {
    return this.repo.listSkills();
  }
  async getEmployeeSkills(email: string): Promise<EmployeeSkillWithNameRow[]> {
    return this.repo.getEmployeeSkills(email);
  }

  async setEmployeeSkill(
    data: { email: string; skillId: string; proficiency: string },
    actorEmail: string,
  ): Promise<ServiceResult> {
    if (!VALID_PROFICIENCIES.includes(data.proficiency)) {
      return {
        success: false,
        error: `Invalid proficiency. Must be one of: ${VALID_PROFICIENCIES.join(', ')}`,
      };
    }
    const skill = await this.repo.getSkillById(data.skillId);
    if (!skill) return { success: false, error: 'Skill not found' };

    await this.repo.setEmployeeSkill({ ...data, source: 'manual' });
    this.logAudit('employee_skill', `${data.email}:${data.skillId}`, 'set', actorEmail, data);
    return { success: true };
  }

  async linkCourseSkill(
    courseId: string,
    skillId: string,
    proficiency: string,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const course = await this.repo.getCourseById(courseId);
    if (!course) return { success: false, error: 'Course not found' };
    const skill = await this.repo.getSkillById(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (!VALID_PROFICIENCIES.includes(proficiency)) {
      return {
        success: false,
        error: `Invalid proficiency. Must be one of: ${VALID_PROFICIENCIES.join(', ')}`,
      };
    }
    await this.repo.linkCourseSkill(courseId, skillId, proficiency);
    this.logAudit('course_skill', `${courseId}:${skillId}`, 'linked', actorEmail, { proficiency });
    return { success: true };
  }

  async getCourseSkills(
    courseId: string,
  ): Promise<
    { skill_id: string; skill_name: string; proficiency_granted: string; [key: string]: unknown }[]
  > {
    return this.repo.getCourseSkills(courseId);
  }

  // ── Budgets ──

  async setBudget(
    data: { groupId: string; year: number; annualBudget: number; perEmployeeCap?: number },
    actorEmail: string,
  ): Promise<ServiceResult<TrainingBudgetRow>> {
    const budget = await this.repo.setBudget(data);
    this.logAudit('training_budget', `${data.groupId}:${data.year}`, 'set', actorEmail, data);
    return { success: true, data: budget };
  }

  async getBudget(groupId: string, year: number): Promise<TrainingBudgetRow | null> {
    return this.repo.getBudget(groupId, year);
  }

  // ── External training requests ──

  async submitExternalRequest(data: {
    email: string;
    name: string;
    title: string;
    provider?: string;
    cost?: number;
    startDate?: string;
    endDate?: string;
    reason?: string;
  }): Promise<ServiceResult<ExternalTrainingRequestRow>> {
    if (!data.title?.trim()) return { success: false, error: 'Training title is required' };
    const member = await this.db.get<MemberRow>(
      'SELECT email, name, group_id, active FROM members WHERE email = ? AND active = 1',
      [data.email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    // Budget check
    if (data.cost && data.cost > 0 && member.group_id) {
      const year = new Date().getFullYear();
      const budget = await this.repo.getBudget(member.group_id, year);
      if (budget) {
        const remaining = budget.annual_budget - budget.spent;
        if (data.cost > remaining) {
          return {
            success: false,
            error: `Exceeds remaining department budget (${remaining} available)`,
          };
        }
        if (budget.per_employee_cap > 0 && data.cost > budget.per_employee_cap) {
          return { success: false, error: `Exceeds per-employee cap (${budget.per_employee_cap})` };
        }
      }
    }

    const req = await this.repo.createExternalRequest({ ...data, title: data.title.trim() });
    this.logger.info(
      { requestId: req.id, email: data.email, title: data.title },
      'External training request submitted',
    );
    this.logAudit('external_training', req.id, 'submitted', data.email, {
      title: data.title,
      cost: data.cost,
    });
    return { success: true, data: req };
  }

  async approveExternalRequest(
    id: string,
    role: string,
    approverEmail: string,
  ): Promise<ServiceResult> {
    const req = await this.repo.getExternalRequestById(id);
    if (!req) return { success: false, error: 'Request not found' };

    if (role === 'manager') {
      if (req.status !== 'pending')
        return { success: false, error: `Cannot manager-approve with status "${req.status}"` };
      await this.repo.updateExternalRequest(id, {
        status: 'manager_approved',
        manager_email: approverEmail,
      });
    } else if (role === 'hr') {
      if (req.status !== 'manager_approved')
        return { success: false, error: 'Cannot HR-approve before manager approval' };
      await this.repo.updateExternalRequest(id, { status: 'approved', hr_email: approverEmail });
      // Deduct from budget on final approval
      const member = await this.db.get<MemberRow>('SELECT group_id FROM members WHERE email = ?', [
        req.email,
      ]);
      if (member?.group_id && req.cost > 0) {
        await this.repo.addSpend(member.group_id, new Date().getFullYear(), req.cost);
      }
    } else {
      return { success: false, error: 'Role must be "manager" or "hr"' };
    }

    this.logAudit('external_training', id, `${role}_approved`, approverEmail, {});
    return { success: true };
  }

  async rejectExternalRequest(
    id: string,
    rejectorEmail: string,
    reason: string,
  ): Promise<ServiceResult> {
    const req = await this.repo.getExternalRequestById(id);
    if (!req) return { success: false, error: 'Request not found' };
    if (req.status === 'approved' || req.status === 'rejected') {
      return { success: false, error: `Cannot reject with status "${req.status}"` };
    }
    await this.repo.updateExternalRequest(id, { status: 'rejected', rejection_reason: reason });
    this.logAudit('external_training', id, 'rejected', rejectorEmail, { reason });
    return { success: true };
  }

  async getExternalRequestsByEmail(email: string): Promise<ExternalTrainingRequestRow[]> {
    return this.repo.getExternalRequestsByEmail(email);
  }

  async listExternalRequests(status?: string): Promise<ExternalTrainingRequestRow[]> {
    return this.repo.listExternalRequests(status);
  }

  // ── Completion report ──

  async getCompletionReport(courseId: string): Promise<{
    courseTitle: string;
    totalEnrolled: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  }> {
    const course = await this.repo.getCourseById(courseId);
    const enrollments = await this.repo.getEnrollmentsByCourse(courseId);
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

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}

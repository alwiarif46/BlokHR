import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { TrainingService } from '../services/training-service';

export function createTrainingRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new TrainingService(db, logger, auditService);

  // ── Courses ──

  router.post(
    '/training/courses',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const {
        title,
        description,
        category,
        durationMinutes,
        format,
        mandatory,
        recurrence,
        contentUrl,
        fileId,
        autoAssignGroupIds,
        autoAssignMemberTypes,
      } = req.body as Record<string, unknown>;
      if (!title) throw new AppError('title is required', 400);
      const result = await service.createCourse(
        {
          title: title as string,
          description: description as string | undefined,
          category: category as string | undefined,
          durationMinutes: durationMinutes as number | undefined,
          format: format as string | undefined,
          mandatory: mandatory as boolean | undefined,
          recurrence: recurrence as string | undefined,
          contentUrl: contentUrl as string | undefined,
          fileId: fileId as string | null | undefined,
          autoAssignGroupIds: autoAssignGroupIds as string | undefined,
          autoAssignMemberTypes: autoAssignMemberTypes as string | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ course: result.data });
    }),
  );

  router.get(
    '/training/courses',
    asyncHandler(async (req: Request, res: Response) => {
      const category = req.query.category as string | undefined;
      const mandatory =
        req.query.mandatory === 'true' ? true : req.query.mandatory === 'false' ? false : undefined;
      const courses = await service.listCourses({ category, mandatory, active: true });
      res.json({ courses });
    }),
  );

  router.get(
    '/training/courses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const course = await service.getCourseById(req.params.id);
      if (!course) throw new AppError('Course not found', 404);
      res.json({ course });
    }),
  );

  router.put(
    '/training/courses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.updateCourse(
        req.params.id,
        req.body as Record<string, unknown>,
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/training/courses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteCourse(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Enrollment ──

  router.post(
    '/training/enroll',
    asyncHandler(async (req: Request, res: Response) => {
      const { courseId, email } = req.body as { courseId?: string; email?: string };
      if (!courseId) throw new AppError('courseId is required', 400);
      if (!email) throw new AppError('email is required', 400);
      const enrolledBy = req.identity?.email ?? email;
      const result = await service.enroll(courseId, email.toLowerCase().trim(), enrolledBy);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ enrollment: result.data });
    }),
  );

  router.get(
    '/training/my-courses',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const enrollments = await service.getMyEnrollments(email);
      res.json({ enrollments });
    }),
  );

  router.get(
    '/training/courses/:id/enrollments',
    asyncHandler(async (req: Request, res: Response) => {
      const enrollments = await service.getCourseEnrollments(req.params.id);
      res.json({ enrollments });
    }),
  );

  router.put(
    '/training/enrollments/:id/progress',
    asyncHandler(async (req: Request, res: Response) => {
      const { progress, score } = req.body as { progress?: number; score?: number };
      if (progress === undefined) throw new AppError('progress is required', 400);
      const actor = req.identity?.email ?? '';
      const result = await service.updateProgress(req.params.id, progress, score, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/training/courses/:id/completion-report',
    asyncHandler(async (req: Request, res: Response) => {
      const report = await service.getCompletionReport(req.params.id);
      res.json({ report });
    }),
  );

  // ── Skills ──

  router.post(
    '/training/skills',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { name, category } = req.body as { name?: string; category?: string };
      if (!name) throw new AppError('name is required', 400);
      const result = await service.createSkill({ name, category }, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ skill: result.data });
    }),
  );

  router.get(
    '/training/skills',
    asyncHandler(async (_req: Request, res: Response) => {
      const skills = await service.listSkills();
      res.json({ skills });
    }),
  );

  router.get(
    '/training/skills/employee',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.query.email as string) || req.identity?.email;
      if (!email) throw new AppError('email is required', 400);
      const skills = await service.getEmployeeSkills(email.toLowerCase().trim());
      res.json({ skills });
    }),
  );

  router.put(
    '/training/skills/employee',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { email, skillId, proficiency } = req.body as {
        email?: string;
        skillId?: string;
        proficiency?: string;
      };
      if (!email || !skillId || !proficiency)
        throw new AppError('email, skillId, and proficiency are required', 400);
      const result = await service.setEmployeeSkill(
        { email: email.toLowerCase().trim(), skillId, proficiency },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/training/courses/:id/skills',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { skillId, proficiency } = req.body as { skillId?: string; proficiency?: string };
      if (!skillId || !proficiency) throw new AppError('skillId and proficiency are required', 400);
      const result = await service.linkCourseSkill(req.params.id, skillId, proficiency, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/training/courses/:id/skills',
    asyncHandler(async (req: Request, res: Response) => {
      const skills = await service.getCourseSkills(req.params.id);
      res.json({ skills });
    }),
  );

  // ── Budgets ──

  router.put(
    '/training/budgets',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { groupId, year, annualBudget, perEmployeeCap } = req.body as {
        groupId?: string;
        year?: number;
        annualBudget?: number;
        perEmployeeCap?: number;
      };
      if (!groupId || !year || annualBudget === undefined)
        throw new AppError('groupId, year, and annualBudget are required', 400);
      const result = await service.setBudget(
        { groupId, year, annualBudget, perEmployeeCap },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ budget: result.data });
    }),
  );

  router.get(
    '/training/budgets',
    asyncHandler(async (req: Request, res: Response) => {
      const groupId = req.query.groupId as string;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      if (!groupId) throw new AppError('groupId is required', 400);
      const budget = await service.getBudget(groupId, year);
      res.json({ budget });
    }),
  );

  // ── External training requests ──

  router.post(
    '/training/external-requests',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, name, title, provider, cost, startDate, endDate, reason } = req.body as Record<
        string,
        unknown
      >;
      if (!email) throw new AppError('email is required', 400);
      if (!title) throw new AppError('title is required', 400);
      const result = await service.submitExternalRequest({
        email: (email as string).toLowerCase().trim(),
        name: (name as string) ?? (email as string),
        title: title as string,
        provider: provider as string | undefined,
        cost: cost as number | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        reason: reason as string | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ request: result.data });
    }),
  );

  router.get(
    '/training/external-requests',
    asyncHandler(async (req: Request, res: Response) => {
      const status = req.query.status as string | undefined;
      const email = req.query.email as string | undefined;
      if (email) {
        const requests = await service.getExternalRequestsByEmail(email.toLowerCase().trim());
        res.json({ requests });
        return;
      }
      const requests = await service.listExternalRequests(status);
      res.json({ requests });
    }),
  );

  router.post(
    '/training/external-requests/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { role } = req.body as { role?: string };
      if (!role) throw new AppError('role is required (manager or hr)', 400);
      const approver = req.identity?.email ?? '';
      const result = await service.approveExternalRequest(req.params.id, role, approver);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/training/external-requests/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const { reason } = req.body as { reason?: string };
      const rejector = req.identity?.email ?? '';
      const result = await service.rejectExternalRequest(req.params.id, rejector, reason ?? '');
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  return router;
}

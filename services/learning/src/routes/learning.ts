import { Router, Request, Response, NextFunction } from 'express';
import type { LearningService } from '../services/learning-service';

export interface LearningRouterOptions {
  tenantId: string;
  isAdmin?: (email: string) => Promise<boolean>;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function callerEmail(req: Request): string {
  return (
    (req.headers['x-user-email'] as string | undefined) ||
    (req as { identity?: { email?: string } }).identity?.email ||
    ''
  )
    .toLowerCase()
    .trim();
}

function callerName(req: Request): string {
  const raw =
    (req.headers['x-user-name'] as string | undefined) ||
    (req as { identity?: { name?: string } }).identity?.name ||
    '';
  try {
    return decodeURIComponent(raw).trim() || callerEmail(req);
  } catch {
    return raw.trim() || callerEmail(req);
  }
}

export function createLearningRouter(
  service: LearningService,
  options: LearningRouterOptions,
): Router {
  const router = Router();
  const tenantId = options.tenantId;

  async function requireAuth(req: Request, res: Response): Promise<string | null> {
    const email = callerEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Authentication required' });
      return null;
    }
    return email;
  }

  async function requireAdmin(req: Request, res: Response): Promise<string | null> {
    const email = await requireAuth(req, res);
    if (!email) return null;
    if (!options.isAdmin) return email;
    if (!(await options.isAdmin(email))) {
      res.status(403).json({ error: 'Admin access required' });
      return null;
    }
    return email;
  }

  // ── Courses ──

  router.get(
    '/courses',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const isAdmin = options.isAdmin ? await options.isAdmin(email) : false;
      const category = req.query.category as string | undefined;
      const mandatory =
        req.query.mandatory === 'true' ? true : req.query.mandatory === 'false' ? false : undefined;
      const status = req.query.status as string | undefined;
      const courses = await service.listCourses(tenantId, {
        category,
        mandatory,
        status,
        includeDrafts: isAdmin,
      });
      res.json({ courses });
    }),
  );

  router.post(
    '/courses',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.createCourse(tenantId, req.body as Record<string, unknown>, actor);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ course: result.data });
    }),
  );

  router.get(
    '/courses/:id',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const result = await service.getCourse(tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.data);
    }),
  );

  router.put(
    '/courses/:id',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.updateCourse(
        tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.delete(
    '/courses/:id',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.deleteCourse(tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.post(
    '/courses/:id/publish',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.publishCourse(tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  // ── Lessons ──

  router.post(
    '/courses/:id/lessons',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.createLesson(
        tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ lesson: result.data });
    }),
  );

  router.put(
    '/lessons/:id',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.updateLesson(
        tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.delete(
    '/lessons/:id',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.deleteLesson(tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.put(
    '/courses/:id/lessons/reorder',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const { orderedIds } = req.body as { orderedIds?: string[] };
      const result = await service.reorderLessons(tenantId, req.params.id, orderedIds ?? []);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  // ── Enrollment ──

  router.post(
    '/enroll',
    asyncHandler(async (req, res) => {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const { courseId, email } = req.body as { courseId?: string; email?: string };
      if (!courseId) {
        res.status(400).json({ error: 'courseId is required' });
        return;
      }
      const target = (email || actor).toLowerCase().trim();
      if (target !== actor) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      const result = await service.enroll(tenantId, courseId, target, actor);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ enrollment: result.data });
    }),
  );

  router.get(
    '/my-courses',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const enrollments = await service.getMyEnrollments(tenantId, email);
      res.json({ enrollments });
    }),
  );

  router.put(
    '/enrollments/:id/lessons/:lessonId',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const { timeSpentSeconds } = req.body as { timeSpentSeconds?: number };
      const result = await service.completeLesson(
        tenantId,
        req.params.id,
        req.params.lessonId,
        email,
        timeSpentSeconds,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.data);
    }),
  );

  router.get(
    '/courses/:id/enrollments',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const enrollments = await service.getCourseEnrollments(tenantId, req.params.id);
      res.json({ enrollments });
    }),
  );

  router.get(
    '/courses/:id/completion-report',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const report = await service.getCompletionReport(tenantId, req.params.id);
      res.json({ report });
    }),
  );

  router.get(
    '/reports/compliance',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const report = await service.getComplianceReport(tenantId);
      res.json({ report });
    }),
  );

  // ── Skills ──

  router.post(
    '/skills',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.createSkill(tenantId, req.body as { name?: string; category?: string });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ skill: result.data });
    }),
  );

  router.get(
    '/skills',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const skills = await service.listSkills(tenantId);
      res.json({ skills });
    }),
  );

  router.get(
    '/skills/employee',
    asyncHandler(async (req, res) => {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const email = ((req.query.email as string) || actor).toLowerCase().trim();
      if (email !== actor) {
        const admin = await requireAdmin(req, res);
        if (!admin) return;
      }
      const skills = await service.getEmployeeSkills(tenantId, email);
      res.json({ skills });
    }),
  );

  router.put(
    '/skills/employee',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.setEmployeeSkill(
        tenantId,
        req.body as { email?: string; skillId?: string; proficiency?: string },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.post(
    '/courses/:id/skills',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const { skillId, proficiency } = req.body as { skillId?: string; proficiency?: string };
      if (!skillId || !proficiency) {
        res.status(400).json({ error: 'skillId and proficiency are required' });
        return;
      }
      const result = await service.linkCourseSkill(tenantId, req.params.id, skillId, proficiency);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.get(
    '/courses/:id/skills',
    asyncHandler(async (req, res) => {
      const email = await requireAuth(req, res);
      if (!email) return;
      const skills = await service.getCourseSkills(tenantId, req.params.id);
      res.json({ skills });
    }),
  );

  // ── Budgets ──

  router.put(
    '/budgets',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const result = await service.setBudget(
        tenantId,
        req.body as {
          groupId?: string;
          year?: number;
          annualBudget?: number;
          perEmployeeCap?: number;
        },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ budget: result.data });
    }),
  );

  router.get(
    '/budgets',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const groupId = req.query.groupId as string | undefined;
      if (groupId) {
        const budget = await service.getBudget(tenantId, groupId, year);
        res.json({ budget });
        return;
      }
      const budgets = await service.listBudgets(tenantId, year);
      res.json({ budgets });
    }),
  );

  // ── External requests ──

  router.post(
    '/external-requests',
    asyncHandler(async (req, res) => {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const body = req.body as Record<string, unknown>;
      if (!body.email) body.email = actor;
      if (!body.name) body.name = callerName(req);
      const result = await service.submitExternalRequest(tenantId, body);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ request: result.data });
    }),
  );

  router.get(
    '/external-requests',
    asyncHandler(async (req, res) => {
      const actor = await requireAuth(req, res);
      if (!actor) return;
      const status = req.query.status as string | undefined;
      const email = req.query.email as string | undefined;
      if (email) {
        const target = email.toLowerCase().trim();
        if (target !== actor) {
          const admin = await requireAdmin(req, res);
          if (!admin) return;
        }
        const requests = await service.getExternalRequestsByEmail(tenantId, target);
        res.json({ requests });
        return;
      }
      const isAdmin = options.isAdmin ? await options.isAdmin(actor) : false;
      if (!isAdmin) {
        const requests = await service.getExternalRequestsByEmail(tenantId, actor);
        res.json({ requests });
        return;
      }
      const requests = await service.listExternalRequests(tenantId, status);
      res.json({ requests });
    }),
  );

  router.post(
    '/external-requests/:id/approve',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const { role, groupId } = req.body as { role?: string; groupId?: string };
      if (!role) {
        res.status(400).json({ error: 'role is required (manager or hr)' });
        return;
      }
      const result = await service.approveExternalRequest(
        tenantId,
        req.params.id,
        role,
        actor,
        groupId,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.post(
    '/external-requests/:id/reject',
    asyncHandler(async (req, res) => {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const { reason } = req.body as { reason?: string };
      const result = await service.rejectExternalRequest(
        tenantId,
        req.params.id,
        reason ?? '',
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}

import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { SurveyService, type SurveyQuestion } from '../services/survey-service';

export function createSurveyRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new SurveyService(db, logger, auditService);

  async function requireAuth(req: Request): Promise<string> {
    const email = req.identity?.email ?? '';
    if (!email) throw new AppError('Authentication required', 401);
    return email;
  }

  async function requireAdmin(req: Request): Promise<string> {
    const email = await requireAuth(req);
    const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
    if (!isAdmin) throw new AppError('Admin access required', 403);
    return email;
  }

  router.post(
    '/surveys',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const {
        title,
        description,
        questionsJson,
        questions,
        anonymous,
        recurrence,
        targetGroupIds,
        audience,
        minResponses,
      } = req.body as Record<string, unknown>;
      if (!title) throw new AppError('title is required', 400);
      const result = await service.createSurvey(
        {
          title: title as string,
          description: description as string | undefined,
          questionsJson: (questionsJson ?? questions) as string | SurveyQuestion[] | undefined,
          anonymous: anonymous as boolean | undefined,
          recurrence: recurrence as string | undefined,
          targetGroupIds: targetGroupIds as string | string[] | undefined,
          audience: audience as string | undefined,
          minResponses: minResponses as number | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ survey: result.data });
    }),
  );

  router.get(
    '/surveys',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const status = req.query.status as string | undefined;
      const surveys = await service.listSurveys(status);
      res.json({ surveys });
    }),
  );

  router.get(
    '/surveys/pending',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const surveys = await service.getPendingSurveys(email);
      res.json({ surveys });
    }),
  );

  router.get(
    '/surveys/:id',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAuth(req);
      const survey = await service.getSurveyById(req.params.id);
      if (!survey) throw new AppError('Survey not found', 404);
      res.json({ survey });
    }),
  );

  router.put(
    '/surveys/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const {
        title,
        description,
        questionsJson,
        questions,
        anonymous,
        recurrence,
        targetGroupIds,
        audience,
        minResponses,
      } = req.body as Record<string, unknown>;
      const result = await service.updateSurvey(
        req.params.id,
        {
          title: title as string | undefined,
          description: description as string | undefined,
          questionsJson: (questionsJson ?? questions) as string | SurveyQuestion[] | undefined,
          anonymous: anonymous as boolean | undefined,
          recurrence: recurrence as string | undefined,
          targetGroupIds: targetGroupIds as string | string[] | undefined,
          audience: audience as string | undefined,
          minResponses: minResponses as number | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ survey: result.data });
    }),
  );

  router.post(
    '/surveys/:id/publish',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const result = await service.publishSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/surveys/:id/close',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const result = await service.closeSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/surveys/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const result = await service.deleteSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/surveys/:id/peer-assignments',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const { assignments } = req.body as {
        assignments?: Array<{ reviewerEmail: string; subjectEmail: string }>;
      };
      if (!assignments?.length) throw new AppError('assignments is required', 400);
      const result = await service.setPeerAssignments(req.params.id, assignments, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/surveys/:id/peer-assignments',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const assignments = await service.listPeerAssignments(req.params.id);
      res.json({ assignments });
    }),
  );

  router.post(
    '/surveys/:id/respond',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const { answers, subjectEmail } = req.body as {
        answers?: Record<string, unknown>;
        subjectEmail?: string;
      };
      if (!answers) throw new AppError('answers is required', 400);
      const result = await service.submitResponse(
        req.params.id,
        email,
        answers,
        subjectEmail,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ response: result.data });
    }),
  );

  router.get(
    '/surveys/:id/responses',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const subject = req.query.subject as string | undefined;
      const responses = await service.getResponses(req.params.id, subject);
      res.json({ responses });
    }),
  );

  router.get(
    '/surveys/:id/results',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const subject = req.query.subject as string | undefined;
      const summary = await service.getResultsSummary(req.params.id, subject);
      res.json({ summary });
    }),
  );

  router.get(
    '/surveys/:id/enps',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const questionKey = (req.query.questionKey as string) ?? 'nps';
      const subject = req.query.subject as string | undefined;
      const enps = await service.calculateENPS(req.params.id, questionKey, subject);
      res.json({ enps });
    }),
  );

  router.post(
    '/surveys/:id/action-items',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const { title, description, assignedTo } = req.body as Record<string, unknown>;
      if (!title) throw new AppError('title is required', 400);
      const result = await service.createActionItem(
        {
          surveyId: req.params.id,
          title: title as string,
          description: description as string | undefined,
          assignedTo: assignedTo as string | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ actionItem: result.data });
    }),
  );

  router.get(
    '/surveys/:id/action-items',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const items = await service.getActionItems(req.params.id);
      res.json({ actionItems: items });
    }),
  );

  router.put(
    '/surveys/action-items/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const { title, description, assignedTo, status } = req.body as Record<string, unknown>;
      const result = await service.updateActionItem(
        req.params.id,
        {
          title: title as string | undefined,
          description: description as string | undefined,
          assignedTo: assignedTo as string | undefined,
          status: status as string | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  return router;
}

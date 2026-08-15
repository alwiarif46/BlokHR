import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { SurveyService } from '../services/survey-service';

export function createSurveyRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new SurveyService(db, logger, auditService);

  router.post(
    '/surveys',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { title, description, questionsJson, anonymous, recurrence, targetGroupIds } =
        req.body as Record<string, unknown>;
      if (!title) throw new AppError('title is required', 400);
      const result = await service.createSurvey(
        {
          title: title as string,
          description: description as string | undefined,
          questionsJson: questionsJson as string | undefined,
          anonymous: anonymous as boolean | undefined,
          recurrence: recurrence as string | undefined,
          targetGroupIds: targetGroupIds as string | undefined,
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
      const status = req.query.status as string | undefined;
      const surveys = await service.listSurveys(status);
      res.json({ surveys });
    }),
  );

  router.get(
    '/surveys/pending',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const surveys = await service.getPendingSurveys(email);
      res.json({ surveys });
    }),
  );

  router.get(
    '/surveys/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const survey = await service.getSurveyById(req.params.id);
      if (!survey) throw new AppError('Survey not found', 404);
      res.json({ survey });
    }),
  );

  router.post(
    '/surveys/:id/publish',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.publishSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/surveys/:id/close',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.closeSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/surveys/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteSurvey(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/surveys/:id/respond',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { answers } = req.body as { answers?: Record<string, unknown> };
      if (!answers) throw new AppError('answers is required', 400);
      const result = await service.submitResponse(req.params.id, email, answers);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ response: result.data });
    }),
  );

  router.get(
    '/surveys/:id/responses',
    asyncHandler(async (req: Request, res: Response) => {
      const responses = await service.getResponses(req.params.id);
      res.json({ responses });
    }),
  );

  router.get(
    '/surveys/:id/results',
    asyncHandler(async (req: Request, res: Response) => {
      const summary = await service.getResultsSummary(req.params.id);
      res.json({ summary });
    }),
  );

  router.get(
    '/surveys/:id/enps',
    asyncHandler(async (req: Request, res: Response) => {
      const questionKey = (req.query.questionKey as string) ?? 'nps';
      const enps = await service.calculateENPS(req.params.id, questionKey);
      res.json({ enps });
    }),
  );

  // Action items
  router.post(
    '/surveys/:id/action-items',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
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
      const items = await service.getActionItems(req.params.id);
      res.json({ actionItems: items });
    }),
  );

  router.put(
    '/surveys/action-items/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
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

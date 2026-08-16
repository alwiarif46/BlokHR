import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { TimesheetRepository } from '../repositories/timesheet-repository';
import { TimesheetService } from '../services/timesheet-service';
import type { EventBus } from '../events';
import type { NotificationDispatcher } from '../services/notification/dispatcher';

/**
 * Timesheet routes:
 *   POST   /api/timesheets/generate          — generate a new timesheet
 *   POST   /api/timesheets/generate-team     — generate for the whole roster
 *   GET    /api/timesheets                   — list timesheets (filterable)
 *   GET    /api/timesheets/week              — weekly grid with daily entries
 *   GET    /api/timesheets/pending-approvals — submitted sheets the caller may decide
 *   GET    /api/timesheets/:id               — detail + daily entries + adjustment trail
 *   POST   /api/timesheets/:id/submit        — submit for approval
 *   POST   /api/timesheets/:id/approve       — approve a submitted timesheet
 *   POST   /api/timesheets/:id/reject        — reject a submitted timesheet
 *   POST   /api/timesheets/:id/regenerate    — regenerate a draft/rejected timesheet
 *   POST   /api/timesheets/:id/adjust        — admin override for one day
 *   POST   /api/timesheets/:id/adjust/revert — drop an override
 */
export function createTimesheetRouter(
  db: DatabaseEngine,
  logger: Logger,
  eventBus?: EventBus,
  dispatcher?: NotificationDispatcher | null,
): Router {
  const router = Router();
  const repo = new TimesheetRepository(db);
  const service = new TimesheetService(repo, logger, eventBus, dispatcher ?? null);

  function requireAuth(req: Request): string {
    const email = req.identity?.email;
    if (!email) throw new AppError('Authentication required', 401);
    return email;
  }

  function throwResult(result: { error?: string; statusCode?: number }): never {
    throw new AppError(result.error ?? 'Failed', result.statusCode ?? 400);
  }

  router.post(
    '/timesheets/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = ((body.email as string) ?? '').toLowerCase().trim();
      const periodType = (body.periodType as string) ?? '';
      const startDate = (body.startDate as string) ?? '';
      if (!email) throw new AppError('email is required', 400);
      if (!periodType) throw new AppError('periodType is required', 400);
      if (!startDate) throw new AppError('startDate is required', 400);

      const result = await service.generate(email, periodType, startDate);
      if (!result.success) throw new AppError(result.error ?? 'Generation failed', 400);
      res.status(201).json(result.timesheet);
    }),
  );

  router.post(
    '/timesheets/generate-team',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const periodType = (body.periodType as string) ?? 'weekly';
      const startDate = (body.startDate as string) ?? '';
      const emails = Array.isArray(body.emails) ? (body.emails as string[]) : undefined;
      if (!startDate) throw new AppError('startDate is required', 400);

      const result = await service.generateTeam(periodType, startDate, emails);
      if (!result.success) throwResult(result);
      res.status(201).json({
        success: true,
        generated: result.generated,
        skipped: result.skipped,
      });
    }),
  );

  router.get(
    '/timesheets',
    asyncHandler(async (req: Request, res: Response) => {
      const timesheets = await service.list({
        email: (req.query.email as string) || undefined,
        periodType: (req.query.periodType as string) || undefined,
        status: (req.query.status as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
      });
      res.json({ timesheets });
    }),
  );

  // Static paths must precede /timesheets/:id
  router.get(
    '/timesheets/week',
    asyncHandler(async (req: Request, res: Response) => {
      const startDate = (req.query.startDate as string) || '';
      if (!startDate) throw new AppError('startDate is required', 400);

      let email: string | undefined;
      if (req.query.scope === 'mine') {
        email = req.identity?.email ?? (req.query.email as string) ?? '';
        if (!email) throw new AppError('Authentication required', 401);
      } else if (req.query.email) {
        email = req.query.email as string;
      }

      const week = await service.getWeek(startDate, { email });
      if (!week) throw new AppError('startDate must be YYYY-MM-DD', 400);
      res.json(week);
    }),
  );

  router.get(
    '/timesheets/pending-approvals',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const timesheets = await service.listPendingApprovals(actor);
      res.json({ timesheets });
    }),
  );

  router.get(
    '/timesheets/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const detail = await service.getDetail(req.params.id);
      if (!detail) throw new AppError('Timesheet not found', 404);
      res.json(detail);
    }),
  );

  router.post(
    '/timesheets/:id/submit',
    asyncHandler(async (req: Request, res: Response) => {
      const submitter =
        req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      if (!submitter) throw new AppError('Submitter email is required', 400);
      const result = await service.submit(req.params.id, submitter);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/timesheets/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const approver =
        req.identity?.email ??
        ((req.body as { approverEmail?: string }).approverEmail ?? '').toLowerCase().trim();
      if (!approver) throw new AppError('Approver email is required', 400);
      const result = await service.approve(req.params.id, approver);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/timesheets/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const rejector =
        req.identity?.email ?? ((body.rejectorEmail as string) ?? '').toLowerCase().trim();
      const reason = (body.reason as string) ?? '';
      if (!rejector) throw new AppError('Rejector email is required', 400);
      const result = await service.reject(req.params.id, rejector, reason);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/timesheets/:id/regenerate',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.regenerate(req.params.id);
      if (!result.success) throwResult(result);
      res.json(result.timesheet);
    }),
  );

  router.post(
    '/timesheets/:id/adjust',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const body = req.body as Record<string, unknown>;
      const date = (body.date as string) ?? '';
      const hours = Number(body.hours);
      const reason = (body.reason as string) ?? '';
      if (!date) throw new AppError('date is required', 400);

      const result = await service.adjustDay(req.params.id, date, hours, reason, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/timesheets/:id/adjust/revert',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const date = ((req.body as { date?: string }).date ?? '').trim();
      if (!date) throw new AppError('date is required', 400);

      const result = await service.revertDay(req.params.id, date, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  return router;
}

import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { TimesheetRepository } from '../repositories/timesheet-repository';
import { TimesheetService } from '../services/timesheet-service';

/**
 * Timesheet routes:
 *   POST /api/timesheets/generate          — generate a new timesheet
 *   GET  /api/timesheets                   — list timesheets (filterable)
 *   GET  /api/timesheets/:id               — get timesheet detail + daily entries
 *   POST /api/timesheets/:id/submit        — submit for approval
 *   POST /api/timesheets/:id/approve       — approve a submitted timesheet
 *   POST /api/timesheets/:id/reject        — reject a submitted timesheet
 *   POST /api/timesheets/:id/regenerate    — regenerate a draft/rejected timesheet
 */
export function createTimesheetRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new TimesheetRepository(db);
  const service = new TimesheetService(repo, logger);

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
      if (!result.success) throw new AppError(result.error ?? 'Submit failed', 400);
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
      if (!result.success) throw new AppError(result.error ?? 'Approve failed', 400);
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
      if (!result.success) throw new AppError(result.error ?? 'Reject failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/timesheets/:id/regenerate',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.regenerate(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Regenerate failed', 400);
      res.json(result.timesheet);
    }),
  );

  return router;
}

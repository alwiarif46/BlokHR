import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { OvertimeRepository } from '../repositories/overtime-repository';
import { OvertimeService } from '../services/overtime-service';

/**
 * Overtime routes:
 *   POST /api/overtime/detect?date=     — auto-detect OT for a date
 *   POST /api/overtime/log              — manually log OT
 *   GET  /api/overtime?email=&start=&end=  — get OT records
 *   GET  /api/overtime/pending          — pending approvals
 *   POST /api/overtime/:id/approve      — approve OT
 *   POST /api/overtime/:id/reject       — reject OT
 *   GET  /api/overtime/summary?email=&start=&end=  — OT summary
 */
export function createOvertimeRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new OvertimeRepository(db);
  const clockRepo = new ClockRepository(db);
  const service = new OvertimeService(repo, clockRepo, db, logger);

  router.post(
    '/overtime/detect',
    asyncHandler(async (req: Request, res: Response) => {
      const date = (req.query.date as string) ?? (req.body as { date?: string }).date;
      if (!date) throw new AppError('date is required', 400);
      const result = await service.detectForDate(date);
      res.json(result);
    }),
  );

  router.post(
    '/overtime/log',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.logManual({
        email: (body.email as string) ?? '',
        date: (body.date as string) ?? '',
        otMinutes: (body.otMinutes as number) ?? 0,
        otType: body.otType as string | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.get(
    '/overtime',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.query.email as string) ?? '';
      if (!email) throw new AppError('email query param is required', 400);
      const records = await service.getByEmail(
        email,
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined,
      );
      res.json({ records });
    }),
  );

  router.get(
    '/overtime/pending',
    asyncHandler(async (_req: Request, res: Response) => {
      const records = await service.getPending();
      res.json({ records });
    }),
  );

  router.post(
    '/overtime/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid OT record ID', 400);
      const approver =
        req.identity?.email ?? (req.body as { approverEmail?: string }).approverEmail ?? '';
      const result = await service.approve(id, approver);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.post(
    '/overtime/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid OT record ID', 400);
      const approver =
        req.identity?.email ?? (req.body as { approverEmail?: string }).approverEmail ?? '';
      const reason = (req.body as { reason?: string }).reason ?? '';
      const result = await service.reject(id, approver, reason);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.get(
    '/overtime/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.query.email as string) ?? '';
      const startDate = (req.query.startDate as string) ?? '';
      const endDate = (req.query.endDate as string) ?? '';
      if (!email || !startDate || !endDate)
        throw new AppError('email, startDate, endDate required', 400);
      const summary = await service.getSummary(email, startDate, endDate);
      res.json(summary);
    }),
  );

  return router;
}

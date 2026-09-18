import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { isTenantAdmin } from '../tenant/admin-access';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService, type RosterPort } from '../services/clock-service';

/**
 * Clock routes:
 *   POST /api/clock          — clock in/out/break/back
 *   GET  /api/attendance     — get attendance board for a date
 */
export function createClockRouter(
  db: DatabaseEngine,
  logger: Logger,
  roster?: RosterPort,
): Router {
  const router = Router();
  const repo = new ClockRepository(db);
  const service = new ClockService(repo, logger, undefined, roster);

  /**
   * POST /api/clock
   * Body: { action: 'in'|'out'|'break'|'back', email: string, name: string }
   */
  router.post(
    '/clock',
    asyncHandler(async (req: Request, res: Response) => {
      const { action, email, name } = req.body as {
        action?: string;
        email?: string;
        name?: string;
      };

      if (!action || typeof action !== 'string') {
        throw new AppError('action is required (in, out, break, back)', 400);
      }
      if (!email || typeof email !== 'string') {
        throw new AppError('email is required', 400);
      }

      const caller = (req.identity?.email ?? '').toLowerCase().trim();
      if (!caller) {
        throw new AppError('Authentication required', 401);
      }

      const cleanEmail = email.toLowerCase().trim();
      const cleanName = (name || email).trim();
      const isSelf = caller === cleanEmail;
      if (!isSelf && !(await isTenantAdmin(db, caller))) {
        throw new AppError('Admin access required to clock another employee', 403);
      }

      const source = isSelf ? 'manual' : 'admin';

      const result = await service.clock(action, cleanEmail, cleanName, source);

      if (result.blocked) {
        res.status(200).json(result);
        return;
      }
      if (result.duplicate) {
        res.status(200).json(result);
        return;
      }

      res.json(result);
    }),
  );

  /**
   * GET /api/attendance?date=YYYY-MM-DD
   * Returns attendance board data for the given date.
   */
  router.get(
    '/attendance',
    asyncHandler(async (req: Request, res: Response) => {
      const caller = (req.identity?.email ?? '').toLowerCase().trim();
      if (!caller) {
        throw new AppError('Authentication required', 401);
      }

      const date = req.query.date as string | undefined;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError('date query parameter required in YYYY-MM-DD format', 400);
      }

      const board = await service.getBoard(date);
      res.json(board);
    }),
  );

  return router;
}

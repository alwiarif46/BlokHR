import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { RegularizationRepository } from '../repositories/regularization-repository';
import { ClockRepository } from '../repositories/clock-repository';
import { RegularizationService } from '../services/regularization-service';
import type { NotificationDispatcher } from '../services/notification/dispatcher';

/**
 * Regularization routes:
 *   POST /api/regularizations              — submit a correction request
 *   GET  /api/regularizations?email=       — get corrections for an employee
 *   PUT  /api/regularizations/:id/approve  — approve (manager or HR)
 *   PUT  /api/regularizations/:id/reject   — reject with comments
 */
export function createRegularizationRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const repo = new RegularizationRepository(db);
  const clockRepo = new ClockRepository(db);
  const service = new RegularizationService(repo, clockRepo, db, dispatcher ?? null, logger);

  /** POST /api/regularizations */
  router.post(
    '/regularizations',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, name, date, correctionType, inTime, outTime, reason } = req.body as {
        email?: string;
        name?: string;
        date?: string;
        correctionType?: string;
        inTime?: string;
        outTime?: string;
        reason?: string;
      };

      if (!email) throw new AppError('email is required', 400);
      if (!date) throw new AppError('date is required', 400);
      if (!reason) throw new AppError('reason is required', 400);

      const result = await service.submit({
        email: email.toLowerCase().trim(),
        name: name ?? email,
        date,
        correctionType: correctionType ?? 'both',
        inTime: inTime ?? '',
        outTime: outTime ?? '',
        reason,
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to submit correction', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/regularizations?email= */
  router.get(
    '/regularizations',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) throw new AppError('email query parameter required', 400);

      const regularizations = await service.getByEmail(email.toLowerCase().trim());
      res.json({ regularizations });
    }),
  );

  /** PUT /api/regularizations/:id/approve */
  router.put(
    '/regularizations/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { role, approverEmail } = req.body as {
        role?: string;
        approverEmail?: string;
      };

      if (!role || (role !== 'manager' && role !== 'hr')) {
        throw new AppError('role must be "manager" or "hr"', 400);
      }

      const result = await service.approve(id, role, approverEmail ?? req.identity?.email ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to approve', 400);
      }
      res.json(result);
    }),
  );

  /** PUT /api/regularizations/:id/reject */
  router.put(
    '/regularizations/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { approverEmail, comments } = req.body as {
        approverEmail?: string;
        comments?: string;
      };

      const result = await service.reject(
        id,
        approverEmail ?? req.identity?.email ?? '',
        comments ?? '',
      );

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject', 400);
      }
      res.json(result);
    }),
  );

  return router;
}

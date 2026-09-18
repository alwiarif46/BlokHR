import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { isTenantAdmin } from '../tenant/admin-access';
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
      const { name, date, correctionType, inTime, outTime, reason } = req.body as {
        name?: string;
        date?: string;
        correctionType?: string;
        inTime?: string;
        outTime?: string;
        reason?: string;
      };

      const applicantEmail = (req.identity?.email ?? '').toLowerCase().trim();
      if (!applicantEmail) throw new AppError('Authentication required', 401);
      if (!date) throw new AppError('date is required', 400);
      if (!reason) throw new AppError('reason is required', 400);

      const result = await service.submit({
        email: applicantEmail,
        name: name ?? applicantEmail,
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
      const caller = (req.identity?.email ?? '').toLowerCase().trim();
      if (!caller) throw new AppError('Authentication required', 401);

      const requested =
        (req.query.email as string | undefined)?.toLowerCase().trim() || caller;
      if (requested !== caller && !(await isTenantAdmin(db, caller))) {
        throw new AppError('Forbidden', 403);
      }

      const regularizations = await service.getByEmail(requested);
      res.json({ regularizations });
    }),
  );

  /** PUT /api/regularizations/:id/approve */
  router.put(
    '/regularizations/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { role } = req.body as {
        role?: string;
      };
      const approverEmail = (req.identity?.email ?? '').toLowerCase().trim();
      if (!approverEmail) throw new AppError('Authentication required', 401);

      if (!role || (role !== 'manager' && role !== 'hr')) {
        throw new AppError('role must be "manager" or "hr"', 400);
      }

      const result = await service.approve(id, role, approverEmail);

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
      const { comments } = req.body as {
        comments?: string;
      };
      const approverEmail = (req.identity?.email ?? '').toLowerCase().trim();
      if (!approverEmail) throw new AppError('Authentication required', 401);

      const result = await service.reject(id, approverEmail, comments ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject', 400);
      }
      res.json(result);
    }),
  );

  return router;
}

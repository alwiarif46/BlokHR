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
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { date, correctedClockIn, correctedClockOut, reason } = req.body as {
        date?: string;
        correctedClockIn?: string | null;
        correctedClockOut?: string | null;
        reason?: string;
      };

      if (!date) throw new AppError('date is required', 400);
      if (!reason) throw new AppError('reason is required', 400);

      let correctionType = 'both';
      if (correctedClockIn && !correctedClockOut) correctionType = 'clock-in';
      if (!correctedClockIn && correctedClockOut) correctionType = 'clock-out';

      const result = await service.submit({
        email: callerEmail.toLowerCase().trim(),
        name: req.identity?.name ?? callerEmail,
        date,
        correctionType,
        inTime: correctedClockIn ?? '',
        outTime: correctedClockOut ?? '',
        reason,
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to submit correction', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/regularizations */
  router.get(
    '/regularizations',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);
      
      const email = (req.query.email as string) || callerEmail;
      
      // If fetching for someone else, must be their manager or an admin
      if (email.toLowerCase().trim() !== callerEmail.toLowerCase().trim()) {
        const isAdmin = await repo.isAdmin(callerEmail);
        const member = await repo.getMember(email);
        if (!isAdmin && member?.reports_to !== callerEmail) {
           throw new AppError('Unauthorized to view these regularizations', 403);
        }
      }

      const regularizations = await service.getByEmail(email.toLowerCase().trim());
      res.json({ regularizations });
    }),
  );

  /** PUT /api/regularizations/:id/approve */
  router.put(
    '/regularizations/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { id } = req.params;

      const result = await service.approve(id, callerEmail);

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
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { id } = req.params;
      const { reason } = req.body as {
        reason?: string;
      };

      const result = await service.reject(id, callerEmail, reason ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject', 400);
      }
      res.json(result);
    }),
  );

  return router;
}

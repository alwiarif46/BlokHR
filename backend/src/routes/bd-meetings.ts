import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { BdMeetingRepository } from '../repositories/bd-meeting-repository';
import { BdMeetingService } from '../services/bd-meeting-service';
import type { NotificationDispatcher } from '../services/notification/dispatcher';

/**
 * BD Meeting routes (Business Development department ONLY):
 *   POST /api/bd-meetings              — submit a meeting qualification request
 *   GET  /api/bd-meetings?email=       — get meetings for an employee
 *   POST /api/bd-meetings/qualify      — qualify a pending meeting (manager/admin)
 *   POST /api/bd-meetings/approve      — approve a qualified meeting (admin/HR)
 *   POST /api/bd-meetings/reject       — reject with reason (any open stage)
 */
export function createBdMeetingRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const repo = new BdMeetingRepository(db);
  const service = new BdMeetingService(repo, db, dispatcher ?? null, logger);

  /** POST /api/bd-meetings — submit a new BD meeting request. */
  router.post(
    '/bd-meetings',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { date, time, client, location, notes } = req.body as {
        date?: string;
        time?: string;
        client?: string;
        location?: string;
        notes?: string;
      };

      if (!date) throw new AppError('date is required', 400);
      if (!client) throw new AppError('client is required', 400);

      const result = await service.submit({
        email: callerEmail.toLowerCase().trim(),
        name: req.identity?.name ?? callerEmail,
        client: client.trim(),
        date,
        time: time ?? '',
        location: location ?? '',
        notes: notes ?? '',
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to submit BD meeting', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/bd-meetings — list BD meetings. */
  router.get(
    '/bd-meetings',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const email = (req.query.email as string) || callerEmail;

      if (email.toLowerCase().trim() !== callerEmail.toLowerCase().trim()) {
        const canView = await service.canManage(callerEmail, email);
        if (!canView) {
          throw new AppError('Unauthorized to view these BD meetings', 403);
        }
      }

      const meetings = await service.getByEmail(email.toLowerCase().trim());
      res.json({ meetings });
    }),
  );

  /** POST /api/bd-meetings/qualify — qualify a pending BD meeting. */
  router.post(
    '/bd-meetings/qualify',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { meetingId } = req.body as {
        meetingId?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const result = await service.qualify(meetingId, callerEmail);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to qualify', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/bd-meetings/approve — approve a qualified BD meeting. */
  router.post(
    '/bd-meetings/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { meetingId } = req.body as {
        meetingId?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const result = await service.approve(meetingId, callerEmail);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to approve', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/bd-meetings/reject — reject a BD meeting at any open stage. */
  router.post(
    '/bd-meetings/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const { meetingId, reason } = req.body as {
        meetingId?: string;
        reason?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const result = await service.reject(meetingId, callerEmail, reason ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject', 400);
      }
      res.json(result);
    }),
  );

  return router;
}

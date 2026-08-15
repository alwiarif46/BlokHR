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
      const { email, name, client, date, time, location, notes } = req.body as {
        email?: string;
        name?: string;
        client?: string;
        date?: string;
        time?: string;
        location?: string;
        notes?: string;
      };

      if (!email) throw new AppError('email is required', 400);
      if (!date) throw new AppError('date is required', 400);
      if (!client) throw new AppError('client is required', 400);

      const result = await service.submit({
        email: email.toLowerCase().trim(),
        name: name ?? email,
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

  /** GET /api/bd-meetings?email= — list BD meetings for an employee. */
  router.get(
    '/bd-meetings',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) throw new AppError('email query parameter required', 400);

      const meetings = await service.getByEmail(email.toLowerCase().trim());
      res.json({ meetings });
    }),
  );

  /** POST /api/bd-meetings/qualify — qualify a pending BD meeting. */
  router.post(
    '/bd-meetings/qualify',
    asyncHandler(async (req: Request, res: Response) => {
      const { meetingId, approverEmail } = req.body as {
        meetingId?: string;
        approverEmail?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const qualifier = approverEmail ?? req.identity?.email ?? '';
      const result = await service.qualify(meetingId, qualifier);

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
      const { meetingId, approverEmail } = req.body as {
        meetingId?: string;
        approverEmail?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const approver = approverEmail ?? req.identity?.email ?? '';
      const result = await service.approve(meetingId, approver);

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
      const { meetingId, approverEmail, reason } = req.body as {
        meetingId?: string;
        approverEmail?: string;
        reason?: string;
      };

      if (!meetingId) throw new AppError('meetingId is required', 400);

      const rejector = approverEmail ?? req.identity?.email ?? '';
      const result = await service.reject(meetingId, rejector, reason ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject', 400);
      }
      res.json(result);
    }),
  );

  return router;
}

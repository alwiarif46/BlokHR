import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import { MeetingRepository } from '../repositories/meeting-repository';
import { MeetingService } from '../services/meeting-service';

/**
 * Tracked Meeting routes:
 *   GET  /api/meetings                        — list all tracked meetings
 *   POST /api/meetings                        — add a meeting manually
 *   PUT  /api/meetings/:id                    — enrich/update a meeting
 *   GET  /api/meetings/attendance              — get all attendance data (grouped)
 *   GET  /api/meetings/discover-all            — discover from all configured platforms
 *   POST /api/meetings/:id/sync-attendance     — pull attendance from meeting's platform API
 */
export function createMeetingRouter(db: DatabaseEngine, logger: Logger, config: AppConfig): Router {
  const router = Router();
  const repo = new MeetingRepository(db);
  const service = new MeetingService(repo, logger, config);

  /** GET /api/meetings — list all tracked meetings. */
  router.get(
    '/meetings',
    asyncHandler(async (_req: Request, res: Response) => {
      const meetings = await service.getAll();
      res.json({ meetings });
    }),
  );

  /** POST /api/meetings — add a tracked meeting manually. */
  router.post(
    '/meetings',
    asyncHandler(async (req: Request, res: Response) => {
      const { name, joinUrl, client, purpose, addedBy } = req.body as {
        name?: string;
        joinUrl?: string;
        client?: string;
        purpose?: string;
        addedBy?: string;
      };

      if (!name) throw new AppError('Meeting name is required', 400);

      const result = await service.addMeeting({
        name: name.trim(),
        joinUrl: (joinUrl ?? '').trim(),
        client: (client ?? '').trim(),
        purpose: (purpose ?? '').trim(),
        addedBy: addedBy ?? req.identity?.email ?? '',
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to add meeting', 400);
      }

      res.json(result);
    }),
  );

  /** PUT /api/meetings/:id — enrich a meeting with client/purpose. */
  router.put(
    '/meetings/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { client, purpose } = req.body as {
        client?: string;
        purpose?: string;
      };

      const result = await service.update(id, {
        client: client?.trim(),
        purpose: purpose?.trim(),
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to update meeting', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/meetings/attendance — get all attendance data grouped by meeting+date. */
  router.get(
    '/meetings/attendance',
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await service.getAttendance();
      res.json(data);
    }),
  );

  /**
   * GET /api/meetings/discover-all — discover from all configured platforms.
   *
   * Query params (all optional — platforms without credentials return []):
   *   userId         — Teams user ID for Graph API
   *   googleEmail    — Google Calendar email
   *   zoomUserId     — Zoom user ID or email
   *   webexEmail     — Webex host email
   *   gotoOrganizerKey — GoToMeeting organizer key
   *   bluejeansUserId — BlueJeans user ID
   */
  router.get(
    '/meetings/discover-all',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req.query.userId as string) ?? '';
      const googleEmail = (req.query.googleEmail as string) ?? '';
      const zoomUserId = (req.query.zoomUserId as string) ?? '';
      const webexEmail = (req.query.webexEmail as string) ?? '';
      const gotoOrganizerKey = (req.query.gotoOrganizerKey as string) ?? '';
      const bluejeansUserId = (req.query.bluejeansUserId as string) ?? '';

      const result = await service.discoverAll(
        userId,
        googleEmail,
        zoomUserId,
        webexEmail,
        gotoOrganizerKey,
        bluejeansUserId,
      );

      res.json(result);
    }),
  );

  /**
   * POST /api/meetings/:id/sync-attendance — pull attendance from the meeting's platform API.
   * Body: { sessionDate?: string } — defaults to today.
   */
  router.post(
    '/meetings/:id/sync-attendance',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { sessionDate } = req.body as { sessionDate?: string };

      const result = await service.syncAttendance(
        id,
        sessionDate ?? new Date().toISOString().split('T')[0],
      );

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to sync attendance', 400);
      }

      res.json(result);
    }),
  );

  return router;
}

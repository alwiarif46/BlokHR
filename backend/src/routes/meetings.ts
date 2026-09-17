import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import { MeetingRepository } from '../repositories/meeting-repository';
import { MeetingService } from '../services/meeting-service';
import {
  UserCalendarService,
  defaultCalendarRange,
  parseCalendarProvider,
  parseOAuthCalendarProvider,
  parsePlatformCalendarProvider,
} from '../services/user-calendar-service';

/**
 * Tracked Meeting + personal calendar routes:
 *   GET  /api/meetings                        — list all tracked meetings
 *   POST /api/meetings                        — add a meeting manually
 *   PUT  /api/meetings/:id                    — enrich/update a meeting
 *   GET  /api/meetings/attendance              — get all attendance data (grouped)
 *   GET  /api/meetings/discover-all            — discover from all configured platforms
 *   POST /api/meetings/:id/sync-attendance     — pull attendance from meeting's platform API
 *   GET  /api/meetings/calendar/status         — personal calendar connection status
 *   GET  /api/meetings/calendar/connect/:provider
 *   GET  /api/meetings/calendar/callback/:provider
 *   DELETE /api/meetings/calendar/connect/:provider
 *   GET  /api/meetings/my-calendar
 *   GET  /api/meetings/calendar/org            — admin: all connected users' events
 */
export function createMeetingRouter(db: DatabaseEngine, logger: Logger, config: AppConfig): Router {
  const router = Router();
  const repo = new MeetingRepository(db);
  const service = new MeetingService(repo, logger, config);
  const calendar = new UserCalendarService(db, logger, config);

  async function requireAuth(req: Request): Promise<string> {
    const email = req.identity?.email ?? '';
    if (!email) throw new AppError('Authentication required', 401);
    return email.toLowerCase().trim();
  }

  async function requireAdmin(req: Request): Promise<string> {
    const email = await requireAuth(req);
    const isAdmin = await db.get('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [getTenantId(), email]);
    if (!isAdmin) throw new AppError('Admin access required', 403);
    return email;
  }

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

  // ── Personal calendar (before /meetings/:id) ──

  router.get(
    '/meetings/calendar/status',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const status = await calendar.getStatus(email);
      res.json(status);
    }),
  );

  router.get(
    '/meetings/calendar/connect/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const provider = parseOAuthCalendarProvider(req.params.provider);
      if (!provider) {
        throw new AppError(
          'Use POST /api/meetings/calendar/link/:provider for Zoom/Webex/GoTo/BlueJeans',
          400,
        );
      }
      try {
        const result = await calendar.buildAuthorizeUrl(email, provider);
        res.json(result);
      } catch (err) {
        throw new AppError(err instanceof Error ? err.message : 'Connect failed', 400);
      }
    }),
  );

  /** POST /api/meetings/calendar/link/:provider — link Zoom/Webex/GoTo/BlueJeans identity */
  router.post(
    '/meetings/calendar/link/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const provider = parsePlatformCalendarProvider(req.params.provider);
      if (!provider) {
        throw new AppError('provider must be zoom, webex, gotomeeting, or bluejeans', 400);
      }
      const body = (req.body ?? {}) as { externalUserId?: string };
      try {
        const result = await calendar.linkPlatform(email, provider, body.externalUserId);
        res.json(result);
      } catch (err) {
        throw new AppError(err instanceof Error ? err.message : 'Link failed', 400);
      }
    }),
  );

  router.get(
    '/meetings/calendar/callback/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const provider = parseOAuthCalendarProvider(req.params.provider);
      if (!provider) {
        res.redirect(calendar.frontendRedirectUrl(false, 'Invalid provider'));
        return;
      }
      const error = req.query.error as string | undefined;
      if (error) {
        res.redirect(calendar.frontendRedirectUrl(false, error));
        return;
      }
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      if (!code || !state) {
        res.redirect(calendar.frontendRedirectUrl(false, 'Missing code or state'));
        return;
      }
      try {
        await calendar.handleCallback(provider, code, state);
        res.redirect(calendar.frontendRedirectUrl(true));
      } catch (err) {
        logger.warn({ err, provider }, 'Calendar OAuth callback failed');
        res.redirect(
          calendar.frontendRedirectUrl(
            false,
            err instanceof Error ? err.message : 'Callback failed',
          ),
        );
      }
    }),
  );

  router.delete(
    '/meetings/calendar/connect/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const provider = parseCalendarProvider(req.params.provider);
      if (!provider) throw new AppError('provider must be microsoft or google', 400);
      const removed = await calendar.disconnect(email, provider);
      res.json({ success: true, removed });
    }),
  );

  router.get(
    '/meetings/my-calendar',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const range = defaultCalendarRange();
      const from = (req.query.from as string) || range.from;
      const to = (req.query.to as string) || range.to;
      const events = await calendar.getMyCalendar(email, from, to);
      res.json({ events, from, to });
    }),
  );

  router.get(
    '/meetings/calendar/org',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const range = defaultCalendarRange();
      const from = (req.query.from as string) || range.from;
      const to = (req.query.to as string) || range.to;
      const filterEmail = (req.query.email as string | undefined)?.toLowerCase().trim();
      const events = await calendar.getOrgCalendar(from, to, filterEmail || undefined);
      res.json({ events, from, to });
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

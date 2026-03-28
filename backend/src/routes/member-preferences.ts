import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { MemberPreferencesService } from '../services/member-preferences-service';

/**
 * Member Preferences routes:
 *   GET  /api/profiles/me/prefs — returns prefs for calling user
 *   PUT  /api/profiles/me/prefs — upserts partial prefs for calling user
 */
export function createMemberPreferencesRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const service = new MemberPreferencesService(db, logger);

  router.get(
    '/profiles/me/prefs',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const prefs = await service.getPrefs(email);
      res.json(prefs);
    }),
  );

  router.put(
    '/profiles/me/prefs',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);

      const body = req.body as Record<string, unknown>;
      const result = await service.updatePrefs(email, body);
      if (!result.success) {
        throw new AppError(result.error ?? 'Validation failed', 400);
      }
      res.json(result.prefs);
    }),
  );

  return router;
}

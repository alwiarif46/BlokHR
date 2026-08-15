import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { FeatureFlagService } from '../services/feature-flags';

/**
 * Feature Flags routes:
 *   GET  /api/features           — list all features (admin: all, others: enabled only)
 *   GET  /api/features/enabled   — list enabled features only (frontend discovery)
 *   PUT  /api/features/:key      — toggle a single feature on/off (admin-only)
 *   PUT  /api/features           — bulk update multiple features (admin-only)
 */
export function createFeatureFlagsRouter(
  featureFlags: FeatureFlagService,
  _logger: Logger,
  db?: DatabaseEngine,
): Router {
  const router = Router();

  router.get(
    '/features',
    asyncHandler(async (req: Request, res: Response) => {
      // Backward compat: ?all=true returns all flags (original behavior)
      if (req.query.all === 'true') {
        const flags = await featureFlags.getAll();
        res.json({ features: flags });
        return;
      }
      const callerEmail = req.identity?.email ?? '';
      let isAdmin = false;
      if (callerEmail && db) {
        const admin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
        isAdmin = !!admin;
      }
      const flags = await featureFlags.getForUser(isAdmin);
      res.json({ features: flags });
    }),
  );

  router.get(
    '/features/enabled',
    asyncHandler(async (_req: Request, res: Response) => {
      const flags = await featureFlags.getEnabled();
      res.json({ features: flags.map(f => ({ key: f.key, label: f.label, category: f.category })) });
    }),
  );

  router.put(
    '/features/:key',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const enabled = body.enabled;
      if (typeof enabled !== 'boolean') throw new AppError('enabled (boolean) is required', 400);
      const updatedBy = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      if (!updatedBy) throw new AppError('email is required', 400);

      // Admin-only enforcement
      if (db) {
        const admin = await db.get('SELECT email FROM admins WHERE email = ?', [updatedBy]);
        if (!admin) throw new AppError('Admin access required', 403);
      }

      const result = await featureFlags.toggle(req.params.key, enabled, updatedBy);
      if (!result.success) throw new AppError(result.error ?? 'Toggle failed', 400);
      res.json({ success: true, feature: req.params.key, enabled });
    }),
  );

  router.put(
    '/features',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const updates = body.updates as Array<{ key: string; enabled: boolean }> | undefined;
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new AppError('updates array is required', 400);
      }
      const updatedBy = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      if (!updatedBy) throw new AppError('email is required', 400);

      // Admin-only enforcement
      if (db) {
        const admin = await db.get('SELECT email FROM admins WHERE email = ?', [updatedBy]);
        if (!admin) throw new AppError('Admin access required', 403);
      }

      const result = await featureFlags.bulkUpdate(updates, updatedBy);
      res.json(result);
    }),
  );

  return router;
}

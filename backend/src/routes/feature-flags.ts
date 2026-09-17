import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import { AppError, asyncHandler } from '../app';
import { FeatureFlagService, type FeatureFlag } from '../services/feature-flags';
import { TenantSettingsService } from '../services/tenant-settings-service';

/**
 * Synthetic flag the shell uses to gate the school module group. It is derived
 * from the tenant vertical rather than stored, because the vertical is chosen
 * once at setup and is immutable — an independently toggleable flag would let
 * the two disagree.
 */
export const SCHOOL_VERTICAL_FLAG = 'school_vertical';

function schoolVerticalFlag(enabled: boolean): FeatureFlag {
  return {
    key: SCHOOL_VERTICAL_FLAG,
    enabled,
    label: 'School vertical',
    description: 'Derived from the tenant vertical; not directly toggleable.',
    category: 'vertical',
    adminOnly: false,
    updatedBy: 'system',
    updatedAt: '',
  };
}

/**
 * Feature Flags routes:
 *   GET  /api/features           — list all features (admin: all, others: enabled only)
 *   GET  /api/features/enabled   — list enabled features only (frontend discovery)
 *   PUT  /api/features/:key      — toggle a single feature on/off (admin-only)
 *   PUT  /api/features           — bulk update multiple features (admin-only)
 */
export function createFeatureFlagsRouter(
  featureFlags: FeatureFlagService,
  logger: Logger,
  db?: DatabaseEngine,
  tenantSettings?: TenantSettingsService,
): Router {
  const router = Router();
  const tenants = tenantSettings ?? (db ? new TenantSettingsService(db, logger) : null);

  async function isSchoolVertical(): Promise<boolean> {
    if (!tenants) return false;
    return (await tenants.getVertical()) === 'school';
  }

  router.get(
    '/features',
    asyncHandler(async (req: Request, res: Response) => {
      // Backward compat: ?all=true returns all flags (original behavior)
      if (req.query.all === 'true') {
        const flags = await featureFlags.getAll();
        res.json({ features: [...flags, schoolVerticalFlag(await isSchoolVertical())] });
        return;
      }
      const callerEmail = req.identity?.email ?? '';
      let isAdmin = false;
      if (callerEmail && db) {
        const admin = await db.get('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [getTenantId(), callerEmail]);
        isAdmin = !!admin;
      }
      const flags = await featureFlags.getForUser(isAdmin);
      res.json({ features: [...flags, schoolVerticalFlag(await isSchoolVertical())] });
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
      if (req.params.key === SCHOOL_VERTICAL_FLAG) {
        throw new AppError('school_vertical is derived from the tenant vertical', 400);
      }
      const updatedBy = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      if (!updatedBy) throw new AppError('email is required', 400);

      // Admin-only enforcement
      if (db) {
        const admin = await db.get('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [getTenantId(), updatedBy]);
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
      if (updates.some(u => u.key === SCHOOL_VERTICAL_FLAG)) {
        throw new AppError('school_vertical is derived from the tenant vertical', 400);
      }
      const updatedBy = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      if (!updatedBy) throw new AppError('email is required', 400);

      // Admin-only enforcement
      if (db) {
        const admin = await db.get('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [getTenantId(), updatedBy]);
        if (!admin) throw new AppError('Admin access required', 403);
      }

      const result = await featureFlags.bulkUpdate(updates, updatedBy);
      res.json(result);
    }),
  );

  return router;
}

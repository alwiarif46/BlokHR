import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { SettingsRepository } from '../repositories/settings-repository';
import { LeaveRepository } from '../repositories/leave-repository';
import { RegularizationRepository } from '../repositories/regularization-repository';
import { BdMeetingRepository } from '../repositories/bd-meeting-repository';
import { MeetingRepository } from '../repositories/meeting-repository';
import { SettingsService } from '../services/settings-service';
import { TenantSettingsService } from '../services/tenant-settings-service';
import type { SseBroadcaster } from '../sse/broadcaster';

/**
 * Settings & Roles routes:
 *   GET  /api/settings                — master settings bundle
 *   PUT  /api/members/:id             — update member profile
 *   GET  /api/user-roles?email=       — resolve user's roles
 *   GET  /api/pending-actions         — pending action counts
 *   GET  /api/pending-actions-detail  — pending action detail
 *   GET  /api/employee-of-month       — current EOM
 */
export function createSettingsRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();
  const settingsRepo = new SettingsRepository(db);
  const leaveRepo = new LeaveRepository(db);
  const regRepo = new RegularizationRepository(db);
  const bdMeetingRepo = new BdMeetingRepository(db);
  const meetingRepo = new MeetingRepository(db);
  const service = new SettingsService(
    settingsRepo,
    leaveRepo,
    regRepo,
    bdMeetingRepo,
    meetingRepo,
    logger,
  );
  const tenantService = new TenantSettingsService(db, logger);

  /** GET /api/settings — full settings bundle for frontend cache + tenant settings. */
  router.get(
    '/settings',
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await service.getSettings();
      const tenant = await tenantService.getFullBundle(true);
      res.json({ ...settings, tenant_settings: tenant });
    }),
  );

  /** POST /api/settings — update tenant settings (admin-only). */
  router.post(
    '/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
      if (!isAdmin) throw new AppError('Admin access required', 403);

      const body = req.body as Record<string, unknown>;
      const columns: Record<string, unknown> = {};
      const columnKeys = ['platform_name', 'company_legal_name', 'logo_data_url', 'login_tagline', 'primary_timezone', 'version'];
      for (const key of columnKeys) {
        if (key in body) columns[key] = body[key];
      }

      const settingsJson = body.settings_json as Record<string, unknown> | undefined;
      await tenantService.updateSettings({
        columns: Object.keys(columns).length > 0 ? columns : undefined,
        settingsJson: settingsJson ?? undefined,
      });

      if (broadcaster) {
        broadcaster.broadcast('settings-update', { source: 'tenant_settings' });
      }

      const updated = await tenantService.getFullBundle(true);
      res.json(updated);
    }),
  );

  /** PUT /api/members/:id — update a member's profile. */
  router.put(
    '/members/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const fields = req.body as Record<string, unknown>;

      if (!fields || typeof fields !== 'object') {
        throw new AppError('Request body must be a JSON object', 400);
      }

      const result = await service.updateMember(id, fields);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to update member', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/user-roles?email= — resolve a user's roles across all scopes. */
  router.get(
    '/user-roles',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) throw new AppError('email query parameter required', 400);

      const roles = await service.getUserRoles(email.toLowerCase().trim());
      res.json(roles);
    }),
  );

  /** GET /api/pending-actions — counts for the pending badge. */
  router.get(
    '/pending-actions',
    asyncHandler(async (_req: Request, res: Response) => {
      const counts = await service.getPendingCounts();
      res.json(counts);
    }),
  );

  /** GET /api/pending-actions-detail — full detail for the pending modal. */
  router.get(
    '/pending-actions-detail',
    asyncHandler(async (_req: Request, res: Response) => {
      const detail = await service.getPendingDetail();
      res.json(detail);
    }),
  );

  /** GET /api/employee-of-month — current employee of the month. */
  router.get(
    '/employee-of-month',
    asyncHandler(async (_req: Request, res: Response) => {
      const eom = await service.getEmployeeOfMonth();
      res.json(eom);
    }),
  );

  return router;
}

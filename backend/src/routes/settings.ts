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

  // ── Lottie Animation endpoints ──

  const VALID_LOTTIE_ACTIONS = new Set(['clock-in', 'clock-out', 'break', 'back']);
  const MAX_LOTTIE_SIZE = 2 * 1024 * 1024; // 2 MB

  /** GET /api/settings/lottie — returns all 4 actions (no file_data). */
  router.get(
    '/settings/lottie',
    asyncHandler(async (_req: Request, res: Response) => {
      const rows = await db.all<{
        action: string; enabled: number; duration_sec: number;
        file_name: string | null; file_size_bytes: number;
      }>(
        'SELECT action, enabled, duration_sec, file_name, file_size_bytes FROM lottie_animations ORDER BY action',
      );
      res.json({ animations: rows.map(r => ({
        action: r.action,
        enabled: r.enabled === 1,
        duration_sec: r.duration_sec,
        file_name: r.file_name,
        file_size_bytes: r.file_size_bytes,
      })) });
    }),
  );

  /** GET /api/settings/lottie/:action — returns file_data for one action. */
  router.get(
    '/settings/lottie/:action',
    asyncHandler(async (req: Request, res: Response) => {
      const { action } = req.params;
      if (!VALID_LOTTIE_ACTIONS.has(action)) throw new AppError('Invalid action', 400);

      const row = await db.get<{
        action: string; file_data: string | null; file_name: string | null;
        file_size_bytes: number; duration_sec: number; enabled: number;
      }>(
        'SELECT * FROM lottie_animations WHERE action = ?',
        [action],
      );
      if (!row) throw new AppError('Animation not found', 404);
      res.json({
        action: row.action,
        file_data: row.file_data,
        file_name: row.file_name,
        file_size_bytes: row.file_size_bytes,
        duration_sec: row.duration_sec,
        enabled: row.enabled === 1,
      });
    }),
  );

  /** PUT /api/settings/lottie/:action — upload or update config. */
  router.put(
    '/settings/lottie/:action',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
      if (!isAdmin) throw new AppError('Admin access required', 403);

      const { action } = req.params;
      if (!VALID_LOTTIE_ACTIONS.has(action)) throw new AppError('Invalid action', 400);

      const body = req.body as Record<string, unknown>;
      const fileData = body.file_data as string | undefined;
      const fileName = body.file_name as string | undefined;
      const fileSizeBytes = body.file_size_bytes as number | undefined;
      const durationSec = body.duration_sec as number | undefined;
      const enabled = body.enabled as boolean | undefined;

      // Validate file_data if provided
      if (fileData !== undefined) {
        if (typeof fileData !== 'string') throw new AppError('file_data must be a string', 400);
        if (fileData.length > MAX_LOTTIE_SIZE) throw new AppError('file_data exceeds 2 MB limit', 400);
        try {
          JSON.parse(fileData);
        } catch {
          throw new AppError('file_data must be valid JSON', 400);
        }
      }

      // Validate duration
      if (durationSec !== undefined && (durationSec < 1 || durationSec > 10)) {
        throw new AppError('duration_sec must be between 1 and 10', 400);
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      if (fileData !== undefined) { sets.push('file_data = ?'); params.push(fileData); }
      if (fileName !== undefined) { sets.push('file_name = ?'); params.push(fileName); }
      if (fileSizeBytes !== undefined) { sets.push('file_size_bytes = ?'); params.push(fileSizeBytes); }
      if (durationSec !== undefined) { sets.push('duration_sec = ?'); params.push(durationSec); }
      if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
      sets.push('uploaded_by = ?'); params.push(callerEmail);
      sets.push("updated_at = datetime('now')");
      params.push(action);

      await db.run(
        `UPDATE lottie_animations SET ${sets.join(', ')} WHERE action = ?`,
        params,
      );

      res.json({ success: true });
    }),
  );

  /** DELETE /api/settings/lottie/:action — clear file_data and disable. */
  router.delete(
    '/settings/lottie/:action',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
      if (!isAdmin) throw new AppError('Admin access required', 403);

      const { action } = req.params;
      if (!VALID_LOTTIE_ACTIONS.has(action)) throw new AppError('Invalid action', 400);

      await db.run(
        "UPDATE lottie_animations SET file_data = NULL, enabled = 0, updated_at = datetime('now') WHERE action = ?",
        [action],
      );
      res.json({ success: true });
    }),
  );

  return router;
}

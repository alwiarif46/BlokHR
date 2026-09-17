import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { DirectoryService } from '@blokhr/directory';
import type { SseBroadcaster } from '../sse/broadcaster';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { isTenantAdmin } from '../tenant/admin-access';
import { getTenantId } from '../tenant/context';
import { TenantSettingsService } from '../services/tenant-settings-service';
import { RoleAccessService } from '../services/role-access-service';

/**
 * Roles & Access + member role assignment.
 *   GET  /api/settings/role-access
 *   PUT  /api/settings/role-access
 *   PATCH /api/members/:id/role
 */
export function createRoleAccessRouter(
  db: DatabaseEngine,
  logger: Logger,
  roleAccess: RoleAccessService,
  broadcaster?: SseBroadcaster,
  directory?: DirectoryService,
): Router {
  const router = Router();
  const tenants = new TenantSettingsService(db, logger);
  const audit = new AuditService(db, logger);

  router.get(
    '/settings/role-access',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.identity?.email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('Authentication required', 401);
      const vertical = await tenants.getVertical();
      const bundle = await roleAccess.getBundle(vertical);
      res.json(bundle);
    }),
  );

  router.put(
    '/settings/role-access',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.identity?.email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('Authentication required', 401);
      if (!(await isTenantAdmin(db, email))) {
        throw new AppError('Admin access required', 403);
      }

      const body = (req.body ?? {}) as {
        overrides?: Array<{ role?: string; moduleKey?: string; visible?: boolean }>;
      };
      const overrides = Array.isArray(body.overrides) ? body.overrides : [];
      const vertical = await tenants.getVertical();
      const result = await roleAccess.applyOverrides(
        overrides.map((o) => ({
          role: String(o.role ?? ''),
          moduleKey: String(o.moduleKey ?? ''),
          visible: !!o.visible,
        })),
        email,
        vertical,
      );
      if (!result.success) {
        throw new AppError(result.error ?? 'update_failed', result.status ?? 400);
      }

      await audit
        .log({
          entityType: 'role_module_visibility',
          entityId: getTenantId(),
          action: 'role_access_updated',
          actorEmail: email,
          actorName: req.identity?.name,
          detail: { overrides },
          correlationId: (req as Request & { correlationId?: string }).correlationId,
        })
        .catch((err) => logger.warn({ err }, 'audit log failed'));

      if (broadcaster) {
        broadcaster.broadcast('settings-update', { source: 'role_access' });
      }
      const bundle = await roleAccess.getBundle(vertical);
      res.json(bundle);
    }),
  );

  router.patch(
    '/members/:id/role',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.identity?.email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('Authentication required', 401);
      if (!(await isTenantAdmin(db, email))) {
        throw new AppError('Admin access required', 403);
      }

      const { id } = req.params;
      const body = (req.body ?? {}) as { role?: string };
      const vertical = await tenants.getVertical();
      const result = await roleAccess.changeMemberRole({
        memberId: id,
        newRole: String(body.role ?? ''),
        vertical,
        actorEmail: email,
        directory: directory
          ? {
              updateMember: (memberId, input, tenantId) =>
                directory.updateMember(memberId, input, tenantId),
            }
          : undefined,
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'update_failed', result.status ?? 400);
      }

      await audit
        .log({
          entityType: 'member',
          entityId: result.memberId ?? id,
          action: 'role_changed',
          actorEmail: email,
          actorName: req.identity?.name,
          detail: { from: result.from, to: result.to, email: result.email },
          correlationId: (req as Request & { correlationId?: string }).correlationId,
        })
        .catch((err) => logger.warn({ err }, 'audit log failed'));

      if (broadcaster) {
        broadcaster.broadcast('settings-update', { source: 'member_role' });
      }

      res.json({
        success: true,
        memberId: result.memberId,
        email: result.email,
        from: result.from,
        to: result.to,
      });
    }),
  );

  return router;
}

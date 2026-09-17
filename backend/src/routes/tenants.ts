import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import { TenantProvisionService } from '../services/tenant-provision-service';
import { parseTenantHostMap } from '../tenant/resolve-tenant';

/**
 * Self-serve tenant (workspace) provisioning.
 *   GET  /api/tenants/check/:slug — advisory availability
 *   POST /api/tenants            — atomic claim { slug }
 */
export function createTenantsRouter(
  db: DatabaseEngine,
  logger: Logger,
  config: AppConfig,
): Router {
  const router = Router();
  const service = new TenantProvisionService(db, logger, {
    reservedSlugsRaw: config.tenantReservedSlugs,
    subdomainBase: config.tenantSubdomainBase,
    hostMap: parseTenantHostMap(config.tenantHostMap),
  });

  const checkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many slug checks, please try again later' },
  });

  const claimLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many workspace claims, please try again later' },
  });

  router.get(
    '/tenants/check/:slug',
    checkLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.checkSlug(String(req.params.slug ?? ''));
      if (result.status === 'invalid') {
        throw new AppError('invalid_slug', 400);
      }
      res.json({ slug: result.slug, status: result.status });
    }),
  );

  router.post(
    '/tenants',
    claimLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as { slug?: string };
      const result = await service.claimSlug(String(body.slug ?? ''));
      if (!result.success) {
        throw new AppError(result.error ?? 'claim_failed', result.statusCode);
      }
      res.status(201).json({
        tenantId: result.tenantId,
        workspaceUrl: result.workspaceUrl,
      });
    }),
  );

  return router;
}

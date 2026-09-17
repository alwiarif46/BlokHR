import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import type { EntitlementsService } from '@blokhr/entitlements';
import type { DirectoryService } from '@blokhr/directory';
import { AppError, asyncHandler } from '../app';
import { SetupService } from '../services/setup-service';
import { isApexHost, normalizeHost, parseHostList } from '../tenant/resolve-tenant';

/**
 * Setup Wizard routes (3-screen first-run):
 *   GET  /api/setup/status  — check if setup is complete + current step + branding state
 *   POST /api/setup/step1   — save company & branding
 *   POST /api/setup/step2   — save auth configuration
 *   POST /api/setup/step3   — admin + trial (cloud) or signed license (self-hosted)
 */
export function createSetupRouter(
  db: DatabaseEngine,
  logger: Logger,
  config: AppConfig,
  entitlements?: EntitlementsService,
  directory?: DirectoryService,
): Router {
  const router = Router();
  const apexHosts = parseHostList(config.tenantApexHosts);
  const subdomainBase = (config.tenantSubdomainBase || '').trim().toLowerCase();
  const service = new SetupService(db, logger, {
    deploymentMode: config.deploymentMode,
    tenantId: config.defaultTenantId,
    trialSeatLimit: config.trialSeatLimit,
    entitlements,
    directory,
  });

  function requestHost(req: Request): string {
    const forwarded = String(req.headers['x-forwarded-host'] ?? '').split(',')[0];
    return normalizeHost(forwarded || String(req.headers.host ?? ''));
  }

  function assertNotApex(req: Request): void {
    if (apexHosts.size === 0) return;
    if (isApexHost(requestHost(req), apexHosts)) {
      throw new AppError('use_workspace_subdomain', 400);
    }
  }

  /** GET /api/setup/status — returns setup state. */
  router.get(
    '/setup/status',
    asyncHandler(async (req: Request, res: Response) => {
      const host = requestHost(req);
      const signupPortal = apexHosts.size > 0 && isApexHost(host, apexHosts);
      const status = await service.getStatus();
      res.json({
        ...status,
        signupPortal,
        subdomainBase: subdomainBase || null,
      });
    }),
  );

  /** POST /api/setup/step1 — Company & Branding. */
  router.post(
    '/setup/step1',
    asyncHandler(async (req: Request, res: Response) => {
      assertNotApex(req);
      const {
        companyName,
        tagline,
        logoUrl,
        faviconUrl,
        primaryColor,
        cardFooterText,
        emailFromName,
        emailFromAddress,
      } = req.body as {
        companyName?: string;
        tagline?: string;
        logoUrl?: string;
        faviconUrl?: string;
        primaryColor?: string;
        cardFooterText?: string;
        emailFromName?: string;
        emailFromAddress?: string;
      };

      if (!companyName) throw new AppError('companyName is required', 400);

      const result = await service.saveStep1({
        companyName: companyName.trim(),
        tagline: tagline?.trim(),
        logoUrl: logoUrl?.trim(),
        faviconUrl: faviconUrl?.trim(),
        primaryColor: primaryColor?.trim(),
        cardFooterText: cardFooterText?.trim(),
        emailFromName: emailFromName?.trim(),
        emailFromAddress: emailFromAddress?.trim(),
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to save step 1', result.statusCode ?? 400);
      }

      res.json(result);
    }),
  );

  /** POST /api/setup/step2 — Auth Configuration (local, magic link, optional SSO). */
  router.post(
    '/setup/step2',
    asyncHandler(async (req: Request, res: Response) => {
      assertNotApex(req);
      const {
        authLocalEnabled,
        authMagicLinkEnabled,
        msalClientId,
        msalTenantId,
        googleOAuthClientId,
      } = req.body as {
        authLocalEnabled?: boolean;
        authMagicLinkEnabled?: boolean;
        msalClientId?: string;
        msalTenantId?: string;
        googleOAuthClientId?: string;
      };

      const result = await service.saveStep2({
        authLocalEnabled,
        authMagicLinkEnabled,
        msalClientId: msalClientId?.trim(),
        msalTenantId: msalTenantId?.trim(),
        googleOAuthClientId: googleOAuthClientId?.trim(),
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to save step 2', result.statusCode ?? 400);
      }

      res.json(result);
    }),
  );

  /** POST /api/setup/step3 — Admin & plan. Marks setup_complete = 1. */
  router.post(
    '/setup/step3',
    asyncHandler(async (req: Request, res: Response) => {
      assertNotApex(req);
      const { licenseToken, licenseKey, adminEmail, vertical } = req.body as {
        licenseToken?: string;
        /** @deprecated stub key — ignored on cloud; mapped to licenseToken on self-hosted */
        licenseKey?: string;
        adminEmail?: string;
        vertical?: string;
      };

      if (!adminEmail) throw new AppError('adminEmail is required', 400);
      if (vertical !== undefined && vertical !== 'hr' && vertical !== 'school') {
        throw new AppError('vertical must be hr or school', 400);
      }

      const result = await service.saveStep3({
        adminEmail: adminEmail.toLowerCase().trim(),
        licenseToken: licenseToken?.trim() || licenseKey?.trim(),
        vertical: vertical === 'school' ? 'school' : vertical === 'hr' ? 'hr' : undefined,
      });

      if (!result.success) {
        throw new AppError(
          result.error ?? 'Failed to save step 3',
          result.statusCode ?? 400,
        );
      }

      res.json(result);
    }),
  );

  return router;
}

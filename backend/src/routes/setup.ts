import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { SetupService } from '../services/setup-service';

/**
 * Setup Wizard routes (3-screen first-run):
 *   GET  /api/setup/status  — check if setup is complete + current step + branding state
 *   POST /api/setup/step1   — save company & branding
 *   POST /api/setup/step2   — save auth configuration
 *   POST /api/setup/step3   — save license + first admin + mark complete
 */
export function createSetupRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const service = new SetupService(db, logger);

  /** GET /api/setup/status — returns setup state. */
  router.get(
    '/setup/status',
    asyncHandler(async (_req: Request, res: Response) => {
      const status = await service.getStatus();
      res.json(status);
    }),
  );

  /** POST /api/setup/step1 — Company & Branding. */
  router.post(
    '/setup/step1',
    asyncHandler(async (req: Request, res: Response) => {
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
        throw new AppError(result.error ?? 'Failed to save step 1', 400);
      }

      res.json(result);
    }),
  );

  /** POST /api/setup/step2 — Auth Configuration. */
  router.post(
    '/setup/step2',
    asyncHandler(async (req: Request, res: Response) => {
      const { msalClientId, msalTenantId, googleOAuthClientId } = req.body as {
        msalClientId?: string;
        msalTenantId?: string;
        googleOAuthClientId?: string;
      };

      const result = await service.saveStep2({
        msalClientId: msalClientId?.trim(),
        msalTenantId: msalTenantId?.trim(),
        googleOAuthClientId: googleOAuthClientId?.trim(),
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to save step 2', 400);
      }

      res.json(result);
    }),
  );

  /** POST /api/setup/step3 — License & Admin Setup. Marks setup_complete = 1. */
  router.post(
    '/setup/step3',
    asyncHandler(async (req: Request, res: Response) => {
      const { licenseKey, adminEmail } = req.body as {
        licenseKey?: string;
        adminEmail?: string;
      };

      if (!adminEmail) throw new AppError('adminEmail is required', 400);

      const result = await service.saveStep3({
        licenseKey: licenseKey ?? '',
        adminEmail: adminEmail.toLowerCase().trim(),
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to save step 3', 400);
      }

      res.json(result);
    }),
  );

  return router;
}

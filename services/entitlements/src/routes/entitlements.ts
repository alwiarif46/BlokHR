import { Router, Request, Response, NextFunction } from 'express';
import { EntitlementsService } from '../entitlements-service';
import type { EntitlementPlan, EntitlementStatus, SignedLicenseClaims } from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createEntitlementsRouter(service: EntitlementsService): Router {
  const router = Router();

  router.get(
    '/health',
    (_req, res) => {
      res.json({ status: 'ok', service: 'entitlements' });
    },
  );

  router.get(
    '/:tenantId',
    asyncHandler(async (req, res) => {
      const ent = await service.get(req.params.tenantId);
      if (!ent) {
        res.status(404).json({ error: 'Entitlement not found' });
        return;
      }
      res.json(ent);
    }),
  );

  router.post(
    '/:tenantId/trial',
    asyncHandler(async (req, res) => {
      const seatLimit =
        typeof req.body?.seatLimit === 'number' ? req.body.seatLimit : undefined;
      const verticalRaw = req.body?.vertical;
      const vertical =
        verticalRaw === 'school' || verticalRaw === 'hr' ? verticalRaw : 'hr';
      const ent = await service.startCloudTrial(req.params.tenantId, seatLimit, vertical);
      res.status(201).json(ent);
    }),
  );

  router.put(
    '/:tenantId/subscription',
    asyncHandler(async (req, res) => {
      const { plan, status, seatLimit, modules, renewsAt, source } = req.body as {
        plan?: EntitlementPlan;
        status?: EntitlementStatus;
        seatLimit?: number;
        modules?: string[];
        renewsAt?: string | null;
        source?: 'razorpay' | 'manual';
      };
      if (!plan || !status || typeof seatLimit !== 'number') {
        res.status(400).json({ error: 'plan, status, and seatLimit are required' });
        return;
      }
      const ent = await service.applySubscription({
        tenantId: req.params.tenantId,
        plan,
        status,
        seatLimit,
        modules,
        renewsAt,
        source,
      });
      res.json(ent);
    }),
  );

  router.post(
    '/:tenantId/activate-license',
    asyncHandler(async (req, res) => {
      const licenseToken = (req.body?.licenseToken as string | undefined)?.trim();
      if (!licenseToken) {
        res.status(400).json({ error: 'licenseToken is required' });
        return;
      }
      const result = await service.activateSignedLicense(req.params.tenantId, licenseToken);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result.entitlement);
    }),
  );

  router.post(
    '/licenses/issue',
    asyncHandler(async (req, res) => {
      const claims = req.body as SignedLicenseClaims;
      if (!claims?.tenantId || !claims.plan || !claims.validFrom || !claims.validTo) {
        res.status(400).json({ error: 'Invalid license claims' });
        return;
      }
      if (typeof claims.seatLimit !== 'number') {
        res.status(400).json({ error: 'seatLimit is required' });
        return;
      }
      const token = service.issueSignedLicense({
        ...claims,
        modules: claims.modules ?? [],
      });
      res.status(201).json({ licenseToken: token, claims });
    }),
  );

  router.post(
    '/:tenantId/check-seats',
    asyncHandler(async (req, res) => {
      const activeSeats = Number(req.body?.activeSeats ?? 0);
      const result = await service.checkSeats(req.params.tenantId, activeSeats);
      res.status(result.allowed ? 200 : 403).json(result);
    }),
  );

  router.post(
    '/:tenantId/check-module',
    asyncHandler(async (req, res) => {
      const moduleId = (req.body?.moduleId as string | undefined)?.trim();
      if (!moduleId) {
        res.status(400).json({ error: 'moduleId is required' });
        return;
      }
      const result = await service.canUseModule(req.params.tenantId, moduleId);
      res.status(result.allowed ? 200 : 403).json(result);
    }),
  );

  router.get(
    '/:tenantId/can-write',
    asyncHandler(async (req, res) => {
      const result = await service.canWrite(req.params.tenantId);
      res.status(result.allowed ? 200 : 403).json(result);
    }),
  );

  return router;
}

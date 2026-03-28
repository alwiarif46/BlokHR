import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { AssetService } from '../services/asset-service';

export function createAssetRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new AssetService(db, logger, auditService);

  router.post(
    '/assets',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const b = req.body as Record<string, unknown>;
      if (!b.name) throw new AppError('name is required', 400);
      if (!b.assetTag) throw new AppError('assetTag is required', 400);
      const result = await service.createAsset(
        {
          assetTag: b.assetTag as string,
          assetType: b.assetType as string | undefined,
          name: b.name as string,
          description: b.description as string | undefined,
          serialNumber: b.serialNumber as string | undefined,
          purchaseDate: b.purchaseDate as string | undefined,
          purchaseCost: b.purchaseCost as number | undefined,
          warrantyExpiry: b.warrantyExpiry as string | undefined,
          depreciationMethod: b.depreciationMethod as string | undefined,
          usefulLifeYears: b.usefulLifeYears as number | undefined,
          location: b.location as string | undefined,
          notes: b.notes as string | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ asset: result.data });
    }),
  );

  router.get(
    '/assets',
    asyncHandler(async (req: Request, res: Response) => {
      const assetType = req.query.assetType as string | undefined;
      const status = req.query.status as string | undefined;
      const assets = await service.listAssets({ assetType, status });
      res.json({ assets });
    }),
  );

  router.get(
    '/assets/mine',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const assignments = await service.getMyAssets(email);
      res.json({ assignments });
    }),
  );

  router.get(
    '/assets/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const asset = await service.getAssetById(req.params.id);
      if (!asset) throw new AppError('Asset not found', 404);
      const bookValue = service.computeBookValue(asset);
      res.json({ asset, bookValue });
    }),
  );

  router.put(
    '/assets/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.updateAsset(
        req.params.id,
        req.body as Record<string, unknown>,
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/assets/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteAsset(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/assets/:id/assign',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { email, conditionOnAssign, notes } = req.body as {
        email?: string;
        conditionOnAssign?: string;
        notes?: string;
      };
      if (!email) throw new AppError('email is required', 400);
      const result = await service.assignAsset(
        req.params.id,
        email.toLowerCase().trim(),
        actor,
        conditionOnAssign,
        notes,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ assignment: result.data });
    }),
  );

  router.post(
    '/assets/assignments/:id/return',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { conditionOnReturn } = req.body as { conditionOnReturn?: string };
      const result = await service.returnAsset(req.params.id, conditionOnReturn ?? 'good', actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/assets/:id/history',
    asyncHandler(async (req: Request, res: Response) => {
      const history = await service.getAssetHistory(req.params.id);
      res.json({ history });
    }),
  );

  router.post(
    '/assets/:id/maintenance',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { scheduledDate, cost, notes } = req.body as {
        scheduledDate?: string;
        cost?: number;
        notes?: string;
      };
      if (!scheduledDate) throw new AppError('scheduledDate is required', 400);
      const result = await service.scheduleMaintenance(
        { assetId: req.params.id, scheduledDate, cost, notes },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ record: result.data });
    }),
  );

  router.post(
    '/assets/maintenance/:id/complete',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.completeMaintenance(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/assets/:id/maintenance',
    asyncHandler(async (req: Request, res: Response) => {
      const records = await service.getMaintenanceHistory(req.params.id);
      res.json({ records });
    }),
  );

  return router;
}

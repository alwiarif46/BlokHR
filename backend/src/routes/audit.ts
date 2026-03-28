import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';

/**
 * Audit Trail routes (admin-only, read-only):
 *   GET /api/audit                      — query audit logs with filters
 *   GET /api/audit/:id                  — get a single audit entry
 *   GET /api/audit/entity/:type/:id     — full history for an entity
 *   GET /api/audit/entity-types         — distinct entity types
 *   GET /api/audit/actions              — distinct actions (optionally by entity type)
 */
export function createAuditRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const service = new AuditService(db, logger);

  router.get(
    '/audit/entity-types',
    asyncHandler(async (_req: Request, res: Response) => {
      const types = await service.getEntityTypes();
      res.json({ entityTypes: types });
    }),
  );

  router.get(
    '/audit/actions',
    asyncHandler(async (req: Request, res: Response) => {
      const entityType = (req.query.entityType as string) || undefined;
      const actions = await service.getActions(entityType);
      res.json({ actions });
    }),
  );

  router.get(
    '/audit/entity/:type/:entityId',
    asyncHandler(async (req: Request, res: Response) => {
      const entries = await service.getEntityHistory(req.params.type, req.params.entityId);
      res.json({ entries });
    }),
  );

  router.get(
    '/audit/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid audit entry ID', 400);
      const entry = await service.getById(id);
      if (!entry) throw new AppError('Audit entry not found', 404);
      res.json(entry);
    }),
  );

  router.get(
    '/audit',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.query({
        entityType: (req.query.entityType as string) || undefined,
        entityId: (req.query.entityId as string) || undefined,
        action: (req.query.action as string) || undefined,
        actorEmail: (req.query.actorEmail as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        correlationId: (req.query.correlationId as string) || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);
    }),
  );

  return router;
}

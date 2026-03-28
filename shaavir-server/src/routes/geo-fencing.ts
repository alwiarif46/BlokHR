import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import { GeoFencingRepository } from '../repositories/geo-fencing-repository';
import { GeoFencingService } from '../services/geo-fencing-service';

/**
 * Geo-fencing routes:
 *   POST   /api/clock/geo            — clock in/out via geo-location
 *   GET    /api/geo/zones            — list zones
 *   POST   /api/geo/zones            — create a zone
 *   PUT    /api/geo/zones/:id        — update a zone
 *   DELETE /api/geo/zones/:id        — delete a zone
 *   GET    /api/geo/settings         — get geo-fencing settings
 *   PUT    /api/geo/settings         — update geo-fencing settings
 *   GET    /api/geo/logs             — get geo clock logs
 */
export function createGeoFencingRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new GeoFencingRepository(db);
  const clockRepo = new ClockRepository(db);
  const clockService = new ClockService(clockRepo, logger);
  const service = new GeoFencingService(repo, clockService, logger);

  router.post(
    '/clock/geo',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = ((body.email as string) ?? '').toLowerCase().trim();
      const name = ((body.name as string) ?? email).trim();
      const action = (body.action as string) ?? '';
      const latitude = body.latitude as number | undefined;
      const longitude = body.longitude as number | undefined;
      const accuracyMeters = body.accuracyMeters as number | undefined;

      if (!email) throw new AppError('email is required', 400);
      if (!action) throw new AppError('action is required (in, out, break, back)', 400);
      if (latitude === undefined || longitude === undefined) {
        throw new AppError('latitude and longitude are required', 400);
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new AppError('latitude and longitude must be numbers', 400);
      }
      if (latitude < -90 || latitude > 90) {
        throw new AppError('latitude must be between -90 and 90', 400);
      }
      if (longitude < -180 || longitude > 180) {
        throw new AppError('longitude must be between -180 and 180', 400);
      }

      const result = await service.geoClock({
        email,
        name,
        action,
        latitude,
        longitude,
        accuracyMeters,
      });

      if (!result.success && !result.clockResult) {
        // Geo rejection (not a clock-level issue)
        res.json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/geo/zones',
    asyncHandler(async (req: Request, res: Response) => {
      const includeInactive = req.query.includeInactive === 'true';
      const zones = await service.getZones(includeInactive);
      res.json({ zones });
    }),
  );

  router.post(
    '/geo/zones',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const name = (body.name as string) ?? '';
      const latitude = body.latitude as number | undefined;
      const longitude = body.longitude as number | undefined;
      const radiusMeters = (body.radiusMeters as number) ?? 200;
      const address = (body.address as string) ?? '';

      if (!name) throw new AppError('name is required', 400);
      if (latitude === undefined || longitude === undefined) {
        throw new AppError('latitude and longitude are required', 400);
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new AppError('latitude and longitude must be numbers', 400);
      }
      if (radiusMeters <= 0) throw new AppError('radiusMeters must be positive', 400);

      const zone = await service.createZone({ name, latitude, longitude, radiusMeters, address });
      res.status(201).json(zone);
    }),
  );

  router.put(
    '/geo/zones/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid zone ID', 400);
      await service.updateZone(id, req.body as Record<string, unknown>);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/geo/zones/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid zone ID', 400);
      await service.deleteZone(id);
      res.json({ success: true });
    }),
  );

  router.get(
    '/geo/settings',
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await service.getSettings();
      res.json(settings);
    }),
  );

  router.put(
    '/geo/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const enabled = body.enabled === true || body.enabled === 1;
      const strict = body.strict === true || body.strict === 1;
      await service.updateSettings(enabled, strict);
      res.json({ success: true, enabled, strict });
    }),
  );

  router.get(
    '/geo/logs',
    asyncHandler(async (req: Request, res: Response) => {
      const logs = await service.getLogs({
        email: (req.query.email as string) || undefined,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json({ logs });
    }),
  );

  return router;
}

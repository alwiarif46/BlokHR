import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import { GeoRepository } from '../repositories/geo-repository';
import { GeoService } from '../services/geo-service';

/**
 * Geo-fencing routes:
 *   POST   /api/clock/geo              — clock in/out with location validation
 *   GET    /api/geo/zones              — list geo-fence zones
 *   POST   /api/geo/zones              — create a zone
 *   PUT    /api/geo/zones/:id          — update a zone
 *   DELETE /api/geo/zones/:id          — delete a zone
 *   GET    /api/geo/settings           — get geo-fencing settings
 *   PUT    /api/geo/settings           — update geo-fencing settings
 *   GET    /api/geo/logs               — get geo clock audit logs
 */
export function createGeoRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const geoRepo = new GeoRepository(db);
  const clockRepo = new ClockRepository(db);
  const clockService = new ClockService(clockRepo, logger);
  const geoService = new GeoService(geoRepo, clockService, logger);

  // ── Geo Clock ──

  router.post(
    '/clock/geo',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = ((body.email as string) ?? '').toLowerCase().trim();
      const action = (body.action as string) ?? '';
      const latitude = body.latitude as number | undefined;
      const longitude = body.longitude as number | undefined;
      const accuracy = body.accuracy as number | undefined;

      if (!email) throw new AppError('email is required', 400);
      if (!action) throw new AppError('action is required (in, out, break, back)', 400);
      if (latitude === undefined || longitude === undefined) {
        throw new AppError('latitude and longitude are required', 400);
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new AppError('latitude and longitude must be numbers', 400);
      }

      const result = await geoService.validateAndClock(
        email,
        latitude,
        longitude,
        action,
        accuracy,
      );
      // Backward-compatible response: add insideZone + nearestZone fields
      const compat: Record<string, unknown> = { ...result };
      if (result.allowed !== undefined) {
        compat.insideZone = result.allowed;
      }
      if (result.matchedZone !== undefined || result.distanceMeters !== undefined) {
        compat.nearestZone = {
          name: result.matchedZone ?? 'unknown',
          distanceMeters: result.distanceMeters ?? 0,
        };
      }
      res.json(compat);
    }),
  );

  // ── Zone CRUD ──

  router.get(
    '/geo/zones',
    asyncHandler(async (req: Request, res: Response) => {
      const includeInactive = req.query.includeInactive === 'true';
      const zones = await geoRepo.getZones(includeInactive);
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

      if (!name) throw new AppError('name is required', 400);
      if (latitude === undefined || longitude === undefined) {
        throw new AppError('latitude and longitude are required', 400);
      }
      if (radiusMeters <= 0) throw new AppError('radiusMeters must be positive', 400);

      const zone = await geoRepo.createZone({
        name,
        latitude,
        longitude,
        radiusMeters,
        address: (body.address as string) ?? '',
      });
      res.status(201).json(zone);
    }),
  );

  router.put(
    '/geo/zones/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid zone ID', 400);

      const existing = await geoRepo.getZoneById(id);
      if (!existing) throw new AppError('Zone not found', 404);

      await geoRepo.updateZone(id, req.body as Record<string, unknown>);
      const updated = await geoRepo.getZoneById(id);
      res.json(updated);
    }),
  );

  router.delete(
    '/geo/zones/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid zone ID', 400);

      const existing = await geoRepo.getZoneById(id);
      if (!existing) throw new AppError('Zone not found', 404);

      await geoRepo.deleteZone(id);
      res.json({ success: true });
    }),
  );

  // ── Settings ──

  router.get(
    '/geo/settings',
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await geoRepo.getSettings();
      res.json(settings);
    }),
  );

  router.put(
    '/geo/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const enabledVal = body.geoFencingEnabled ?? body.enabled;
      const strictVal = body.geoFencingStrict ?? body.strict;
      await geoRepo.updateSettings({
        geoFencingEnabled: enabledVal !== undefined ? Boolean(enabledVal) : undefined,
        geoFencingStrict: strictVal !== undefined ? Boolean(strictVal) : undefined,
      });
      const settings = await geoRepo.getSettings();
      res.json(settings);
    }),
  );

  // ── Audit logs ──

  router.get(
    '/geo/logs',
    asyncHandler(async (req: Request, res: Response) => {
      const logs = await geoRepo.getClockLogs({
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

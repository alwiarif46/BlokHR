import { Router, Request, Response, NextFunction } from 'express';
import type { TransportService, EventKind } from '../transport-service';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createTransportRouter(service: TransportService): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'transport' });
  });

  router.post(
    '/bus-events',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.recordBoarding({
        payloadB64: String(body.payload_b64 ?? ''),
        routeId: String(body.route_id ?? ''),
        stopId: String(body.stop_id ?? ''),
        eventKind: String(body.event_kind ?? 'board') as EventKind,
        lat: typeof body.lat === 'number' ? body.lat : undefined,
        lng: typeof body.lng === 'number' ? body.lng : undefined,
        consentRef: String(body.consent_ref ?? ''),
        idempotencyKey: String(body.idempotency_key ?? ''),
        deviceId: typeof body.device_id === 'string' ? body.device_id : undefined,
      });
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/routes/:routeId/events',
    asyncHandler(async (req, res) => {
      res.json({ events: await service.listForRoute(req.params.routeId) });
    }),
  );

  return router;
}

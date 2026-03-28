import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { WebhookReceiverService, WEBHOOK_SOURCES } from '../webhooks/webhook-receiver-service';

/**
 * Webhook Receiver routes:
 *   POST   /api/webhooks/inbound/:source   — receive an inbound webhook
 *   GET    /api/webhooks/inbound           — query webhook logs
 *   GET    /api/webhooks/inbound/:id       — get a single log entry
 *   POST   /api/webhooks/inbound/:id/replay — replay a logged webhook
 *   GET    /api/webhooks/inbound/stats     — per-source stats
 *   GET    /api/webhooks/sources           — list known sources
 */
export function createWebhookReceiverRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const service = new WebhookReceiverService(db, logger);

  // Register default handlers for known sources (log-only for now; real handlers wire to services)
  // In production, each source would have a handler that parses the payload and calls the appropriate service.
  // Example: payroll webhook → update member salary fields
  // For now, they're registered as pass-through (always succeed) so the infrastructure is proven.
  for (const source of WEBHOOK_SOURCES) {
    service.registerHandler(source, async (_src, eventType, payload, _headers) => {
      logger.info({ source, eventType, payloadKeys: Object.keys(payload) }, 'Webhook processed (default handler)');
      return true;
    });
  }

  // ── Receiver endpoint ──

  router.post(
    '/webhooks/inbound/:source',
    asyncHandler(async (req: Request, res: Response) => {
      const source = req.params.source.toLowerCase();
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const eventType = (payload.event_type as string) ??
                        (payload.eventType as string) ??
                        (payload.type as string) ??
                        (req.headers['x-event-type'] as string) ?? '';

      // Extract relevant headers (filter out noisy ones)
      const headers: Record<string, unknown> = {};
      for (const key of ['content-type', 'x-event-type', 'x-webhook-id', 'x-signature', 'user-agent']) {
        if (req.headers[key]) headers[key] = req.headers[key];
      }

      const result = await service.receive({ source, eventType, payload, headers });
      res.status(result.processed ? 200 : 202).json(result);
    }),
  );

  // ── Stats (must come before :id param route) ──

  router.get(
    '/webhooks/inbound/stats',
    asyncHandler(async (_req: Request, res: Response) => {
      const stats = await service.getStats();
      res.json({ stats });
    }),
  );

  // ── Query ──

  router.get(
    '/webhooks/inbound',
    asyncHandler(async (req: Request, res: Response) => {
      const processedParam = req.query.processed as string | undefined;
      let processed: boolean | undefined;
      if (processedParam === 'true') processed = true;
      if (processedParam === 'false') processed = false;

      const result = await service.query({
        source: (req.query.source as string) || undefined,
        eventType: (req.query.eventType as string) || undefined,
        processed,
        startDate: (req.query.startDate as string) || undefined,
        endDate: (req.query.endDate as string) || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.json(result);
    }),
  );

  // ── Single entry ──

  router.get(
    '/webhooks/inbound/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid webhook log ID', 400);
      const entry = await service.getById(id);
      if (!entry) throw new AppError('Webhook log entry not found', 404);
      res.json(entry);
    }),
  );

  // ── Replay ──

  router.post(
    '/webhooks/inbound/:id/replay',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid webhook log ID', 400);
      const result = await service.replay(id);
      if (!result.processed && result.error) {
        throw new AppError(result.error, 400);
      }
      res.json(result);
    }),
  );

  // ── Sources ──

  router.get(
    '/webhooks/sources',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        sources: WEBHOOK_SOURCES.map(s => ({
          id: s,
          endpoint: `/api/webhooks/inbound/${s}`,
        })),
      });
    }),
  );

  return router;
}

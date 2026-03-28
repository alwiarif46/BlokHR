import { Router, Request, Response } from 'express';
import type { SseBroadcaster } from '../sse/broadcaster';

/**
 * SSE route:
 *   GET /api/sse — opens a server-sent events connection.
 *
 * The frontend's initSSE() calls this endpoint and listens for:
 *   - attendance-update
 *   - settings-update
 *   - leave-update
 *   - meeting-update
 *
 * The connection stays open. The broadcaster pushes events as they happen.
 * Client disconnect is handled automatically by the broadcaster.
 */
export function createSseRouter(broadcaster: SseBroadcaster): Router {
  const router = Router();

  router.get('/sse', (req: Request, res: Response) => {
    // Disable Express timeout for long-lived SSE connections
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);

    broadcaster.addClient(res);

    // Do NOT call res.end() — the connection stays open.
    // The broadcaster handles cleanup on disconnect.
  });

  return router;
}

/**
 * SSE passthrough helpers (G-03).
 * Endpoint: GET /api/sse/stream (matches frontend/shared/sse.js).
 */

import type { IncomingMessage } from 'http';
import type { Request, Response } from 'express';

/** Path under the /api mount that streams Server-Sent Events. */
export const SSE_STREAM_SUFFIX = '/sse/stream';

export function isSseStreamPath(req: IncomingMessage | Request): boolean {
  const url = (req as Request).originalUrl || req.url || '';
  const pathOnly = url.split('?')[0] || '';
  return pathOnly === '/api/sse/stream' || pathOnly.endsWith('/sse/stream');
}

/**
 * Disable proxy/response buffering for SSE and keep the connection alive.
 * Mutate upstream headers so http-proxy copies them when writing the response.
 * Do not flush early — that would omit Content-Type from the upstream.
 */
export function applySsePassthroughHeaders(proxyRes: IncomingMessage): void {
  proxyRes.headers['cache-control'] = 'no-cache, no-transform';
  proxyRes.headers['connection'] = 'keep-alive';
  proxyRes.headers['x-accel-buffering'] = 'no';
  // Prevent intermediaries from buffering; Content-Type stays text/event-stream from upstream.
  delete proxyRes.headers['content-length'];
}

/** Clear idle timeouts on long-lived SSE sockets. */
export function clearSseSocketTimeouts(req: IncomingMessage, res: Response): void {
  req.socket?.setTimeout(0);
  res.socket?.setTimeout(0);
}

/**
 * Proxy header hygiene (G-02).
 * Strip inbound X-Blok-* (spoof protection), inject X-Blok-Internal.
 * Authorization / X-User-Email / X-User-Name are left untouched.
 */

import type { ClientRequest, IncomingMessage } from 'http';
import type { Request } from 'express';
import type { Logger } from 'pino';

/** Auth headers forwarded byte-identical (matches frontend/shared/api.js). */
export const AUTH_FORWARD_HEADERS = [
  'authorization',
  'x-user-email',
  'x-user-name',
] as const;

export function stripInboundBlokHeaders(proxyReq: ClientRequest): void {
  const headers = proxyReq.getHeaders();
  for (const rawKey of Object.keys(headers)) {
    const key = rawKey.toLowerCase();
    if (key.startsWith('x-blok-')) {
      proxyReq.removeHeader(rawKey);
    }
  }
}

export function injectInternalSecret(proxyReq: ClientRequest, secret: string): void {
  proxyReq.setHeader('X-Blok-Internal', secret);
}

export function applyProxyHeaderHygiene(proxyReq: ClientRequest, secret: string): void {
  stripInboundBlokHeaders(proxyReq);
  injectInternalSecret(proxyReq, secret);
}

type TimedRequest = IncomingMessage & {
  method?: string;
  originalUrl?: string;
  url?: string;
  _gwProxyStartedAt?: number;
};

export function markProxyStart(req: IncomingMessage): void {
  (req as TimedRequest)._gwProxyStartedAt = Date.now();
}

export function logProxyResult(
  logger: Logger,
  req: IncomingMessage,
  statusCode: number | undefined,
  upstream: string,
): void {
  const timed = req as TimedRequest;
  const started = timed._gwProxyStartedAt ?? Date.now();
  const expressReq = req as Request;
  logger.info(
    {
      method: timed.method || expressReq.method,
      path: expressReq.originalUrl || timed.url,
      upstream,
      status: statusCode ?? 0,
      duration: Date.now() - started,
    },
    'proxy',
  );
}

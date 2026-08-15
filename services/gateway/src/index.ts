import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';
import {
  isKnownService,
  SERVICE_NAMES,
  type GatewayConfig,
  type ServiceName,
} from './config';
import {
  applyProxyHeaderHygiene,
  logProxyResult,
  markProxyStart,
} from './proxy-headers';
import { applySsePassthroughHeaders, clearSseSocketTimeouts, isSseStreamPath } from './sse-proxy';

const PROXY_TIMEOUT_MS = 30_000;
/** 0 = no timeout kill (SSE must stay open). */
const SSE_NO_TIMEOUT = 0;

export interface GatewayAppOptions {
  config: GatewayConfig;
  logger: Logger;
}

function buildProxyHooks(
  logger: Logger,
  upstream: string,
  serviceLabel: string,
  internalSecret: string,
  opts: { ssePassthrough?: boolean } = {},
): NonNullable<Options['on']> {
  return {
    proxyReq: (proxyReq, req) => {
      markProxyStart(req);
      applyProxyHeaderHygiene(proxyReq, internalSecret);
      if (opts.ssePassthrough || isSseStreamPath(req)) {
        req.socket?.setTimeout(0);
        proxyReq.setTimeout(0);
      }
    },
    proxyRes: (proxyRes, req, res) => {
      if (opts.ssePassthrough || isSseStreamPath(req)) {
        applySsePassthroughHeaders(proxyRes);
        clearSseSocketTimeouts(req, res as Response);
      }
      logProxyResult(logger, req, proxyRes.statusCode, upstream);
    },
    error: (err, req, res) => {
      logger.warn({ err, service: serviceLabel, target: upstream }, 'Upstream proxy error');
      logProxyResult(logger, req, 502, upstream);
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({ error: 'upstream_unavailable', service: serviceLabel });
      }
    },
  };
}

export function createGatewayApp(options: GatewayAppOptions): { app: Express } {
  const { config, logger } = options;
  const app = express();
  app.use(cors());

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true, services: [...SERVICE_NAMES] });
  });

  const serviceProxies = new Map<
    ServiceName,
    (req: Request, res: Response, next: NextFunction) => void
  >();

  for (const name of SERVICE_NAMES) {
    const target = config.serviceUrls[name];
    const proxyOpts: Options = {
      target,
      changeOrigin: true,
      proxyTimeout: PROXY_TIMEOUT_MS,
      timeout: PROXY_TIMEOUT_MS,
      pathRewrite: (_p, req) => {
        const url = req.url && req.url.length > 0 ? req.url : '/';
        return url.startsWith('/') ? url : `/${url}`;
      },
      on: buildProxyHooks(logger, target, name, config.internalSecret),
    };
    serviceProxies.set(
      name,
      createProxyMiddleware(proxyOpts) as (req: Request, res: Response, next: NextFunction) => void,
    );
  }

  app.use('/svc/:service', (req: Request, res: Response, next: NextFunction) => {
    const service = req.params.service;
    if (!isKnownService(service)) {
      res.status(404).json({ error: 'unknown_service' });
      return;
    }
    const proxy = serviceProxies.get(service);
    if (!proxy) {
      res.status(404).json({ error: 'unknown_service' });
      return;
    }
    proxy(req, res, next);
  });

  // SSE first: unbuffered stream to GET /api/sse/stream (frontend/shared/sse.js).
  const sseProxy = createProxyMiddleware({
    target: config.monolithUrl,
    changeOrigin: true,
    proxyTimeout: SSE_NO_TIMEOUT,
    timeout: SSE_NO_TIMEOUT,
    pathRewrite: (p) => `/api/sse${p === '/' ? '' : p}`,
    on: buildProxyHooks(logger, config.monolithUrl, 'monolith-sse', config.internalSecret, {
      ssePassthrough: true,
    }),
  }) as (req: Request, res: Response, next: NextFunction) => void;

  app.use('/api/sse', sseProxy);

  const monolithProxy = createProxyMiddleware({
    target: config.monolithUrl,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
    pathRewrite: (p) => `/api${p === '/' ? '' : p}`,
    on: buildProxyHooks(logger, config.monolithUrl, 'monolith', config.internalSecret),
  }) as (req: Request, res: Response, next: NextFunction) => void;

  app.use('/api', monolithProxy);

  app.use(
    express.static(config.frontendDir, {
      index: 'shell.html',
      fallthrough: true,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/svc') || req.path === '/healthz') {
      next();
      return;
    }
    if (path.extname(req.path) === '') {
      res.sendFile(path.join(config.frontendDir, 'shell.html'), (err) => {
        if (err) next(err);
      });
      return;
    }
    next();
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Gateway error');
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  return { app };
}

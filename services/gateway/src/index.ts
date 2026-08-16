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
import {
  isGuardianStudentRefAllowed,
  isGuardianSurfacePath,
  resolveGuardianAllowlist,
} from './guards/guardian-allowlist';
import {
  CachedIntrospect,
  createHttpIntrospect,
  parseBearer,
  safeIntrospect,
  type IntrospectFn,
} from './guards/guardian-introspect';
import {
  CachedStaffIntrospect,
  createHttpStaffIntrospect,
  safeStaffIntrospect,
  staffBlokHeaders,
  type StaffIntrospectFn,
} from './guards/staff-introspect';
import { isPublicSvcPath } from './guards/public-paths';

const PROXY_TIMEOUT_MS = 30_000;
/** 0 = no timeout kill (SSE must stay open). */
const SSE_NO_TIMEOUT = 0;

type BlokProxyRequest = Request & {
  _blokExtraHeaders?: Record<string, string>;
};

export interface GatewayAppOptions {
  config: GatewayConfig;
  logger: Logger;
  /** Override identity introspect (tests). */
  introspect?: IntrospectFn;
  /** Override staff introspect (tests). */
  staffIntrospect?: StaffIntrospectFn;
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
      const extra = (req as BlokProxyRequest)._blokExtraHeaders;
      applyProxyHeaderHygiene(proxyReq, internalSecret, extra);
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

function guardianBlokHeaders(
  tenantId: string,
  guardianId: string,
  studentIds: string[],
): Record<string, string> {
  return {
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
    'X-Blok-Tenant': tenantId,
    'X-Blok-Students': studentIds.join(','),
  };
}

export function createGatewayApp(options: GatewayAppOptions): {
  app: Express;
  introspectCache: CachedIntrospect;
  staffIntrospectCache: CachedStaffIntrospect;
} {
  const { config, logger } = options;
  const app = express();
  app.use(cors());

  const introspectFn =
    options.introspect ??
    createHttpIntrospect({
      identityUrl: config.identityUrl,
      internalSecret: config.internalSecret,
    });
  const introspectCache = new CachedIntrospect(introspectFn);

  const staffIntrospectFn =
    options.staffIntrospect ??
    createHttpStaffIntrospect({
      monolithUrl: config.monolithUrl,
      directoryUrl: config.directoryUrl,
      internalSecret: config.internalSecret,
    });
  const staffIntrospectCache = new CachedStaffIntrospect(staffIntrospectFn);

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true, services: [...SERVICE_NAMES] });
  });

  /**
   * Staff whoami (P12-02). Guardian tokens → anonymous (portal has its own surface).
   */
  app.get('/whoami', async (req: Request, res: Response) => {
    const token = parseBearer(
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined,
    );
    if (!token) {
      res.json({ principal: 'anonymous' });
      return;
    }
    const result = await safeStaffIntrospect(staffIntrospectCache, token, logger);
    if (result === 'down' || !result.active) {
      res.json({ principal: 'anonymous' });
      return;
    }
    res.json({
      principal: 'staff',
      email: result.email,
      role: result.role,
      isAdmin: result.isAdmin || result.role === 'admin',
      tenantId: result.tenantId,
      memberId: result.memberId,
    });
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

  // Parent portal entry (static) — before authenticated /guardian proxy
  app.get(['/guardian', '/guardian/'], (_req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(config.frontendDir, 'guardian.html'), (err) => {
      if (err) next(err);
    });
  });

  // Guardian login — no bearer; proxies to identity login
  app.post('/guardian/login', (req: Request, res: Response, next: NextFunction) => {
    const proxy = serviceProxies.get('school-identity');
    if (!proxy) {
      res.status(502).json({ error: 'upstream_unavailable', service: 'school-identity' });
      return;
    }
    req.url = '/api/identity/guardian-auth/login';
    proxy(req, res, next);
  });

  // Deny guardian principal outside /guardian/*
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (isGuardianSurfacePath(req.path)) {
      next();
      return;
    }

    const principal = String(req.headers['x-blok-principal'] ?? '')
      .trim()
      .toLowerCase();
    if (principal === 'guardian') {
      res.status(403).json({ error: 'guardian_scope' });
      return;
    }

    const token = parseBearer(
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined,
    );
    if (!token) {
      next();
      return;
    }

    const result = await safeIntrospect(introspectCache, token, logger);
    if (result === 'down') {
      // Staff paths: do not fail closed when identity is down (guardian surface does).
      next();
      return;
    }
    if (result.active) {
      res.status(403).json({ error: 'guardian_scope' });
      return;
    }
    next();
  });

  // Guardian surface → introspect + allowlist rewrite + service proxy
  app.use('/guardian', async (req: Request, res: Response, next: NextFunction) => {
    const token = parseBearer(
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined,
    );
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const result = await safeIntrospect(introspectCache, token, logger);
    if (result === 'down') {
      res.status(503).json({ error: 'introspect_unavailable' });
      return;
    }
    if (!result.active) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const surfacePath = (req.originalUrl || '').split('?')[0] || '/guardian';
    const search = (req.originalUrl || '').includes('?')
      ? `?${(req.originalUrl || '').split('?').slice(1).join('?')}`
      : '';
    const pathWithQuery = `${surfacePath}${search}`;

    const match = resolveGuardianAllowlist(req.method, pathWithQuery, {
      tenantId: result.tenantId,
      guardianId: result.guardianId,
    });
    if (!match) {
      res.status(403).json({ error: 'guardian_scope' });
      return;
    }

    const linked = result.studentIds ?? [];
    if (
      surfacePath === '/guardian/diary' &&
      !isGuardianStudentRefAllowed(pathWithQuery, linked)
    ) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const proxy = serviceProxies.get(match.service);
    if (!proxy) {
      res.status(502).json({ error: 'upstream_unavailable', service: match.service });
      return;
    }

    const gReq = req as BlokProxyRequest;
    gReq._blokExtraHeaders = guardianBlokHeaders(
      result.tenantId,
      result.guardianId,
      result.studentIds ?? [],
    );
    // Rewrite URL to upstream path for the service proxy (no /svc prefix).
    req.url = match.upstreamPath;
    proxy(req, res, next);
  });

  app.use('/svc/:service', async (req: Request, res: Response, next: NextFunction) => {
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

    // Upstream path is whatever remains after /svc/:service (Express strips the mount).
    const upstreamPath = req.url && req.url.length > 0 ? req.url : '/';
    if (isPublicSvcPath(service, req.method, upstreamPath)) {
      proxy(req, res, next);
      return;
    }

    const token = parseBearer(
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined,
    );
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Fail-closed for school data (unlike monolith staff fail-open).
    const result = await safeStaffIntrospect(staffIntrospectCache, token, logger);
    if (result === 'down') {
      res.status(503).json({ error: 'introspect_unavailable' });
      return;
    }
    if (!result.active) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const sReq = req as BlokProxyRequest;
    sReq._blokExtraHeaders = staffBlokHeaders(result);
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

  // P12-02: never let a browser reach introspect via gateway (would attach X-Blok-Internal).
  app.all('/api/auth/introspect', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

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
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/svc') ||
      req.path.startsWith('/guardian') ||
      req.path === '/healthz'
    ) {
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

  return { app, introspectCache, staffIntrospectCache };
}

export {
  resolveGuardianAllowlist,
  isGuardianSurfacePath,
} from './guards/guardian-allowlist';
export {
  CachedIntrospect,
  createHttpIntrospect,
  hashBearerToken,
  parseBearer,
} from './guards/guardian-introspect';
export {
  CachedStaffIntrospect,
  createHttpStaffIntrospect,
  resolveStaffRole,
  staffBlokHeaders,
} from './guards/staff-introspect';
export { PUBLIC_PATHS, isPublicSvcPath } from './guards/public-paths';

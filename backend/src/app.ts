import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { AppConfig } from './config';
import type { DatabaseEngine } from './db/engine';
import { resolveInternalSecret } from './internal-auth';
import { runWithTenant } from './tenant/context';
import {
  parseHostList,
  parseReservedSlugs,
  parseTenantHostMap,
  resolveTenantId,
} from './tenant/resolve-tenant';

/**
 * Augment Express Request with identity, correlationId, and tenantId.
 * Every downstream handler can access req.correlationId, req.identity, req.tenantId.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      identity: { email: string; name: string } | null;
      tenantId: string;
    }
  }
}

/**
 * Operational error — safe to return to client.
 * Anything that is NOT an AppError is treated as a programmer error and crashes the process.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Wraps an async route handler so rejected promises are forwarded to Express error handler.
 * Without this, unhandled rejections in async handlers crash the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function parseBearer(header: string | undefined): string {
  if (!header) return '';
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() ?? '';
}

/**
 * Builds the Express application with the full middleware stack in enforced order.
 * Pass `db` so Bearer session tokens can be verified against auth_sessions.
 */
export function createApp(
  config: AppConfig,
  logger: Logger,
  registerRoutes?: (app: Express) => void,
  db?: DatabaseEngine,
): Express {
  const app = express();
  const internalSecret = resolveInternalSecret();

  // ── 1. Correlation ID ──
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    next();
  });

  // ── 2. Request logging ──
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration,
          correlationId: req.correlationId,
        },
        'request',
      );
    });
    next();
  });

  // ── 3. CORS ──
  app.use(
    cors({
      origin:
        config.corsOrigins === '*' ? true : config.corsOrigins.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );

  // ── 4. Helmet (security headers) ──
  app.use(
    helmet({
      contentSecurityPolicy: false, // frontend is served from same origin
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── 5. Rate limiting ──
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    skip: (req) => req.path === '/api/health',
  });
  app.use('/api/', globalLimiter);

  // Aggressive rate limit on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later' },
  });
  app.use('/api/auth/', authLimiter);
  app.use('/api/clock/face', authLimiter);

  // ── 6. Body parsing ──
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ── 7. Static files ──
  // shell.html is the single app shell (the gateway serves it the same way).
  app.use(express.static(config.publicDir, { index: 'shell.html' }));

  // ── 8. Tenant resolution (Host map → subdomain → trusted X-Blok-Tenant → fallback) ──
  // Only trust client/gateway X-Blok-Tenant when X-Blok-Internal matches INTERNAL_SECRET.
  const hostMap = parseTenantHostMap(config.tenantHostMap);
  const apexHosts = parseHostList(config.tenantApexHosts);
  const reservedSlugs = parseReservedSlugs(config.tenantReservedSlugs);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const gotInternal = String(req.headers['x-blok-internal'] ?? '');
    const trustBlokTenantHeader = !!(internalSecret && gotInternal === internalSecret);
    const tenantId = resolveTenantId({
      headers: req.headers as Record<string, string | string[] | undefined>,
      hostMap,
      trustBlokTenantHeader,
      fallback: config.defaultTenantId,
      subdomainBase: config.tenantSubdomainBase,
      reservedSlugs,
      apexHosts,
    });
    req.tenantId = tenantId;
    // Propagate for directory/school routers that read X-Blok-Tenant
    req.headers['x-blok-tenant'] = tenantId;
    runWithTenant(tenantId, () => next());
  });

  // ── 8b. Identity — Bearer session first; spoofable headers only when allowed ──
  app.use((req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      req.identity = null;

      const token = parseBearer(req.headers.authorization);
      if (token && db) {
        try {
          const row = await db.get<{
            email: string;
            name: string;
            expires_at: string;
            tenant_id: string | null;
          }>('SELECT email, name, expires_at, tenant_id FROM auth_sessions WHERE token = ?', [
            token,
          ]);
          if (row) {
            const exp = Date.parse(row.expires_at);
            if (Number.isFinite(exp) && exp >= Date.now()) {
              const sessionTenant = (row.tenant_id || '').trim() || config.defaultTenantId;
              if (sessionTenant !== req.tenantId) {
                res.status(403).json({
                  error: 'tenant_mismatch',
                  correlationId: req.correlationId,
                });
                return;
              }
              req.identity = {
                email: row.email.toLowerCase().trim(),
                name: (row.name || row.email).trim(),
              };
              next();
              return;
            }
            await db.run('DELETE FROM auth_sessions WHERE token = ?', [token]);
          }
        } catch (err) {
          logger.warn({ err, correlationId: req.correlationId }, 'Session lookup failed');
        }
      }

      if (config.allowHeaderIdentity) {
        const email = req.headers['x-user-email'] as string | undefined;
        const name = req.headers['x-user-name'] as string | undefined;
        if (email) {
          req.identity = {
            email: email.toLowerCase().trim(),
            name: name ? decodeURIComponent(name).trim() : email.toLowerCase().trim(),
          };
        }
      }

      next();
    })().catch(next);
  });

  // ── 9. Health check (before auth, always accessible) ──
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // ── 10. Register routes (modules inject here) ──
  if (registerRoutes) {
    registerRoutes(app);
  }

  // ── 11. 404 handler ──
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Not found', 404));
  });

  // ── 12. Centralized error handler (MUST be last) ──
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError && err.isOperational) {
      // Operational error — safe to return
      logger.warn(
        {
          err: { message: err.message, statusCode: err.statusCode },
          correlationId: req.correlationId,
        },
        'Operational error',
      );
      res.status(err.statusCode).json({
        error: err.message,
        correlationId: req.correlationId,
      });
      return;
    }

    // Programmer error — log full stack, return generic message
    logger.error(
      {
        err,
        correlationId: req.correlationId,
        method: req.method,
        url: req.originalUrl,
      },
      'Unexpected error',
    );

    const status = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    const message = config.nodeEnv === 'development' ? err.message : 'Internal server error';

    res.status(status).json({
      error: message,
      correlationId: req.correlationId,
    });
  });

  return app;
}

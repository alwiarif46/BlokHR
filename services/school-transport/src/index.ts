import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolTransportSqlite, runSchoolTransportMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { TransportRepository } from './repositories/transport-repository';
import { TransportService } from './services/transport-service';
import {
  BoardingService,
  hashCapturePayloadB64,
} from './services/boarding-service';
import { TelemetryService } from './services/telemetry-service';
import { haversineKm, computeEta } from './services/eta-math';
import { createTransportRouter } from './routes/transport';
import { resolveInternalSecret } from './internal-auth';
import { transportDbAls } from './db-context';
import {
  createTransportTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolTransportAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  clock?: () => Date;
  events?: EventPublisher;
  internalSecret?: string;
}

export async function createSchoolTransportApp(
  options: SchoolTransportAppOptions,
): Promise<{
  app: Express;
  service: TransportService;
  boarding: BoardingService;
  telemetry: TelemetryService;
  db: SchoolTransportSqlite;
  pool?: TenantSqlitePool<SchoolTransportSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolTransportSqlite.create(options.dbPath);
  await runSchoolTransportMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createTransportTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const repo = new TransportRepository(fallbackDb);
  const clock = options.clock ?? (() => new Date());
  const service = new TransportService(repo, clock);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const boarding = new BoardingService(repo, events, clock);
  const telemetry = new TelemetryService(repo, events, clock);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (pool) {
    const bindTenantDb = async (
      req: Request,
      _res: Response,
      next: NextFunction,
    ) => {
      const tid = extractRequestTenant({
        headerTenant: String(req.headers['x-blok-tenant'] ?? ''),
        path: req.path,
        apiPrefix: '/api/transport',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        transportDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/transport', bindTenantDb);
  }

  app.use(
    '/api/transport',
    createTransportRouter(service, boarding, telemetry, { internalSecret }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School transport error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    service,
    boarding,
    telemetry,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  TransportService,
  TransportRepository,
  BoardingService,
  TelemetryService,
  hashCapturePayloadB64,
  haversineKm,
  computeEta,
  SchoolTransportSqlite,
  runSchoolTransportMigrations,
  createTransportRouter,
  HttpEventPublisher,
  LogEventPublisher,
};
export * from './types';
export type { EventPublisher, DomainEvent } from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { TRANSPORT_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createTransportTenantPool,
} from './tenant-db';

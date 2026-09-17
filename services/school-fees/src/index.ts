import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolFeesSqlite, runSchoolFeesMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { FeesRepository } from './repositories/fees-repository';
import { FeesService } from './services/fees-service';
import { InvoiceService, applyConcessions } from './services/invoice-service';
import {
  PaymentService,
  ageingBucket,
  daysBetween,
} from './services/payment-service';
import { createFeesRouter } from './routes/fees';
import { feesDbAls } from './db-context';
import {
  createFeesTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolFeesAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  events?: EventPublisher;
  clock?: () => Date;
}

export async function createSchoolFeesApp(
  options: SchoolFeesAppOptions,
): Promise<{
  app: Express;
  service: FeesService;
  invoices: InvoiceService;
  payments: PaymentService;
  db: SchoolFeesSqlite;
  pool?: TenantSqlitePool<SchoolFeesSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolFeesSqlite.create(options.dbPath);
  await runSchoolFeesMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createFeesTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const repo = new FeesRepository(fallbackDb);
  const service = new FeesService(repo);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const clock = options.clock ?? (() => new Date());
  const invoices = new InvoiceService(repo, events, clock);
  const payments = new PaymentService(repo, events, clock);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

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
        apiPrefix: '/api/fees',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        feesDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/fees', bindTenantDb);
  }

  app.use('/api/fees', createFeesRouter(service, invoices, payments));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School fees error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    service,
    invoices,
    payments,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  FeesService,
  FeesRepository,
  InvoiceService,
  PaymentService,
  applyConcessions,
  ageingBucket,
  daysBetween,
  SchoolFeesSqlite,
  runSchoolFeesMigrations,
  createFeesRouter,
  HttpEventPublisher,
  LogEventPublisher,
};
export * from './types';
export type { EventPublisher, DomainEvent } from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { FEES_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createFeesTenantPool,
} from './tenant-db';

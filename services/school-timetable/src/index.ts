import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolTimetableSqlite, runSchoolTimetableMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { TimetableRepository } from './repositories/timetable-repository';
import { TimetableService } from './services/timetable-service';
import { generateInstances } from './services/instance-generator';
import { createTimetableRouter } from './routes/timetable';
import { resolveInternalSecret } from './internal-auth';
import {
  createHttpIdentityClient,
  type IdentityClient,
} from './clients/identity-client';
import { timetableDbAls } from './db-context';
import {
  createTimetableTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolTimetableAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  identityClient?: IdentityClient;
  internalSecret?: string;
}

export async function createSchoolTimetableApp(
  options: SchoolTimetableAppOptions,
): Promise<{
  app: Express;
  service: TimetableService;
  db: SchoolTimetableSqlite;
  pool?: TenantSqlitePool<SchoolTimetableSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolTimetableSqlite.create(options.dbPath);
  await runSchoolTimetableMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createTimetableTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const repo = new TimetableRepository(fallbackDb);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new TimetableService(repo, events);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);

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
        apiPrefix: '/api/timetable',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        timetableDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/timetable', bindTenantDb);
  }

  app.use(
    '/api/timetable',
    createTimetableRouter(service, {
      internalSecret,
      identity:
        options.identityClient ??
        createHttpIdentityClient(process.env.IDENTITY_URL, internalSecret),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School timetable error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    service,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  TimetableService,
  TimetableRepository,
  SchoolTimetableSqlite,
  runSchoolTimetableMigrations,
  createTimetableRouter,
  LogEventPublisher,
  generateInstances,
};
export * from './types';
export * from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { TIMETABLE_ROUTE_POLICIES } from './route-policies';
export {
  createHttpIdentityClient,
  createStubIdentityClient,
} from './clients/identity-client';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createTimetableTenantPool,
} from './tenant-db';

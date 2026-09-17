import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolSurveysSqlite, runSchoolSurveysMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { resolveInternalSecret } from './internal-auth';
import { SurveysRepository } from './repositories/surveys-repository';
import { SurveysService } from './services/surveys-service';
import { createSurveysRouter } from './routes/surveys';
import { surveysDbAls } from './db-context';
import {
  createSurveysTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolSurveysAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  events?: EventPublisher;
  internalSecret?: string;
}

export async function createSchoolSurveysApp(
  options: SchoolSurveysAppOptions,
): Promise<{
  app: Express;
  service: SurveysService;
  db: SchoolSurveysSqlite;
  pool?: TenantSqlitePool<SchoolSurveysSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolSurveysSqlite.create(options.dbPath);
  await runSchoolSurveysMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createSurveysTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const service = new SurveysService(new SurveysRepository(fallbackDb), events);
  const internalSecret = options.internalSecret ?? resolveInternalSecret();

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
        apiPrefix: '/api/surveys',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        surveysDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/surveys', bindTenantDb);
  }

  app.use('/api/surveys', createSurveysRouter(service, internalSecret));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School surveys error');
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
  SurveysService,
  SurveysRepository,
  SchoolSurveysSqlite,
  runSchoolSurveysMigrations,
  createSurveysRouter,
  HttpEventPublisher,
  LogEventPublisher,
};
export * from './types';
export type { EventPublisher, DomainEvent } from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { SURVEYS_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createSurveysTenantPool,
} from './tenant-db';

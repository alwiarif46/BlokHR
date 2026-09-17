import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolAcademicsSqlite, runSchoolAcademicsMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { AcademicsRepository } from './repositories/academics-repository';
import { AcademicsService } from './services/academics-service';
import { createAcademicsRouter } from './routes/academics';
import { loadSyllabusPackRegistry, type SyllabusPackRegistry } from './packs/registry';
import {
  HttpTimetableClient,
  type TimetableClient,
} from './clients/timetable-client';
import {
  createHttpIdentityClient,
  type IdentityClient,
} from './clients/identity-client';
import { resolveInternalSecret } from './internal-auth';
import { academicsDbAls } from './db-context';
import {
  createAcademicsTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolAcademicsAppOptions {
  dbPath: string;
  migrationsDir?: string;
  /** Defaults to services/school-academics/packs */
  packsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  timetableClient?: TimetableClient;
  identityClient?: IdentityClient;
  internalSecret?: string;
}

export async function createSchoolAcademicsApp(
  options: SchoolAcademicsAppOptions,
): Promise<{
  app: Express;
  service: AcademicsService;
  db: SchoolAcademicsSqlite;
  packs: SyllabusPackRegistry;
  pool?: TenantSqlitePool<SchoolAcademicsSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolAcademicsSqlite.create(options.dbPath);
  await runSchoolAcademicsMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createAcademicsTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const packsDir =
    options.packsDir ?? path.resolve(__dirname, '..', 'packs');
  const packs = loadSyllabusPackRegistry(packsDir);

  const repo = new AcademicsRepository(fallbackDb);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new AcademicsService(repo, events, packs);

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
        apiPrefix: '/api/academics',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        academicsDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/academics', bindTenantDb);
  }

  app.use(
    '/api/academics',
    createAcademicsRouter(service, {
      internalSecret:
        options.internalSecret ?? resolveInternalSecret(process.env),
      timetable:
        options.timetableClient ??
        new HttpTimetableClient(
          undefined,
          options.internalSecret ?? resolveInternalSecret(process.env),
        ),
      identity:
        options.identityClient ??
        createHttpIdentityClient(
          process.env.IDENTITY_URL,
          options.internalSecret ?? resolveInternalSecret(process.env),
        ),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School academics error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    service,
    db: fallbackDb,
    packs,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  AcademicsService,
  AcademicsRepository,
  SchoolAcademicsSqlite,
  runSchoolAcademicsMigrations,
  createAcademicsRouter,
  LogEventPublisher,
  loadSyllabusPackRegistry,
};
export { selectDeterministicSample } from './services/academics-service';
export { computeVariance, isoWeekNumber } from './services/variance';
export type {
  VarianceReport,
  VarianceInstanceInput,
  VarianceUnitInput,
  VarianceTopicInput,
  VarianceDeliveryInput,
} from './services/variance';
export * from './types';
export * from './events';
export { SAMPLE_NCERT_SEED_COUNT, seedSampleNcertOutcomes } from './seed-ncert-sample';
export type { SyllabusPackRegistry } from './packs/registry';
export type { SyllabusPack, SyllabusPackSummary } from './packs/types';
export { validateImportUnits } from './services/syllabus-import-validate';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { ACADEMICS_ROUTE_POLICIES } from './route-policies';
export {
  createHttpIdentityClient,
  createStubIdentityClient,
} from './clients/identity-client';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createAcademicsTenantPool,
} from './tenant-db';

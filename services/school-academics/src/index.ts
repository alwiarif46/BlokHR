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
import { resolveInternalSecret } from './internal-auth';

export interface SchoolAcademicsAppOptions {
  dbPath: string;
  migrationsDir?: string;
  /** Defaults to services/school-academics/packs */
  packsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  timetableClient?: TimetableClient;
  internalSecret?: string;
}

export async function createSchoolAcademicsApp(
  options: SchoolAcademicsAppOptions,
): Promise<{
  app: Express;
  service: AcademicsService;
  db: SchoolAcademicsSqlite;
  packs: SyllabusPackRegistry;
}> {
  const db = await SchoolAcademicsSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolAcademicsMigrations(db, migrationsDir);

  const packsDir =
    options.packsDir ?? path.resolve(__dirname, '..', 'packs');
  const packs = loadSyllabusPackRegistry(packsDir);

  const repo = new AcademicsRepository(db);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new AcademicsService(repo, events, packs);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

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
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School academics error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db, packs };
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

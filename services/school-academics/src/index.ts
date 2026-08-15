import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolAcademicsSqlite, runSchoolAcademicsMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { AcademicsRepository } from './repositories/academics-repository';
import { AcademicsService } from './services/academics-service';
import { createAcademicsRouter } from './routes/academics';

export interface SchoolAcademicsAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
}

export async function createSchoolAcademicsApp(
  options: SchoolAcademicsAppOptions,
): Promise<{ app: Express; service: AcademicsService; db: SchoolAcademicsSqlite }> {
  const db = await SchoolAcademicsSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolAcademicsMigrations(db, migrationsDir);

  const repo = new AcademicsRepository(db);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new AcademicsService(repo, events);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/academics', createAcademicsRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School academics error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  AcademicsService,
  AcademicsRepository,
  SchoolAcademicsSqlite,
  runSchoolAcademicsMigrations,
  createAcademicsRouter,
  LogEventPublisher,
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

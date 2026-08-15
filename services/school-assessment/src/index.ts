import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolAssessmentSqlite, runSchoolAssessmentMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { AssessmentRepository } from './repositories/assessment-repository';
import { AssessmentService } from './services/assessment-service';
import { createAssessmentRouter } from './routes/assessment';

export interface SchoolAssessmentAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
}

export async function createSchoolAssessmentApp(
  options: SchoolAssessmentAppOptions,
): Promise<{ app: Express; service: AssessmentService; db: SchoolAssessmentSqlite }> {
  const db = await SchoolAssessmentSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolAssessmentMigrations(db, migrationsDir);

  const repo = new AssessmentRepository(db);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new AssessmentService(repo, events);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/assessment', createAssessmentRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School assessment error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  AssessmentService,
  AssessmentRepository,
  SchoolAssessmentSqlite,
  runSchoolAssessmentMigrations,
  createAssessmentRouter,
  LogEventPublisher,
};
export { analyzeItems, checkPaperConformance, pearsonCorrelation, questionBucket } from './services/item-analysis';
export * from './types';
export * from './events';

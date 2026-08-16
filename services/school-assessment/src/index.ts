import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolAssessmentSqlite, runSchoolAssessmentMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import {
  HttpAcademicsClient,
  NoopAcademicsClient,
  type AcademicsClient,
} from './clients/academics-client';
import { AssessmentRepository } from './repositories/assessment-repository';
import { AssessmentService } from './services/assessment-service';
import { createAssessmentRouter } from './routes/assessment';
import {
  HttpTimetableClient,
  type TimetableClient,
} from './clients/timetable-client';
import { resolveInternalSecret } from './internal-auth';

export interface SchoolAssessmentAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  academicsClient?: AcademicsClient;
  academicsUrl?: string;
  timetableClient?: TimetableClient;
  internalSecret?: string;
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
  const academics =
    options.academicsClient ??
    (options.academicsUrl || process.env.ACADEMICS_URL
      ? new HttpAcademicsClient(
          options.logger,
          options.academicsUrl ?? process.env.ACADEMICS_URL,
        )
      : new NoopAcademicsClient());
  const service = new AssessmentService(repo, events, academics);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    '/api/assessment',
    createAssessmentRouter(service, {
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
  HttpAcademicsClient,
  NoopAcademicsClient,
};
export {
  analyzeItems,
  checkPaperConformance,
  pearsonCorrelation,
  questionBucket,
} from './services/item-analysis';
export { deriveLevelFromCircled, majorityLevel } from './services/hpc-levels';
export { mapCbse9Point, mapMsbshseSsc } from './services/grade-maps';
export { SAMPLE_HPC_COMPETENCY_COUNT, seedSampleHpcCompetencies } from './seed-hpc-sample';
export * from './types';
export * from './events';
export type { AcademicsClient, InferAssessmentDeliveryInput } from './clients/academics-client';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { ASSESSMENT_ROUTE_POLICIES } from './route-policies';

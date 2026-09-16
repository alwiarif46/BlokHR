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
): Promise<{ app: Express; service: TimetableService; db: SchoolTimetableSqlite }> {
  const db = await SchoolTimetableSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolTimetableMigrations(db, migrationsDir);

  const repo = new TimetableRepository(db);
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

  return { app, service, db };
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

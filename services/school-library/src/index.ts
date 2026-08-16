import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolLibrarySqlite, runSchoolLibraryMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { LibraryRepository } from './repositories/library-repository';
import { LibraryService } from './services/library-service';
import { CirculationService } from './services/circulation-service';
import { FineService } from './services/fine-service';
import { createLibraryRouter } from './routes/library';

export interface SchoolLibraryAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  events?: EventPublisher;
  clock?: () => Date;
}

export async function createSchoolLibraryApp(
  options: SchoolLibraryAppOptions,
): Promise<{
  app: Express;
  service: LibraryService;
  circulation: CirculationService;
  fines: FineService;
  db: SchoolLibrarySqlite;
}> {
  const db = await SchoolLibrarySqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolLibraryMigrations(db, migrationsDir);

  const repo = new LibraryRepository(db);
  const service = new LibraryService(repo);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const clock = options.clock ?? (() => new Date());
  const fines = new FineService(repo, events, clock);
  const circulation = new CirculationService(repo, events, clock, fines);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/library', createLibraryRouter(service, circulation, fines));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School library error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, circulation, fines, db };
}

export {
  LibraryService,
  CirculationService,
  FineService,
  LibraryRepository,
  SchoolLibrarySqlite,
  runSchoolLibraryMigrations,
  createLibraryRouter,
  HttpEventPublisher,
  LogEventPublisher,
};
export * from './types';
export { normalizeIsbn13 } from './services/isbn';
export {
  addDays,
  toDateOnly,
  parseDateOnly,
  calendarDaysBetween,
} from './services/date-only';
export { computeFine } from './services/fine-math';
export type { EventPublisher, DomainEvent } from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { LIBRARY_ROUTE_POLICIES } from './route-policies';

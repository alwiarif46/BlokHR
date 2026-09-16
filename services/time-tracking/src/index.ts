import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { TimeTrackingSqlite, runTimeTrackingMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { TimeTrackingRepository } from './repositories/time-tracking-repository';
import { TimeTrackingService } from './services/time-tracking-service';
import { createTimeTrackingRouter } from './routes/time-tracking';
import { resolveInternalSecret } from './internal-auth';

export interface TimeTrackingAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  events?: EventPublisher;
  clock?: () => Date;
  internalSecret?: string;
}

export async function createTimeTrackingApp(
  options: TimeTrackingAppOptions,
): Promise<{
  app: Express;
  service: TimeTrackingService;
  db: TimeTrackingSqlite;
}> {
  const db = await TimeTrackingSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runTimeTrackingMigrations(db, migrationsDir);

  const repo = new TimeTrackingRepository(db);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const clock = options.clock ?? (() => new Date());
  const service = new TimeTrackingService(repo, options.logger, events, clock);

  const internalSecret = options.internalSecret ?? resolveInternalSecret();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/time-tracking', createTimeTrackingRouter(service, { internalSecret }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Time tracking error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  TimeTrackingService,
  TimeTrackingRepository,
  TimeTrackingSqlite,
  runTimeTrackingMigrations,
  createTimeTrackingRouter,
  HttpEventPublisher,
  LogEventPublisher,
};

export type {
  ClientView,
  ProjectView,
  TimeEntryView,
  Actor,
} from './services/time-tracking-service';
export type { EventPublisher, DomainEvent } from './events';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy, StaffClaims } from './role-guard';
export { TIME_TRACKING_ROUTE_POLICIES } from './route-policies';

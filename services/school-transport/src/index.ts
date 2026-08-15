import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolTransportSqlite, runSchoolTransportMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import { TransportRepository } from './repositories/transport-repository';
import { TransportService } from './services/transport-service';
import {
  BoardingService,
  hashCapturePayloadB64,
} from './services/boarding-service';
import { createTransportRouter } from './routes/transport';

export interface SchoolTransportAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  clock?: () => Date;
  events?: EventPublisher;
}

export async function createSchoolTransportApp(
  options: SchoolTransportAppOptions,
): Promise<{
  app: Express;
  service: TransportService;
  boarding: BoardingService;
  db: SchoolTransportSqlite;
}> {
  const db = await SchoolTransportSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolTransportMigrations(db, migrationsDir);

  const repo = new TransportRepository(db);
  const clock = options.clock ?? (() => new Date());
  const service = new TransportService(repo, clock);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const boarding = new BoardingService(repo, events, clock);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/transport', createTransportRouter(service, boarding));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School transport error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, boarding, db };
}

export {
  TransportService,
  TransportRepository,
  BoardingService,
  hashCapturePayloadB64,
  SchoolTransportSqlite,
  runSchoolTransportMigrations,
  createTransportRouter,
  HttpEventPublisher,
  LogEventPublisher,
};
export * from './types';
export type { EventPublisher, DomainEvent } from './events';

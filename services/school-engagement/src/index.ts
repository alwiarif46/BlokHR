import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolEngagementSqlite, runSchoolEngagementMigrations } from './db';
import {
  HttpNotifySink,
  LogEventPublisher,
  type EventPublisher,
  type NotifySink,
} from './events';
import { EngagementRepository } from './repositories/engagement-repository';
import { DiaryRepository } from './repositories/diary-repository';
import { EngagementService } from './services/engagement-service';
import { MessageService } from './services/message-service';
import { ThreadService } from './services/thread-service';
import { DiaryService } from './services/diary-service';
import { createEngagementRouter } from './routes/engagement';
import { resolveInternalSecret } from './internal-auth';
import {
  createHttpTimetableClient,
  type TimetableClient,
} from './clients/timetable-client';
import {
  createHttpIdentityClient,
  type IdentityClient,
} from './clients/identity-client';

export interface SchoolEngagementAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  notifySink?: NotifySink;
  eventPublisher?: EventPublisher;
  timetableClient?: TimetableClient;
  identityClient?: IdentityClient;
  clock?: () => Date;
  internalSecret?: string;
}

export async function createSchoolEngagementApp(
  options: SchoolEngagementAppOptions,
): Promise<{
  app: Express;
  service: EngagementService;
  messages: MessageService;
  threads: ThreadService;
  diary: DiaryService;
  db: SchoolEngagementSqlite;
}> {
  const db = await SchoolEngagementSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolEngagementMigrations(db, migrationsDir);

  const repo = new EngagementRepository(db);
  const diaryRepo = new DiaryRepository(db);
  const service = new EngagementService(repo);
  const notify = options.notifySink ?? new HttpNotifySink(options.logger);
  const clock = options.clock ?? (() => new Date());
  const events =
    options.eventPublisher ?? new LogEventPublisher(options.logger);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);
  const timetable =
    options.timetableClient ??
    createHttpTimetableClient(process.env.TIMETABLE_URL, internalSecret);
  const identity =
    options.identityClient ??
    createHttpIdentityClient(process.env.IDENTITY_URL, internalSecret);
  const messages = new MessageService(repo, service, notify, clock, options.logger);
  const threads = new ThreadService(repo, clock);
  const diary = new DiaryService(
    diaryRepo,
    events,
    timetable,
    identity,
    clock,
    options.logger,
  );

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    '/api/engagement',
    createEngagementRouter(service, messages, threads, diary, { internalSecret }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School engagement error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, messages, threads, diary, db };
}

export {
  EngagementService,
  EngagementRepository,
  MessageService,
  ThreadService,
  DiaryService,
  DiaryRepository,
  SchoolEngagementSqlite,
  runSchoolEngagementMigrations,
  createEngagementRouter,
  HttpNotifySink,
  LogEventPublisher,
};
export {
  extractPlaceholders,
  renderTemplate,
  isInQuietHours,
} from './services/message-service';
export { SAMPLE_MESSAGE_TEMPLATE_COUNT, seedGlobalMessageTemplates } from './seed-message-templates';
export { asRole, guardRoutes } from './role-guard';
export { ENGAGEMENT_ROUTE_POLICIES } from './route-policies';
export {
  createStubTimetableClient,
  createHttpTimetableClient,
} from './clients/timetable-client';
export {
  createStubIdentityClient,
  createHttpIdentityClient,
} from './clients/identity-client';
export * from './types';
export * from './events';

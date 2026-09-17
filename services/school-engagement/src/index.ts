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
import { engagementDbAls } from './db-context';
import {
  createEngagementTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

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
  pool?: TenantSqlitePool<SchoolEngagementSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolEngagementSqlite.create(options.dbPath);
  await runSchoolEngagementMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createEngagementTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const repo = new EngagementRepository(fallbackDb);
  const diaryRepo = new DiaryRepository(fallbackDb);
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
  const messages = new MessageService(
    repo,
    service,
    notify,
    clock,
    options.logger,
    identity,
  );
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

  if (pool) {
    const bindTenantDb = async (
      req: Request,
      _res: Response,
      next: NextFunction,
    ) => {
      const tid = extractRequestTenant({
        headerTenant: String(req.headers['x-blok-tenant'] ?? ''),
        path: req.path,
        apiPrefix: '/api/engagement',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        engagementDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/engagement', bindTenantDb);
  }

  app.use(
    '/api/engagement',
    createEngagementRouter(service, messages, threads, diary, { internalSecret }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School engagement error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    service,
    messages,
    threads,
    diary,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
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
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createEngagementTenantPool,
} from './tenant-db';

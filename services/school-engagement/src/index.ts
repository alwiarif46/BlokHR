import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolEngagementSqlite, runSchoolEngagementMigrations } from './db';
import { HttpNotifySink, type NotifySink } from './events';
import { EngagementRepository } from './repositories/engagement-repository';
import { EngagementService } from './services/engagement-service';
import { MessageService } from './services/message-service';
import { ThreadService } from './services/thread-service';
import { createEngagementRouter } from './routes/engagement';
import { resolveInternalSecret } from './internal-auth';

export interface SchoolEngagementAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  notifySink?: NotifySink;
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
  db: SchoolEngagementSqlite;
}> {
  const db = await SchoolEngagementSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolEngagementMigrations(db, migrationsDir);

  const repo = new EngagementRepository(db);
  const service = new EngagementService(repo);
  const notify = options.notifySink ?? new HttpNotifySink(options.logger);
  const clock = options.clock ?? (() => new Date());
  const messages = new MessageService(repo, service, notify, clock, options.logger);
  const threads = new ThreadService(repo, clock);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    '/api/engagement',
    createEngagementRouter(service, messages, threads, { internalSecret }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School engagement error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, messages, threads, db };
}

export {
  EngagementService,
  EngagementRepository,
  MessageService,
  ThreadService,
  SchoolEngagementSqlite,
  runSchoolEngagementMigrations,
  createEngagementRouter,
  HttpNotifySink,
};
export {
  extractPlaceholders,
  renderTemplate,
  isInQuietHours,
} from './services/message-service';
export { SAMPLE_MESSAGE_TEMPLATE_COUNT, seedGlobalMessageTemplates } from './seed-message-templates';
export * from './types';
export * from './events';

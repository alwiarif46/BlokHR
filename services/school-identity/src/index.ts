import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolIdentitySqlite, runSchoolIdentityMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { IdentityRepository } from './repositories/identity-repository';
import { IdentityService } from './services/identity-service';
import { createIdentityRouter } from './routes/identity';

export interface SchoolIdentityAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
}

export async function createSchoolIdentityApp(
  options: SchoolIdentityAppOptions,
): Promise<{ app: Express; service: IdentityService; db: SchoolIdentitySqlite }> {
  const db = await SchoolIdentitySqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolIdentityMigrations(db, migrationsDir);

  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const repo = new IdentityRepository(db);
  const service = new IdentityService(repo, events);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/identity', createIdentityRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School identity error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  IdentityService,
  IdentityRepository,
  SchoolIdentitySqlite,
  runSchoolIdentityMigrations,
  createIdentityRouter,
  LogEventPublisher,
};
export * from './types';
export * from './events';
export {
  listStatePacks,
  getStatePack,
  listStatePackCodes,
} from './state-packs';
export type {
  StatePack,
  StatePackCategory,
  StatePackGradeScheme,
  StatePackStudentIdField,
} from './state-packs';
export {
  validateStudentForUdise,
  ageYearsAt,
  ageRangeForClass,
} from './services/udise-validator';
export type { UdiseIssue, UdiseValidationResult, UdiseValidateContext } from './services/udise-validator';

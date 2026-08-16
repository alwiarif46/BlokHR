import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { LearningSqlite, runLearningMigrations } from './db';
import { LearningRepository } from './repositories/learning-repository';
import { LearningService } from './services/learning-service';
import { createLearningRouter, type LearningRouterOptions } from './routes/learning';

export interface LearningAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
  routerOptions?: LearningRouterOptions;
}

export async function createLearningApp(
  options: LearningAppOptions,
): Promise<{ app: Express; service: LearningService; db: LearningSqlite }> {
  const db = await LearningSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runLearningMigrations(db, migrationsDir);

  const service = new LearningService(new LearningRepository(db));

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    '/api/training',
    createLearningRouter(service, {
      tenantId: options.tenantId ?? 'default',
      ...(options.routerOptions ?? {}),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Learning error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  LearningService,
  LearningRepository,
  LearningSqlite,
  runLearningMigrations,
  createLearningRouter,
};
export type { LearningRouterOptions };
export * from './types';

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { ConsentSqlite, runConsentMigrations } from './db';
import { ConsentRepository } from './repositories/consent-repository';
import { ConsentService } from './services/consent-service';
import { createConsentRouter, type ConsentRouterOptions } from './routes/consent';

export interface ConsentAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
  routerOptions?: ConsentRouterOptions;
}

export async function createConsentApp(
  options: ConsentAppOptions,
): Promise<{ app: Express; service: ConsentService; db: ConsentSqlite }> {
  const db = await ConsentSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runConsentMigrations(db, migrationsDir);

  const service = new ConsentService(new ConsentRepository(db));

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api/consent',
    createConsentRouter(service, {
      tenantId: options.tenantId ?? 'default',
      ...(options.routerOptions ?? {}),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Consent error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export { ConsentService, ConsentRepository, ConsentSqlite, runConsentMigrations, createConsentRouter };
export * from './types';

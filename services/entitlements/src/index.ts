import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { EntitlementsSqlite, runEntitlementsMigrations } from './db';
import { EntitlementsRepository } from './repositories/entitlements-repository';
import { EntitlementsService } from './entitlements-service';
import { LicenseSigner } from './license-signer';
import { createEntitlementsRouter } from './routes/entitlements';

export interface EntitlementsAppOptions {
  dbPath: string;
  licenseSigningSecret: string;
  migrationsDir?: string;
  logger: Logger;
}

export async function createEntitlementsApp(
  options: EntitlementsAppOptions,
): Promise<{ app: Express; service: EntitlementsService; db: EntitlementsSqlite }> {
  const db = await EntitlementsSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runEntitlementsMigrations(db, migrationsDir);

  const repo = new EntitlementsRepository(db);
  const signer = new LicenseSigner(options.licenseSigningSecret);
  const service = new EntitlementsService(repo, signer);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/entitlements', createEntitlementsRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Entitlements error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  EntitlementsService,
  EntitlementsRepository,
  LicenseSigner,
  EntitlementsSqlite,
  runEntitlementsMigrations,
  createEntitlementsRouter,
};
export * from './types';

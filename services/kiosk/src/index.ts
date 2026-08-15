import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { KioskSqlite, runKioskMigrations } from './db';
import { KioskRepository } from './repositories/kiosk-repository';
import { KioskService } from './services/kiosk-service';
import { createKioskRouter, type KioskRouterOptions } from './routes/kiosk';
import type { ClockPort, RosterPort, SettingsPort } from './types';

export interface KioskAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
  settings: SettingsPort;
  roster: RosterPort;
  clock: ClockPort;
  routerOptions?: KioskRouterOptions;
}

export async function createKioskApp(
  options: KioskAppOptions,
): Promise<{ app: Express; service: KioskService; db: KioskSqlite }> {
  const db = await KioskSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runKioskMigrations(db, migrationsDir);

  const service = new KioskService({
    repo: new KioskRepository(db),
    settings: options.settings,
    roster: options.roster,
    clock: options.clock,
    logger: options.logger,
    defaultTenantId: options.tenantId ?? 'default',
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api/kiosk',
    createKioskRouter(service, {
      tenantId: options.tenantId ?? 'default',
      ...(options.routerOptions ?? {}),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Kiosk error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  KioskService,
  KioskRepository,
  KioskSqlite,
  runKioskMigrations,
  createKioskRouter,
};
export * from './types';

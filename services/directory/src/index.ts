import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { DirectorySqlite, runDirectoryMigrations } from './db';
import { DirectoryRepository } from './repositories/directory-repository';
import { DirectoryService } from './directory-service';
import { createDirectoryRouter, type DirectoryRouterOptions } from './routes/directory';
import type { AuthPort, EventPort, MemberProjectionPort, SeatChecker } from './types';

export interface DirectoryAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
  seatChecker?: SeatChecker;
  auth?: AuthPort;
  projection?: MemberProjectionPort;
  events?: EventPort;
  routerOptions?: DirectoryRouterOptions;
}

export async function createDirectoryApp(
  options: DirectoryAppOptions,
): Promise<{ app: Express; service: DirectoryService; db: DirectorySqlite }> {
  const db = await DirectorySqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runDirectoryMigrations(db, migrationsDir);

  const service = new DirectoryService({
    repo: new DirectoryRepository(db),
    seatChecker: options.seatChecker,
    auth: options.auth,
    projection: options.projection,
    events: options.events,
    defaultTenantId: options.tenantId ?? 'default',
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    '/api/directory',
    createDirectoryRouter(service, {
      tenantId: options.tenantId ?? 'default',
      ...(options.routerOptions ?? {}),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Directory error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  DirectoryService,
  DirectoryRepository,
  DirectorySqlite,
  runDirectoryMigrations,
  createDirectoryRouter,
};
export * from './types';
export { DIRECTORY_DEFAULTS } from './directory-service';

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { DirectorySqlite, runDirectoryMigrations } from './db';
import { DirectoryRepository } from './repositories/directory-repository';
import { DirectoryService } from './directory-service';
import { createDirectoryRouter, type DirectoryRouterOptions } from './routes/directory';
import type { AuthPort, EventPort, MemberProjectionPort, SeatChecker } from './types';
import { directoryDbAls } from './db-context';
import { DirectoryTenantPool, isTenantDbSplitEnabled } from './tenant-db';

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
): Promise<{
  app: Express;
  service: DirectoryService;
  db: DirectorySqlite;
  pool?: DirectoryTenantPool;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await DirectorySqlite.create(options.dbPath);
  await runDirectoryMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? new DirectoryTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
        create: (p) => DirectorySqlite.create(p),
      })
    : undefined;

  const service = new DirectoryService({
    repo: new DirectoryRepository(fallbackDb),
    seatChecker: options.seatChecker,
    auth: options.auth,
    projection: options.projection,
    events: options.events,
    defaultTenantId: options.tenantId ?? 'default',
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  if (pool) {
    app.use('/api/directory', async (req, res, next) => {
      const raw = String(req.headers['x-blok-tenant'] ?? '')
        .trim()
        .toLowerCase();
      if (!raw || !/^[a-z0-9_-]{1,64}$/.test(raw)) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(raw);
        directoryDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    });
  }

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

  return {
    app,
    service,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  DirectoryService,
  DirectoryRepository,
  DirectorySqlite,
  runDirectoryMigrations,
  createDirectoryRouter,
};
export * from './types';
export { DIRECTORY_DEFAULTS, DIRECTORY_MEMBER_ROLES } from './directory-service';

export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { DIRECTORY_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  DirectoryTenantPool,
} from './tenant-db';

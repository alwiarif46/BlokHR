import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import {
  SchoolFamilyOpsSqlite,
  runSchoolFamilyOpsMigrations,
} from './db';
import { resolveInternalSecret } from './internal-auth';
import { createFamilyOpsRouter } from './routes/family-ops';
import { familyOpsDbAls } from './db-context';
import {
  createFamilyOpsTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolFamilyOpsAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  internalSecret?: string;
}

export async function createSchoolFamilyOpsApp(
  options: SchoolFamilyOpsAppOptions,
): Promise<{
  app: Express;
  db: SchoolFamilyOpsSqlite;
  pool?: TenantSqlitePool<SchoolFamilyOpsSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolFamilyOpsSqlite.create(options.dbPath);
  await runSchoolFamilyOpsMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createFamilyOpsTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const internalSecret = options.internalSecret ?? resolveInternalSecret();

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
        apiPrefix: '/api/family-ops',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        familyOpsDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/family-ops', bindTenantDb);
  }

  app.use('/api/family-ops', createFamilyOpsRouter(fallbackDb, internalSecret));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School family-ops error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return {
    app,
    db: fallbackDb,
    pool,
    close: async () => {
      await pool?.closeAll();
      await fallbackDb.close();
    },
  };
}

export {
  SchoolFamilyOpsSqlite,
  runSchoolFamilyOpsMigrations,
  createFamilyOpsRouter,
};
export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { FAMILY_OPS_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createFamilyOpsTenantPool,
} from './tenant-db';

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
}> {
  const db = await SchoolFamilyOpsSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolFamilyOpsMigrations(db, migrationsDir);

  const internalSecret = options.internalSecret ?? resolveInternalSecret();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/family-ops', createFamilyOpsRouter(db, internalSecret));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School family-ops error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, db };
}

export {
  SchoolFamilyOpsSqlite,
  runSchoolFamilyOpsMigrations,
  createFamilyOpsRouter,
};
export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { FAMILY_OPS_ROUTE_POLICIES } from './route-policies';

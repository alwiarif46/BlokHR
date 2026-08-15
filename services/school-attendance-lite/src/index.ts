import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolSqlite, runSchoolMigrations } from './db';
import { SchoolAttendanceService } from './school-attendance-service';
import { createSchoolAttendanceRouter } from './routes/school-attendance';

export interface SchoolAttendanceAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
}

export async function createSchoolAttendanceApp(
  options: SchoolAttendanceAppOptions,
): Promise<{ app: Express; service: SchoolAttendanceService; db: SchoolSqlite }> {
  const db = await SchoolSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolMigrations(db, migrationsDir);

  const service = new SchoolAttendanceService(db, options.tenantId ?? 'default');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/school-attendance', createSchoolAttendanceRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School attendance error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export { SchoolAttendanceService, SchoolSqlite, runSchoolMigrations, createSchoolAttendanceRouter };
export type { MarkStatus } from './school-attendance-service';

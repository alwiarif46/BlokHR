import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolSqlite, runSchoolMigrations } from './db';
import { CaptureRollcallService } from './capture-rollcall-service';
import { createCaptureRollcallRouter } from './routes/capture-rollcall';

export interface CaptureRollcallAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
}

export async function createCaptureRollcallApp(
  options: CaptureRollcallAppOptions,
): Promise<{ app: Express; service: CaptureRollcallService; db: SchoolSqlite }> {
  const db = await SchoolSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolMigrations(db, migrationsDir);

  const service = new CaptureRollcallService(db, options.tenantId ?? 'default');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  // HTTP path unchanged for existing consumers (frontend school_register, capture mount).
  app.use('/api/school-attendance', createCaptureRollcallRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Capture rollcall error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  CaptureRollcallService,
  SchoolSqlite,
  runSchoolMigrations,
  createCaptureRollcallRouter,
};
export type { MarkStatus } from './capture-rollcall-service';

/** @deprecated Use CaptureRollcallAppOptions */
export type SchoolAttendanceAppOptions = CaptureRollcallAppOptions;
/** @deprecated Use createCaptureRollcallApp */
export const createSchoolAttendanceApp = createCaptureRollcallApp;
/** @deprecated Use CaptureRollcallService */
export const SchoolAttendanceService = CaptureRollcallService;
/** @deprecated Use createCaptureRollcallRouter */
export { createSchoolAttendanceRouter } from './routes/capture-rollcall';

/**
 * Resolve DB path: CAPTURE_ROLLCALL_DB_PATH preferred;
 * SCHOOL_ATTENDANCE_DB_PATH accepted with a deprecation log.
 */
export function resolveCaptureRollcallDbPath(
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Logger, 'warn'> | Console = console,
): string {
  const neu = (env.CAPTURE_ROLLCALL_DB_PATH ?? '').trim();
  if (neu) return neu;
  const legacy = (env.SCHOOL_ATTENDANCE_DB_PATH ?? '').trim();
  if (legacy) {
    log.warn(
      '[deprecation] SCHOOL_ATTENDANCE_DB_PATH is deprecated; use CAPTURE_ROLLCALL_DB_PATH',
    );
    return legacy;
  }
  return './school-attendance.db';
}

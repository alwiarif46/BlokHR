import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolAttendanceSqlite, runSchoolAttendanceMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { AttendanceRepository } from './repositories/attendance-repository';
import { AttendanceService, hashCapturePayloadB64 } from './services/attendance-service';
import { createAttendanceRouter } from './routes/attendance';
import { resolveInternalSecret } from './internal-auth';
import {
  HttpTimetableClient,
  type TimetableClient,
} from './clients/timetable-client';
import { attendanceDbAls } from './db-context';
import {
  createAttendanceTenantPool,
  extractRequestTenant,
  isTenantDbSplitEnabled,
  type TenantSqlitePool,
} from './tenant-db';

export interface SchoolAttendanceAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  internalSecret?: string;
  timetableClient?: TimetableClient;
}

export async function createSchoolAttendanceApp(
  options: SchoolAttendanceAppOptions,
): Promise<{
  app: Express;
  service: AttendanceService;
  db: SchoolAttendanceSqlite;
  pool?: TenantSqlitePool<SchoolAttendanceSqlite>;
  close?: () => Promise<void>;
}> {
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  const split = isTenantDbSplitEnabled();

  const fallbackDb = await SchoolAttendanceSqlite.create(options.dbPath);
  await runSchoolAttendanceMigrations(fallbackDb, migrationsDir);

  const pool = split
    ? createAttendanceTenantPool({
        legacyPath: options.dbPath,
        migrationsDir,
      })
    : undefined;

  const repo = new AttendanceRepository(fallbackDb);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const service = new AttendanceService(repo, events);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);
  const timetable =
    options.timetableClient ?? new HttpTimetableClient(undefined, internalSecret);

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
        apiPrefix: '/api/attendance',
      });
      if (!tid) {
        next();
        return;
      }
      try {
        const tenantDb = await pool.get(tid);
        attendanceDbAls.run(tenantDb, () => next());
      } catch (err) {
        next(err);
      }
    };
    app.use('/api/attendance', bindTenantDb);
  }

  app.use(
    '/api/attendance',
    createAttendanceRouter(service, { internalSecret, timetable }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School attendance error');
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
  AttendanceService,
  AttendanceRepository,
  SchoolAttendanceSqlite,
  runSchoolAttendanceMigrations,
  createAttendanceRouter,
  LogEventPublisher,
  hashCapturePayloadB64,
};
export {
  computeMonth,
  deriveDayPresent,
  computeEligibilityProjection,
} from './services/attendance-stats';
export { assignCohort, studentHoldoutBucket, classifyNudgeTier } from './services/nudge-math';
export * from './types';
export * from './events';
export { asRole, guardRoutes, staffFromHeaders } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { ATTENDANCE_ROUTE_POLICIES } from './route-policies';
export {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
  createAttendanceTenantPool,
} from './tenant-db';

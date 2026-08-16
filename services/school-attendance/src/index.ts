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
): Promise<{ app: Express; service: AttendanceService; db: SchoolAttendanceSqlite }> {
  const db = await SchoolAttendanceSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolAttendanceMigrations(db, migrationsDir);

  const repo = new AttendanceRepository(db);
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

  app.use(
    '/api/attendance',
    createAttendanceRouter(service, { internalSecret, timetable }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School attendance error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
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

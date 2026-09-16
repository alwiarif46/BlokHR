import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { OvertimeSqlite, runOvertimeMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { OvertimeRepository } from './repositories/overtime-repository';
import { OvertimeService } from './services/overtime-service';
import { createOvertimeRouter } from './routes/overtime';
import { resolveInternalSecret } from './internal-auth';
import {
  createHttpAttendanceClient,
  type AttendanceClient,
} from './clients/attendance-client';
import {
  createHttpHolidaysClient,
  type HolidaysClient,
} from './clients/holidays-client';
import {
  createHttpMembersClient,
  type MembersClient,
} from './clients/members-client';

export interface OvertimeAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  attendanceClient?: AttendanceClient;
  holidaysClient?: HolidaysClient;
  membersClient?: MembersClient;
  internalSecret?: string;
}

export async function createOvertimeApp(options: OvertimeAppOptions): Promise<{
  app: Express;
  service: OvertimeService;
  db: OvertimeSqlite;
}> {
  const db = await OvertimeSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runOvertimeMigrations(db, migrationsDir);

  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);

  const repo = new OvertimeRepository(db);
  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const attendance =
    options.attendanceClient ?? createHttpAttendanceClient(undefined, internalSecret);
  const holidays =
    options.holidaysClient ?? createHttpHolidaysClient(undefined, internalSecret);
  const members =
    options.membersClient ?? createHttpMembersClient(undefined, internalSecret);
  const service = new OvertimeService(
    repo,
    options.logger,
    attendance,
    holidays,
    members,
    events,
  );

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/overtime', createOvertimeRouter(service, { internalSecret }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Overtime service error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  OvertimeSqlite,
  runOvertimeMigrations,
  createOvertimeRouter,
  OvertimeRepository,
  OvertimeService,
  LogEventPublisher,
};
export { HttpEventPublisher } from './events';
export type { EventPublisher, DomainEvent } from './events';
export { calculateOvertimeIndia } from './formula';
export {
  createHttpAttendanceClient,
  StubAttendanceClient,
} from './clients/attendance-client';
export type {
  AttendanceClient,
  AttendanceDayRecord,
} from './clients/attendance-client';
export {
  createHttpHolidaysClient,
  StubHolidaysClient,
} from './clients/holidays-client';
export type { HolidaysClient } from './clients/holidays-client';
export {
  createHttpMembersClient,
  StubMembersClient,
} from './clients/members-client';
export type { MembersClient, MemberCompensation } from './clients/members-client';
export { asRole, guardRoutes } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { OVERTIME_ROUTE_POLICIES } from './route-policies';
export type {
  OvertimeView,
  OvertimeRequestView,
} from './services/overtime-service';
export type {
  OtPolicyConfig,
  OvertimeRow,
  OvertimeRequestRow,
} from './repositories/overtime-repository';

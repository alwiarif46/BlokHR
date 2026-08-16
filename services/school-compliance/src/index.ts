import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolComplianceSqlite, runSchoolComplianceMigrations } from './db';
import {
  HttpEventPublisher,
  LogEventPublisher,
  type EventPublisher,
} from './events';
import {
  HttpIdentityClient,
  HttpStorageClient,
  type IdentityClient,
  type StorageClient,
} from './clients/identity-client';
import { ComplianceRepository } from './repositories/compliance-repository';
import { ComplianceService } from './services/compliance-service';
import { ExportService } from './services/export-service';
import { ApaarService } from './services/apaar-service';
import { DsrService } from './services/dsr-service';
import {
  classifyApaarStudent,
  detectNameDobAnomalies,
} from './services/apaar-readiness';
import { createComplianceRouter } from './routes/compliance';
import { daysUntilDue, resolveDueDate, dueDateIso } from './services/due-math';
import { escapeCsv, buildCsv } from './exports/csv';
import { UDISE_COLUMNS } from './exports/udise-columns';
import { groupPreflightErrors, studentToUdiseRow } from './services/export-service';
import { DsrRepository } from './repositories/dsr-repository';

export interface SchoolComplianceAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  clock?: () => Date;
  events?: EventPublisher;
  identity?: IdentityClient;
  storage?: StorageClient;
}

export async function createSchoolComplianceApp(
  options: SchoolComplianceAppOptions,
): Promise<{
  app: Express;
  service: ComplianceService;
  exports: ExportService;
  apaar: ApaarService;
  dsr: DsrService;
  db: SchoolComplianceSqlite;
}> {
  const db = await SchoolComplianceSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolComplianceMigrations(db, migrationsDir);

  const repo = new ComplianceRepository(db);
  const dsrRepo = new DsrRepository(db);
  const clock = options.clock ?? (() => new Date());
  const service = new ComplianceService(repo, clock);
  const events =
    options.events ??
    (process.env.EVENT_SINK_URL
      ? new HttpEventPublisher(options.logger)
      : new LogEventPublisher(options.logger));
  const identity = options.identity ?? new HttpIdentityClient();
  const storage = options.storage ?? new HttpStorageClient();
  const exports = new ExportService(repo, identity, storage, events, clock);
  const apaar = new ApaarService(identity, clock);
  const dsr = new DsrService(dsrRepo, events, clock);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/compliance', createComplianceRouter(service, exports, apaar, dsr));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School compliance error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, exports, apaar, dsr, db };
}

export {
  ComplianceService,
  ComplianceRepository,
  ExportService,
  ApaarService,
  DsrService,
  DsrRepository,
  SchoolComplianceSqlite,
  runSchoolComplianceMigrations,
  createComplianceRouter,
  daysUntilDue,
  resolveDueDate,
  dueDateIso,
  escapeCsv,
  buildCsv,
  UDISE_COLUMNS,
  groupPreflightErrors,
  studentToUdiseRow,
  classifyApaarStudent,
  detectNameDobAnomalies,
  HttpIdentityClient,
  HttpStorageClient,
  HttpEventPublisher,
  LogEventPublisher,
};
export { addDaysIso, DEFAULT_SLA_DAYS } from './services/dsr-service';
export { SAMPLE_COMPLIANCE_ITEM_COUNT, seedGlobalComplianceItems } from './seed-compliance-items';
export * from './types';
export type { EventPublisher, DomainEvent } from './events';
export type {
  IdentityClient,
  StorageClient,
  IdentityStudentRow,
  ApaarStudentBundle,
  ApaarConsentState,
  UdisePreflightResult,
  UdisePreflightRow,
} from './clients/identity-client';

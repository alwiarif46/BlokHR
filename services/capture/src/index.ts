import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { CaptureSqlite, runCaptureMigrations } from './db';
import { CaptureRepository } from './repositories/capture-repository';
import { CaptureService } from './services/capture-service';
import { createCaptureRouter, type CaptureRouterOptions } from './routes/capture';
import type { ClockPort, ConsentPort, EntitlementsPort, SchoolAttendancePort } from './types';

export interface CaptureAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  tenantId?: string;
  consent: ConsentPort;
  entitlements: EntitlementsPort;
  schoolAttendance?: SchoolAttendancePort;
  clock?: ClockPort;
  routerOptions?: CaptureRouterOptions;
}

export async function createCaptureApp(
  options: CaptureAppOptions,
): Promise<{ app: Express; service: CaptureService; db: CaptureSqlite }> {
  const db = await CaptureSqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runCaptureMigrations(db, migrationsDir);

  const service = new CaptureService({
    db,
    repo: new CaptureRepository(db),
    logger: options.logger,
    tenantId: options.tenantId ?? 'default',
    consent: options.consent,
    entitlements: options.entitlements,
    schoolAttendance: options.schoolAttendance,
    clock: options.clock,
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(
    '/api/capture',
    createCaptureRouter(service, {
      tenantId: options.tenantId ?? 'default',
      ...(options.routerOptions ?? {}),
    }),
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Capture error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, db };
}

export {
  CaptureService,
  CaptureRepository,
  CaptureSqlite,
  runCaptureMigrations,
  createCaptureRouter,
};
export * from './types';
export { resolveAvailableModalities, isFaceJurisdictionBlocked, defaultJurisdiction } from './gating';

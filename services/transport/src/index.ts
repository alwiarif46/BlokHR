import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { TransportSqlite, runTransportMigrations } from './db';
import { TransportService, type CaptureMatchPort, type ConsentPort } from './transport-service';
import { createTransportRouter } from './routes/transport';

export async function createTransportApp(options: {
  dbPath: string;
  logger: Logger;
  tenantId?: string;
  capture: CaptureMatchPort;
  consent: ConsentPort;
  migrationsDir?: string;
}): Promise<{ app: Express; service: TransportService; db: TransportSqlite }> {
  const db = await TransportSqlite.create(options.dbPath);
  await runTransportMigrations(
    db,
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations'),
  );
  const service = new TransportService(
    db,
    options.tenantId ?? 'default',
    options.capture,
    options.consent,
  );
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/transport', createTransportRouter(service));
  return { app, service, db };
}

export { TransportService, TransportSqlite, runTransportMigrations, createTransportRouter };
export type { CaptureMatchPort, ConsentPort, EventKind } from './transport-service';

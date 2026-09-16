import path from 'path';
import type { Express } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import {
  ConsentSqlite,
  runConsentMigrations,
  ConsentRepository,
  ConsentService,
  createConsentRouter,
} from '@blokhr/consent';
import {
  CaptureSqlite,
  runCaptureMigrations,
  CaptureRepository,
  CaptureService,
  createCaptureRouter,
  MODULE_IDS,
} from '@blokhr/capture';
import {
  SchoolSqlite,
  runSchoolMigrations,
  CaptureRollcallService,
  createCaptureRollcallRouter,
} from '@blokhr/capture-rollcall';
import {
  TransportSqlite,
  runTransportMigrations,
  TransportService,
  createTransportRouter,
} from '@blokhr/transport';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import type { EntitlementsService } from '@blokhr/entitlements';
import type { FeatureFlagService } from '../services/feature-flags';

export interface CapturePlatformBundle {
  consent: ConsentService;
  capture: CaptureService;
  school: CaptureRollcallService;
  transport: TransportService;
  close: () => Promise<void>;
}

export async function createCapturePlatformBundle(
  config: AppConfig,
  logger: Logger,
  deps: {
    monolithDb: DatabaseEngine;
    entitlements?: EntitlementsService;
  },
): Promise<CapturePlatformBundle> {
  const consentDb = await ConsentSqlite.create(config.consentDbPath);
  await runConsentMigrations(
    consentDb,
    path.resolve(__dirname, '..', '..', '..', 'services', 'consent', 'migrations'),
  );
  const consentService = new ConsentService(new ConsentRepository(consentDb));

  const schoolDb = await SchoolSqlite.create(config.captureRollcallDbPath);
  await runSchoolMigrations(
    schoolDb,
    path.resolve(__dirname, '..', '..', '..', 'services', 'capture-rollcall', 'migrations'),
  );
  const schoolService = new CaptureRollcallService(schoolDb, config.defaultTenantId);

  const captureDb = await CaptureSqlite.create(config.captureDbPath);
  await runCaptureMigrations(
    captureDb,
    path.resolve(__dirname, '..', '..', '..', 'services', 'capture', 'migrations'),
  );

  const transportDb = await TransportSqlite.create(config.transportDbPath);
  await runTransportMigrations(
    transportDb,
    path.resolve(__dirname, '..', '..', '..', 'services', 'transport', 'migrations'),
  );

  const clockRepo = new ClockRepository(deps.monolithDb);
  const clockService = new ClockService(clockRepo, logger);

  const entitlementsPort = {
    async hasModule(tenantId: string, moduleId: string): Promise<boolean> {
      if (!deps.entitlements) {
        return (
          moduleId === MODULE_IDS.capture_qr ||
          moduleId === MODULE_IDS.school_roll_call ||
          moduleId === MODULE_IDS.capture_nfc ||
          moduleId === MODULE_IDS.capture_fingerprint_staff ||
          moduleId === MODULE_IDS.capture_face_adults ||
          moduleId === MODULE_IDS.transport_bus_rfid
        );
      }
      const result = await deps.entitlements.canUseModule(tenantId, moduleId);
      return result.allowed;
    },
  };

  const captureService = new CaptureService({
    db: captureDb,
    repo: new CaptureRepository(captureDb),
    logger,
    tenantId: config.defaultTenantId,
    consent: {
      validate: (tenantId, consentRef, modality) =>
        consentService.validate(tenantId, consentRef, modality),
    },
    entitlements: entitlementsPort,
    schoolAttendance: {
      markFromCapture: (input) => schoolService.markFromCapture(input),
    },
    clock: {
      clock: (action, email, name, source) => clockService.clock(action, email, name, source),
    },
  });

  const transportService = new TransportService(
    transportDb,
    config.defaultTenantId,
    {
      processBusRfid: async (input) => {
        const result = await captureService.processEvent({
          modality: 'bus_rfid',
          payloadB64: input.payloadB64,
          idempotencyKey: input.idempotencyKey,
          deviceId: input.deviceId,
          context: input.context,
          subjectTypeHint: 'student',
        });
        return {
          eventId: result.id,
          subjectRef: result.subjectRef,
          decision: result.decision,
        };
      },
    },
    {
      validate: (tenantId, consentRef, modality) =>
        consentService.validate(tenantId, consentRef, modality),
    },
  );

  await captureService.ensureJurisdiction({ vertical: 'hr', country: 'IN' });

  logger.info(
    {
      consentDbPath: config.consentDbPath,
      captureDbPath: config.captureDbPath,
      captureRollcallDbPath: config.captureRollcallDbPath,
      transportDbPath: config.transportDbPath,
    },
    'Capture platform ready',
  );

  return {
    consent: consentService,
    capture: captureService,
    school: schoolService,
    transport: transportService,
    close: async () => {
      await captureDb.close();
      await consentDb.close();
      await schoolDb.close();
      await transportDb.close();
    },
  };
}

export function mountCapturePlatform(
  app: Express,
  bundle: CapturePlatformBundle,
  config: AppConfig,
  monolithDb: DatabaseEngine,
  featureFlags?: FeatureFlagService,
): void {
  const isAdmin = async (email: string) => {
    const row = await monolithDb.get<{ email: string }>(
      'SELECT email FROM admins WHERE email = ?',
      [email],
    );
    return !!row;
  };

  const captureGuards = featureFlags ? [featureFlags.guardFeature('capture_admin')] : [];
  const registerGuards = featureFlags ? [featureFlags.guardFeature('school_register')] : [];

  app.use(
    '/api/consent',
    ...captureGuards,
    createConsentRouter(bundle.consent, {
      tenantId: config.defaultTenantId,
      isAdmin,
    }),
  );
  app.use(
    '/api/capture',
    ...captureGuards,
    createCaptureRouter(bundle.capture, {
      tenantId: config.defaultTenantId,
      isAdmin,
    }),
  );
  app.use(
    '/api/school-attendance',
    ...registerGuards,
    createCaptureRollcallRouter(bundle.school),
  );
  app.use('/api/transport', createTransportRouter(bundle.transport));
}

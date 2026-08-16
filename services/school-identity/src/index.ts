import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import type { Logger } from 'pino';
import { SchoolIdentitySqlite, runSchoolIdentityMigrations } from './db';
import { LogEventPublisher, type EventPublisher } from './events';
import { IdentityRepository } from './repositories/identity-repository';
import { GuardianAuthRepository } from './repositories/guardian-auth-repository';
import { IdentityService } from './services/identity-service';
import { GuardianAuthService } from './services/guardian-auth-service';
import { createIdentityRouter } from './routes/identity';
import { createGuardianAuthRouter } from './routes/guardian-auth';
import { resolveInternalSecret } from './internal-auth';

export interface SchoolIdentityAppOptions {
  dbPath: string;
  migrationsDir?: string;
  logger: Logger;
  eventPublisher?: EventPublisher;
  clock?: () => Date;
  internalSecret?: string;
}

export async function createSchoolIdentityApp(
  options: SchoolIdentityAppOptions,
): Promise<{
  app: Express;
  service: IdentityService;
  guardianAuth: GuardianAuthService;
  guardianAuthRepo: GuardianAuthRepository;
  db: SchoolIdentitySqlite;
}> {
  const db = await SchoolIdentitySqlite.create(options.dbPath);
  const migrationsDir =
    options.migrationsDir ?? path.resolve(__dirname, '..', 'migrations');
  await runSchoolIdentityMigrations(db, migrationsDir);

  const events = options.eventPublisher ?? new LogEventPublisher(options.logger);
  const repo = new IdentityRepository(db);
  const authRepo = new GuardianAuthRepository(db);
  const clock = options.clock ?? (() => new Date());
  const service = new IdentityService(repo, events);
  const guardianAuth = new GuardianAuthService(repo, authRepo, clock);
  const internalSecret =
    options.internalSecret ?? resolveInternalSecret(process.env);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/identity/guardian-auth', createGuardianAuthRouter(guardianAuth));
  app.use('/api/identity', createIdentityRouter(service, { internalSecret }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'School identity error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service, guardianAuth, guardianAuthRepo: authRepo, db };
}

export {
  IdentityService,
  IdentityRepository,
  GuardianAuthService,
  GuardianAuthRepository,
  SchoolIdentitySqlite,
  runSchoolIdentityMigrations,
  createIdentityRouter,
  createGuardianAuthRouter,
  LogEventPublisher,
};
export {
  hashToken,
  generateOpaqueToken,
  LOCKOUT_ATTEMPTS,
  LOCKOUT_MS,
  SESSION_TTL_MS,
} from './services/guardian-auth-crypto';
export * from './types';
export * from './events';
export { asRole, guardRoutes, staffFromHeaders } from './role-guard';
export type { Role, RoutePolicy } from './role-guard';
export { IDENTITY_ROUTE_POLICIES } from './route-policies';
export {
  listStatePacks,
  getStatePack,
  listStatePackCodes,
} from './state-packs';
export type {
  StatePack,
  StatePackCategory,
  StatePackGradeScheme,
  StatePackStudentIdField,
} from './state-packs';
export {
  validateStudentForUdise,
  ageYearsAt,
  ageRangeForClass,
} from './services/udise-validator';
export type {
  UdiseIssue,
  UdiseValidationResult,
  UdiseValidateContext,
} from './services/udise-validator';

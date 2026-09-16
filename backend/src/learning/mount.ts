import path from 'path';
import type { Express } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import type { FeatureFlagService } from '../services/feature-flags';
import {
  LearningSqlite,
  runLearningMigrations,
  LearningRepository,
  LearningService,
  createLearningRouter,
} from '@blokhr/learning';

export interface LearningBundle {
  service: LearningService;
  db: LearningSqlite;
  close: () => Promise<void>;
}

export async function createLearningBundle(
  config: AppConfig,
  logger: Logger,
): Promise<LearningBundle> {
  const learningDbPath = config.nodeEnv === 'test' ? ':memory:' : config.learningDbPath;

  const db = await LearningSqlite.create(learningDbPath);
  const migrationsDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'services',
    'learning',
    'migrations',
  );
  await runLearningMigrations(db, migrationsDir);

  const service = new LearningService(new LearningRepository(db));

  logger.info({ learningDbPath }, 'Learning service ready');

  return {
    service,
    db,
    close: async () => {
      await db.close();
    },
  };
}

export function mountLearningRouter(
  app: Express,
  bundle: LearningBundle,
  config: AppConfig,
  monolithDb: DatabaseEngine,
  featureFlags?: FeatureFlagService,
): void {
  const guards = featureFlags ? [featureFlags.guardFeature('training_lms')] : [];
  app.use(
    '/api/training',
    ...guards,
    createLearningRouter(bundle.service, {
      tenantId: config.defaultTenantId,
      isAdmin: async (email: string) => {
        const row = await monolithDb.get<{ email: string }>(
          'SELECT email FROM admins WHERE email = ?',
          [email],
        );
        return !!row;
      },
    }),
  );
}

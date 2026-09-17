import { loadConfig } from './config';
import { createLogger } from './config/logger';
import { createApp } from './app';
import { createDatabase } from './db';
import { createEventBus } from './events';
import { FeatureFlagService } from './services/feature-flags';
import { SseBroadcaster } from './sse/broadcaster';
import { SchedulerRunner } from './scheduler/runner';
import { SchedulerService } from './scheduler/scheduler-service';
import { ClockRepository } from './repositories/clock-repository';
import { registerAllRoutes } from './routes';
import {
  createCommercialServices,
  mountCommercialRouters,
} from './commercial/mount';
import {
  createDirectoryBundle,
  mountDirectoryRouter,
} from './directory/mount';
import {
  createLearningBundle,
  mountLearningRouter,
} from './learning/mount';
import {
  createKioskBundle,
  mountKioskRouter,
} from './kiosk/mount';
import {
  createCapturePlatformBundle,
  mountCapturePlatform,
} from './capture/mount';
import type { EventBus } from './events';
import type { CommercialServices } from './commercial/mount';
import type { DirectoryBundle } from './directory/mount';
import type { LearningBundle } from './learning/mount';
import type { KioskBundle } from './kiosk/mount';
import type { CapturePlatformBundle } from './capture/mount';

/**
 * Bootstrap the server.
 *
 * Startup sequence (order matters):
 *   1. Config — fail-fast on missing required env vars
 *   2. Logger — structured JSON with PII redaction
 *   3. Database — SQLite or Postgres, migrations auto-applied
 *   4. EventBus — in-memory (default) or Redis (when REDIS_URL is set)
 *   5. Feature flags — load into memory cache from DB
 *   6. SSE broadcaster — heartbeat timer for client connections
 *   7. Commercial services — entitlements + billing (own DBs)
 *   8. Routes — feature flag guard → Phase 1 → Phase 2
 *   9. Scheduler — auto-cutoff, absence marking, PTO accrual, reminders
 *  10. HTTP server — listen on configured port
 *
 * Shutdown sequence (on SIGTERM/SIGINT):
 *   1. Stop accepting new connections
 *   2. Stop scheduler
 *   3. Close EventBus
 *   4. Close SSE broadcaster
 *   5. Close commercial services
 *   6. Close database
 *   7. Exit 0
 *   8. Force exit after 30s if draining stalls
 */
async function main(): Promise<void> {
  // ── 1. Config ──
  const config = loadConfig();

  // ── 2. Logger ──
  const logger = createLogger({ level: config.logLevel, nodeEnv: config.nodeEnv });
  logger.info(
    {
      port: config.port,
      dbEngine: config.dbEngine,
      env: config.nodeEnv,
      deploymentMode: config.deploymentMode,
    },
    'Config loaded',
  );

  // ── 3. Database ──
  const db = await createDatabase(config, logger);
  logger.info('Database ready');

  // ── 4. EventBus ──
  let eventBus: EventBus | undefined;
  try {
    eventBus = await createEventBus(logger, config.redisUrl, config.eventRetentionDays);
    logger.info({ transport: config.redisUrl ? 'redis' : 'in-memory' }, 'EventBus ready');
  } catch (err) {
    logger.warn({ err }, 'EventBus creation failed, continuing without EventBus');
  }

  // ── 5. Feature flags ──
  const featureFlags = new FeatureFlagService(db, logger);
  await featureFlags.load();
  logger.info('Feature flags loaded');

  // ── 6. SSE broadcaster ──
  const broadcaster = new SseBroadcaster(logger);

  // ── 7. Commercial services ──
  const commercial: CommercialServices = await createCommercialServices(config, logger);

  // ── 7b. Directory (people) service ──
  const directory: DirectoryBundle = await createDirectoryBundle(config, logger, {
    monolithDb: db,
    entitlements: commercial.entitlements,
    eventBus,
  });

  // ── 7c. Learning (LMS) service ──
  const learning: LearningBundle = await createLearningBundle(config, logger);

  // ── 7d. Kiosk (shared-device PIN clock) service ──
  const kiosk: KioskBundle = await createKioskBundle(config, logger, {
    monolithDb: db,
    directory: directory.service,
  });

  // ── 7e. Capture platform (consent + capture + school attendance) ──
  const capturePlatform: CapturePlatformBundle = await createCapturePlatformBundle(config, logger, {
    monolithDb: db,
    entitlements: commercial.entitlements,
  });

  // ── 8. Routes ──
  const app = createApp(
    config,
    logger,
    (a) => {
      mountCommercialRouters(a, config, commercial);
      mountDirectoryRouter(a, directory, config, db, featureFlags);
      mountLearningRouter(a, learning, config, db, featureFlags);
      mountKioskRouter(a, kiosk, config, db, featureFlags);
      mountCapturePlatform(a, capturePlatform, config, db, featureFlags);
      registerAllRoutes(a, {
        db,
        config,
        logger,
        broadcaster,
        featureFlags,
        eventBus,
        entitlements: commercial.entitlements,
        directory: directory.service,
      });
    },
    db,
  );
  logger.info('Routes registered');

  // ── 9. Scheduler ──
  let scheduler: SchedulerRunner | undefined;
  try {
    const clockRepo = new ClockRepository(db);
    const schedulerService = new SchedulerService(db, clockRepo, broadcaster, logger);
    scheduler = new SchedulerRunner(schedulerService, logger);
    scheduler.start();
    logger.info('Scheduler started');
  } catch (err) {
    logger.warn({ err }, 'Scheduler failed to start, continuing without scheduler');
  }

  // ── 10. HTTP server ──
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
  });

  // ── Graceful shutdown ──
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutdown signal received, draining connections');

    server.close(() => {
      logger.info('HTTP server closed');

      // Stop scheduler
      if (scheduler) {
        scheduler.stop();
        logger.info('Scheduler stopped');
      }

      // Close EventBus
      const closeEventBus =
        eventBus && 'close' in eventBus
          ? (eventBus as { close: () => Promise<void> }).close()
          : Promise.resolve();

      closeEventBus
        .then(() => {
          logger.info('EventBus closed');
          // Close SSE
          broadcaster.stop();
          logger.info('SSE broadcaster stopped');
          return commercial.close();
        })
        .then(() => {
          logger.info('Commercial services closed');
          return directory.close();
        })
        .then(() => {
          logger.info('Directory service closed');
          return learning.close();
        })
        .then(() => {
          logger.info('Learning service closed');
          return kiosk.close();
        })
        .then(() => {
          logger.info('Kiosk service closed');
          return capturePlatform.close();
        })
        .then(() => {
          logger.info('Capture platform closed');
          // Close DB
          return db.close();
        })
        .then(() => {
          logger.info('Database closed');
          process.exit(0);
        })
        .catch((err) => {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        });
    });

    // Force exit after 30s if draining stalls
    setTimeout(() => {
      logger.error('Forced exit after 30s shutdown timeout');
      process.exit(1);
    }, 30_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — crashing');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection — crashing');
    process.exit(1);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FATAL: Server failed to start', err);
  process.exit(1);
});

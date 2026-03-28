import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import type { DatabaseEngine } from './engine';
import { SqliteEngine } from './sqlite-engine';
import { PostgresEngine } from './postgres-engine';
import { MigrationRunner } from './migration-runner';

export type { DatabaseEngine, DbRow } from './engine';

/**
 * Creates, initializes, and migrates the database.
 * Returns a ready-to-use DatabaseEngine.
 *
 * Two engines:
 *   - sqlite: sql.js (WASM), file-based or in-memory. Zero setup.
 *   - postgres: pg connection pool. Set DB_URL to connection string.
 */
export async function createDatabase(config: AppConfig, logger: Logger): Promise<DatabaseEngine> {
  let engine: DatabaseEngine;

  if (config.dbEngine === 'postgres') {
    if (!config.dbUrl) {
      throw new Error(
        'FATAL: DB_ENGINE=postgres requires DB_URL. ' +
          'Set DB_URL=postgresql://user:pass@host:5432/shaavir',
      );
    }
    engine = new PostgresEngine(config.dbUrl);
    // Verify connection
    const alive = await engine.ping();
    if (!alive) {
      throw new Error(
        `FATAL: Cannot connect to PostgreSQL at ${config.dbUrl.replace(/:[^:@]+@/, ':***@')}`,
      );
    }
    logger.info(
      { url: config.dbUrl.replace(/:[^:@]+@/, ':***@') },
      'PostgreSQL database connected',
    );
  } else {
    const sqlite = new SqliteEngine(config.dbPath);
    await sqlite.initialize();
    engine = sqlite;
    logger.info({ path: config.dbPath }, 'SQLite database initialized');
  }

  // Run migrations
  const runner = new MigrationRunner(engine, config.migrationsDir, logger);
  const applied = await runner.run();
  logger.info({ applied }, 'Database migrations complete');

  return engine;
}

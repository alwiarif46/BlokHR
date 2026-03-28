import fs from 'fs';
import path from 'path';
import type { Logger } from 'pino';
import type { DatabaseEngine } from './engine';

interface MigrationFile {
  version: string;
  name: string;
  filePath: string;
}

/**
 * Runs versioned SQL migrations on startup.
 * Migrations are numbered SQL files in the migrations/ directory: 001_name.sql, 002_name.sql, etc.
 * Applied migrations are tracked in the _migrations table.
 * Runs inside a transaction per migration — if one fails, it rolls back and throws.
 * Never skips a version — if version 3 is applied but 2 is not, it throws.
 */
export class MigrationRunner {
  private readonly db: DatabaseEngine;
  private readonly migrationsDir: string;
  private readonly logger: Logger;

  constructor(db: DatabaseEngine, migrationsDir: string, logger: Logger) {
    this.db = db;
    this.migrationsDir = migrationsDir;
    this.logger = logger;
  }

  /** Ensure the _migrations tracking table exists. */
  private async ensureMigrationsTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /** Read and sort migration files from disk. */
  private readMigrationFiles(): MigrationFile[] {
    if (!fs.existsSync(this.migrationsDir)) {
      this.logger.warn({ dir: this.migrationsDir }, 'Migrations directory does not exist');
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    return files.map((f) => {
      const match = /^(\d+)_(.+)\.sql$/.exec(f);
      if (!match) {
        throw new Error(`Invalid migration filename: ${f}. Expected format: 001_name.sql`);
      }
      return {
        version: match[1],
        name: match[2],
        filePath: path.join(this.migrationsDir, f),
      };
    });
  }

  /** Get list of already-applied migration versions. */
  private async getAppliedVersions(): Promise<Set<string>> {
    const rows = await this.db.all<{ version: string }>(
      'SELECT version FROM _migrations ORDER BY version',
    );
    return new Set(rows.map((r) => r.version));
  }

  /** Run all pending migrations in order. */
  async run(): Promise<number> {
    await this.ensureMigrationsTable();

    const files = this.readMigrationFiles();
    const applied = await this.getAppliedVersions();
    let count = 0;

    for (const migration of files) {
      if (applied.has(migration.version)) {
        continue;
      }

      // Detect gaps: if a later migration is applied but this one isn't, error
      for (const laterFile of files) {
        if (laterFile.version > migration.version && applied.has(laterFile.version)) {
          throw new Error(
            `Migration gap detected: ${migration.version}_${migration.name} is not applied, ` +
              `but ${laterFile.version}_${laterFile.name} is. Migrations must be sequential.`,
          );
        }
      }

      const sql = fs.readFileSync(migration.filePath, 'utf-8');
      this.logger.info({ version: migration.version, name: migration.name }, 'Applying migration');

      await this.db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [
          migration.version,
          migration.name,
        ]);
      });

      this.logger.info({ version: migration.version, name: migration.name }, 'Migration applied');
      count++;
    }

    if (count === 0) {
      this.logger.info('No pending migrations');
    } else {
      this.logger.info({ count }, 'Migrations complete');
    }

    return count;
  }
}

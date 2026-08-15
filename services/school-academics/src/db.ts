import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — sql.js ships without bundled types in this package
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { seedSampleNcertOutcomes } from './seed-ncert-sample';

export interface SchoolAcademicsDb {
  get<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  close(): Promise<void>;
}

export class SchoolAcademicsSqlite implements SchoolAcademicsDb {
  private db!: SqlJsDatabase;
  private persistPath: string | null;

  private constructor(persistPath: string | null) {
    this.persistPath = persistPath === ':memory:' ? null : persistPath;
  }

  static async create(dbPath: string): Promise<SchoolAcademicsSqlite> {
    const engine = new SchoolAcademicsSqlite(dbPath);
    const SQL = await initSqlJs();
    if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      engine.db = new SQL.Database(buf);
    } else {
      engine.db = new SQL.Database();
      if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }
    }
    return engine;
  }

  async get<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as never[]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  async all<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as never[]);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.db.run(sql, params as never[]);
    this.persist();
  }

  async close(): Promise<void> {
    this.persist();
    this.db.close();
  }

  private persist(): void {
    if (!this.persistPath) return;
    const data = this.db.export();
    fs.writeFileSync(this.persistPath, Buffer.from(data));
  }
}

export async function runSchoolAcademicsMigrations(
  db: SchoolAcademicsDb,
  migrationsDir: string,
): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.split('_')[0];
    const existing = await db.get<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [version],
    );
    if (existing) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await db.run(stmt);
    }
    await db.run('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
  }

  // SAMPLE SEED — replace with full NCERT import (called from migration runner path).
  await seedSampleNcertOutcomes(db);
}

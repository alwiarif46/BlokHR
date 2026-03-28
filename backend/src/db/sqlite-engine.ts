/**
 * sql.js is synchronous under the hood (WASM).
 * Methods are async to satisfy the DatabaseEngine interface (needed for Postgres compatibility).
 * The require-await rule is disabled at file level for this reason.
 */
/* eslint-disable @typescript-eslint/require-await */
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import type { DatabaseEngine, DbRow } from './engine';

/**
 * SQLite engine backed by sql.js (pure WASM, no native compilation).
 * Database persists to a file on disk. On Azure App Service, use /home/data/ for persistence.
 * WAL mode is not available in sql.js — uses default journal mode.
 * Thread-safe for single-instance servers (sql.js is synchronous under the hood).
 */
export class SqliteEngine implements DatabaseEngine {
  private db: SqlJsDatabase | null = null;
  private readonly dbPath: string;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** Initialize the engine: load sql.js WASM, open or create the DB file. */
  async initialize(): Promise<void> {
    const SQL = await initSqlJs();

    if (this.dbPath === ':memory:') {
      this.db = new SQL.Database();
    } else {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
      }
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON;');
    // Busy timeout equivalent — not needed for sql.js (single-threaded)
    // but set journal mode for safety
    this.db.run('PRAGMA journal_mode = DELETE;');

    // Auto-save to disk every 5 seconds if dirty
    this.saveTimer = setInterval(() => {
      this.persistToDisk();
    }, 5000);
  }

  /** Flush in-memory DB to disk file. Skips for in-memory databases. */
  private persistToDisk(): void {
    if (!this.dirty || !this.db) return;
    if (this.dbPath === ':memory:') return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const tmpPath = this.dbPath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, this.dbPath);
    this.dirty = false;
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    const db = this.ensureDb();
    db.run(sql, params as initSqlJs.BindParams);
    this.dirty = true;

    const changesRow = db.exec('SELECT changes() as c, last_insert_rowid() as r');
    const changes =
      changesRow.length > 0 && changesRow[0].values.length > 0
        ? Number(changesRow[0].values[0][0])
        : 0;
    const lastInsertRowid =
      changesRow.length > 0 && changesRow[0].values.length > 0
        ? Number(changesRow[0].values[0][1])
        : 0;

    return { changes, lastInsertRowid };
  }

  async get<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as initSqlJs.BindParams);

    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  async all<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as initSqlJs.BindParams);

    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  async transaction<T>(fn: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    const db = this.ensureDb();
    db.run('BEGIN TRANSACTION;');
    try {
      const result = await fn(this);
      db.run('COMMIT;');
      this.dirty = true;
      return result;
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }
  }

  async exec(sql: string): Promise<void> {
    const db = this.ensureDb();
    db.exec(sql);
    this.dirty = true;
  }

  async close(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    this.persistToDisk();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const db = this.ensureDb();
      db.exec('SELECT 1;');
      return true;
    } catch {
      return false;
    }
  }
}

import pg from 'pg';
import type { DatabaseEngine, DbRow } from './engine';

const { Pool } = pg;
type PgPool = InstanceType<typeof Pool>;
type PgPoolClient = pg.PoolClient;

/**
 * PostgreSQL engine backed by the `pg` package with connection pooling.
 *
 * Key design: all SQL written for SQLite is automatically translated to
 * Postgres-compatible syntax at execution time. This means:
 *   - Migrations work on both engines without modification
 *   - Application queries work on both engines without modification
 *   - No dual-maintenance of SQL
 *
 * Translation rules:
 *   - `?` params → `$1, $2, $3, ...`
 *   - `datetime('now')` → `CURRENT_TIMESTAMP`
 *   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
 *   - `INSERT OR IGNORE INTO` → `INSERT INTO ... ON CONFLICT DO NOTHING`
 *   - `INSERT OR REPLACE INTO` → Postgres UPSERT (best-effort)
 *   - SQLite `PRAGMA` statements → silently ignored
 */
export class PostgresEngine implements DatabaseEngine {
  private pool: PgPool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    if (isPragma(sql)) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    // For INSERTs on tables with SERIAL id, try to get the id back
    const finalSql = numberedSql;
    const isInsert = /^\s*INSERT\s+INTO/i.test(finalSql);
    const hasReturning = /\bRETURNING\b/i.test(finalSql);

    if (isInsert && !hasReturning) {
      try {
        const result = await this.pool.query(finalSql + ' RETURNING id', pgParams);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        const lastId = row && row.id !== null && row.id !== undefined ? Number(row.id) : 0;
        return { changes: result.rowCount ?? 0, lastInsertRowid: lastId };
      } catch {
        const result = await this.pool.query(finalSql, pgParams);
        return { changes: result.rowCount ?? 0, lastInsertRowid: 0 };
      }
    }

    const result = await this.pool.query(finalSql, pgParams);
    return { changes: result.rowCount ?? 0, lastInsertRowid: 0 };
  }

  async get<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (isPragma(sql)) return null;
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    const result = await this.pool.query(numberedSql, pgParams);
    return (result.rows[0] as T) ?? null;
  }

  async all<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (isPragma(sql)) return [];
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    const result = await this.pool.query(numberedSql, pgParams);
    return result.rows as T[];
  }

  async transaction<T>(fn: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txEngine = new PgClientEngine(client);
      const result = await fn(txEngine);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async exec(sql: string): Promise<void> {
    if (isPragma(sql)) return;
    const translated = translateSql(sql);
    // exec() can have multiple statements — split on semicolons and execute each
    const statements = splitStatements(translated);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      try {
        await this.pool.query(trimmed);
      } catch (err) {
        // Tolerate "column already exists" for ALTER TABLE ADD COLUMN idempotency
        const msg = (err as Error).message ?? '';
        if (msg.includes('already exists')) continue;
        throw err;
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 AS ok');
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return row?.ok === 1;
    } catch {
      return false;
    }
  }
}

/**
 * Transaction-scoped engine that uses a single checked-out client.
 * Used inside `transaction()` to ensure all statements run on the same connection.
 */
class PgClientEngine implements DatabaseEngine {
  constructor(private readonly client: PgPoolClient) {}

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    if (isPragma(sql)) return { changes: 0, lastInsertRowid: 0 };
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    const isInsert = /^\s*INSERT\s+INTO/i.test(numberedSql);
    const hasReturning = /\bRETURNING\b/i.test(numberedSql);

    if (isInsert && !hasReturning) {
      try {
        const result = await this.client.query(numberedSql + ' RETURNING id', pgParams);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        const lastId = row && row.id !== null && row.id !== undefined ? Number(row.id) : 0;
        return { changes: result.rowCount ?? 0, lastInsertRowid: lastId };
      } catch {
        const result = await this.client.query(numberedSql, pgParams);
        return { changes: result.rowCount ?? 0, lastInsertRowid: 0 };
      }
    }

    const result = await this.client.query(numberedSql, pgParams);
    return { changes: result.rowCount ?? 0, lastInsertRowid: 0 };
  }

  async get<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (isPragma(sql)) return null;
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    const result = await this.client.query(numberedSql, pgParams);
    return (result.rows[0] as T) ?? null;
  }

  async all<T extends DbRow = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (isPragma(sql)) return [];
    const translated = translateSql(sql);
    const pgParams = translateParams(params);
    const numberedSql = numberParams(translated);

    const result = await this.client.query(numberedSql, pgParams);
    return result.rows as T[];
  }

  async transaction<T>(fn: (engine: DatabaseEngine) => Promise<T>): Promise<T> {
    // Already inside a transaction — savepoints for nested
    await this.client.query('SAVEPOINT nested');
    try {
      const result = await fn(this);
      await this.client.query('RELEASE SAVEPOINT nested');
      return result;
    } catch (err) {
      await this.client.query('ROLLBACK TO SAVEPOINT nested');
      throw err;
    }
  }

  async exec(sql: string): Promise<void> {
    if (isPragma(sql)) return;
    const translated = translateSql(sql);
    const statements = splitStatements(translated);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      try {
        await this.client.query(trimmed);
      } catch (err) {
        const msg = (err as Error).message ?? '';
        if (msg.includes('already exists')) continue;
        throw err;
      }
    }
  }

  async close(): Promise<void> {
    // No-op for client engine — pool manages lifecycle
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  SQL DIALECT TRANSLATION — SQLite → PostgreSQL
// ═══════════════════════════════════════════════════════════════

/** Check if a SQL statement is a SQLite PRAGMA (skip on Postgres). */
function isPragma(sql: string): boolean {
  return /^\s*PRAGMA\b/i.test(sql.trim());
}

/**
 * Translate SQLite-dialect SQL to PostgreSQL.
 * Handles the 5 most common incompatibilities.
 */
function translateSql(sql: string): string {
  let result = sql;

  // 1. datetime('now') → CURRENT_TIMESTAMP
  result = result.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');

  // 2. INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  result = result.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

  // 3. INSERT OR IGNORE INTO → INSERT INTO ... ON CONFLICT DO NOTHING
  result = result.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  // Add ON CONFLICT DO NOTHING to INSERT OR IGNORE statements
  if (/INSERT\s+OR\s+IGNORE/i.test(sql)) {
    // Find VALUES(...) and append ON CONFLICT DO NOTHING after closing paren
    if (!/ON\s+CONFLICT/i.test(result)) {
      result = result.replace(/(\)\s*;?\s*)$/, ') ON CONFLICT DO NOTHING;');
    }
  }

  // 4. INSERT OR REPLACE INTO → INSERT INTO ... ON CONFLICT DO UPDATE
  // This is harder to auto-translate perfectly, so we convert to basic INSERT
  // with ON CONFLICT DO NOTHING (callers that need UPSERT use ON CONFLICT explicitly)
  if (/INSERT\s+OR\s+REPLACE/i.test(sql)) {
    result = result.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(result)) {
      result = result.replace(/(\)\s*;?\s*)$/, ') ON CONFLICT DO NOTHING;');
    }
  }

  // 5. Boolean handling: SQLite stores booleans as 0/1 integers — Postgres handles this natively

  return result;
}

/**
 * Convert `?` placeholders to `$1, $2, $3, ...` for pg driver.
 * Skips `?` inside single-quoted strings.
 */
function numberParams(sql: string): string {
  let idx = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && (i === 0 || sql[i - 1] !== "'")) {
      inString = !inString;
      result += ch;
    } else if (ch === '?' && !inString) {
      idx++;
      result += '$' + idx;
    } else {
      result += ch;
    }
  }

  return result;
}

/**
 * Translate parameter values for Postgres compatibility.
 * SQLite stores booleans as 0/1; Postgres accepts both but
 * some contexts need explicit handling.
 */
function translateParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    // Convert undefined to null
    if (p === undefined) return null;
    return p;
  });
}

/**
 * Split a multi-statement SQL string into individual statements.
 * Respects string literals (won't split on semicolons inside quotes).
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        current += ch;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '-' && next === '-' && !inString) {
      inLineComment = true;
      current += ch;
      continue;
    }

    if (ch === "'" && !inLineComment) {
      inString = !inString;
      current += ch;
      continue;
    }

    if (ch === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

/**
 * Database engine abstraction.
 * Business logic calls these methods — never touches SQL drivers directly.
 * Two implementations: SqliteEngine (sql.js / WASM) and PostgresEngine (pg).
 */

export interface DbRow {
  [key: string]: unknown;
}

export interface DatabaseEngine {
  /** Execute a write statement (INSERT, UPDATE, DELETE). Returns { changes, lastInsertRowid }. */
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;

  /** Fetch a single row. Returns null if not found. */
  get<T extends DbRow = DbRow>(sql: string, params?: unknown[]): Promise<T | null>;

  /** Fetch all matching rows. */
  all<T extends DbRow = DbRow>(sql: string, params?: unknown[]): Promise<T[]>;

  /** Execute multiple statements inside a transaction. Rolls back on error. */
  transaction<T>(fn: (engine: DatabaseEngine) => Promise<T>): Promise<T>;

  /** Execute raw SQL with no return (DDL statements, pragmas). */
  exec(sql: string): Promise<void>;

  /** Close the database connection. */
  close(): Promise<void>;

  /** Check if the database connection is alive. */
  ping(): Promise<boolean>;
}

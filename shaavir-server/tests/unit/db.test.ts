import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';
import pino from 'pino';

const logger = pino({ level: 'silent' });

function tmpDbPath(): string {
  return path.join(
    os.tmpdir(),
    `shaavir-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
}

function tmpMigrationsDir(): string {
  const dir = path.join(
    os.tmpdir(),
    `shaavir-mig-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('SqliteEngine', () => {
  let engine: SqliteEngine;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    engine = new SqliteEngine(dbPath);
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('ping returns true after initialization', async () => {
    expect(await engine.ping()).toBe(true);
  });

  it('exec creates a table', async () => {
    await engine.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');
    const row = await engine.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
    );
    expect(row).not.toBeNull();
    expect(row?.name).toBe('test_table');
  });

  it('run inserts a row and returns changes + lastInsertRowid', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT)');
    const result = await engine.run('INSERT INTO items (val) VALUES (?)', ['hello']);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(1);
  });

  it('get returns null when row not found', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    const row = await engine.get('SELECT * FROM items WHERE id = ?', [999]);
    expect(row).toBeNull();
  });

  it('get returns the row when found', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [1, 'test']);
    const row = await engine.get<{ id: number; val: string }>(
      'SELECT * FROM items WHERE id = ?',
      [1],
    );
    expect(row).not.toBeNull();
    expect(row?.id).toBe(1);
    expect(row?.val).toBe('test');
  });

  it('all returns empty array when no rows', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    const rows = await engine.all('SELECT * FROM items');
    expect(rows).toEqual([]);
  });

  it('all returns multiple rows', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [1, 'a']);
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [2, 'b']);
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [3, 'c']);
    const rows = await engine.all<{ id: number; val: string }>('SELECT * FROM items ORDER BY id');
    expect(rows).toHaveLength(3);
    expect(rows[0].val).toBe('a');
    expect(rows[2].val).toBe('c');
  });

  it('transaction commits on success', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await engine.transaction(async (tx) => {
      await tx.run('INSERT INTO items (id, val) VALUES (?, ?)', [1, 'committed']);
    });
    const row = await engine.get<{ val: string }>('SELECT val FROM items WHERE id = 1');
    expect(row?.val).toBe('committed');
  });

  it('transaction rolls back on error', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [1, 'original']);

    await expect(
      engine.transaction(async (tx) => {
        await tx.run('UPDATE items SET val = ? WHERE id = ?', ['changed', 1]);
        throw new Error('Simulated failure');
      }),
    ).rejects.toThrow('Simulated failure');

    const row = await engine.get<{ val: string }>('SELECT val FROM items WHERE id = 1');
    expect(row?.val).toBe('original');
  });

  it('persists data to disk after close', async () => {
    await engine.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await engine.run('INSERT INTO items (id, val) VALUES (?, ?)', [1, 'persisted']);
    await engine.close();

    // Reopen from disk
    const engine2 = new SqliteEngine(dbPath);
    await engine2.initialize();
    const row = await engine2.get<{ val: string }>('SELECT val FROM items WHERE id = 1');
    expect(row?.val).toBe('persisted');
    await engine2.close();

    // Reassign so afterEach cleanup works
    engine = new SqliteEngine(tmpDbPath());
    await engine.initialize();
  });

  it('throws when used before initialization', async () => {
    const uninit = new SqliteEngine(tmpDbPath());
    await expect(uninit.run('SELECT 1')).rejects.toThrow('not initialized');
  });
});

describe('MigrationRunner', () => {
  let engine: SqliteEngine;
  let dbPath: string;
  let migDir: string;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    engine = new SqliteEngine(dbPath);
    await engine.initialize();
    migDir = tmpMigrationsDir();
  });

  afterEach(async () => {
    await engine.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(migDir)) fs.rmSync(migDir, { recursive: true });
  });

  it('creates _migrations table on first run', async () => {
    const runner = new MigrationRunner(engine, migDir, logger);
    await runner.run();
    const row = await engine.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'",
    );
    expect(row).not.toBeNull();
  });

  it('returns 0 when no migration files exist', async () => {
    const runner = new MigrationRunner(engine, migDir, logger);
    const count = await runner.run();
    expect(count).toBe(0);
  });

  it('applies a single migration', async () => {
    fs.writeFileSync(
      path.join(migDir, '001_test.sql'),
      'CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT);',
    );
    const runner = new MigrationRunner(engine, migDir, logger);
    const count = await runner.run();
    expect(count).toBe(1);

    const row = await engine.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_items'",
    );
    expect(row).not.toBeNull();
  });

  it('skips already-applied migrations', async () => {
    fs.writeFileSync(
      path.join(migDir, '001_test.sql'),
      'CREATE TABLE test_items (id INTEGER PRIMARY KEY);',
    );
    const runner = new MigrationRunner(engine, migDir, logger);
    await runner.run();
    const count2 = await runner.run();
    expect(count2).toBe(0);
  });

  it('applies multiple migrations in order', async () => {
    fs.writeFileSync(
      path.join(migDir, '001_first.sql'),
      'CREATE TABLE t1 (id INTEGER PRIMARY KEY);',
    );
    fs.writeFileSync(
      path.join(migDir, '002_second.sql'),
      'CREATE TABLE t2 (id INTEGER PRIMARY KEY);',
    );
    const runner = new MigrationRunner(engine, migDir, logger);
    const count = await runner.run();
    expect(count).toBe(2);

    const t1 = await engine.get("SELECT name FROM sqlite_master WHERE type='table' AND name='t1'");
    const t2 = await engine.get("SELECT name FROM sqlite_master WHERE type='table' AND name='t2'");
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
  });

  it('rolls back a failed migration without affecting prior ones', async () => {
    fs.writeFileSync(
      path.join(migDir, '001_good.sql'),
      'CREATE TABLE good_table (id INTEGER PRIMARY KEY);',
    );
    fs.writeFileSync(path.join(migDir, '002_bad.sql'), 'INVALID SQL STATEMENT;');
    const runner = new MigrationRunner(engine, migDir, logger);

    await expect(runner.run()).rejects.toThrow();

    // First migration should have been applied (it ran in its own transaction)
    const good = await engine.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'",
    );
    expect(good).not.toBeNull();

    // Second migration should NOT have been recorded
    const applied = await engine.all<{ version: string }>('SELECT version FROM _migrations');
    expect(applied).toHaveLength(1);
    expect(applied[0].version).toBe('001');
  });

  it('throws on invalid migration filename', async () => {
    fs.writeFileSync(path.join(migDir, 'bad-name.sql'), 'SELECT 1;');
    const runner = new MigrationRunner(engine, migDir, logger);
    await expect(runner.run()).rejects.toThrow('Invalid migration filename');
  });

  it('throws on migration gap', async () => {
    // Apply migration 001 and 003, skip 002
    fs.writeFileSync(
      path.join(migDir, '001_first.sql'),
      'CREATE TABLE t1 (id INTEGER PRIMARY KEY);',
    );
    const runner1 = new MigrationRunner(engine, migDir, logger);
    await runner1.run();

    // Now manually insert 003 as applied (simulating a gap)
    await engine.run("INSERT INTO _migrations (version, name) VALUES ('003', 'third')");

    // Add 002 and 003 files
    fs.writeFileSync(
      path.join(migDir, '002_second.sql'),
      'CREATE TABLE t2 (id INTEGER PRIMARY KEY);',
    );
    fs.writeFileSync(
      path.join(migDir, '003_third.sql'),
      'CREATE TABLE t3 (id INTEGER PRIMARY KEY);',
    );

    const runner2 = new MigrationRunner(engine, migDir, logger);
    await expect(runner2.run()).rejects.toThrow('Migration gap detected');
  });

  it('handles non-existent migrations directory gracefully', async () => {
    const runner = new MigrationRunner(engine, '/tmp/nonexistent-dir-xyz', logger);
    const count = await runner.run();
    expect(count).toBe(0);
  });

  it('applies all real migrations', async () => {
    const realMigDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(engine, realMigDir, logger);
    const count = await runner.run();
    expect(count).toBe(35);

    // Verify infrastructure tables exist
    const tables = await engine.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tableNames = tables.map((t) => t.name);
    // 001_skeleton tables
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('notification_queue');
    expect(tableNames).toContain('webhook_inbound_log');
    expect(tableNames).toContain('kv_store');
    // 002_settings tables
    expect(tableNames).toContain('groups');
    expect(tableNames).toContain('members');
    expect(tableNames).toContain('admins');
    expect(tableNames).toContain('role_assignments');
    expect(tableNames).toContain('late_rules');
    expect(tableNames).toContain('system_settings');
    expect(tableNames).toContain('member_types');
    expect(tableNames).toContain('designations');
    // 003_attendance tables
    expect(tableNames).toContain('attendance_daily');
    expect(tableNames).toContain('clock_events');
    expect(tableNames).toContain('monthly_late_counts');
    // 004_leaves tables
    expect(tableNames).toContain('leave_policies');
    expect(tableNames).toContain('leave_requests');
    expect(tableNames).toContain('pto_balances');
    // 005_notifications tables
    expect(tableNames).toContain('notification_cards');
    // 006_branding tables
    expect(tableNames).toContain('branding');
    // 007_regularizations tables
    expect(tableNames).toContain('regularizations');
    // 008_bd_meetings tables
    expect(tableNames).toContain('bd_meetings');
    // 009_tracked_meetings tables
    expect(tableNames).toContain('tracked_meetings');
    expect(tableNames).toContain('meeting_attendance');
    // 010_leave_policy_rules tables
    expect(tableNames).toContain('leave_clubbing_rules');
  });
});

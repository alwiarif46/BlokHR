import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import pino from 'pino';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';

describe('Migration 045 — BlokSchool colour preset', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine(':memory:');
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.close();
  });

  it('applies on a fresh DB and seeds csp-blokschool', async () => {
    const migDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(engine, migDir, pino({ level: 'silent' }));
    const count = await runner.run();
    expect(count).toBeGreaterThanOrEqual(45);

    const row = await engine.get<{ id: string; name: string; accent: string }>(
      "SELECT id, name, accent FROM colour_scheme_presets WHERE id = 'csp-blokschool'",
    );
    expect(row).toBeTruthy();
    expect(row!.name).toBe('BlokSchool');
    expect(row!.accent).toBe('#0ea5e9');
  });
});

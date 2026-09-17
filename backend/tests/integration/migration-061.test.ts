import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';

describe('Migration 061 — rehome default setup to si', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine(':memory:');
    await engine.initialize();
    const migDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(engine, migDir, pino({ level: 'silent' }));
    await runner.run();
  });

  afterEach(async () => {
    await engine.close();
  });

  it('moves completed default branding to si and reopens the wizard on default', async () => {
    await engine.run(
      `UPDATE branding SET
         company_name = 'Hanfia High School',
         tagline = 'Learn',
         setup_complete = 1,
         license_key = 'cloud-trial',
         license_valid = 1,
         auth_local_enabled = 1
       WHERE tenant_id = 'default'`,
    );
    await engine.run(
      `UPDATE branding SET setup_complete = 0, company_name = '' WHERE tenant_id = 'si'`,
    );
    await engine.run(
      `INSERT OR IGNORE INTO auth_credentials (tenant_id, email, password_hash)
       VALUES ('default', 'admin@hanfia.test', 'hash')`,
    );
    await engine.run(
      `INSERT OR IGNORE INTO members (tenant_id, id, email, name, role, active)
       VALUES ('default', 'm1', 'admin@hanfia.test', 'Admin', 'admin', 1)`,
    );
    await engine.run(
      `UPDATE tenant_settings
       SET settings_json = '{"vertical":"school"}', company_legal_name = 'Hanfia High School'
       WHERE id = 'default'`,
    );

    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../migrations/061_rehome_default_setup_to_si.sql'),
      'utf8',
    );
    await engine.exec(sql);

    const def = await engine.get<{
      company_name: string;
      setup_complete: number;
    }>('SELECT company_name, setup_complete FROM branding WHERE tenant_id = ?', ['default']);
    const si = await engine.get<{
      company_name: string;
      setup_complete: number;
    }>('SELECT company_name, setup_complete FROM branding WHERE tenant_id = ?', ['si']);

    expect(def?.setup_complete).toBe(0);
    expect(def?.company_name || '').toBe('');
    expect(si?.setup_complete).toBe(1);
    expect(si?.company_name).toBe('Hanfia High School');

    const cred = await engine.get<{ tenant_id: string }>(
      'SELECT tenant_id FROM auth_credentials WHERE email = ?',
      ['admin@hanfia.test'],
    );
    expect(cred?.tenant_id).toBe('si');

    const member = await engine.get<{ tenant_id: string }>(
      'SELECT tenant_id FROM members WHERE email = ?',
      ['admin@hanfia.test'],
    );
    expect(member?.tenant_id).toBe('si');

    const settings = await engine.get<{ settings_json: string; company_legal_name: string | null }>(
      'SELECT settings_json, company_legal_name FROM tenant_settings WHERE id = ?',
      ['default'],
    );
    expect(settings?.company_legal_name).toBeNull();
    expect(settings?.settings_json).toBe('{}');
  });
});

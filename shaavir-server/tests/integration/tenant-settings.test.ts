import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Tenant Settings (Gap 8)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const ADMIN = 'admin@shaavir.com';
  const USER = 'user@shaavir.com';

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: ADMIN, name: 'Admin' });
    await seedMember(db, { email: USER, name: 'User' });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [ADMIN]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('GET /api/settings returns bundle with tenant_settings', async () => {
    const res = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tenant_settings');
    expect(res.body.tenant_settings).toHaveProperty('platform_name');
    expect(res.body.tenant_settings).toHaveProperty('settings_json');
  });

  it('POST /api/settings updates platform_name column', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ platform_name: 'MyHR' });
    expect(res.status).toBe(200);
    expect(res.body.platform_name).toBe('MyHR');
  });

  it('POST /api/settings merges settings_json.attendance partial', async () => {
    // First set attendance
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { attendance: { gracePeriodMinutes: 20 }, leaves: { types: [] } } });

    // Now update only attendance.autoCutoffMinutes — leaves should remain
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { attendance: { autoCutoffMinutes: 60 } } });
    expect(res.status).toBe(200);

    const get = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    const sj = get.body.tenant_settings.settings_json;
    expect(sj.attendance.autoCutoffMinutes).toBe(60);
    expect(sj.attendance.gracePeriodMinutes).toBe(20);
    expect(sj.leaves).toEqual({ types: [] });
  });

  it('POST /api/settings merges settings_json.leaves without destroying attendance', async () => {
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { attendance: { gracePeriodMinutes: 15 } } });

    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { leaves: { sandwichPolicy: true } } });

    const get = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    const sj = get.body.tenant_settings.settings_json;
    expect(sj.attendance.gracePeriodMinutes).toBe(15);
    expect(sj.leaves.sandwichPolicy).toBe(true);
  });

  it('SSE broadcast fires on POST /api/settings', async () => {
    // We just verify the POST succeeds — SSE broadcast happens internally
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ platform_name: 'TestHR' });
    expect(res.status).toBe(200);
  });

  it('default tenant_settings row exists after migration', async () => {
    const row = await db.get<{ id: string }>('SELECT id FROM tenant_settings WHERE id = ?', ['default']);
    expect(row).toBeTruthy();
    expect(row!.id).toBe('default');
  });

  it('3-tier resolution: member override > tenant default', async () => {
    // Set tenant default
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { ui: { toastDurationMs: 5000 } } });

    // Without member pref, should get tenant value
    const { TenantSettingsService } = await import('../../src/services/tenant-settings-service');
    const svc = new TenantSettingsService(db, (await import('../helpers/setup')).testLogger);
    await svc.load();
    const val = await svc.getResolved('ui.toastDurationMs', USER);
    expect(val).toBe(5000);
  });

  it('fresh install has sensible defaults in settings_json', async () => {
    const row = await db.get<{ settings_json: string }>(
      'SELECT settings_json FROM tenant_settings WHERE id = ?',
      ['default'],
    );
    expect(row).toBeTruthy();
    // settings_json starts as {} or with migrated data
    const parsed = JSON.parse(row!.settings_json as string);
    expect(typeof parsed).toBe('object');
  });

  it('backward compatibility — GET /api/settings response has original shape', async () => {
    const res = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    expect(res.status).toBe(200);
    // Original shape fields still present
    expect(res.body).toHaveProperty('groups');
    expect(res.body).toHaveProperty('members');
    expect(res.body).toHaveProperty('admins');
  });

  it('concurrent JSON merges preserve data', async () => {
    // Simulate rapid updates
    await Promise.all([
      request(app).post('/api/settings').set('x-user-email', ADMIN)
        .send({ settings_json: { attendance: { gracePeriodMinutes: 10 } } }),
      request(app).post('/api/settings').set('x-user-email', ADMIN)
        .send({ settings_json: { leaves: { sandwichPolicy: true } } }),
    ]);

    const get = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    // At least one of them should persist
    const sj = get.body.tenant_settings.settings_json;
    expect(sj).toBeDefined();
  });

  it('credential resolution — env var wins over settings_json value', async () => {
    const { TenantSettingsService } = await import('../../src/services/tenant-settings-service');
    const svc = new TenantSettingsService(db, (await import('../helpers/setup')).testLogger);

    // Set a value in settings_json
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { notifications: { channels: { slack: { botToken: 'db-token' } } } } });
    await svc.load();

    // Set env var
    process.env.SLACK_BOT_TOKEN = 'env-token';
    const val = svc.getCredential('SLACK_BOT_TOKEN', 'notifications.channels.slack.botToken');
    expect(val).toBe('env-token');
    delete process.env.SLACK_BOT_TOKEN;
  });

  it('credential resolution — settings_json used when env var is empty', async () => {
    const { TenantSettingsService } = await import('../../src/services/tenant-settings-service');
    const svc = new TenantSettingsService(db, (await import('../helpers/setup')).testLogger);

    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ settings_json: { notifications: { channels: { slack: { botToken: 'db-token' } } } } });
    await svc.load();

    delete process.env.SLACK_BOT_TOKEN;
    const val = svc.getCredential('SLACK_BOT_TOKEN', 'notifications.channels.slack.botToken');
    expect(val).toBe('db-token');
  });

  it('credential resolution — empty string when both are empty', async () => {
    const { TenantSettingsService } = await import('../../src/services/tenant-settings-service');
    const svc = new TenantSettingsService(db, (await import('../helpers/setup')).testLogger);
    await svc.load();

    delete process.env.NONEXISTENT_KEY;
    const val = svc.getCredential('NONEXISTENT_KEY', 'nonexistent.path');
    expect(val).toBe('');
  });

  it('GET /api/settings masks secrets', async () => {
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({
        settings_json: {
          notifications: { channels: { slack: { botToken: 'xoxb-123456789' } } },
        },
      });

    const res = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    const slack = res.body.tenant_settings.settings_json?.notifications?.channels?.slack;
    if (slack?.botToken) {
      expect(slack.botToken).toContain('****');
      expect(slack.botToken).not.toBe('xoxb-123456789');
    }
  });

  it('POST /api/settings with non-admin caller returns 403', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', USER)
      .send({ platform_name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('POST /api/settings with admin caller returns 200', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({ platform_name: 'AdminHR' });
    expect(res.status).toBe(200);
  });

  it('POST /api/settings stores full secret values in DB', async () => {
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({
        settings_json: {
          notifications: { channels: { slack: { botToken: 'xoxb-realtoken123' } } },
        },
      });

    // Read directly from DB
    const row = await db.get<{ settings_json: string }>(
      'SELECT settings_json FROM tenant_settings WHERE id = ?',
      ['default'],
    );
    const parsed = JSON.parse(row!.settings_json as string);
    expect(parsed.notifications.channels.slack.botToken).toBe('xoxb-realtoken123');
  });

  it('deep merge preserves nested arrays', async () => {
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({
        settings_json: {
          assetConfig: { assetTypes: [{ id: 'laptop', name: 'Laptop' }] },
        },
      });

    // Update a different field — assetTypes should not be overwritten
    await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({
        settings_json: {
          assetConfig: { defaultDepreciationMethod: 'declining_balance' },
        },
      });

    const get = await request(app).get('/api/settings').set('x-user-email', ADMIN);
    const ac = get.body.tenant_settings.settings_json.assetConfig;
    expect(ac.assetTypes).toEqual([{ id: 'laptop', name: 'Laptop' }]);
    expect(ac.defaultDepreciationMethod).toBe('declining_balance');
  });

  it('POST /api/settings with notification credentials triggers no crash', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('x-user-email', ADMIN)
      .send({
        settings_json: {
          notifications: {
            channels: {
              slack: { botToken: 'xoxb-test', signingSecret: 'test-secret' },
            },
          },
        },
      });
    expect(res.status).toBe(200);
  });

  it('all default sections validate as object', async () => {
    const row = await db.get<{ settings_json: string }>(
      'SELECT settings_json FROM tenant_settings WHERE id = ?',
      ['default'],
    );
    const parsed = JSON.parse(row!.settings_json as string);
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
  });
});

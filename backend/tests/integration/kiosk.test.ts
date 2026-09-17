import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Kiosk mount', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', ['default', 'admin@shaavir.com']);
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });

    // Enable kiosk in tenant settings
    const row = await db.get<{ settings_json: string }>('SELECT settings_json FROM tenant_settings WHERE id = ?', [
      'default',
    ]);
    const json = row?.settings_json ? JSON.parse(row.settings_json) : {};
    json.attendance = { ...(json.attendance || {}), kioskEnabled: true };
    await db.run('UPDATE tenant_settings SET settings_json = ? WHERE id = ?', [
      JSON.stringify(json),
      'default',
    ]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('reports enabled from tenant settings', async () => {
    const res = await request(app).get('/api/kiosk/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('set PIN → clock in via kiosk → attendance updates', async () => {
    const setPin = await request(app)
      .put('/api/kiosk/pins/alice@shaavir.com')
      .send({ pin: '4321' })
      .set('X-User-Email', 'admin@shaavir.com');
    expect(setPin.body.success).toBe(true);

    const clock = await request(app)
      .post('/api/kiosk/clock')
      .send({ email: 'alice@shaavir.com', pin: '4321', action: 'in' });
    expect(clock.status).toBe(200);
    expect(clock.body.success).toBe(true);

    const daily = await db.get<{ status: string }>(
      'SELECT status FROM attendance_daily WHERE email = ? ORDER BY date DESC LIMIT 1',
      ['alice@shaavir.com'],
    );
    expect(daily?.status).toBe('in');
  });

  it('returns 403 when kiosk disabled', async () => {
    await db.run(
      `UPDATE tenant_settings SET settings_json = ? WHERE id = ?`,
      [JSON.stringify({ attendance: { kioskEnabled: false } }), 'default'],
    );

    const res = await request(app)
      .post('/api/kiosk/clock')
      .send({ email: 'alice@shaavir.com', pin: '4321', action: 'in' });
    expect(res.status).toBe(403);
  });
});

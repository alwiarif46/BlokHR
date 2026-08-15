import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createKioskApp } from '../src/index';
import type { KioskSqlite } from '../src/db';
import type { ClockPort, ClockResult, RosterPort, SettingsPort } from '../src/types';

const logger = pino({ level: 'silent' });

describe('@blokhr/kiosk', () => {
  let app: Express;
  let db: KioskSqlite;
  let kioskEnabled = true;
  let clockCalls: Array<{ action: string; email: string; name: string; source?: string }> = [];
  let clockImpl: ClockPort['clock'];

  const members = [
    { email: 'alice@acme.com', name: 'Alice', designation: 'Eng', groupId: 'g1' },
    { email: 'bob@acme.com', name: 'Bob', designation: 'Ops', groupId: 'g1' },
  ];

  const settings: SettingsPort = {
    async getAttendanceSettings() {
      return {
        kioskEnabled,
        ipRestrictionEnabled: false,
        allowedIPs: [],
      };
    },
  };

  const roster: RosterPort = {
    async searchActiveMembers(query: string) {
      const q = query.toLowerCase().trim();
      return members.filter(
        (m) => !q || m.name.toLowerCase().includes(q) || m.email.includes(q),
      );
    },
    async getMemberByEmail(email: string) {
      return members.find((m) => m.email === email.toLowerCase().trim()) ?? null;
    },
  };

  beforeEach(async () => {
    kioskEnabled = true;
    clockCalls = [];
    clockImpl = async (action, email, name, source) => {
      clockCalls.push({ action, email, name, source });
      return { success: true, status: action === 'back' ? 'in' : action } as ClockResult;
    };

    const created = await createKioskApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger,
      tenantId: 'default',
      settings,
      roster,
      clock: {
        clock: (action, email, name, source) => clockImpl(action, email, name, source),
      },
      routerOptions: {
        isAdmin: async (email) => email === 'admin@acme.com',
      },
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('reports enabled status', async () => {
    const res = await request(app).get('/api/kiosk/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('rejects members when kiosk disabled', async () => {
    kioskEnabled = false;
    const res = await request(app).get('/api/kiosk/members?q=ali');
    expect(res.status).toBe(403);
  });

  it('admin can set PIN and employee can verify + clock', async () => {
    const set = await request(app)
      .put('/api/kiosk/pins/alice@acme.com')
      .send({ pin: '1234' })
      .set('X-User-Email', 'admin@acme.com');
    expect(set.status).toBe(200);
    expect(set.body.success).toBe(true);

    const bad = await request(app)
      .post('/api/kiosk/verify')
      .send({ email: 'alice@acme.com', pin: '0000' });
    expect(bad.status).toBe(200);
    expect(bad.body.success).toBe(false);

    const ok = await request(app)
      .post('/api/kiosk/verify')
      .send({ email: 'alice@acme.com', pin: '1234' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const clock = await request(app)
      .post('/api/kiosk/clock')
      .send({ email: 'alice@acme.com', token: ok.body.token, action: 'in' });
    expect(clock.status).toBe(200);
    expect(clock.body.success).toBe(true);
    expect(clockCalls).toHaveLength(1);
    expect(clockCalls[0]).toMatchObject({
      action: 'in',
      email: 'alice@acme.com',
      name: 'Alice',
      source: 'kiosk',
    });
  });

  it('clocks with pin in one shot', async () => {
    await request(app)
      .put('/api/kiosk/pins/bob@acme.com')
      .send({ pin: '9876' })
      .set('X-User-Email', 'admin@acme.com');

    const clock = await request(app)
      .post('/api/kiosk/clock')
      .send({ email: 'bob@acme.com', pin: '9876', action: 'in' });
    expect(clock.body.success).toBe(true);
    expect(clockCalls[0].source).toBe('kiosk');
  });

  it('returns 403 on clock when disabled', async () => {
    await request(app)
      .put('/api/kiosk/pins/alice@acme.com')
      .send({ pin: '1234' })
      .set('X-User-Email', 'admin@acme.com');
    kioskEnabled = false;
    const res = await request(app)
      .post('/api/kiosk/clock')
      .send({ email: 'alice@acme.com', pin: '1234', action: 'in' });
    expect(res.status).toBe(403);
    expect(clockCalls).toHaveLength(0);
  });

  it('rejects non-admin PIN set', async () => {
    const res = await request(app)
      .put('/api/kiosk/pins/alice@acme.com')
      .send({ pin: '1234' })
      .set('X-User-Email', 'alice@acme.com');
    expect(res.status).toBe(403);
  });

  it('searches members when enabled', async () => {
    const res = await request(app).get('/api/kiosk/members?q=bob');
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].email).toBe('bob@acme.com');
  });

  it('clears PIN', async () => {
    await request(app)
      .put('/api/kiosk/pins/alice@acme.com')
      .send({ pin: '1234' })
      .set('X-User-Email', 'admin@acme.com');
    const del = await request(app)
      .delete('/api/kiosk/pins/alice@acme.com')
      .set('X-User-Email', 'admin@acme.com');
    expect(del.body.success).toBe(true);
    const verify = await request(app)
      .post('/api/kiosk/verify')
      .send({ email: 'alice@acme.com', pin: '1234' });
    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(false);
  });
});

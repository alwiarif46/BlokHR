import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember, testConfig } from '../helpers/setup';
import { UserCalendarService } from '../../src/services/user-calendar-service';
import { encryptToken, signOAuthState } from '../../src/services/calendar-token-crypto';
import { UserCalendarRepository } from '../../src/repositories/user-calendar-repository';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const testLogger = pino({ level: 'silent' });
const SECRET = 'test-calendar-token-key-32chars!!';

describe('Personal calendar meetings', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', ['default', 'admin@shaavir.com']);

    await db.run(
      `UPDATE tenant_settings SET settings_json = ? WHERE id = 'default'`,
      [
        JSON.stringify({
          meetings: {
            calendar: {
              microsoft: {
                clientId: 'ms-client',
                clientSecret: 'ms-secret',
                tenantId: 'common',
              },
              google: {
                clientId: 'go-client',
                clientSecret: 'go-secret',
              },
            },
          },
        }),
      ],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  describe('authz', () => {
    it('requires auth for my-calendar', async () => {
      const res = await request(app).get('/api/meetings/my-calendar');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin from calendar/org', async () => {
      const res = await request(app)
        .get('/api/meetings/calendar/org')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(403);
    });

    it('allows admin calendar/org', async () => {
      const res = await request(app)
        .get('/api/meetings/calendar/org')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
    });
  });

  describe('status + connect URL', () => {
    it('returns provider status for caller', async () => {
      const res = await request(app)
        .get('/api/meetings/calendar/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.providers.length).toBeGreaterThanOrEqual(6);
      const ms = res.body.providers.find((p: { provider: string }) => p.provider === 'microsoft');
      const zoom = res.body.providers.find((p: { provider: string }) => p.provider === 'zoom');
      expect(ms?.configured).toBe(true);
      expect(ms?.authMode).toBe('oauth');
      expect(zoom?.authMode).toBe('link');
      expect(zoom?.configured).toBe(false);
    });

    it('builds microsoft authorize URL bound to caller', async () => {
      const res = await request(app)
        .get('/api/meetings/calendar/connect/microsoft')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.authorizeUrl).toContain('login.microsoftonline.com');
      expect(res.body.authorizeUrl).toContain('client_id=ms-client');
      expect(res.body.authorizeUrl).toContain('state=');
    });
  });

  describe('callback binds to state email only', () => {
    it('stores connection for state email, not header spoof', async () => {
      const fetchFn = vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('oauth2/v2.0/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 3600,
              id_token: [
                Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
                Buffer.from(JSON.stringify({ email: 'alice@outlook.com' })).toString('base64url'),
                'sig',
              ].join('.'),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });

      const config = testConfig({ calendarTokenKey: SECRET, serverBaseUrl: 'http://localhost:3000' });
      const calendar = new UserCalendarService(db, testLogger, config, fetchFn as never);
      const state = signOAuthState(
        {
          email: 'alice@shaavir.com',
          provider: 'microsoft',
          exp: Date.now() + 60_000,
          nonce: 'n1',
        },
        SECRET,
      );

      const result = await calendar.handleCallback('microsoft', 'auth-code', state);
      expect(result.email).toBe('alice@shaavir.com');

      const repo = new UserCalendarRepository(db);
      const alice = await repo.getByEmailAndProvider('alice@shaavir.com', 'microsoft');
      const bob = await repo.getByEmailAndProvider('bob@shaavir.com', 'microsoft');
      expect(alice).toBeTruthy();
      expect(alice?.account_email).toBe('alice@outlook.com');
      expect(bob).toBeNull();
    });
  });

  describe('my-calendar returns only caller events', () => {
    it('lists events for the authenticated user connection', async () => {
      const repo = new UserCalendarRepository(db);
      await repo.upsert({
        id: uuidv4(),
        email: 'alice@shaavir.com',
        provider: 'google',
        refreshTokenEnc: encryptToken('refresh-a', SECRET),
        accessTokenEnc: encryptToken('access-a', SECRET),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        accountEmail: 'alice@gmail.com',
        scopes: 'calendar.readonly',
        status: 'active',
      });
      await repo.upsert({
        id: uuidv4(),
        email: 'bob@shaavir.com',
        provider: 'google',
        refreshTokenEnc: encryptToken('refresh-b', SECRET),
        accessTokenEnc: encryptToken('access-b', SECRET),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        accountEmail: 'bob@gmail.com',
        scopes: 'calendar.readonly',
        status: 'active',
      });

      const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        if (u.includes('googleapis.com/calendar')) {
          const auth = String((init?.headers as Record<string, string>)?.Authorization || '');
          const isAlice = auth.includes('access-a');
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: isAlice ? 'evt-alice' : 'evt-bob',
                  summary: isAlice ? 'Alice 1:1' : 'Bob sync',
                  start: { dateTime: '2026-08-17T10:00:00Z' },
                  end: { dateTime: '2026-08-17T11:00:00Z' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });

      const config = testConfig({ calendarTokenKey: SECRET });
      const calendar = new UserCalendarService(db, testLogger, config, fetchFn as never);
      const from = '2026-08-16T00:00:00.000Z';
      const to = '2026-08-30T00:00:00.000Z';

      const aliceEvents = await calendar.getMyCalendar('alice@shaavir.com', from, to);
      expect(aliceEvents).toHaveLength(1);
      expect(aliceEvents[0].subject).toBe('Alice 1:1');
      expect(aliceEvents[0].ownerEmail).toBe('alice@shaavir.com');

      const org = await calendar.getOrgCalendar(from, to);
      expect(org).toHaveLength(2);
      expect(org.map((e) => e.ownerEmail).sort()).toEqual([
        'alice@shaavir.com',
        'bob@shaavir.com',
      ]);
    });
  });

  describe('platform link (zoom)', () => {
    it('rejects link when platform not enabled', async () => {
      const res = await request(app)
        .post('/api/meetings/calendar/link/zoom')
        .send({ externalUserId: 'alice@shaavir.com' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('links zoom and returns personal events without writing tracked_meetings', async () => {
      await db.run(
        `UPDATE tenant_settings SET settings_json = ? WHERE id = 'default'`,
        [
          JSON.stringify({
            meetings: {
              calendar: {
                microsoft: { clientId: 'ms-client', clientSecret: 'ms-secret', tenantId: 'common' },
                google: { clientId: 'go-client', clientSecret: 'go-secret' },
              },
              platforms: {
                zoom: {
                  enabled: true,
                  accountId: 'acct',
                  clientId: 'z-client',
                  clientSecret: 'z-secret',
                },
              },
            },
          }),
        ],
      );

      const link = await request(app)
        .post('/api/meetings/calendar/link/zoom')
        .send({})
        .set('X-User-Email', 'alice@shaavir.com');
      expect(link.status).toBe(200);
      expect(link.body.externalUserId).toBe('alice@shaavir.com');

      const fetchFn = vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('zoom.us/oauth/token')) {
          return new Response(JSON.stringify({ access_token: 'zoom-tok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (u.includes('api.zoom.us/v2/users/')) {
          return new Response(
            JSON.stringify({
              meetings: [
                {
                  id: 99,
                  topic: 'Standup',
                  join_url: 'https://zoom.us/j/99',
                  start_time: '2026-08-20T09:00:00Z',
                  duration: 30,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });

      const config = testConfig({ calendarTokenKey: SECRET });
      const calendar = new UserCalendarService(db, testLogger, config, fetchFn as never);
      const events = await calendar.getMyCalendar(
        'alice@shaavir.com',
        '2026-08-16T00:00:00.000Z',
        '2026-08-30T00:00:00.000Z',
      );
      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe('zoom');
      expect(events[0].subject).toBe('Standup');

      const tracked = await db.all('SELECT id FROM tracked_meetings WHERE external_id = ?', [
        'zoom_99',
      ]);
      expect(tracked).toHaveLength(0);
    });
  });

  describe('disconnect', () => {
    it('removes the caller connection', async () => {
      const repo = new UserCalendarRepository(db);
      await repo.upsert({
        id: uuidv4(),
        email: 'alice@shaavir.com',
        provider: 'microsoft',
        refreshTokenEnc: encryptToken('r', SECRET),
        accessTokenEnc: encryptToken('a', SECRET),
        expiresAt: null,
        accountEmail: 'a@x.com',
        scopes: 'x',
        status: 'active',
      });

      const res = await request(app)
        .delete('/api/meetings/calendar/connect/microsoft')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.removed).toBe(true);
      expect(await repo.getByEmailAndProvider('alice@shaavir.com', 'microsoft')).toBeNull();
    });
  });
});

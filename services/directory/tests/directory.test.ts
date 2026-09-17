import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import { createDirectoryApp } from '../src/index';
import type { Express } from 'express';
import type { DirectorySqlite } from '../src/db';
import type { SeatChecker, AuthPort } from '../src/types';

describe('Directory service', () => {
  let app: Express;
  let db: DirectorySqlite;
  let seatChecker: SeatChecker;
  let auth: AuthPort;
  const credentials: Array<{ email: string; password: string; mustChange: boolean }> = [];

  beforeEach(async () => {
    credentials.length = 0;
    seatChecker = {
      checkSeats: vi.fn(async (_tenantId: string, activeSeats: number) => {
        if (activeSeats > 2) {
          return {
            allowed: false,
            seatLimit: 2,
            activeSeats,
            reason: `Seat limit exceeded (${activeSeats}/2)`,
          };
        }
        return { allowed: true, seatLimit: 2, activeSeats };
      }),
    };
    auth = {
      createCredentials: vi.fn(async (email, password, mustChangePassword) => {
        if (credentials.some((c) => c.email === email)) {
          return { success: false, error: 'Credentials already exist for this email' };
        }
        credentials.push({ email, password, mustChange: mustChangePassword });
        return { success: true };
      }),
    };

    const created = await createDirectoryApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      seatChecker,
      auth,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates a member with credentials', async () => {
    const res = await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({
        email: 'jane@acme.com',
        name: 'Jane Doe',
        temporaryPassword: 'TempPass1',
      });
    expect(res.status).toBe(201);
    expect(res.body.member.email).toBe('jane@acme.com');
    expect(res.body.member.groupId).toBe('default');
    expect(res.body.member.individualShiftStart).toBe('09:00');
    expect(credentials).toHaveLength(1);
    expect(credentials[0].mustChange).toBe(true);
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'jane@acme.com', name: 'Jane', temporaryPassword: 'TempPass1' });
    const res = await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'jane@acme.com', name: 'Jane 2', temporaryPassword: 'TempPass2' });
    expect(res.status).toBe(409);
  });

  it('rejects when seat limit exceeded', async () => {
    await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'a@acme.com', name: 'A', temporaryPassword: 'TempPass1' });
    await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'b@acme.com', name: 'B', temporaryPassword: 'TempPass1' });
    const res = await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'c@acme.com', name: 'C', temporaryPassword: 'TempPass1' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Seat limit/i);
  });

  it('lists active members', async () => {
    await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({ email: 'a@acme.com', name: 'Ada', temporaryPassword: 'TempPass1' });
    const res = await request(app).get('/api/directory/members').set(staff('admin'));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.members[0].name).toBe('Ada');
  });

  it('requires admin for create', async () => {
    const res = await request(app)
      .post('/api/directory/members')
      .set(staff('employee'))
      .send({ email: 'x@acme.com', name: 'X', temporaryPassword: 'TempPass1' });
    expect(res.status).toBe(403);
  });

  describe('GET /members/lookup (P12-02)', () => {
    const INTERNAL = 'test-internal-secret';

    it('returns member id/role/active for case-insensitive email', async () => {
      await request(app)
        .post('/api/directory/members')
        .set(staff('admin'))
        .send({
          email: 'teacher@acme.com',
          name: 'T',
          role: 'teacher',
          temporaryPassword: 'TempPass1',
        });

      const res = await request(app)
        .get('/api/directory/members/lookup?email=Teacher@Acme.com')
        .set('X-Blok-Internal', INTERNAL)
        .set('X-Blok-Tenant', 't1');
      expect(res.status).toBe(200);
      expect(res.body.member).toMatchObject({
        id: 'teacher@acme.com',
        role: 'teacher',
        active: true,
      });
    });

    it('returns member:null for inactive members', async () => {
      await request(app)
        .post('/api/directory/members')
        .set(staff('admin'))
        .send({
          email: 'gone@acme.com',
          name: 'Gone',
          temporaryPassword: 'TempPass1',
        });
      await request(app)
        .patch('/api/directory/members/gone@acme.com')
        .set(staff('admin'))
        .send({ active: false });

      const res = await request(app)
        .get('/api/directory/members/lookup?email=gone@acme.com')
        .set('X-Blok-Internal', INTERNAL)
        .set('X-Blok-Tenant', 't1');
      expect(res.status).toBe(200);
      expect(res.body.member).toBeNull();
    });

    it('returns 401 without internal secret', async () => {
      const res = await request(app).get(
        '/api/directory/members/lookup?email=a@acme.com',
      );
      expect(res.status).toBe(401);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolFamilyOpsApp, asRole } from '../src/index';

const SECRET = 'test-internal-secret';

function guardianHeaders(
  guardianId: string,
  studentIds: string[],
  tenantId = 't1',
): Record<string, string> {
  return {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
    'X-Blok-Students': studentIds.join(','),
    'X-Blok-Tenant': tenantId,
  };
}

describe('school-family-ops smoke', () => {
  let app: Express;
  let db: { close: () => Promise<void> };

  beforeEach(async () => {
    const created = await createSchoolFamilyOpsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('modules lists entitlement keys disabled by default', async () => {
    const res = await request(app)
      .get('/api/family-ops/t1/modules')
      .set(asRole('office', { secret: SECRET }));
    expect(res.status).toBe(200);
    expect(res.body.modules.health).toEqual({
      enabled: false,
      message: 'requires school_family_health entitlement',
    });
    expect(res.body.modules.ai).toEqual({
      enabled: false,
      message: 'requires school_family_ai entitlement',
    });
    expect(Object.keys(res.body.modules).sort()).toEqual([
      'activities',
      'ai',
      'community',
      'fundraising',
      'health',
      'meals',
      'pickup',
    ]);
  });

  it('guardian scope denial when student not linked', async () => {
    const res = await request(app)
      .get('/api/family-ops/t1/guardian/students/stu-other/health')
      .set(guardianHeaders('g1', ['stu-own']));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });
});

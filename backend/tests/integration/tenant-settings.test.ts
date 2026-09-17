import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import type { SseBroadcaster } from '../../src/sse/broadcaster';
import { createTestApp, seedMember } from '../helpers/setup';
import { HR_TERMINOLOGY_DEFAULTS } from '../../src/services/vertical-defaults';

describe('Tenant settings — terminology (W-04)', () => {
  let app: Express;
  let db: DatabaseEngine;
  let broadcaster: SseBroadcaster;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    broadcaster = setup.broadcaster;
    commercial = setup.commercial;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', ['default', 'admin@shaavir.com']);
  });

  afterEach(async () => {
    if (commercial) await commercial.close();
    if (db) await db.close();
  });

  it('seeds section 37 terminology with HR defaults', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('X-User-Email', 'admin@shaavir.com');
    expect(res.status).toBe(200);
    const terminology = res.body.tenant_settings?.settings_json?.terminology;
    expect(terminology).toMatchObject({ ...HR_TERMINOLOGY_DEFAULTS });

    const row = await db.get<{ settings_json: string }>(
      "SELECT settings_json FROM tenant_settings WHERE id = 'default'",
    );
    const parsed = JSON.parse(row!.settings_json) as {
      terminology?: Record<string, string>;
    };
    expect(parsed.terminology).toMatchObject({ ...HR_TERMINOLOGY_DEFAULTS });
  });

  it('rejects empty terminology values on POST', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('X-User-Email', 'admin@shaavir.com')
      .send({
        settings_json: {
          terminology: {
            ...HR_TERMINOLOGY_DEFAULTS,
            person: '',
          },
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terminology\.person/i);
  });

  it('rejects over-length terminology values on POST', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('X-User-Email', 'admin@shaavir.com')
      .send({
        settings_json: {
          terminology: {
            ...HR_TERMINOLOGY_DEFAULTS,
            supervisor: 'A'.repeat(31),
          },
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terminology\.supervisor/i);
  });

  it('returns 403 for non-admin POST', async () => {
    const res = await request(app)
      .post('/api/settings')
      .set('X-User-Email', 'alice@shaavir.com')
      .send({
        settings_json: {
          terminology: { ...HR_TERMINOLOGY_DEFAULTS, person: 'Teammate' },
        },
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it('accepts valid terminology update from admin and broadcasts settings-update', async () => {
    const mockRes = {
      _written: [] as string[],
      writeHead: () => undefined,
      write: (data: string) => {
        mockRes._written.push(data);
        return true;
      },
      end: () => undefined,
      on: () => undefined,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcaster.addClient(mockRes as any);

    const res = await request(app)
      .post('/api/settings')
      .set('X-User-Email', 'admin@shaavir.com')
      .send({
        settings_json: {
          terminology: {
            ...HR_TERMINOLOGY_DEFAULTS,
            person: 'Teammate',
            person_plural: 'Teammates',
          },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.settings_json.terminology.person).toBe('Teammate');
    expect(res.body.settings_json.terminology.person_plural).toBe('Teammates');

    const written = mockRes._written.join('');
    expect(written).toContain('event: settings-update');
  });
});

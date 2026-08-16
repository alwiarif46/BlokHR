import { describe, it, expect } from 'vitest';
import path from 'path';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import {
  createSchoolAcademicsApp,
  loadSyllabusPackRegistry,
} from '../src/index';

const fixtures = path.resolve(__dirname, 'fixtures');

describe('syllabus pack registry (P11-01)', () => {
  it('loads valid pack and serves list/detail shapes', async () => {
    const { app, db } = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      packsDir: path.join(fixtures, 'packs-valid'),
      logger: pino({ level: 'silent' }),
    });

    const list = await request(app).get('/api/academics/packs').set(staff('school_admin'));
    expect(list.status).toBe(200);
    expect(list.body.packs).toHaveLength(1);
    expect(list.body.packs[0]).toMatchObject({
      id: 'cbse-2026-27',
      family: 'cbse',
      academic_year: '2026-27',
      status: 'sample',
      course_count: 1,
    });
    expect(list.body.packs[0].classes).toContain('8');
    expect(list.body.packs[0].subjects).toContain('Sc');

    const detail = await request(app).get('/api/academics/packs/cbse-2026-27').set(staff('school_admin'));
    expect(detail.status).toBe(200);
    expect(detail.body.courses[0].units.length).toBeGreaterThan(0);

    const missing = await request(app).get('/api/academics/packs/nope').set(staff('school_admin'));
    expect(missing.status).toBe(404);

    await db.close();
  });

  it('boots with empty packs dir', async () => {
    const { app, db, packs } = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      packsDir: path.join(fixtures, 'packs-empty'),
      logger: pino({ level: 'silent' }),
    });
    expect(packs.list()).toEqual([]);
    const list = await request(app).get('/api/academics/packs').set(staff('school_admin'));
    expect(list.body.packs).toEqual([]);
    await db.close();
  });

  it('refuses ib board with filename in error', () => {
    expect(() => loadSyllabusPackRegistry(path.join(fixtures, 'packs-ib'))).toThrow(
      /pack ib\.json: board 'ib' is not distributable/,
    );
  });

  it('fails on bad units with filename', () => {
    expect(() =>
      loadSyllabusPackRegistry(path.join(fixtures, 'packs-bad-units')),
    ).toThrow(/pack bad\.json: courses\[0\] units/);
  });

  it('fails on duplicate pack ids', () => {
    expect(() => loadSyllabusPackRegistry(path.join(fixtures, 'packs-dup'))).toThrow(
      /duplicate pack id/,
    );
  });

  it('fails state family without state_code', () => {
    expect(() =>
      loadSyllabusPackRegistry(path.join(fixtures, 'packs-state-missing')),
    ).toThrow(/state_code is required/);
  });

  it('loads real packs/ dir: 3 sample packs, SAMPLE source notes', () => {
    const registry = loadSyllabusPackRegistry(path.resolve(__dirname, '../packs'));
    const list = registry.list();
    expect(list).toHaveLength(3);
    expect(list.every((p) => p.status === 'sample')).toBe(true);
    for (const summary of list) {
      const pack = registry.get(summary.id);
      expect(pack).toBeTruthy();
      expect(pack!.source_note).toMatch(/SAMPLE/);
      expect(pack!.courses.length).toBeGreaterThan(0);
      for (const c of pack!.courses) {
        expect(c.units.length).toBe(4);
        expect(c.units[0].topics.length).toBe(3);
      }
    }
  });
});

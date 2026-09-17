import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import * as XLSX from 'xlsx';
import pino from 'pino';
import path from 'path';
import { staff } from './helpers/auth';
import { createDirectoryApp } from '../src/index';
import type { Express } from 'express';
import type { DirectorySqlite } from '../src/db';
import type { AuthPort, SeatChecker } from '../src/types';
import {
  buildRosterTemplateWorkbook,
  parseTeachersWorkbook,
} from '../src/services/member-import';

function workbookBase64(sheets: Record<string, unknown[][]>): string {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

describe('Directory members import', () => {
  let app: Express;
  let db: DirectorySqlite;
  const credentials: Array<{ email: string; password: string }> = [];

  beforeEach(async () => {
    credentials.length = 0;
    const seatChecker: SeatChecker = {
      checkSeats: vi.fn(async () => ({ allowed: true, seatLimit: 100, activeSeats: 0 })),
    };
    const auth: AuthPort = {
      createCredentials: vi.fn(async (email, password) => {
        credentials.push({ email, password });
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

  it('parses Teachers sheet rows', () => {
    const buf = Buffer.from(
      workbookBase64({
        Teachers: [
          ['Name', 'Email', 'Temporary Password', 'Role'],
          ['Ada', 'ada@school.test', 'TempPass1', 'teacher'],
        ],
      }),
      'base64',
    );
    const { rows, parseErrors } = parseTeachersWorkbook(buf);
    expect(parseErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('ada@school.test');
  });

  it('builds multi-sheet roster template', () => {
    const buf = buildRosterTemplateWorkbook();
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Students', 'Teachers', 'Periods', 'Classes']);
  });

  it('imports teachers via POST /members/import', async () => {
    const contentBase64 = workbookBase64({
      Teachers: [
        ['Name', 'Email', 'Temporary Password', 'Role'],
        ['Ada Lovelace', 'ada@school.test', 'TempPass1', 'teacher'],
        ['Bad Row', 'not-an-email', 'TempPass1', 'teacher'],
      ],
    });

    const res = await request(app)
      .post('/api/directory/members/import')
      .set(staff('school_admin'))
      .send({ filename: 'teachers.xlsx', contentBase64 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toBe(1);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
    expect(credentials.some((c) => c.email === 'ada@school.test')).toBe(true);
  });

  it('skips duplicate emails', async () => {
    await request(app)
      .post('/api/directory/members')
      .set(staff('admin'))
      .send({
        email: 'ada@school.test',
        name: 'Ada',
        temporaryPassword: 'TempPass1',
        role: 'teacher',
      });

    const contentBase64 = workbookBase64({
      Teachers: [
        ['Name', 'Email', 'Temporary Password'],
        ['Ada 2', 'ada@school.test', 'TempPass2'],
      ],
    });

    const res = await request(app)
      .post('/api/directory/members/import')
      .set(staff('hr'))
      .send({ contentBase64 });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('serves import template xlsx', async () => {
    const res = await request(app)
      .get('/api/directory/members/import-template')
      .set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import * as XLSX from 'xlsx';
import type { Express } from 'express';
import { createSchoolTimetableApp } from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';

function multiSheetBase64(): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Day Scheme', 'Index', 'Label', 'Start Time', 'End Time', 'Is Teaching'],
      ['Standard Day', 1, 'Period 1', '08:00', '08:45', 'yes'],
      ['Standard Day', 2, 'Period 2', '08:45', '09:30', 'yes'],
      ['Standard Day', 3, 'Break', '09:30', '09:45', 'no'],
      ['Standard Day', 4, 'Period 3', '09:45', '10:30', 'yes'],
    ]),
    'Periods',
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Class', 'Section', 'Day Scheme'],
      ['5', 'A', 'Standard Day'],
      ['5', 'B', 'Standard Day'],
    ]),
    'Classes',
  );
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

describe('school-timetable import', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('imports periods and classes from workbook sheets', async () => {
    const res = await request(app)
      .post('/api/timetable/t1/import').set(staff('school_admin'))
      .send({
        filename: 'roster.xlsx',
        contentBase64: multiSheetBase64(),
        academic_session_id: 'sess-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.daySchemesCreated).toBe(1);
    expect(res.body.sectionsCreated).toBe(2);

    const schemes = await request(app).get('/api/timetable/t1/day-schemes').set(staff('school_admin'));
    expect(schemes.body.daySchemes.length).toBe(1);
    expect(schemes.body.daySchemes[0].periods.length).toBe(4);

    const sections = await request(app).get('/api/timetable/t1/sections').set(staff('school_admin'));
    expect(sections.body.sections.length).toBe(2);
  });

  it('requires academic_session_id', async () => {
    const res = await request(app)
      .post('/api/timetable/t1/import').set(staff('school_admin'))
      .send({
        filename: 'roster.xlsx',
        contentBase64: multiSheetBase64(),
      });
    expect(res.status).toBe(200);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.sectionsCreated).toBe(0);
  });
});

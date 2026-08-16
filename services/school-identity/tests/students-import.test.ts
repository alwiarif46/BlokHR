import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import * as XLSX from 'xlsx';
import type { Express } from 'express';
import { createSchoolIdentityApp, type DomainEvent, type EventPublisher } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolIdentitySqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function workbookBase64(rows: unknown[][]): string {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Students');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

describe('school-identity students import', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;

  beforeEach(async () => {
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: new RecordingPublisher(),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('imports students and enrols from class/section/roll columns', async () => {
    const contentBase64 = workbookBase64([
      [
        'Admission Number',
        'First Name',
        'Last Name',
        'DOB',
        'Gender',
        'Admission Date',
        'Status',
        'Category',
        'Mother Name',
        'Father Name',
        'Guardian Contact',
        'Class',
        'Section',
        'Roll Number',
      ],
      [
        'ADM-100',
        'Asha',
        'Rao',
        '2015-06-15',
        'female',
        '2025-04-01',
        'active',
        'GEN',
        'Meera',
        'Ravi',
        '9876543210',
        '5',
        'A',
        '1',
      ],
      [
        'ADM-101',
        'Dev',
        'Patel',
        '2014-01-10',
        'male',
        '2025-04-01',
        'active',
        'GEN',
        'Sita',
        'Anil',
        '9876543211',
        '5',
        'A',
        '2',
      ],
    ]);

    const res = await request(app)
      .post('/api/identity/t1/students/import').set(staff('admin'))
      .send({ filename: 'roster.xlsx', contentBase64 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toBe(2);
    expect(res.body.enrolled).toBe(2);
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.classes).toEqual([{ classLabel: '5', section: 'A' }]);

    const list = await request(app).get('/api/identity/t1/students?class=5&section=A').set(staff('admin'));
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(2);
  });

  it('skips duplicate admission numbers', async () => {
    await request(app).post('/api/identity/t1/students').set(staff('admin')).send({
      admission_number: 'ADM-100',
      first_name: 'Asha',
      last_name: 'Rao',
      dob: '2015-06-15',
      gender: 'female',
      admission_date: '2025-04-01',
      status: 'active',
      category: 'GEN',
      mother_name: 'Meera',
      father_name: 'Ravi',
      guardian_contact: '9876543210',
    });

    const contentBase64 = workbookBase64([
      [
        'Admission Number',
        'First Name',
        'Last Name',
        'DOB',
        'Gender',
        'Mother Name',
        'Father Name',
        'Guardian Contact',
      ],
      [
        'ADM-100',
        'Asha',
        'Rao',
        '2015-06-15',
        'female',
        'Meera',
        'Ravi',
        '9876543210',
      ],
    ]);

    const res = await request(app)
      .post('/api/identity/t1/students/import').set(staff('admin'))
      .send({ filename: 'roster.csv', contentBase64 });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('rejects unsupported filenames', async () => {
    const res = await request(app)
      .post('/api/identity/t1/students/import').set(staff('admin'))
      .send({ filename: 'roster.pdf', contentBase64: 'AAAA' });
    expect(res.status).toBe(400);
  });
});

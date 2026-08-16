import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolLibraryApp,
  normalizeIsbn13,
  type SchoolLibrarySqlite,
} from '../src/index';

/** Known-valid ISBN-13 (and its ISBN-10 form 0-306-40615-2). */
const ISBN13 = '9780306406157';
const ISBN10 = '0306406152';

describe('school-library catalogue (P10-01)', () => {
  let app: Express;
  let db: SchoolLibrarySqlite;

  beforeEach(async () => {
    const created = await createSchoolLibraryApp({
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

  it('health ok', async () => {
    const res = await request(app).get('/health').set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('normalises ISBN-10 to ISBN-13 and rejects invalid check digits', () => {
    expect(normalizeIsbn13(ISBN10)).toEqual({ isbn13: ISBN13 });
    expect(normalizeIsbn13(ISBN13)).toEqual({ isbn13: ISBN13 });
    expect(normalizeIsbn13('9780306406158')).toEqual({ error: 'isbn_invalid' });
    expect(normalizeIsbn13('')).toEqual({ isbn13: null });
  });

  it('titles CRUD + search + unique isbn', async () => {
    const created = await request(app).post('/api/library/t1/titles').set(staff('school_admin')).send({
      title: 'Concrete Mathematics',
      authors: ['Graham', 'Knuth', 'Patashnik'],
      isbn13: ISBN10,
      subjects: ['math'],
      publisher: 'Addison-Wesley',
      published_year: 1994,
    });
    expect(created.status).toBe(201);
    expect(created.body.isbn13).toBe(ISBN13);
    expect(created.body.authors).toEqual(['Graham', 'Knuth', 'Patashnik']);
    const id = created.body.id as string;

    const dup = await request(app).post('/api/library/t1/titles').set(staff('school_admin')).send({
      title: 'Dup',
      isbn13: ISBN13,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('isbn_conflict');

    const badIsbn = await request(app).post('/api/library/t1/titles').set(staff('school_admin')).send({
      title: 'Bad',
      isbn13: '123',
    });
    expect(badIsbn.status).toBe(400);
    expect(badIsbn.body.error).toBe('isbn_invalid');

    const listed = await request(app).get('/api/library/t1/titles?q=concrete').set(staff('school_admin'));
    expect(listed.body.titles).toHaveLength(1);

    const bySubject = await request(app).get(
      '/api/library/t1/titles?subject=math',
    ).set(staff('school_admin'));
    expect(bySubject.body.titles).toHaveLength(1);

    const patched = await request(app)
      .patch(`/api/library/t1/titles/${id}`).set(staff('school_admin'))
      .send({ title: 'Concrete Mathematics (2e)' });
    expect(patched.body.title).toContain('2e');

    const delEmpty = await request(app).delete(`/api/library/t1/titles/${id}`).set(staff('school_admin'));
    expect(delEmpty.status).toBe(200);
  });

  it('copies CRUD, barcode unique, delete title blocked, copy_counts, withdrawn→on_loan 409', async () => {
    const title = await request(app).post('/api/library/t1/titles').set(staff('school_admin')).send({
      title: 'The Hobbit',
      authors: ['Tolkien'],
    });
    const titleId = title.body.id as string;

    const missingTitle = await request(app).post('/api/library/t1/copies').set(staff('school_admin')).send({
      title_id: 'missing',
      barcode: 'B1',
    });
    expect(missingTitle.status).toBe(404);

    const c1 = await request(app).post('/api/library/t1/copies').set(staff('school_admin')).send({
      title_id: titleId,
      barcode: 'HOB-001',
      condition: 'good',
    });
    expect(c1.status).toBe(201);
    expect(c1.body.status).toBe('available');
    const copyId = c1.body.id as string;

    const dupBar = await request(app).post('/api/library/t1/copies').set(staff('school_admin')).send({
      title_id: titleId,
      barcode: 'HOB-001',
    });
    expect(dupBar.status).toBe(409);
    expect(dupBar.body.error).toBe('barcode_conflict');

    await request(app).post('/api/library/t1/copies').set(staff('school_admin')).send({
      title_id: titleId,
      barcode: 'HOB-002',
      status: 'withdrawn',
    });

    const detail = await request(app).get(`/api/library/t1/titles/${titleId}`).set(staff('school_admin'));
    expect(detail.status).toBe(200);
    expect(detail.body.copyCounts).toEqual({
      available: 1,
      on_loan: 0,
      reserved: 0,
      withdrawn: 1,
      total: 2,
    });

    const blocked = await request(app).delete(`/api/library/t1/titles/${titleId}`).set(staff('school_admin'));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('copies_exist');

    const withdrawn = await request(app)
      .get('/api/library/t1/copies').set(staff('school_admin'))
      .query({ title_id: titleId, status: 'withdrawn' });
    expect(withdrawn.body.copies).toHaveLength(1);
    const withdrawnId = withdrawn.body.copies[0].id as string;

    const loanBlocked = await request(app)
      .patch(`/api/library/t1/copies/${withdrawnId}`).set(staff('school_admin'))
      .send({ status: 'on_loan' });
    expect(loanBlocked.status).toBe(409);
    expect(loanBlocked.body.error).toBe('withdrawn_cannot_loan');

    await request(app).delete(`/api/library/t1/copies/${copyId}`).set(staff('school_admin'));
    await request(app).delete(`/api/library/t1/copies/${withdrawnId}`).set(staff('school_admin'));
    const delTitle = await request(app).delete(`/api/library/t1/titles/${titleId}`).set(staff('school_admin'));
    expect(delTitle.status).toBe(200);
  });

  it('tenant isolation on titles and copies', async () => {
    const a = await request(app).post('/api/library/tA/titles').set(staff('school_admin')).send({
      title: 'Secret',
      isbn13: ISBN13,
    });
    const titleId = a.body.id as string;
    const copy = await request(app).post('/api/library/tA/copies').set(staff('school_admin')).send({
      title_id: titleId,
      barcode: 'SEC-1',
    });
    const copyId = copy.body.id as string;

    expect(
      (await request(app).get(`/api/library/tB/titles/${titleId}`).set(staff('school_admin'))).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/library/tB/copies/${copyId}`).set(staff('school_admin'))).status,
    ).toBe(404);
    expect((await request(app).get('/api/library/tB/titles').set(staff('school_admin'))).body.titles).toEqual(
      [],
    );
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolLibraryApp,
  type DomainEvent,
  type EventPublisher,
  type SchoolLibrarySqlite,
} from '../src/index';

describe('school-library fines (P10-03)', () => {
  let app: Express;
  let db: SchoolLibrarySqlite;
  let events: DomainEvent[];
  let now: Date;

  async function seedOnLoan(student = 'stu-1', barcode = 'F1') {
    const title = await request(app).post('/api/library/t1/titles').send({
      title: 'Fine Book',
      authors: ['A'],
    });
    const copy = await request(app).post('/api/library/t1/copies').send({
      title_id: title.body.id,
      barcode,
    });
    const loan = await request(app).post('/api/library/t1/loans').send({
      copy_id: copy.body.id,
      student_ref: student,
      issued_on: '2026-01-01',
    });
    return {
      titleId: title.body.id as string,
      copyId: copy.body.id as string,
      loanId: loan.body.id as string,
      dueOn: loan.body.dueOn as string,
    };
  }

  beforeEach(async () => {
    events = [];
    now = new Date(Date.UTC(2026, 0, 15));
    const publisher: EventPublisher = {
      async publish(e) {
        events.push(e);
      },
    };
    const created = await createSchoolLibraryApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      events: publisher,
      clock: () => now,
    });
    app = created.app;
    db = created.db;
    await request(app).put('/api/library/t1/settings').send({
      loan_days: 7,
      renew_limit: 1,
      max_open_loans: 5,
      hold_days: 3,
      fine_paise_per_day: 500,
      fine_cap_paise: 20000,
      grace_days: 0,
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('assess upsert is idempotent and return assesses overdue fine', async () => {
    const { loanId } = await seedOnLoan();
    // due = 2026-01-08; as_of Jan 15 → 7 days × 500 = 3500
    const a1 = await request(app)
      .post('/api/library/t1/fines/assess')
      .send({ as_of: '2026-01-15' });
    expect(a1.body.assessed).toBe(1);
    expect(a1.body.total_paise).toBe(3500);

    const a2 = await request(app)
      .post('/api/library/t1/fines/assess')
      .send({ as_of: '2026-01-15' });
    expect(a2.body.assessed).toBe(1);
    expect(a2.body.total_paise).toBe(3500);

    const listed = await request(app)
      .get('/api/library/t1/fines')
      .query({ status: 'open' });
    expect(listed.body.fines).toHaveLength(1);

    // Return with later date recomputes fine before close
    now = new Date(Date.UTC(2026, 0, 18));
    await request(app).post(`/api/library/t1/loans/${loanId}/return`).send({
      returned_on: '2026-01-18',
    });
    const after = await request(app)
      .get('/api/library/t1/fines')
      .query({ status: 'open' });
    expect(after.body.fines).toHaveLength(1);
    expect(after.body.fines[0].daysOverdue).toBe(10);
    expect(after.body.fines[0].amountPaise).toBe(5000);
  });

  it('pay and waive + events; issue blocked then cleared', async () => {
    await seedOnLoan('stu-1', 'P1');
    await request(app)
      .post('/api/library/t1/fines/assess')
      .send({ as_of: '2026-01-15' });
    const fines = await request(app)
      .get('/api/library/t1/fines')
      .query({ student_ref: 'stu-1', status: 'open' });
    const fineId = fines.body.fines[0].id as string;

    const title = await request(app).post('/api/library/t1/titles').send({
      title: 'Another',
      authors: ['B'],
    });
    const copy = await request(app).post('/api/library/t1/copies').send({
      title_id: title.body.id,
      barcode: 'P2',
    });
    const blocked = await request(app).post('/api/library/t1/loans').send({
      copy_id: copy.body.id,
      student_ref: 'stu-1',
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('fines_outstanding');
    expect(blocked.body.open_fines_paise).toBe(3500);

    const paid = await request(app)
      .post(`/api/library/t1/fines/${fineId}/pay`)
      .send({});
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('paid');
    expect(events.some((e) => e.type === 'school.library.fine_paid')).toBe(
      true,
    );

    // Seed a new overdue fine via another loan to test waive path
    const again = await seedOnLoan('stu-2', 'W1');
    await request(app)
      .post('/api/library/t1/fines/assess')
      .send({ as_of: '2026-01-15' });
    const open2 = await request(app)
      .get('/api/library/t1/fines')
      .query({ student_ref: 'stu-2', status: 'open' });
    const fine2 = open2.body.fines[0].id as string;

    const badWaive = await request(app)
      .post(`/api/library/t1/fines/${fine2}/waive`)
      .send({ reason: 'no' });
    expect(badWaive.status).toBe(400);

    const waived = await request(app)
      .post(`/api/library/t1/fines/${fine2}/waive`)
      .send({ reason: 'hardship' });
    expect(waived.body.status).toBe('waived');
    expect(events.some((e) => e.type === 'school.library.fine_waived')).toBe(
      true,
    );

    // After waive, stu-2 can borrow another copy
    const t3 = await request(app).post('/api/library/t1/titles').send({
      title: 'Third',
      authors: ['C'],
    });
    const c3 = await request(app).post('/api/library/t1/copies').send({
      title_id: t3.body.id,
      barcode: 'W2',
    });
    // Return first loan so max loans isn't the issue — stu-2 still has open loan
    await request(app).post(`/api/library/t1/loans/${again.loanId}/return`).send({});
    const ok = await request(app).post('/api/library/t1/loans').send({
      copy_id: c3.body.id,
      student_ref: 'stu-2',
    });
    expect(ok.status).toBe(201);

    // stu-1 already paid — can issue
    const ok1 = await request(app).post('/api/library/t1/loans').send({
      copy_id: copy.body.id,
      student_ref: 'stu-1',
    });
    expect(ok1.status).toBe(201);
  });

  it('library-summary shape + tenant isolation', async () => {
    await seedOnLoan('stu-1', 'S1');
    await request(app)
      .post('/api/library/t1/fines/assess')
      .send({ as_of: '2026-01-15' });

    const summary = await request(app).get(
      '/api/library/t1/students/stu-1/library-summary',
    );
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      open_loans: 1,
      overdue_loans: 1,
      open_fines_paise: 3500,
      holds: 0,
    });

    expect(
      (
        await request(app).get(
          '/api/library/t2/students/stu-1/library-summary',
        )
      ).body,
    ).toEqual({
      open_loans: 0,
      overdue_loans: 0,
      open_fines_paise: 0,
      holds: 0,
    });
  });
});

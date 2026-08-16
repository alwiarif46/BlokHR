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

describe('school-library circulation (P10-02)', () => {
  let app: Express;
  let db: SchoolLibrarySqlite;
  let events: DomainEvent[];
  let now: Date;

  async function seedTitleCopy(barcode = 'BK-1') {
    const title = await request(app).post('/api/library/t1/titles').send({
      title: 'Seed Book',
      authors: ['Author'],
    });
    const titleId = title.body.id as string;
    const copy = await request(app).post('/api/library/t1/copies').send({
      title_id: titleId,
      barcode,
    });
    return { titleId, copyId: copy.body.id as string, barcode };
  }

  beforeEach(async () => {
    events = [];
    now = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
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
  });

  afterEach(async () => {
    await db.close();
  });

  it('settings defaults + validation caps', async () => {
    const get = await request(app).get('/api/library/t1/settings');
    expect(get.status).toBe(200);
    expect(get.body.loanDays).toBe(14);
    expect(get.body.maxOpenLoans).toBe(3);

    const bad = await request(app).put('/api/library/t1/settings').send({
      loan_days: 100,
      renew_limit: 1,
      max_open_loans: 3,
      hold_days: 3,
    });
    expect(bad.status).toBe(400);

    const ok = await request(app).put('/api/library/t1/settings').send({
      loan_days: 7,
      renew_limit: 2,
      max_open_loans: 2,
      hold_days: 5,
    });
    expect(ok.body.loanDays).toBe(7);
    expect(ok.body.maxOpenLoans).toBe(2);
  });

  it('issue/return happy path + barcode + events', async () => {
    const { copyId, barcode } = await seedTitleCopy('BAR-9');
    const issued = await request(app).post('/api/library/t1/loans').send({
      barcode,
      student_ref: 'stu-1',
    });
    expect(issued.status).toBe(201);
    expect(issued.body.dueOn).toBe('2026-01-29');
    expect(events.some((e) => e.type === 'school.library.loan_issued')).toBe(
      true,
    );

    const copy = await request(app).get(`/api/library/t1/copies/${copyId}`);
    expect(copy.body.status).toBe('on_loan');

    const returned = await request(app)
      .post(`/api/library/t1/loans/${issued.body.id}/return`)
      .send({});
    expect(returned.status).toBe(200);
    expect(returned.body.status).toBe('returned');
    expect(events.some((e) => e.type === 'school.library.loan_returned')).toBe(
      true,
    );
    expect(
      (await request(app).get(`/api/library/t1/copies/${copyId}`)).body.status,
    ).toBe('available');
  });

  it('enforces max_open_loans', async () => {
    await request(app).put('/api/library/t1/settings').send({
      loan_days: 14,
      renew_limit: 1,
      max_open_loans: 1,
      hold_days: 3,
    });
    const a = await seedTitleCopy('A1');
    const b = await seedTitleCopy('B1');
    expect(
      (
        await request(app).post('/api/library/t1/loans').send({
          copy_id: a.copyId,
          student_ref: 'stu-1',
        })
      ).status,
    ).toBe(201);
    const second = await request(app).post('/api/library/t1/loans').send({
      copy_id: b.copyId,
      student_ref: 'stu-1',
    });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('max_open_loans');
  });

  it('renew limits, overdue block, hold_pending', async () => {
    await request(app).put('/api/library/t1/settings').send({
      loan_days: 7,
      renew_limit: 1,
      max_open_loans: 3,
      hold_days: 3,
    });
    const { copyId, titleId } = await seedTitleCopy('R1');
    const loan = await request(app).post('/api/library/t1/loans').send({
      copy_id: copyId,
      student_ref: 'stu-1',
    });
    const loanId = loan.body.id as string;

    const renewed = await request(app).post(
      `/api/library/t1/loans/${loanId}/renew`,
    );
    expect(renewed.status).toBe(200);
    expect(renewed.body.renewals).toBe(1);
    expect(renewed.body.dueOn).toBe('2026-01-22');
    expect(events.some((e) => e.type === 'school.library.loan_renewed')).toBe(
      true,
    );

    const again = await request(app).post(
      `/api/library/t1/loans/${loanId}/renew`,
    );
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('renew_limit');

    // Make overdue: set clock past due, issue another copy for hold setup
    now = new Date(Date.UTC(2026, 0, 30));
    const overdue = await request(app).post(
      `/api/library/t1/loans/${loanId}/renew`,
    );
    expect(overdue.status).toBe(400);
    expect(overdue.body.error).toBe('overdue_cannot_renew');

    // Fresh loan for hold_pending: return overdue first so we can re-issue
    await request(app).post(`/api/library/t1/loans/${loanId}/return`).send({});
    // Overdue return assesses a fine — clear it so re-issue is allowed
    const openFines = await request(app)
      .get('/api/library/t1/fines')
      .query({ student_ref: 'stu-1', status: 'open' });
    for (const f of openFines.body.fines || []) {
      await request(app)
        .post(`/api/library/t1/fines/${f.id}/waive`)
        .send({ reason: 'test clear' });
    }
    now = new Date(Date.UTC(2026, 0, 15));
    const loan2 = await request(app).post('/api/library/t1/loans').send({
      copy_id: copyId,
      student_ref: 'stu-1',
    });
    expect(loan2.status).toBe(201);
    // No available copies → place hold
    const hold = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-2',
    });
    expect(hold.status).toBe(201);

    const blocked = await request(app).post(
      `/api/library/t1/loans/${loan2.body.id}/renew`,
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('hold_pending');
  });

  it('holds only when zero available; return → hold_ready; fulfill; cancel reorders', async () => {
    const { titleId, copyId } = await seedTitleCopy('H1');
    const availableHold = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-2',
    });
    expect(availableHold.status).toBe(400);
    expect(availableHold.body.error).toBe('copies_available');

    await request(app).post('/api/library/t1/loans').send({
      copy_id: copyId,
      student_ref: 'stu-1',
    });

    const h1 = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-2',
    });
    const h2 = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-3',
    });
    expect(h1.body.position).toBe(1);
    expect(h2.body.position).toBe(2);

    const loanList = await request(app)
      .get('/api/library/t1/loans')
      .query({ student_ref: 'stu-1', status: 'open' });
    const loanId = loanList.body.loans[0].id as string;

    const returned = await request(app)
      .post(`/api/library/t1/loans/${loanId}/return`)
      .send({});
    expect(returned.status).toBe(200);
    expect(events.some((e) => e.type === 'school.library.hold_ready')).toBe(
      true,
    );
    expect(
      (await request(app).get(`/api/library/t1/copies/${copyId}`)).body.status,
    ).toBe('reserved');

    const ready = await request(app)
      .get('/api/library/t1/holds')
      .query({ status: 'ready' });
    expect(ready.body.holds).toHaveLength(1);
    expect(ready.body.holds[0].studentRef).toBe('stu-2');

    const fulfilled = await request(app)
      .post(`/api/library/t1/holds/${ready.body.holds[0].id}/fulfill`)
      .send({ copy_id: copyId });
    expect(fulfilled.status).toBe(201);
    expect(fulfilled.body.studentRef).toBe('stu-2');

    // Return again → next hold ready
    await request(app)
      .post(`/api/library/t1/loans/${fulfilled.body.id}/return`)
      .send({});
    const ready2 = await request(app)
      .get('/api/library/t1/holds')
      .query({ status: 'ready' });
    expect(ready2.body.holds[0].studentRef).toBe('stu-3');

    // Cancel ready → copy available (no more queue)
    const cancel = await request(app).post(
      `/api/library/t1/holds/${ready2.body.holds[0].id}/cancel`,
    );
    expect(cancel.status).toBe(200);
    expect(
      (await request(app).get(`/api/library/t1/copies/${copyId}`)).body.status,
    ).toBe('available');
  });

  it('cancel queued reorders positions', async () => {
    const { titleId, copyId } = await seedTitleCopy('Q1');
    await request(app).post('/api/library/t1/loans').send({
      copy_id: copyId,
      student_ref: 'stu-1',
    });
    const a = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-a',
    });
    const b = await request(app).post('/api/library/t1/holds').send({
      title_id: titleId,
      student_ref: 'stu-b',
    });
    await request(app).post(`/api/library/t1/holds/${a.body.id}/cancel`);
    const listed = await request(app)
      .get('/api/library/t1/holds')
      .query({ title_id: titleId, status: 'queued' });
    expect(listed.body.holds).toHaveLength(1);
    expect(listed.body.holds[0].id).toBe(b.body.id);
    expect(listed.body.holds[0].position).toBe(1);
  });

  it('mark-overdue counts without changing status; tenant isolation', async () => {
    const { copyId } = await seedTitleCopy('O1');
    await request(app).post('/api/library/t1/loans').send({
      copy_id: copyId,
      student_ref: 'stu-1',
      issued_on: '2026-01-01',
    });
    const marked = await request(app)
      .post('/api/library/t1/loans/mark-overdue')
      .send({ as_of: '2026-01-20' });
    expect(marked.body.count).toBe(1);

    now = new Date(Date.UTC(2026, 0, 20));
    const open = await request(app)
      .get('/api/library/t1/loans')
      .query({ overdue: '1' });
    expect(open.body.loans).toHaveLength(1);
    expect(open.body.loans[0].status).toBe('open');

    expect(
      (await request(app).get('/api/library/t2/loans')).body.loans,
    ).toEqual([]);
  });
});

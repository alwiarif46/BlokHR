import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolFeesApp,
  ageingBucket,
  daysBetween,
  type DomainEvent,
  type EventPublisher,
  type SchoolFeesSqlite,
} from '../src/index';

describe('ageing helpers', () => {
  it('buckets and day math', () => {
    expect(ageingBucket(0)).toBe('0-30');
    expect(ageingBucket(30)).toBe('0-30');
    expect(ageingBucket(31)).toBe('31-60');
    expect(ageingBucket(61)).toBe('61+');
    expect(daysBetween('2025-09-01', new Date('2025-10-01T12:00:00.000Z'))).toBe(30);
  });
});

describe('school-fees payments (P6-03)', () => {
  let app: Express;
  let db: SchoolFeesSqlite;
  let events: DomainEvent[];
  let clock: { now: Date };

  async function invoiceForStudent(studentRef: string, dueOn = '2025-09-01') {
    const head = await request(app).post('/api/fees/t1/heads').set(staff('school_admin')).send({
      code: `H-${studentRef}`,
      label: 'Tuition',
      kind: 'tuition',
    });
    const structure = await request(app).post('/api/fees/t1/structures').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      class_label: '5-A',
      label: 'Class 5',
      lines: [
        { fee_head_id: head.body.id, amount_paise: 100000, schedule: 'term' },
      ],
    });
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: studentRef,
      fee_structure_id: structure.body.id,
      payer: 'guardian',
    });
    const gen = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: `P-${studentRef}`,
      class_label: '5-A',
      due_on: dueOn,
    });
    return gen.body.created[0] as { id: string; totalPaise: number };
  }

  beforeEach(async () => {
    events = [];
    clock = { now: new Date('2025-11-01T12:00:00.000Z') };
    const publisher: EventPublisher = {
      publish: async (e) => {
        events.push(e);
      },
    };
    const created = await createSchoolFeesApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      events: publisher,
      clock: () => clock.now,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('overpay guard; UTR required; duplicate UTR; part_paid/paid', async () => {
    const inv = await invoiceForStudent('s1');

    const noUtr = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 10000,
      method: 'upi_direct',
      recorded_by: 'cashier',
    });
    expect(noUtr.status).toBe(400);

    const partial = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 40000,
      method: 'upi_direct',
      utr: 'UTR1',
      recorded_by: 'cashier',
      received_on: '2025-09-15',
    });
    expect(partial.status).toBe(201);
    expect(partial.body.invoice.status).toBe('part_paid');

    const over = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 70000,
      method: 'cash',
      recorded_by: 'cashier',
    });
    expect(over.status).toBe(400);

    const dup = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 10000,
      method: 'bank_transfer',
      utr: 'UTR1',
      recorded_by: 'cashier',
    });
    expect(dup.status).toBe(409);

    const rest = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 60000,
      method: 'cash',
      recorded_by: 'cashier',
    });
    expect(rest.body.invoice.status).toBe('paid');
  });

  it('reconcile match / unmatch / mismatch', async () => {
    const inv = await invoiceForStudent('s2');
    await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 50000,
      method: 'upi_direct',
      utr: 'MATCH',
      recorded_by: 'c',
    });
    await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 20000,
      method: 'bank_transfer',
      utr: 'MISMATCH',
      recorded_by: 'c',
    });

    const rec = await request(app).post('/api/fees/t1/payments/reconcile').set(staff('school_admin')).send({
      rows: [
        { utr: 'MATCH', amount_paise: 50000, date: '2025-09-20' },
        { utr: 'MISMATCH', amount_paise: 19999, date: '2025-09-21' },
        { utr: 'UNKNOWN', amount_paise: 1000, date: '2025-09-22' },
      ],
    });
    expect(rec.status).toBe(200);
    expect(rec.body.verified).toHaveLength(1);
    expect(rec.body.verified[0].status).toBe('verified');
    expect(rec.body.mismatched).toHaveLength(1);
    expect(rec.body.mismatched[0].statementPaise).toBe(19999);
    expect(rec.body.mismatched[0].paymentPaise).toBe(20000);
    expect(rec.body.unmatched).toHaveLength(1);
    expect(rec.body.unmatched[0].utr).toBe('UNKNOWN');
  });

  it('bounce recomputes invoice and emits event', async () => {
    const inv = await invoiceForStudent('s3');
    const pay = await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 100000,
      method: 'cheque',
      recorded_by: 'c',
    });
    expect(pay.body.invoice.status).toBe('paid');
    events.length = 0;

    const bounce = await request(app).post(
      `/api/fees/t1/payments/${pay.body.payment.id}/bounce`,
    ).set(staff('school_admin'));
    expect(bounce.status).toBe(200);
    expect(bounce.body.payment.status).toBe('bounced');
    expect(bounce.body.invoice.status).toBe('issued');
    expect(events.some((e) => e.type === 'school.fee.payment_bounced')).toBe(true);
  });

  it('outstanding ageing + ledger ordering + tenant isolation', async () => {
    const inv = await invoiceForStudent('s4', '2025-09-01');
    await request(app).post('/api/fees/t1/payments').set(staff('school_admin')).send({
      invoice_id: inv.id,
      amount_paise: 10000,
      method: 'cash',
      recorded_by: 'c',
      received_on: '2025-11-02',
    });

    const outstanding = await request(app).get(
      '/api/fees/t1/outstanding?class=5-A&min_days_overdue=30',
    ).set(staff('school_admin'));
    expect(outstanding.status).toBe(200);
    expect(outstanding.body.outstanding).toHaveLength(1);
    expect(outstanding.body.outstanding[0].daysOverdue).toBe(61);
    expect(outstanding.body.outstanding[0].ageingBucket).toBe('61+');
    expect(outstanding.body.outstanding[0].outstandingPaise).toBe(90000);

    const ledger = await request(app).get('/api/fees/t1/students/s4/ledger').set(staff('school_admin'));
    expect(ledger.body.entries).toHaveLength(2);
    expect(ledger.body.entries[0].kind).toBe('invoice');
    expect(ledger.body.entries[1].kind).toBe('payment');

    const other = await request(app).get('/api/fees/t2/outstanding').set(staff('school_admin'));
    expect(other.body.outstanding).toEqual([]);
  });
});

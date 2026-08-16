import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolFeesApp,
  applyConcessions,
  type DomainEvent,
  type EventPublisher,
  type SchoolFeesSqlite,
} from '../src/index';

describe('applyConcessions', () => {
  it('applies pct then flat and floors at 0', () => {
    const lines = applyConcessions(
      [
        {
          feeHeadId: 'h1',
          headCode: 'T',
          headLabel: 'Tuition',
          grossPaise: 100000,
        },
      ],
      [
        {
          id: 'c1',
          tenantId: 't1',
          code: 'P',
          label: 'Pct',
          kind: 'pct',
          value: 50,
          appliesToHeads: ['h1'],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'c2',
          tenantId: 't1',
          code: 'F',
          label: 'Flat',
          kind: 'flat',
          value: 60000,
          appliesToHeads: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    );
    // 50% of 100000 = 50000 → net 50000; flat 60000 floors to 0
    expect(lines[0]!.netPaise).toBe(0);
    expect(lines[0]!.concessionPaise).toBe(100000);
  });
});

describe('school-fees invoices (P6-02)', () => {
  let app: Express;
  let db: SchoolFeesSqlite;
  let events: DomainEvent[];

  async function seedStructure(withConcession = true) {
    const head = await request(app).post('/api/fees/t1/heads').set(staff('school_admin')).send({
      code: 'TUITION',
      label: 'Tuition',
      kind: 'tuition',
    });
    const headId = head.body.id as string;
    const structure = await request(app).post('/api/fees/t1/structures').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      class_label: '5-A',
      label: 'Class 5',
      lines: [{ fee_head_id: headId, amount_paise: 100000, schedule: 'term' }],
    });
    let concessionId: string | undefined;
    if (withConcession) {
      const conc = await request(app).post('/api/fees/t1/concessions').set(staff('school_admin')).send({
        code: 'SIB',
        label: 'Sibling',
        kind: 'pct',
        value: 25,
        applies_to_heads: [headId],
      });
      concessionId = conc.body.id as string;
    }
    return {
      headId,
      structureId: structure.body.id as string,
      concessionId,
    };
  }

  beforeEach(async () => {
    events = [];
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
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('generation idempotency + concession math', async () => {
    const { structureId, concessionId } = await seedStructure(true);
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 's1',
      fee_structure_id: structureId,
      payer: 'guardian',
      concession_ids: [concessionId],
    });

    const gen1 = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T1',
      class_label: '5-A',
      due_on: '2025-10-01',
    });
    expect(gen1.status).toBe(201);
    expect(gen1.body.created).toHaveLength(1);
    expect(gen1.body.created[0].totalPaise).toBe(75000);
    expect(gen1.body.created[0].lines[0].concessionPaise).toBe(25000);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('school.fee.invoice_issued');

    const gen2 = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T1',
      class_label: '5-A',
    });
    expect(gen2.body.created).toHaveLength(0);
    expect(gen2.body.skipped).toBe(1);
    expect(events).toHaveLength(1);
  });

  it('RTE segregation: no guardian event; claim aggregation', async () => {
    const { structureId } = await seedStructure(false);
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 'rte1',
      fee_structure_id: structureId,
      payer: 'government_rte',
    });
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 'rte2',
      fee_structure_id: structureId,
      payer: 'government_rte',
    });

    const gen = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T1',
      state_code: 'KA',
    });
    expect(gen.status).toBe(201);
    expect(gen.body.created).toHaveLength(2);
    expect(events).toHaveLength(0);
    expect(gen.body.rteClaim.status).toBe('draft');
    expect(gen.body.rteClaim.totalPaise).toBe(200000);
    expect(gen.body.rteClaim.invoiceIds).toHaveLength(2);
  });

  it('RTE claim lifecycle submit/receive/reject', async () => {
    const { structureId } = await seedStructure(false);
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 'rte1',
      fee_structure_id: structureId,
      payer: 'government_rte',
    });
    const gen = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T1',
      state_code: 'KA',
    });
    const claimId = gen.body.rteClaim.id as string;
    const invoiceId = gen.body.created[0].id as string;

    const noRef = await request(app)
      .post(`/api/fees/t1/rte-claims/${claimId}/receive`).set(staff('school_admin'))
      .send({});
    expect(noRef.status).toBe(400);

    const submitted = await request(app).post(
      `/api/fees/t1/rte-claims/${claimId}/submit`,
    ).set(staff('school_admin'));
    expect(submitted.body.status).toBe('submitted');

    const received = await request(app)
      .post(`/api/fees/t1/rte-claims/${claimId}/receive`).set(staff('school_admin'))
      .send({ reference: 'GOV-99' });
    expect(received.body.status).toBe('received');
    expect(received.body.reference).toBe('GOV-99');

    // Fresh claim for reject path
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 'rte3',
      fee_structure_id: structureId,
      payer: 'government_rte',
    });
    const gen2 = await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T2',
      state_code: 'KA',
    });
    const claim2 = gen2.body.rteClaim.id as string;
    const inv2 = gen2.body.created[0].id as string;
    await request(app).post(`/api/fees/t1/rte-claims/${claim2}/submit`).set(staff('school_admin'));
    const rejected = await request(app).post(
      `/api/fees/t1/rte-claims/${claim2}/reject`,
    ).set(staff('school_admin'));
    expect(rejected.body.status).toBe('rejected');
    const invoices = await request(app).get('/api/fees/t1/invoices').set(staff('school_admin'));
    const reopened = invoices.body.invoices.find(
      (i: { id: string }) => i.id === inv2,
    );
    expect(reopened.status).toBe('issued');
    expect(invoiceId).toBeTruthy();
  });

  it('tenant isolation', async () => {
    const { structureId } = await seedStructure(false);
    await request(app).post('/api/fees/t1/assignments').set(staff('school_admin')).send({
      student_ref: 's1',
      fee_structure_id: structureId,
      payer: 'guardian',
    });
    await request(app).post('/api/fees/t1/invoices/generate').set(staff('school_admin')).send({
      academic_session_ref: '2025-26',
      period_label: '2025-T1',
    });
    const other = await request(app).get('/api/fees/t2/invoices').set(staff('school_admin'));
    expect(other.body.invoices).toEqual([]);
  });
});

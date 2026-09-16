import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createOvertimeApp,
  asRole,
  StubAttendanceClient,
  StubHolidaysClient,
  StubMembersClient,
  type MemberCompensation,
} from '../src/index';

const SECRET = 'test-internal-secret';
const MIGRATIONS = path.resolve(__dirname, '../migrations');

const T1 = 't1';
const T2 = 't2';
const EMP1_EMAIL = 'emp1@school.test';
const EMP2_EMAIL = 'emp2@school.test';

function member(overrides: Partial<MemberCompensation> = {}): MemberCompensation {
  return {
    email: EMP1_EMAIL,
    name: 'Emp One',
    basicSalary: 20800, // 26 days × 8h × 100/h = 20800 → tidy hourly rate
    da: 0,
    shiftStart: '09:00',
    shiftEnd: '17:00', // 8h standard
    ...overrides,
  };
}

type Ctx = {
  app: Express;
  db: { close: () => Promise<void> };
  attendance: StubAttendanceClient;
  holidays: StubHolidaysClient;
  members: StubMembersClient;
};

async function setup(): Promise<Ctx> {
  const attendance = new StubAttendanceClient();
  const holidays = new StubHolidaysClient();
  const members = new StubMembersClient();
  const created = await createOvertimeApp({
    dbPath: ':memory:',
    migrationsDir: MIGRATIONS,
    logger: pino({ level: 'silent' }),
    attendanceClient: attendance,
    holidaysClient: holidays,
    membersClient: members,
    internalSecret: SECRET,
  });
  return { app: created.app, db: created.db, attendance, holidays, members };
}

async function disablePriorApproval(app: Express, tenant: string): Promise<void> {
  const res = await request(app)
    .put(`/api/overtime/${tenant}/policy`)
    .set(asRole('admin', { tenantId: tenant, secret: SECRET }))
    .send({ requiresPriorApproval: false });
  expect(res.status).toBe(200);
}

async function seedCache(
  app: Express,
  tenant: string,
  m: MemberCompensation,
): Promise<void> {
  const res = await request(app)
    .post(`/api/overtime/${tenant}/internal/compensation`)
    .set({ 'X-Blok-Internal': SECRET })
    .send({
      rows: [
        {
          email: m.email,
          basicSalary: m.basicSalary,
          da: m.da,
          shiftStart: m.shiftStart,
          shiftEnd: m.shiftEnd,
          name: m.name,
        },
      ],
    });
  expect(res.status).toBe(200);
  expect(res.body.upserted).toBe(1);
}

describe('overtime service', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    await ctx.db.close();
  });

  it('health returns ok', async () => {
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('policy defaults are returned per tenant and can be updated', async () => {
    const get1 = await request(ctx.app)
      .get(`/api/overtime/${T1}/policy`)
      .set(asRole('admin', { tenantId: T1, secret: SECRET }));
    expect(get1.status).toBe(200);
    expect(get1.body.otEnabled).toBe(true);
    expect(get1.body.dailyThresholdMinutes).toBe(540);
    expect(get1.body.requiresPriorApproval).toBe(true);

    const put = await request(ctx.app)
      .put(`/api/overtime/${T1}/policy`)
      .set(asRole('hr', { tenantId: T1, secret: SECRET }))
      .send({ multiplier: 1.75, maxDailyMinutes: 180 });
    expect(put.status).toBe(200);
    expect(put.body.multiplier).toBe(1.75);
    expect(put.body.maxDailyMinutes).toBe(180);

    const get2 = await request(ctx.app)
      .get(`/api/overtime/${T2}/policy`)
      .set(asRole('admin', { tenantId: T2, secret: SECRET }));
    expect(get2.body.multiplier).toBe(2.0);
    expect(get2.body.maxDailyMinutes).toBe(240);
  });

  it('detects OT from mocked attendance client and computes pay', async () => {
    await disablePriorApproval(ctx.app, T1);
    ctx.members.set(T1, member());
    // 9h30m worked = 570 min > 540 threshold → 30 min weekday OT
    ctx.attendance.set(T1, '2026-08-04', [
      { email: EMP1_EMAIL, totalWorkedMinutes: 570 },
    ]);

    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/detect`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ date: '2026-08-04' });
    expect(res.status).toBe(200);
    expect(res.body.detected).toBe(1);
    expect(res.body.skipped).toBe(0);

    const list = await request(ctx.app)
      .get(`/api/overtime/${T1}/records/by-email/${EMP1_EMAIL}`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    const row = list.body.items[0];
    expect(row.otMinutes).toBe(30);
    expect(row.otType).toBe('weekday');
    expect(row.multiplier).toBe(2);
    // hourlyRate = (20800+0)/(26*8) = 100. otPay = 100 × 2 × 0.5 = 100
    expect(row.hourlyRate).toBe(100);
    expect(row.otPay).toBe(100);
    expect(row.status).toBe('pending');
    expect(row.source).toBe('auto');
  });

  it('detect skips employees without an approved prior request when required', async () => {
    ctx.members.set(T1, member());
    ctx.attendance.set(T1, '2026-08-05', [
      { email: EMP1_EMAIL, totalWorkedMinutes: 600 },
    ]);

    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/detect`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ date: '2026-08-05' });
    expect(res.status).toBe(200);
    expect(res.body.detected).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('detect proceeds after an OT request is approved', async () => {
    ctx.members.set(T1, member());
    ctx.attendance.set(T1, '2026-08-06', [
      { email: EMP1_EMAIL, totalWorkedMinutes: 600 },
    ]);

    const create = await request(ctx.app)
      .post(`/api/overtime/${T1}/requests`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-06', plannedHours: 1, reason: 'urgent report' });
    expect(create.status).toBe(201);
    const reqId = create.body.id;

    const approve = await request(ctx.app)
      .post(`/api/overtime/${T1}/requests/${reqId}/approve`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    const detect = await request(ctx.app)
      .post(`/api/overtime/${T1}/detect`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ date: '2026-08-06' });
    expect(detect.body.detected).toBe(1);
  });

  it('logManual requires prior approval when policy requires it', async () => {
    await seedCache(ctx.app, T1, member());
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-07', otMinutes: 60 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('prior_approval_required');
  });

  it('logManual succeeds when prior approval is disabled', async () => {
    await disablePriorApproval(ctx.app, T1);
    await seedCache(ctx.app, T1, member());
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-08', otMinutes: 90 });
    expect(res.status).toBe(201);
    expect(res.body.otMinutes).toBe(90);
    expect(res.body.source).toBe('manual');
    expect(res.body.otPay).toBe(300); // 100 × 2 × 1.5
  });

  it('employee cannot log OT for another employee', async () => {
    await disablePriorApproval(ctx.app, T1);
    await seedCache(ctx.app, T1, member());
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ email: EMP2_EMAIL, date: '2026-08-09', otMinutes: 60 });
    expect(res.status).toBe(403);
  });

  it('approve and reject flow updates status and returns record', async () => {
    await disablePriorApproval(ctx.app, T1);
    await seedCache(ctx.app, T1, member());
    const logged = await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-10', otMinutes: 60 });
    expect(logged.status).toBe(201);
    const recordId = logged.body.id;

    const approve = await request(ctx.app)
      .post(`/api/overtime/${T1}/records/${recordId}/approve`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');
    expect(approve.body.approvedBy).toBe('manager@school.test');

    const again = await request(ctx.app)
      .post(`/api/overtime/${T1}/records/${recordId}/approve`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    expect(again.status).toBe(404);

    const logged2 = await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-11', otMinutes: 60 });
    const reject = await request(ctx.app)
      .post(`/api/overtime/${T1}/records/${logged2.body.id}/reject`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ reason: 'exceeded quota' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('rejected');
    expect(reject.body.rejectionReason).toBe('exceeded quota');
  });

  it('pending list scopes by tenant', async () => {
    await disablePriorApproval(ctx.app, T1);
    await disablePriorApproval(ctx.app, T2);
    await seedCache(ctx.app, T1, member());
    await seedCache(ctx.app, T2, member({ email: EMP2_EMAIL, basicSalary: 15600 }));

    await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-12', otMinutes: 30 });
    await request(ctx.app)
      .post(`/api/overtime/${T2}/records`)
      .set(asRole('employee', { tenantId: T2, secret: SECRET, email: EMP2_EMAIL }))
      .send({ date: '2026-08-12', otMinutes: 60 });

    const pT1 = await request(ctx.app)
      .get(`/api/overtime/${T1}/records/pending`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    const pT2 = await request(ctx.app)
      .get(`/api/overtime/${T2}/records/pending`)
      .set(asRole('manager', { tenantId: T2, secret: SECRET }));
    expect(pT1.body.items.length).toBe(1);
    expect(pT1.body.items[0].email).toBe(EMP1_EMAIL);
    expect(pT2.body.items.length).toBe(1);
    expect(pT2.body.items[0].email).toBe(EMP2_EMAIL);
  });

  it('records/mine only returns own records', async () => {
    await disablePriorApproval(ctx.app, T1);
    await seedCache(ctx.app, T1, member());
    await seedCache(ctx.app, T1, member({ email: EMP2_EMAIL }));
    await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }))
      .send({ date: '2026-08-13', otMinutes: 45 });
    await request(ctx.app)
      .post(`/api/overtime/${T1}/records`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP2_EMAIL }))
      .send({ date: '2026-08-13', otMinutes: 60 });

    const mine = await request(ctx.app)
      .get(`/api/overtime/${T1}/records/mine`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET, email: EMP1_EMAIL }));
    expect(mine.status).toBe(200);
    expect(mine.body.items.length).toBe(1);
    expect(mine.body.items[0].email).toBe(EMP1_EMAIL);
  });

  it('holiday OT uses holiday multiplier and counts full worked minutes', async () => {
    await disablePriorApproval(ctx.app, T1);
    ctx.members.set(T1, member());
    ctx.holidays.add(T1, '2026-08-15');
    ctx.attendance.set(T1, '2026-08-15', [
      { email: EMP1_EMAIL, totalWorkedMinutes: 240 },
    ]);
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/detect`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ date: '2026-08-15' });
    expect(res.body.detected).toBe(1);

    const list = await request(ctx.app)
      .get(`/api/overtime/${T1}/records/by-email/${EMP1_EMAIL}`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }));
    const row = list.body.items[0];
    expect(row.otType).toBe('holiday');
    expect(row.multiplier).toBe(3);
    expect(row.otMinutes).toBe(240);
    // 4h × (100 × 3) = 1200
    expect(row.otPay).toBe(1200);
  });

  it('detect returns empty when attendance client has no rows', async () => {
    await disablePriorApproval(ctx.app, T1);
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/detect`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ date: '2026-08-14' });
    expect(res.status).toBe(200);
    expect(res.body.detected).toBe(0);
    expect(res.body.skipped).toBe(0);
  });
});

describe('overtime RBAC', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    await ctx.db.close();
  });

  it('unknown routes are denied by default (no_policy)', async () => {
    const res = await request(ctx.app)
      .get(`/api/overtime/${T1}/does-not-exist`)
      .set(asRole('admin', { tenantId: T1, secret: SECRET }));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_policy');
  });

  it('missing internal secret is unauthorized', async () => {
    const res = await request(ctx.app).get(`/api/overtime/${T1}/policy`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('employee cannot read policy', async () => {
    const res = await request(ctx.app)
      .get(`/api/overtime/${T1}/policy`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET }));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('role_denied');
  });

  it('employee cannot approve records', async () => {
    const res = await request(ctx.app)
      .post(`/api/overtime/${T1}/records/1/approve`)
      .set(asRole('employee', { tenantId: T1, secret: SECRET }));
    expect(res.status).toBe(403);
  });

  it('manager can approve records but cannot edit policy', async () => {
    const put = await request(ctx.app)
      .put(`/api/overtime/${T1}/policy`)
      .set(asRole('manager', { tenantId: T1, secret: SECRET }))
      .send({ multiplier: 1.5 });
    expect(put.status).toBe(403);
  });

  it('hr and admin can edit policy', async () => {
    const hr = await request(ctx.app)
      .put(`/api/overtime/${T1}/policy`)
      .set(asRole('hr', { tenantId: T1, secret: SECRET }))
      .send({ maxQuarterlyHours: 100 });
    expect(hr.status).toBe(200);
    const admin = await request(ctx.app)
      .put(`/api/overtime/${T1}/policy`)
      .set(asRole('admin', { tenantId: T1, secret: SECRET }))
      .send({ maxQuarterlyHours: 90 });
    expect(admin.status).toBe(200);
    expect(admin.body.maxQuarterlyHours).toBe(90);
  });

  it('internal compensation sync requires secret + no principal', async () => {
    const noSecret = await request(ctx.app)
      .post(`/api/overtime/${T1}/internal/compensation`)
      .send({ rows: [] });
    expect(noSecret.status).toBe(401);

    const withPrincipal = await request(ctx.app)
      .post(`/api/overtime/${T1}/internal/compensation`)
      .set(asRole('admin', { tenantId: T1, secret: SECRET }))
      .send({ rows: [] });
    expect(withPrincipal.status).toBe(403);
    expect(withPrincipal.body.error).toBe('internal_only');

    const ok = await request(ctx.app)
      .post(`/api/overtime/${T1}/internal/compensation`)
      .set({ 'X-Blok-Internal': SECRET })
      .send({ rows: [] });
    expect(ok.status).toBe(200);
  });
});

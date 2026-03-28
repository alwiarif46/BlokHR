import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';
import { AuditService } from '../../src/audit/audit-service';
import pino from 'pino';

describe('Audit Trail Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let auditService: AuditService;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    auditService = new AuditService(db, pino({ level: 'silent' }));
  });

  afterEach(async () => {
    await db.close();
  });

  async function seedLogs(): Promise<void> {
    await auditService.log({ entityType: 'leave', entityId: 'lv-1', action: 'submit', actorEmail: 'alice@shaavir.com', actorName: 'Alice', detail: { leaveType: 'Casual', days: 2 } });
    await auditService.log({ entityType: 'leave', entityId: 'lv-1', action: 'approve', actorEmail: 'manager@shaavir.com', actorName: 'Manager' });
    await auditService.log({ entityType: 'attendance', entityId: 'att-1', action: 'clock_in', actorEmail: 'alice@shaavir.com', actorName: 'Alice', ipAddress: '192.168.1.1', correlationId: 'req-123' });
    await auditService.log({ entityType: 'member', entityId: 'alice@shaavir.com', action: 'update_profile', actorEmail: 'alice@shaavir.com', detail: { field: 'phone', aadhaar_number: '123456789012', pan_number: 'ABCDE1234F' } });
  }

  describe('AuditService.log()', () => {
    it('writes an audit entry to the database', async () => {
      await auditService.log({
        entityType: 'leave',
        entityId: 'lv-99',
        action: 'submit',
        actorEmail: 'alice@shaavir.com',
        actorName: 'Alice',
        detail: { leaveType: 'Sick' },
      });

      const result = await auditService.query({ entityId: 'lv-99' });
      expect(result.total).toBe(1);
      expect(result.entries[0].action).toBe('submit');
      expect(result.entries[0].detail.leaveType).toBe('Sick');
    });

    it('redacts PII fields in detail', async () => {
      await auditService.log({
        entityType: 'member',
        entityId: 'bob@shaavir.com',
        action: 'update',
        actorEmail: 'admin@shaavir.com',
        detail: {
          name: 'Bob',
          aadhaar_number: '999988887777',
          pan_number: 'XYZAB1234C',
          bank_account_number: '12345678901234',
          phone: '9876543210',
        },
      });

      const result = await auditService.query({ entityId: 'bob@shaavir.com' });
      const detail = result.entries[0].detail;
      expect(detail.name).toBe('Bob');
      expect(detail.phone).toBe('9876543210');
      expect(detail.aadhaar_number).toBe('***REDACTED***');
      expect(detail.pan_number).toBe('***REDACTED***');
      expect(detail.bank_account_number).toBe('***REDACTED***');
    });

    it('redacts nested PII fields', async () => {
      await auditService.log({
        entityType: 'member',
        entityId: 'm1',
        action: 'update',
        actorEmail: 'admin@shaavir.com',
        detail: {
          changes: { password: 'hunter2', apiKey: 'sk-123' },
        },
      });

      const result = await auditService.query({ entityId: 'm1' });
      const changes = result.entries[0].detail.changes as Record<string, unknown>;
      expect(changes.password).toBe('***REDACTED***');
      expect(changes.apiKey).toBe('***REDACTED***');
    });
  });

  describe('GET /api/audit', () => {
    it('returns paginated audit entries', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(res.body.entries).toHaveLength(4);
      // Most recent first
      expect(res.body.entries[0].action).toBe('update_profile');
    });

    it('filters by entityType', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit?entityType=leave');
      expect(res.body.total).toBe(2);
      expect(res.body.entries.every((e: { entityType: string }) => e.entityType === 'leave')).toBe(true);
    });

    it('filters by actorEmail', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit?actorEmail=manager@shaavir.com');
      expect(res.body.total).toBe(1);
      expect(res.body.entries[0].action).toBe('approve');
    });

    it('filters by correlationId', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit?correlationId=req-123');
      expect(res.body.total).toBe(1);
      expect(res.body.entries[0].entityType).toBe('attendance');
    });

    it('supports limit and offset pagination', async () => {
      await seedLogs();

      const page1 = await request(app).get('/api/audit?limit=2&offset=0');
      expect(page1.body.entries).toHaveLength(2);
      expect(page1.body.total).toBe(4);

      const page2 = await request(app).get('/api/audit?limit=2&offset=2');
      expect(page2.body.entries).toHaveLength(2);
    });
  });

  describe('GET /api/audit/:id', () => {
    it('returns a single entry', async () => {
      await auditService.log({ entityType: 'test', entityId: 't1', action: 'create', actorEmail: 'a@a.com' });

      const list = await request(app).get('/api/audit');
      const id = list.body.entries[0].id;

      const res = await request(app).get(`/api/audit/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.entityType).toBe('test');
    });

    it('returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/audit/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/audit/entity/:type/:id', () => {
    it('returns full history for an entity', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit/entity/leave/lv-1');
      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.entries[0].action).toBe('approve'); // most recent first
      expect(res.body.entries[1].action).toBe('submit');
    });
  });

  describe('GET /api/audit/entity-types', () => {
    it('returns distinct entity types', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit/entity-types');
      expect(res.status).toBe(200);
      expect(res.body.entityTypes).toContain('leave');
      expect(res.body.entityTypes).toContain('attendance');
      expect(res.body.entityTypes).toContain('member');
    });
  });

  describe('GET /api/audit/actions', () => {
    it('returns distinct actions', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit/actions');
      expect(res.body.actions).toContain('submit');
      expect(res.body.actions).toContain('approve');
      expect(res.body.actions).toContain('clock_in');
    });

    it('filters by entity type', async () => {
      await seedLogs();

      const res = await request(app).get('/api/audit/actions?entityType=leave');
      expect(res.body.actions).toContain('submit');
      expect(res.body.actions).toContain('approve');
      expect(res.body.actions).not.toContain('clock_in');
    });
  });
});

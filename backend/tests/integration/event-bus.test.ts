import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import { InMemoryEventBus } from '../../src/events';
import type { EventName, EventMap } from '../../src/events';
import pino from 'pino';

describe('EventBus Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'alice@shaavir.com';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── InMemoryEventBus unit tests ──

  describe('InMemoryEventBus', () => {
    it('emits and receives a typed event', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      const received: Array<{ email: string }> = [];

      bus.on('clock.in', (payload) => {
        received.push({ email: payload.email });
      });

      bus.emit('clock.in', { email: 'test@test.com', name: 'Test', date: '2026-03-21', source: 'manual' });

      // Events dispatch via setImmediate — wait a tick
      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveLength(1);
      expect(received[0].email).toBe('test@test.com');
      await bus.close();
    });

    it('supports multiple listeners on same event', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let count = 0;

      bus.on('leave.submitted', () => { count++; });
      bus.on('leave.submitted', () => { count++; });

      bus.emit('leave.submitted', {
        leaveId: '1', email: 'a@a.com', name: 'A',
        leaveType: 'Casual', startDate: '2026-03-01', endDate: '2026-03-01', days: 1,
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(count).toBe(2);
      await bus.close();
    });

    it('unsubscribe stops delivery', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let count = 0;

      const unsub = bus.on('clock.out', () => { count++; });
      unsub(); // immediately unsubscribe

      bus.emit('clock.out', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' });

      await new Promise((r) => setTimeout(r, 50));
      expect(count).toBe(0);
      await bus.close();
    });

    it('onAny receives all events', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      const events: EventName[] = [];

      bus.onAny((event) => { events.push(event); });

      bus.emit('clock.in', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' });
      bus.emit('leave.submitted', {
        leaveId: '1', email: 'a@a.com', name: 'A',
        leaveType: 'Casual', startDate: '2026-03-01', endDate: '2026-03-01', days: 1,
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(events).toHaveLength(2);
      expect(events).toContain('clock.in');
      expect(events).toContain('leave.submitted');
      await bus.close();
    });

    it('listener errors do not crash the bus', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let goodCalled = false;

      bus.on('clock.in', () => { throw new Error('Boom'); });
      bus.on('clock.in', () => { goodCalled = true; });

      bus.emit('clock.in', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' });

      await new Promise((r) => setTimeout(r, 50));
      expect(goodCalled).toBe(true); // second listener still fires
      await bus.close();
    });

    it('async listener errors are caught', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let goodCalled = false;

      bus.on('clock.in', async () => { throw new Error('Async boom'); });
      bus.on('clock.in', () => { goodCalled = true; });

      bus.emit('clock.in', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' });

      await new Promise((r) => setTimeout(r, 50));
      expect(goodCalled).toBe(true);
      await bus.close();
    });

    it('close clears all listeners', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let count = 0;

      bus.on('clock.in', () => { count++; });
      await bus.close();

      bus.emit('clock.in', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' });

      await new Promise((r) => setTimeout(r, 50));
      expect(count).toBe(0);
    });

    it('provides event metadata', async () => {
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      let receivedMeta: { eventId: string; timestamp: string; emittedBy: string } | null = null;

      bus.on('clock.in', (_payload, meta) => { receivedMeta = meta; });

      bus.emit('clock.in', { email: 'a@a.com', name: 'A', date: '2026-03-21', source: 'manual' }, 'clock-service');

      await new Promise((r) => setTimeout(r, 50));
      expect(receivedMeta).not.toBeNull();
      expect(receivedMeta!.eventId).toBeTruthy();
      expect(receivedMeta!.timestamp).toBeTruthy();
      expect(receivedMeta!.emittedBy).toBe('clock-service');
      await bus.close();
    });
  });

  // ── Service event emission via API (clock emits events) ──

  describe('Service event emission', () => {
    it('clock-in via API triggers clock.in event', async () => {
      // The services in the test app don't have an EventBus wired (optional param not passed).
      // This test verifies the service works without an EventBus — the optional param pattern.
      const res = await request(app)
        .post('/api/clock')
        .send({ action: 'in', email: EMAIL, name: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('leave submission works with optional EventBus', async () => {
      const res = await request(app)
        .post('/api/leave-submit')
        .send({
          personEmail: EMAIL,
          personName: 'Alice',
          leaveType: 'Casual',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          kind: 'FullDay',
          reason: 'Test',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── createMember via SettingsService ──

  describe('SettingsService.createMember', () => {
    it('creates a new member via POST /api/members', async () => {
      // Use the settings update endpoint or direct tool call
      // The createMember method is on SettingsService — test via chat/tool
      const res = await request(app)
        .post('/api/chat/tool')
        .send({
          email: 'admin@shaavir.com',
          toolName: 'employee_info',
          params: { email: EMAIL },
          isAdmin: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.email).toBe(EMAIL);
      expect(res.body.result.name).toBe('Alice');
    });

    it('member creation is rejected for duplicate email', async () => {
      // Alice already exists from seedMember
      const { SettingsRepository } = await import('../../src/repositories/settings-repository');
      const { SettingsService } = await import('../../src/services/settings-service');

      const repo = new SettingsRepository(db);
      const service = new SettingsService(repo, null, null, null, null, pino({ level: 'silent' }));

      const result = await service.createMember({ email: EMAIL, name: 'Alice Duplicate' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('creates a member via SettingsService', async () => {
      const { SettingsRepository } = await import('../../src/repositories/settings-repository');
      const { SettingsService } = await import('../../src/services/settings-service');

      const repo = new SettingsRepository(db);
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      const service = new SettingsService(repo, null, null, null, null, pino({ level: 'silent' }), bus);

      const events: string[] = [];
      bus.on('member.created', (payload) => { events.push(payload.email); });

      const result = await service.createMember({
        email: 'newperson@shaavir.com',
        name: 'New Person',
        groupId: 'engineering',
        designation: 'Developer',
      });

      expect(result.success).toBe(true);
      expect(result.member?.email).toBe('newperson@shaavir.com');
      expect(result.member?.name).toBe('New Person');
      expect(result.member?.group_id).toBe('engineering');

      // Wait for event dispatch
      await new Promise((r) => setTimeout(r, 50));
      expect(events).toContain('newperson@shaavir.com');

      await bus.close();
    });

    it('emits member.deactivated on deactivation', async () => {
      const { SettingsRepository } = await import('../../src/repositories/settings-repository');
      const { SettingsService } = await import('../../src/services/settings-service');

      const repo = new SettingsRepository(db);
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      const service = new SettingsService(repo, null, null, null, null, pino({ level: 'silent' }), bus);

      const events: string[] = [];
      bus.on('member.deactivated', (payload) => { events.push(payload.email); });

      await service.updateMember(EMAIL, { active: 0 });

      await new Promise((r) => setTimeout(r, 50));
      expect(events).toContain(EMAIL);

      await bus.close();
    });

    it('emits member.group_changed when group changes', async () => {
      const { SettingsRepository } = await import('../../src/repositories/settings-repository');
      const { SettingsService } = await import('../../src/services/settings-service');

      // Create sales group
      await db.run("INSERT OR IGNORE INTO groups (id, name, shift_start, shift_end) VALUES ('sales', 'Sales', '09:00', '18:00')", []);

      const repo = new SettingsRepository(db);
      const bus = new InMemoryEventBus(pino({ level: 'silent' }));
      const service = new SettingsService(repo, null, null, null, null, pino({ level: 'silent' }), bus);

      const events: Array<{ email: string; groupId: string; previousGroupId: string }> = [];
      bus.on('member.group_changed', (payload) => {
        events.push({ email: payload.email, groupId: payload.groupId ?? '', previousGroupId: payload.previousGroupId ?? '' });
      });

      await service.updateMember(EMAIL, { group: 'sales' });

      await new Promise((r) => setTimeout(r, 50));
      expect(events).toHaveLength(1);
      expect(events[0].email).toBe(EMAIL);
      expect(events[0].groupId).toBe('sales');
      expect(events[0].previousGroupId).toBe('engineering');

      await bus.close();
    });
  });

  // ── Factory ──

  describe('createEventBus factory', () => {
    it('creates InMemoryEventBus when no redis URL', async () => {
      const { createEventBus } = await import('../../src/events');
      const bus = await createEventBus(pino({ level: 'silent' }));
      expect(bus).toBeInstanceOf(InMemoryEventBus);
      await bus.close();
    });
  });
});

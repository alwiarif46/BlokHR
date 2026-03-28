import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import type { MockLlmClient } from '../../src/services/llm';

describe('AI Agent / Chatbot Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let mockLlm: MockLlmClient;

  const EMAIL = 'alice@shaavir.com';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    mockLlm = setup.mockLlm;

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
    mockLlm.resetCalls();
    await db.close();
  });

  // ── Direct Tool Execution ──

  describe('POST /api/chat/tool', () => {
    it('executes an employee tool directly', async () => {
      // Seed attendance
      await db.run(
        `INSERT INTO attendance_daily (email, name, date, status, total_worked_minutes, group_id)
         VALUES (?, 'Alice', '2026-03-21', 'out', 480, 'engineering')`,
        [EMAIL],
      );

      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'my_attendance_for_date', params: { date: '2026-03-21' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tool).toBe('my_attendance_for_date');
      expect(res.body.result.email).toBe(EMAIL);
      expect(res.body.result.total_worked_minutes).toBe(480);
    });

    it('executes clock_in tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'clock_in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.success).toBe(true);
    });

    it('executes my_leave_balance tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'my_leave_balance' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Returns array (may be empty if no PTO seeded)
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('executes my_shift tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'my_shift' });

      expect(res.status).toBe(200);
      expect(res.body.result.type).toBe('group');
      expect(res.body.result.start).toBe('00:00');
    });

    it('executes my_department tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'my_department' });

      expect(res.status).toBe(200);
      expect(res.body.result.departmentId).toBe('engineering');
      expect(res.body.result.departmentName).toBe('Engineering');
    });

    it('executes list_projects tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'list_projects' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.result)).toBe(true);
      // Default seeded projects exist
      expect(res.body.result.length).toBeGreaterThanOrEqual(3);
    });

    it('blocks admin tool for non-admin', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'who_is_late_today', isAdmin: false });

      expect(res.status).toBe(403);
    });

    it('allows admin tool with isAdmin flag', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'who_is_present_today', isAdmin: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('executes all_pending_approvals for admin', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'all_pending_approvals', isAdmin: true });

      expect(res.status).toBe(200);
      expect(res.body.result).toHaveProperty('pendingLeaves');
      expect(res.body.result).toHaveProperty('total');
    });

    it('executes employee_count admin tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'employee_count', isAdmin: true });

      expect(res.status).toBe(200);
      expect(res.body.result.count).toBeGreaterThanOrEqual(1);
    });

    it('rejects unknown tool', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'nonexistent_tool' });

      expect(res.status).toBe(400);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ toolName: 'my_shift' });

      expect(res.status).toBe(400);
    });

    it('rejects missing toolName', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL });

      expect(res.status).toBe(400);
    });
  });

  // ── AI Chat (with mock LLM) ──

  describe('POST /api/chat', () => {
    it('sends a message and gets a response', async () => {
      mockLlm.setConfig({ responseContent: 'Hello Alice! How can I help you today?' });

      const res = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'Hi' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('Hello Alice! How can I help you today?');
      expect(res.body.sessionId).toBeTruthy();
      expect(res.body.toolsCalled).toHaveLength(0);
    });

    it('handles tool calls from the LLM', async () => {
      // Mock LLM returns a tool call first, then a final response
      let callCount = 0;
      mockLlm.setConfig({});
      // Override chat to simulate multi-turn
      const originalChat = mockLlm.chat.bind(mockLlm);
      mockLlm.chat = async (messages) => {
        callCount++;
        if (callCount === 1) {
          return { content: '<tool_call>{"tool": "my_worked_hours_today", "params": {}}</tool_call>', tokensUsed: 30 };
        }
        return { content: 'You have worked 0 hours today so far.', tokensUsed: 20 };
      };

      const res = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'How many hours have I worked today?' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('You have worked 0 hours today so far.');
      expect(res.body.toolsCalled).toHaveLength(1);
      expect(res.body.toolsCalled[0].tool).toBe('my_worked_hours_today');

      // Restore
      mockLlm.chat = originalChat;
    });

    it('continues an existing session', async () => {
      mockLlm.setConfig({ responseContent: 'First response' });
      const first = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'Hello' });

      mockLlm.setConfig({ responseContent: 'Second response' });
      const second = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'Follow up', sessionId: first.body.sessionId });

      expect(second.body.sessionId).toBe(first.body.sessionId);
      expect(second.body.reply).toBe('Second response');
    });

    it('creates new session if sessionId is invalid', async () => {
      mockLlm.setConfig({ responseContent: 'New session' });
      const res = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'Hello', sessionId: 'nonexistent' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).not.toBe('nonexistent');
    });

    it('handles LLM failure gracefully', async () => {
      mockLlm.setConfig({ shouldThrow: new Error('LLM down') });

      const res = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL, message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('unable to process');
    });

    it('rejects missing message', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ email: EMAIL });

      expect(res.status).toBe(400);
    });
  });

  // ── External Provider Webhooks ──

  describe('POST /api/chat/external/:provider', () => {
    it('handles Leena AI webhook with direct tool call', async () => {
      const res = await request(app)
        .post('/api/chat/external/leena-ai')
        .send({
          user_email: EMAIL,
          intent: 'my_shift',
          params: {},
        });

      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('leena-ai');
      expect(res.body.result.type).toBe('group');
    });

    it('handles Darwinbox webhook', async () => {
      const res = await request(app)
        .post('/api/chat/external/darwinbox')
        .send({
          email: EMAIL,
          action_type: 'my_department',
        });

      expect(res.status).toBe(200);
      expect(res.body.result.departmentId).toBe('engineering');
    });

    it('handles Copilot webhook', async () => {
      const res = await request(app)
        .post('/api/chat/external/copilot')
        .send({
          from: { email: EMAIL },
          value: { action: 'upcoming_holidays' },
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.result)).toBe(true);
    });

    it('handles Phia webhook with chat message', async () => {
      mockLlm.setConfig({ responseContent: 'Here is your info' });

      const res = await request(app)
        .post('/api/chat/external/phia')
        .send({
          email: EMAIL,
          message: 'What is my shift?',
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('Here is your info');
    });

    it('rejects unsupported provider', async () => {
      const res = await request(app)
        .post('/api/chat/external/unknown-provider')
        .send({ email: EMAIL, message: 'hi' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported');
    });

    it('rejects missing email in provider payload', async () => {
      const res = await request(app)
        .post('/api/chat/external/leena-ai')
        .send({ intent: 'my_shift' });

      expect(res.status).toBe(400);
    });

    it('blocks admin tool from non-admin external request', async () => {
      const res = await request(app)
        .post('/api/chat/external/leena-ai')
        .send({
          user_email: EMAIL,
          intent: 'who_is_late_today',
          is_admin: false,
        });

      expect(res.status).toBe(403);
    });
  });

  // ── Tool Discovery ──

  describe('GET /api/chat/tools', () => {
    it('returns employee tools by default', async () => {
      const res = await request(app).get('/api/chat/tools');

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.employeeTools).toBeGreaterThan(0);
      // All returned tools should be employee or both scope
      for (const tool of res.body.tools) {
        expect(['employee', 'both']).toContain(tool.scope);
      }
    });

    it('returns all tools with isAdmin=true', async () => {
      const res = await request(app).get('/api/chat/tools?isAdmin=true');

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(res.body.employeeTools);
      const adminTools = res.body.tools.filter((t: { scope: string }) => t.scope === 'admin');
      expect(adminTools.length).toBeGreaterThan(0);
    });
  });

  // ── Provider Discovery ──

  describe('GET /api/chat/providers', () => {
    it('lists supported external providers', async () => {
      const res = await request(app).get('/api/chat/providers');

      expect(res.status).toBe(200);
      const ids = res.body.providers.map((p: { id: string }) => p.id);
      expect(ids).toContain('leena-ai');
      expect(ids).toContain('darwinbox');
      expect(ids).toContain('copilot');
      expect(ids).toContain('phia');
      expect(ids).toContain('rezolve');
      expect(ids).toContain('moveworks');
      expect(ids).toContain('workativ');
    });
  });

  // ── Session Management ──

  describe('Session management', () => {
    it('lists sessions for a user', async () => {
      mockLlm.setConfig({ responseContent: 'Hi' });
      await request(app).post('/api/chat').send({ email: EMAIL, message: 'Hello' });
      await request(app).post('/api/chat').send({ email: EMAIL, message: 'Another chat' });

      const res = await request(app).get(`/api/chat/sessions?email=${EMAIL}`);
      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('gets session detail with messages', async () => {
      mockLlm.setConfig({ responseContent: 'Hello back!' });
      const chat = await request(app).post('/api/chat').send({ email: EMAIL, message: 'Hello' });

      const res = await request(app).get(`/api/chat/sessions/${chat.body.sessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe(chat.body.sessionId);
      expect(res.body.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    });

    it('deletes a session', async () => {
      mockLlm.setConfig({ responseContent: 'Bye' });
      const chat = await request(app).post('/api/chat').send({ email: EMAIL, message: 'Hello' });

      const del = await request(app).delete(`/api/chat/sessions/${chat.body.sessionId}`);
      expect(del.status).toBe(200);

      const get = await request(app).get(`/api/chat/sessions/${chat.body.sessionId}`);
      expect(get.status).toBe(404);
    });

    it('returns 404 for nonexistent session', async () => {
      const res = await request(app).get('/api/chat/sessions/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ── Target Tools ──

  describe('Target tools', () => {
    it('my_attendance_target computes correctly', async () => {
      // Seed 3 present days
      for (const d of ['2026-03-02', '2026-03-03', '2026-03-04']) {
        await db.run(
          `INSERT INTO attendance_daily (email, name, date, status, total_worked_minutes, group_id)
           VALUES (?, 'Alice', ?, 'out', 480, 'engineering')`, [EMAIL, d],
        );
      }

      const res = await request(app)
        .post('/api/chat/tool')
        .send({
          email: EMAIL, toolName: 'my_attendance_target',
          params: { startDate: '2026-03-02', endDate: '2026-03-06' },
        });

      expect(res.status).toBe(200);
      const r = res.body.result;
      expect(r.workdays).toBe(5);
      expect(r.presentDays).toBe(3);
      expect(r.actualHours).toBe(24); // 3 × 480 min = 24 hrs
      expect(r.achievementPct).toBeGreaterThan(0);
    });

    it('my_ot_cap_status returns remaining quarter hours', async () => {
      const res = await request(app)
        .post('/api/chat/tool')
        .send({ email: EMAIL, toolName: 'my_ot_cap_status' });

      expect(res.status).toBe(200);
      expect(res.body.result.capHours).toBe(125);
      expect(res.body.result.remainingHours).toBeGreaterThanOrEqual(0);
    });
  });
});

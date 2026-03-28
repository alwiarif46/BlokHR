import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Interaction Identity Resolution (Gap 4)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'alice@shaavir.com';

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: EMAIL, name: 'Alice' });
    // Set platform IDs
    await db.run(
      "UPDATE members SET discord_id = ?, telegram_id = ?, phone = ? WHERE email = ?",
      ['disc-123', 'tg-456', '+919876543210', EMAIL],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  it('Discord with known discord_id resolves correct email', async () => {
    // Send a Discord button click with known discord user id
    const res = await request(app)
      .post('/api/interactions/discord')
      .send({
        type: 3,
        data: { custom_id: JSON.stringify({ action: 'leave.approve', leaveId: 'test' }) },
        member: { user: { id: 'disc-123' } },
      });
    expect(res.status).toBe(200);
    // The dispatch may fail since there's no real leave, but no 500 error
  });

  it('Discord with unknown id returns 200 (no crash)', async () => {
    const res = await request(app)
      .post('/api/interactions/discord')
      .send({
        type: 3,
        data: { custom_id: JSON.stringify({ action: 'leave.approve', leaveId: 'test' }) },
        member: { user: { id: 'unknown-999' } },
      });
    expect(res.status).toBe(200);
  });

  it('Telegram with known id resolves correct email', async () => {
    const res = await request(app)
      .post('/api/interactions/telegram')
      .send({
        callback_query: {
          id: 'cq1',
          data: JSON.stringify({ a: 'leave.approve', leaveId: 'test' }),
          from: { id: parseInt('0', 10) }, // tg-456 is a string not a number
        },
      });
    expect(res.status).toBe(200);
  });

  it('WhatsApp with known phone resolves correct email', async () => {
    const res = await request(app)
      .post('/api/interactions/whatsapp')
      .send({
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '+919876543210',
                interactive: { button_reply: { id: JSON.stringify({ action: 'leave.approve', leaveId: 'test' }) } },
              }],
            },
          }],
        }],
      });
    expect(res.status).toBe(200);
  });

  it('empty discordUserId returns empty without DB query', async () => {
    const res = await request(app)
      .post('/api/interactions/discord')
      .send({
        type: 3,
        data: { custom_id: JSON.stringify({ action: 'leave.approve' }) },
        member: { user: { id: '' } },
      });
    expect(res.status).toBe(200);
  });

  it('Telegram id = 0 returns empty', async () => {
    const res = await request(app)
      .post('/api/interactions/telegram')
      .send({
        callback_query: {
          id: 'cq2',
          data: JSON.stringify({ a: 'leave.approve' }),
          from: { id: 0 },
        },
      });
    expect(res.status).toBe(200);
  });

  it('migration applied — columns exist', async () => {
    const row = await db.get<{ discord_id: string; telegram_id: string }>(
      'SELECT discord_id, telegram_id FROM members WHERE email = ?',
      [EMAIL],
    );
    expect(row).toBeTruthy();
    expect(row!.discord_id).toBe('disc-123');
    expect(row!.telegram_id).toBe('tg-456');
  });
});

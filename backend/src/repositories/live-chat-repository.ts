import type { DatabaseEngine } from '../db/engine';

export interface ChannelRow {
  [key: string]: unknown;
  id: string;
  name: string;
  type: string;
  description: string;
  group_id: string;
  created_by: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelMemberRow {
  [key: string]: unknown;
  id: number;
  channel_id: string;
  email: string;
  role: string;
  joined_at: string;
}

export interface FeedMessageRow {
  [key: string]: unknown;
  id: string;
  channel_id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  message_type: string;
  pinned: number;
  edited: number;
  created_at: string;
  updated_at: string;
}

export interface DirectMessageRow {
  [key: string]: unknown;
  id: string;
  sender_email: string;
  sender_name: string;
  recipient_email: string;
  content: string;
  read: number;
  read_at: string | null;
  created_at: string;
}

export class LiveChatRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Channels ──

  async getChannels(email?: string): Promise<ChannelRow[]> {
    if (!email) {
      return this.db.all<ChannelRow>('SELECT * FROM channels WHERE archived = 0 ORDER BY type, name', []);
    }
    // Channels the user belongs to + all company channels
    return this.db.all<ChannelRow>(
      `SELECT DISTINCT c.* FROM channels c
       LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.email = ?
       WHERE c.archived = 0 AND (c.type = 'company' OR cm.email IS NOT NULL)
       ORDER BY c.type, c.name`,
      [email],
    );
  }

  async getChannelById(id: string): Promise<ChannelRow | null> {
    return this.db.get<ChannelRow>('SELECT * FROM channels WHERE id = ?', [id]);
  }

  async createChannel(data: {
    id: string;
    name: string;
    type: string;
    description?: string;
    groupId?: string;
    createdBy: string;
  }): Promise<ChannelRow> {
    await this.db.run(
      'INSERT INTO channels (id, name, type, description, group_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [data.id, data.name, data.type, data.description ?? '', data.groupId ?? '', data.createdBy],
    );
    const row = await this.getChannelById(data.id);
    if (!row) throw new Error('Failed to create channel');
    return row;
  }

  async updateChannel(id: string, fields: Record<string, unknown>): Promise<void> {
    const colMap: Record<string, string> = {
      name: 'name', description: 'description', archived: 'archived',
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      const col = colMap[key];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteChannel(id: string): Promise<void> {
    await this.db.run('DELETE FROM channels WHERE id = ?', [id]);
  }

  // ── Members ──

  async getMembers(channelId: string): Promise<ChannelMemberRow[]> {
    return this.db.all<ChannelMemberRow>(
      'SELECT * FROM channel_members WHERE channel_id = ? ORDER BY joined_at', [channelId],
    );
  }

  async isMember(channelId: string, email: string): Promise<boolean> {
    const row = await this.db.get(
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND email = ?', [channelId, email],
    );
    return !!row;
  }

  async addMember(channelId: string, email: string, role = 'member'): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO channel_members (channel_id, email, role) VALUES (?, ?, ?)',
      [channelId, email, role],
    );
  }

  async removeMember(channelId: string, email: string): Promise<void> {
    await this.db.run(
      'DELETE FROM channel_members WHERE channel_id = ? AND email = ?', [channelId, email],
    );
  }

  // ── Feed Messages ──

  async getMessages(channelId: string, limit = 50, before?: string): Promise<FeedMessageRow[]> {
    const conditions = ['channel_id = ?'];
    const params: unknown[] = [channelId];
    if (before) {
      conditions.push('created_at < ?');
      params.push(before);
    }
    params.push(limit);
    return this.db.all<FeedMessageRow>(
      `SELECT * FROM feed_messages WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
      params,
    );
  }

  async getMessageById(id: string): Promise<FeedMessageRow | null> {
    return this.db.get<FeedMessageRow>('SELECT * FROM feed_messages WHERE id = ?', [id]);
  }

  async createMessage(data: {
    id: string;
    channelId: string;
    senderEmail: string;
    senderName: string;
    content: string;
    messageType?: string;
  }): Promise<FeedMessageRow> {
    await this.db.run(
      'INSERT INTO feed_messages (id, channel_id, sender_email, sender_name, content, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [data.id, data.channelId, data.senderEmail, data.senderName, data.content, data.messageType ?? 'message'],
    );
    const row = await this.getMessageById(data.id);
    if (!row) throw new Error('Failed to create message');
    return row;
  }

  async updateMessage(id: string, content: string): Promise<void> {
    await this.db.run(
      "UPDATE feed_messages SET content = ?, edited = 1, updated_at = datetime('now') WHERE id = ?",
      [content, id],
    );
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.run('DELETE FROM feed_messages WHERE id = ?', [id]);
  }

  async pinMessage(id: string, pinned: boolean): Promise<void> {
    await this.db.run(
      "UPDATE feed_messages SET pinned = ?, updated_at = datetime('now') WHERE id = ?",
      [pinned ? 1 : 0, id],
    );
  }

  async getPinnedMessages(channelId: string): Promise<FeedMessageRow[]> {
    return this.db.all<FeedMessageRow>(
      'SELECT * FROM feed_messages WHERE channel_id = ? AND pinned = 1 ORDER BY created_at DESC',
      [channelId],
    );
  }

  // ── Read tracking ──

  async markRead(messageId: string, email: string): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO message_reads (message_id, email) VALUES (?, ?)',
      [messageId, email],
    );
  }

  async getUnreadCount(channelId: string, email: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) as cnt FROM feed_messages fm
       WHERE fm.channel_id = ? AND fm.sender_email != ?
         AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = fm.id AND mr.email = ?)`,
      [channelId, email, email],
    );
    return row?.cnt ?? 0;
  }

  // ── Direct Messages ──

  async sendDm(data: {
    id: string;
    senderEmail: string;
    senderName: string;
    recipientEmail: string;
    content: string;
  }): Promise<DirectMessageRow> {
    await this.db.run(
      'INSERT INTO direct_messages (id, sender_email, sender_name, recipient_email, content) VALUES (?, ?, ?, ?, ?)',
      [data.id, data.senderEmail, data.senderName, data.recipientEmail, data.content],
    );
    const row = await this.db.get<DirectMessageRow>('SELECT * FROM direct_messages WHERE id = ?', [data.id]);
    if (!row) throw new Error('Failed to create DM');
    return row;
  }

  async getDmConversation(
    email1: string,
    email2: string,
    limit = 50,
    before?: string,
  ): Promise<DirectMessageRow[]> {
    const conditions = [
      '((sender_email = ? AND recipient_email = ?) OR (sender_email = ? AND recipient_email = ?))',
    ];
    const params: unknown[] = [email1, email2, email2, email1];
    if (before) {
      conditions.push('created_at < ?');
      params.push(before);
    }
    params.push(limit);
    return this.db.all<DirectMessageRow>(
      `SELECT * FROM direct_messages WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
      params,
    );
  }

  async getDmContacts(email: string): Promise<Array<{ email: string; name: string; lastMessage: string; lastAt: string; unread: number }>> {
    // Get all unique conversation partners with latest message
    const rows = await this.db.all<{
      partner_email: string;
      partner_name: string;
      last_content: string;
      last_at: string;
      [key: string]: unknown;
    }>(
      `SELECT
        CASE WHEN sender_email = ? THEN recipient_email ELSE sender_email END as partner_email,
        CASE WHEN sender_email = ? THEN '' ELSE sender_name END as partner_name,
        content as last_content,
        created_at as last_at
       FROM direct_messages
       WHERE sender_email = ? OR recipient_email = ?
       GROUP BY partner_email
       ORDER BY created_at DESC`,
      [email, email, email, email],
    );

    const results = [];
    for (const row of rows) {
      const unreadRow = await this.db.get<{ cnt: number; [key: string]: unknown }>(
        'SELECT COUNT(*) as cnt FROM direct_messages WHERE sender_email = ? AND recipient_email = ? AND read = 0',
        [row.partner_email, email],
      );
      results.push({
        email: row.partner_email,
        name: row.partner_name,
        lastMessage: row.last_content,
        lastAt: row.last_at,
        unread: unreadRow?.cnt ?? 0,
      });
    }
    return results;
  }

  async markDmRead(senderEmail: string, recipientEmail: string): Promise<number> {
    await this.db.run(
      "UPDATE direct_messages SET read = 1, read_at = datetime('now') WHERE sender_email = ? AND recipient_email = ? AND read = 0",
      [senderEmail, recipientEmail],
    );
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT changes() as cnt', [],
    );
    return row?.cnt ?? 0;
  }

  async getTotalUnreadDms(email: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT COUNT(*) as cnt FROM direct_messages WHERE recipient_email = ? AND read = 0',
      [email],
    );
    return row?.cnt ?? 0;
  }
}

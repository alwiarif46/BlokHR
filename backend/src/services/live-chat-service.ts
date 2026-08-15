import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type {
  LiveChatRepository,
  ChannelRow,
  FeedMessageRow,
  DirectMessageRow,
  ChannelMemberRow,
} from '../repositories/live-chat-repository';
import type { SseBroadcaster } from '../sse/broadcaster';

// ── Result types ──

export interface PostMessageResult {
  success: boolean;
  message?: FeedMessageRow;
  error?: string;
}

export interface SendDmResult {
  success: boolean;
  dm?: DirectMessageRow;
  error?: string;
}

export class LiveChatService {
  constructor(
    private readonly repo: LiveChatRepository,
    private readonly db: DatabaseEngine,
    private readonly broadcaster: SseBroadcaster | null,
    private readonly logger: Logger,
  ) {}

  // ── Channels ──

  async getChannels(email: string): Promise<ChannelRow[]> {
    return this.repo.getChannels(email);
  }

  async getChannelById(id: string): Promise<ChannelRow | null> {
    return this.repo.getChannelById(id);
  }

  async createChannel(data: {
    name: string;
    type?: string;
    description?: string;
    groupId?: string;
    createdBy: string;
  }): Promise<ChannelRow> {
    const id = uuidv4();
    const type = data.type ?? 'custom';

    const channel = await this.repo.createChannel({
      id,
      name: data.name,
      type,
      description: data.description,
      groupId: data.groupId,
      createdBy: data.createdBy,
    });

    // Auto-add creator as admin
    await this.repo.addMember(id, data.createdBy, 'admin');

    // For department channels, auto-add all department members
    if (type === 'department' && data.groupId) {
      const members = await this.db.all<{ email: string; [key: string]: unknown }>(
        'SELECT email FROM members WHERE group_id = ? AND active = 1', [data.groupId],
      );
      for (const m of members) {
        await this.repo.addMember(id, m.email, 'member');
      }
    }

    this.logger.info({ channelId: id, name: data.name, type }, 'Channel created');
    this.broadcastChannelUpdate('created', channel);
    return channel;
  }

  async updateChannel(id: string, fields: Record<string, unknown>): Promise<void> {
    await this.repo.updateChannel(id, fields);
  }

  async archiveChannel(id: string): Promise<{ success: boolean; error?: string }> {
    const channel = await this.repo.getChannelById(id);
    if (!channel) return { success: false, error: 'Channel not found' };
    if (channel.type === 'company') return { success: false, error: 'Cannot archive the company channel' };
    await this.repo.updateChannel(id, { archived: true });
    this.logger.info({ channelId: id }, 'Channel archived');
    return { success: true };
  }

  /**
   * Ensure department channels exist for all groups.
   * Creates missing ones and auto-adds members. Idempotent — safe to call repeatedly.
   */
  async ensureDepartmentChannels(): Promise<number> {
    const groups = await this.db.all<{ id: string; name: string; [key: string]: unknown }>(
      'SELECT id, name FROM groups', [],
    );
    let created = 0;
    for (const group of groups) {
      const channelId = `dept-${group.id}`;
      const existing = await this.repo.getChannelById(channelId);
      if (!existing) {
        await this.repo.createChannel({
          id: channelId,
          name: `${group.name}`,
          type: 'department',
          description: `Department channel for ${group.name}`,
          groupId: group.id,
          createdBy: 'system',
        });
        // Add all members
        const members = await this.db.all<{ email: string; [key: string]: unknown }>(
          'SELECT email FROM members WHERE group_id = ? AND active = 1', [group.id],
        );
        for (const m of members) {
          await this.repo.addMember(channelId, m.email, 'member');
        }
        created++;
      }
    }
    return created;
  }

  // ── Membership ──

  async getMembers(channelId: string): Promise<ChannelMemberRow[]> {
    return this.repo.getMembers(channelId);
  }

  async joinChannel(channelId: string, email: string): Promise<{ success: boolean; error?: string }> {
    const channel = await this.repo.getChannelById(channelId);
    if (!channel) return { success: false, error: 'Channel not found' };
    if (channel.archived) return { success: false, error: 'Channel is archived' };
    await this.repo.addMember(channelId, email);
    return { success: true };
  }

  async leaveChannel(channelId: string, email: string): Promise<{ success: boolean; error?: string }> {
    const channel = await this.repo.getChannelById(channelId);
    if (!channel) return { success: false, error: 'Channel not found' };
    if (channel.type === 'company') return { success: false, error: 'Cannot leave the company channel' };
    await this.repo.removeMember(channelId, email);
    return { success: true };
  }

  // ── Feed Messages ──

  async postMessage(data: {
    channelId: string;
    senderEmail: string;
    content: string;
    messageType?: string;
  }): Promise<PostMessageResult> {
    if (!data.content.trim()) return { success: false, error: 'Message content is required' };

    const channel = await this.repo.getChannelById(data.channelId);
    if (!channel) return { success: false, error: 'Channel not found' };
    if (channel.archived) return { success: false, error: 'Channel is archived' };

    // Company channel: only admins can post announcements
    if (channel.type === 'company' && data.messageType === 'announcement') {
      const isAdmin = await this.db.get(
        'SELECT 1 FROM admins WHERE email = ?', [data.senderEmail],
      );
      if (!isAdmin) return { success: false, error: 'Only admins can post announcements' };
    }

    // For non-company channels, check membership (company is open to all)
    if (channel.type !== 'company') {
      const isMember = await this.repo.isMember(data.channelId, data.senderEmail);
      if (!isMember) return { success: false, error: 'You are not a member of this channel' };
    }

    const senderName = await this.getMemberName(data.senderEmail);

    const message = await this.repo.createMessage({
      id: uuidv4(),
      channelId: data.channelId,
      senderEmail: data.senderEmail,
      senderName,
      content: data.content.trim(),
      messageType: data.messageType,
    });

    this.logger.info(
      { messageId: message.id, channelId: data.channelId, sender: data.senderEmail },
      'Message posted',
    );

    // SSE push
    if (this.broadcaster) {
      this.broadcaster.broadcast('chat-message', {
        channelId: data.channelId,
        message: {
          id: message.id,
          senderEmail: message.sender_email,
          senderName: message.sender_name,
          content: message.content,
          messageType: message.message_type,
          createdAt: message.created_at,
        },
      });
    }

    return { success: true, message };
  }

  async getMessages(channelId: string, limit?: number, before?: string): Promise<FeedMessageRow[]> {
    return this.repo.getMessages(channelId, limit, before);
  }

  async editMessage(
    messageId: string,
    senderEmail: string,
    newContent: string,
  ): Promise<{ success: boolean; error?: string }> {
    const msg = await this.repo.getMessageById(messageId);
    if (!msg) return { success: false, error: 'Message not found' };
    if (msg.sender_email !== senderEmail) return { success: false, error: 'You can only edit your own messages' };
    await this.repo.updateMessage(messageId, newContent.trim());
    return { success: true };
  }

  async deleteMessage(
    messageId: string,
    requesterEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const msg = await this.repo.getMessageById(messageId);
    if (!msg) return { success: false, error: 'Message not found' };
    // Allow sender or admin to delete
    const isAdmin = await this.db.get('SELECT 1 FROM admins WHERE email = ?', [requesterEmail]);
    if (msg.sender_email !== requesterEmail && !isAdmin) {
      return { success: false, error: 'You can only delete your own messages' };
    }
    await this.repo.deleteMessage(messageId);
    return { success: true };
  }

  async pinMessage(messageId: string, pin: boolean): Promise<{ success: boolean; error?: string }> {
    const msg = await this.repo.getMessageById(messageId);
    if (!msg) return { success: false, error: 'Message not found' };
    await this.repo.pinMessage(messageId, pin);
    return { success: true };
  }

  async getPinnedMessages(channelId: string): Promise<FeedMessageRow[]> {
    return this.repo.getPinnedMessages(channelId);
  }

  async markRead(messageId: string, email: string): Promise<void> {
    await this.repo.markRead(messageId, email);
  }

  async getUnreadCount(channelId: string, email: string): Promise<number> {
    return this.repo.getUnreadCount(channelId, email);
  }

  // ── Direct Messages ──

  async sendDm(data: {
    senderEmail: string;
    recipientEmail: string;
    content: string;
  }): Promise<SendDmResult> {
    if (!data.content.trim()) return { success: false, error: 'Message content is required' };
    if (data.senderEmail === data.recipientEmail) return { success: false, error: 'Cannot DM yourself' };

    // Verify recipient exists
    const recipient = await this.db.get<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM members WHERE email = ? AND active = 1', [data.recipientEmail],
    );
    if (!recipient) return { success: false, error: 'Recipient not found or inactive' };

    const senderName = await this.getMemberName(data.senderEmail);

    const dm = await this.repo.sendDm({
      id: uuidv4(),
      senderEmail: data.senderEmail,
      senderName,
      recipientEmail: data.recipientEmail,
      content: data.content.trim(),
    });

    // SSE push
    if (this.broadcaster) {
      this.broadcaster.broadcast('chat-dm', {
        dm: {
          id: dm.id,
          senderEmail: dm.sender_email,
          senderName: dm.sender_name,
          recipientEmail: dm.recipient_email,
          content: dm.content,
          createdAt: dm.created_at,
        },
      });
    }

    return { success: true, dm };
  }

  async getDmConversation(
    email1: string,
    email2: string,
    limit?: number,
    before?: string,
  ): Promise<DirectMessageRow[]> {
    return this.repo.getDmConversation(email1, email2, limit, before);
  }

  async getDmContacts(email: string): Promise<Array<{ email: string; name: string; lastMessage: string; lastAt: string; unread: number }>> {
    return this.repo.getDmContacts(email);
  }

  async markDmRead(senderEmail: string, recipientEmail: string): Promise<number> {
    return this.repo.markDmRead(senderEmail, recipientEmail);
  }

  async getTotalUnreadDms(email: string): Promise<number> {
    return this.repo.getTotalUnreadDms(email);
  }

  // ── Private ──

  private async getMemberName(email: string): Promise<string> {
    const r = await this.db.get<{ name: string; [key: string]: unknown }>(
      'SELECT name FROM members WHERE email = ?', [email],
    );
    return r?.name ?? email;
  }

  private broadcastChannelUpdate(action: string, channel: ChannelRow): void {
    if (!this.broadcaster) return;
    this.broadcaster.broadcast('chat-channel-update', {
      action,
      channel: { id: channel.id, name: channel.name, type: channel.type },
    });
  }
}

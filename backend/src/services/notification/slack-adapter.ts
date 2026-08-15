import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toSlackBlocks } from '../../templates/format-converters';

/**
 * Slack App adapter — uses shared template system.
 * Supports all modules automatically.
 */
export class SlackAdapter implements ChannelAdapter {
  readonly name = 'slack';
  readonly isConfigured: boolean;

  private readonly botToken: string;
  private readonly logger: Logger;

  constructor(botToken: string | undefined, logger: Logger) {
    this.botToken = botToken ?? '';
    this.isConfigured = !!this.botToken;
    this.logger = logger;
  }

  private async resolveSlackUserId(email: string): Promise<string | null> {
    try {
      const resp = await fetch(
        `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
        {
          headers: { Authorization: `Bearer ${this.botToken}` },
        },
      );
      const data = (await resp.json()) as { ok: boolean; user?: { id: string } };
      return data.ok && data.user ? data.user.id : null;
    } catch {
      return null;
    }
  }

  async send(
    recipient: NotificationRecipient,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    cardReference?: string;
    conversationId?: string;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Slack bot token not configured' };
    }

    try {
      const slackUserId =
        (data.slackUserId as string) || (await this.resolveSlackUserId(recipient.email));
      if (!slackUserId) {
        return { success: false, error: `Cannot resolve Slack user for ${recipient.email}` };
      }

      const convResp = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: slackUserId }),
      });
      const convData = (await convResp.json()) as {
        ok: boolean;
        channel?: { id: string };
        error?: string;
      };
      if (!convData.ok || !convData.channel) {
        return {
          success: false,
          error: `Slack conversations.open failed: ${convData.error ?? 'unknown'}`,
        };
      }
      const channelId = convData.channel.id;

      const msg = buildNotificationMessage(templateName, data, recipient.role);
      const payload = toSlackBlocks(msg);

      const msgResp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelId, text: payload.text, blocks: payload.blocks }),
      });
      const msgData = (await msgResp.json()) as { ok: boolean; ts?: string; error?: string };
      if (!msgData.ok) {
        return {
          success: false,
          error: `Slack chat.postMessage failed: ${msgData.error ?? 'unknown'}`,
        };
      }

      this.logger.info(
        { recipient: recipient.email, template: templateName, channel: channelId },
        'Slack message sent',
      );
      return { success: true, cardReference: msgData.ts ?? '', conversationId: channelId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Slack send error');
      return { success: false, error: errMsg };
    }
  }

  async updateCard(
    conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Slack bot token not configured' };
    }

    try {
      const msg = buildNotificationMessage(templateName, data);
      const payload = toSlackBlocks(msg);

      const resp = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: conversationId,
          ts: cardReference,
          text: payload.text,
          blocks: payload.blocks,
        }),
      });
      const result = (await resp.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        return { success: false, error: `Slack chat.update failed: ${result.error ?? 'unknown'}` };
      }

      this.logger.info(
        { conversationId, ts: cardReference, template: templateName },
        'Slack message updated',
      );
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}

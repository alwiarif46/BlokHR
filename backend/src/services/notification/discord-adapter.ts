import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toDiscordMessage } from '../../templates/format-converters';

/**
 * Discord Bot adapter — uses shared template system.
 * Supports all modules automatically.
 */
export class DiscordAdapter implements ChannelAdapter {
  readonly name = 'discord';
  readonly isConfigured: boolean;

  private readonly botToken: string;
  private readonly logger: Logger;

  constructor(botToken: string | undefined, appId: string | undefined, logger: Logger) {
    this.botToken = botToken ?? '';
    this.isConfigured = !!(this.botToken && appId);
    this.logger = logger;
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
    if (!this.isConfigured) return { success: false, error: 'Discord bot not configured' };

    try {
      const userId = (data.discordUserId as string) ?? '';
      if (!userId) return { success: false, error: 'No Discord user ID for recipient' };

      const dmResp = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: userId }),
      });
      if (!dmResp.ok) {
        const text = await dmResp.text();
        return { success: false, error: `Discord DM creation failed: ${dmResp.status} ${text}` };
      }
      const dmData = (await dmResp.json()) as { id: string };
      const channelId = dmData.id;

      const msg = buildNotificationMessage(templateName, data, recipient.role);
      const payload = toDiscordMessage(msg);

      const msgResp = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!msgResp.ok) {
        const text = await msgResp.text();
        return { success: false, error: `Discord send failed: ${msgResp.status} ${text}` };
      }

      const msgData = (await msgResp.json()) as { id: string };
      this.logger.info(
        { recipient: recipient.email, template: templateName, channelId },
        'Discord message sent',
      );
      return { success: true, cardReference: msgData.id, conversationId: channelId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Discord send error');
      return { success: false, error: errMsg };
    }
  }

  async updateCard(
    conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) return { success: false, error: 'Discord bot not configured' };

    try {
      const msg = buildNotificationMessage(templateName, data);
      const payload = toDiscordMessage(msg);

      const resp = await fetch(
        `https://discord.com/api/v10/channels/${conversationId}/messages/${cardReference}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `Discord update failed: ${resp.status} ${text}` };
      }

      this.logger.info(
        { conversationId, messageId: cardReference, template: templateName },
        'Discord message updated',
      );
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}

import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toTelegramMessage } from '../../templates/format-converters';

/**
 * Telegram Bot adapter — uses shared template system.
 * Supports all modules automatically.
 */
export class TelegramAdapter implements ChannelAdapter {
  readonly name = 'telegram';
  readonly isConfigured: boolean;

  private readonly botToken: string;
  private readonly logger: Logger;
  private readonly apiBase: string;

  constructor(botToken: string | undefined, logger: Logger) {
    this.botToken = botToken ?? '';
    this.isConfigured = !!this.botToken;
    this.logger = logger;
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
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
    if (!this.isConfigured) return { success: false, error: 'Telegram bot not configured' };

    const chatId = (data.telegramChatId as string) ?? '';
    if (!chatId) return { success: false, error: 'No Telegram chat ID for recipient' };

    try {
      const notifMsg = buildNotificationMessage(templateName, data, recipient.role);
      const tgMsg = toTelegramMessage(notifMsg);

      const resp = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgMsg.text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(tgMsg.reply_markup ? { reply_markup: tgMsg.reply_markup } : {}),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return { success: false, error: `Telegram API returned ${resp.status}: ${errText}` };
      }

      const respData = (await resp.json()) as { result?: { message_id: number } };
      const messageId = String(respData.result?.message_id ?? '');

      this.logger.info(
        { recipient: recipient.email, template: templateName, chatId, messageId },
        'Telegram message sent',
      );
      return { success: true, cardReference: messageId, conversationId: chatId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Telegram send error');
      return { success: false, error: errMsg };
    }
  }

  async updateCard(
    conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) return { success: false, error: 'Telegram bot not configured' };

    try {
      const notifMsg = buildNotificationMessage(templateName, data);
      const tgMsg = toTelegramMessage(notifMsg);

      const resp = await fetch(`${this.apiBase}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: conversationId,
          message_id: parseInt(cardReference, 10),
          text: tgMsg.text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(tgMsg.reply_markup
            ? { reply_markup: tgMsg.reply_markup }
            : { reply_markup: { inline_keyboard: [] } }),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return {
          success: false,
          error: `Telegram editMessageText failed: ${resp.status}: ${errText}`,
        };
      }

      this.logger.info(
        { chatId: conversationId, messageId: cardReference, template: templateName },
        'Telegram message updated',
      );
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}

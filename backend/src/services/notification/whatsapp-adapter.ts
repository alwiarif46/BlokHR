import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toWhatsAppMessage } from '../../templates/format-converters';

/**
 * WhatsApp Business adapter — uses shared template system.
 * Supports all modules automatically.
 */
export class WhatsAppAdapter implements ChannelAdapter {
  readonly name = 'whatsapp';
  readonly isConfigured: boolean;

  private readonly phoneId: string;
  private readonly token: string;
  private readonly logger: Logger;

  constructor(phoneId: string | undefined, token: string | undefined, logger: Logger) {
    this.phoneId = phoneId ?? '';
    this.token = token ?? '';
    this.isConfigured = !!(this.phoneId && this.token);
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
    if (!this.isConfigured) return { success: false, error: 'WhatsApp not configured' };

    const phone = (data.recipientPhone as string) ?? '';
    if (!phone) return { success: false, error: 'No phone number for WhatsApp recipient' };

    try {
      const msg = buildNotificationMessage(templateName, data, recipient.role);
      const payload = toWhatsAppMessage(msg, phone);

      const resp = await fetch(`https://graph.facebook.com/v18.0/${this.phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `WhatsApp API returned ${resp.status}: ${text}` };
      }

      const respData = (await resp.json()) as { messages?: Array<{ id: string }> };
      const messageId = respData.messages?.[0]?.id ?? '';

      this.logger.info(
        { recipient: recipient.email, template: templateName, messageId },
        'WhatsApp message sent',
      );
      return { success: true, cardReference: messageId, conversationId: phone };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'WhatsApp send error');
      return { success: false, error: errMsg };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateCard(
    _conversationId: string,
    _cardReference: string,
    _templateName: string,
    _data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'WhatsApp does not support in-place message updates' };
  }
}

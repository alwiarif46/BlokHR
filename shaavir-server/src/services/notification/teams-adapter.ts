import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toAdaptiveCard } from '../../templates/format-converters';

/**
 * Microsoft Teams notification adapter via Bot Framework.
 * Uses shared template system — supports all modules (leaves, regularizations, etc.)
 * automatically when templates are added to notification-message.ts.
 */
export class TeamsBotAdapter implements ChannelAdapter {
  readonly name = 'teams';
  readonly isConfigured: boolean;

  private readonly appId: string;
  private readonly appPassword: string;
  private readonly logger: Logger;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(appId: string | undefined, appPassword: string | undefined, logger: Logger) {
    this.appId = appId ?? '';
    this.appPassword = appPassword ?? '';
    this.isConfigured = !!(this.appId && this.appPassword);
    this.logger = logger;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.appId,
      client_secret: this.appPassword,
      scope: 'https://api.botframework.com/.default',
    });

    const resp = await fetch(
      'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Bot token request failed: ${resp.status} ${text}`);
    }

    const data = (await resp.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
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
      return { success: false, error: 'Teams bot not configured' };
    }

    const msg = buildNotificationMessage(templateName, data, recipient.role);
    const card = toAdaptiveCard(msg);

    try {
      const token = await this.getToken();
      const teamsUserId = (data.teamsUserId as string) ?? '';
      const serviceUrl = (data.serviceUrl as string) ?? 'https://smba.trafficmanager.net/in/';

      if (!teamsUserId) {
        this.logger.warn({ email: recipient.email }, 'No Teams user ID');
        return { success: false, error: 'No Teams user ID for recipient' };
      }

      const convResp = await fetch(`${serviceUrl}v3/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot: { id: this.appId },
          members: [{ id: teamsUserId }],
          channelData: { tenant: { id: (data.tenantId as string) ?? '' } },
          isGroup: false,
        }),
      });

      if (!convResp.ok) {
        const err = await convResp.text();
        return { success: false, error: `Create conversation failed: ${convResp.status} ${err}` };
      }

      const convData = (await convResp.json()) as { id: string };
      const conversationId = convData.id;

      const msgResp = await fetch(`${serviceUrl}v3/conversations/${conversationId}/activities`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }],
        }),
      });

      if (!msgResp.ok) {
        const err = await msgResp.text();
        return { success: false, error: `Send message failed: ${msgResp.status} ${err}` };
      }

      const msgData = (await msgResp.json()) as { id: string };
      this.logger.info(
        { recipient: recipient.email, template: templateName, conversationId },
        'Teams card sent',
      );
      return { success: true, cardReference: msgData.id, conversationId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Teams send error');
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
      return { success: false, error: 'Teams bot not configured' };
    }

    const msg = buildNotificationMessage(templateName, data);
    const card = toAdaptiveCard(msg);

    try {
      const token = await this.getToken();
      const serviceUrl = (data.serviceUrl as string) ?? 'https://smba.trafficmanager.net/in/';

      const resp = await fetch(
        `${serviceUrl}v3/conversations/${conversationId}/activities/${cardReference}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message',
            id: cardReference,
            attachments: [
              { contentType: 'application/vnd.microsoft.card.adaptive', content: card },
            ],
          }),
        },
      );

      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, error: `Update card failed: ${resp.status} ${err}` };
      }

      this.logger.info(
        { conversationId, cardReference, template: templateName },
        'Teams card updated',
      );
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}

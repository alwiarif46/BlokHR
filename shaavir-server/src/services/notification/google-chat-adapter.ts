import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toGoogleChatCard } from '../../templates/format-converters';

/**
 * Google Chat App adapter — uses shared template system.
 * Supports all modules automatically.
 */
export class GoogleChatAdapter implements ChannelAdapter {
  readonly name = 'google-chat';
  readonly isConfigured: boolean;

  private readonly serviceAccountKey: Record<string, unknown> | null;
  private readonly logger: Logger;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(serviceAccountJson: string | undefined, logger: Logger) {
    this.logger = logger;
    if (serviceAccountJson) {
      try {
        const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
        this.serviceAccountKey = JSON.parse(decoded) as Record<string, unknown>;
        this.isConfigured = true;
      } catch {
        this.logger.warn('Invalid GOOGLE_CHAT_SERVICE_ACCOUNT_JSON');
        this.serviceAccountKey = null;
        this.isConfigured = false;
      }
    } else {
      this.serviceAccountKey = null;
      this.isConfigured = false;
    }
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }
    if (!this.serviceAccountKey) throw new Error('No service account key');

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: this.serviceAccountKey.client_email,
        scope: 'https://www.googleapis.com/auth/chat.bot',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(this.serviceAccountKey.private_key as string, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google OAuth failed: ${resp.status} ${text}`);
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
    if (!this.isConfigured) return { success: false, error: 'Google Chat not configured' };

    try {
      const token = await this.getToken();
      const spaceName = (data.googleChatSpaceName as string) ?? '';
      if (!spaceName) return { success: false, error: 'No Google Chat space name' };

      const msg = buildNotificationMessage(templateName, data, recipient.role);
      const entityId = (data.leaveId as string) ?? (data.regId as string) ?? 'unknown';
      const card = toGoogleChatCard(msg, `${templateName}-${entityId}`);

      const resp = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `Google Chat API returned ${resp.status}: ${text}` };
      }

      const msgData = (await resp.json()) as { name: string };
      this.logger.info(
        { recipient: recipient.email, template: templateName },
        'Google Chat card sent',
      );
      return { success: true, cardReference: msgData.name, conversationId: spaceName };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Google Chat send error');
      return { success: false, error: errMsg };
    }
  }

  async updateCard(
    _conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) return { success: false, error: 'Google Chat not configured' };

    try {
      const token = await this.getToken();
      const msg = buildNotificationMessage(templateName, data);
      const card = toGoogleChatCard(msg, `${templateName}-resolved`);

      const resp = await fetch(
        `https://chat.googleapis.com/v1/${cardReference}?updateMask=cardsV2`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(card),
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `Google Chat update failed: ${resp.status}: ${text}` };
      }

      this.logger.info({ cardReference, template: templateName }, 'Google Chat card updated');
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errMsg };
    }
  }
}

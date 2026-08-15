import crypto from 'crypto';
import nodemailer from 'nodemailer';
import type { ChannelAdapter, NotificationRecipient } from './dispatcher';
import type { Logger } from 'pino';
import { buildNotificationMessage } from '../../templates/notification-message';
import { toEmailHtml } from '../../templates/format-converters';

/**
 * Email adapter with one-click action links — uses shared template system.
 * Supports all modules automatically.
 */
export class EmailAdapter implements ChannelAdapter {
  readonly name = 'email';
  readonly isConfigured: boolean;

  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;
  private readonly serverBaseUrl: string;
  private readonly actionSecret: string;
  private readonly logger: Logger;

  constructor(
    smtpHost: string | undefined,
    smtpPort: number,
    smtpUser: string | undefined,
    smtpPass: string | undefined,
    smtpFrom: string | undefined,
    serverBaseUrl: string | undefined,
    actionSecret: string | undefined,
    logger: Logger,
  ) {
    this.fromAddress = smtpFrom ?? '';
    this.serverBaseUrl = serverBaseUrl ?? '';
    this.actionSecret = actionSecret ?? '';
    this.logger = logger;
    this.isConfigured = !!(smtpHost && smtpUser && smtpPass && smtpFrom);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
    } else {
      this.transporter = null;
    }
  }

  private generateActionToken(payload: Record<string, unknown>): string {
    const data = { ...payload, exp: Date.now() + 72 * 60 * 60 * 1000 };
    const json = JSON.stringify(data);
    const encoded = Buffer.from(json).toString('base64url');
    const hmac = crypto.createHmac('sha256', this.actionSecret).update(encoded).digest('base64url');
    return `${encoded}.${hmac}`;
  }

  private actionUrl(
    entityType: string,
    entityId: string,
    action: string,
    approverEmail: string,
  ): string {
    if (!this.serverBaseUrl || !this.actionSecret) return '';
    const token = this.generateActionToken({ entityType, entityId, action, approverEmail });
    return `${this.serverBaseUrl}/api/actions/${token}`;
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
    if (!this.isConfigured || !this.transporter) {
      return { success: false, error: 'Email SMTP not configured' };
    }

    try {
      const msg = buildNotificationMessage(templateName, data, recipient.role);

      // Build action URLs from buttons if available
      let actionUrls: { approve?: string; reject?: string } | undefined;
      if (msg.buttons.length > 0 && this.serverBaseUrl && this.actionSecret) {
        const entityId = (data.leaveId as string) ?? (data.regId as string) ?? '';
        const entityType = templateName.startsWith('leave:')
          ? 'leave'
          : templateName.startsWith('regularization:')
            ? 'regularization'
            : 'unknown';
        const approveBtn = msg.buttons.find((b) => b.style === 'primary');
        const rejectBtn = msg.buttons.find((b) => b.style === 'danger');
        if (approveBtn && rejectBtn) {
          actionUrls = {
            approve: this.actionUrl(
              entityType,
              entityId,
              approveBtn.payload.action as string,
              recipient.email,
            ),
            reject: this.actionUrl(
              entityType,
              entityId,
              rejectBtn.payload.action as string,
              recipient.email,
            ),
          };
        }
      }

      const { subject, html } = toEmailHtml(msg, actionUrls);
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipient.email,
        subject,
        html,
      });

      this.logger.info({ recipient: recipient.email, template: templateName }, 'Email sent');
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, recipient: recipient.email }, 'Email send error');
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
    return { success: false, error: 'Email does not support in-place updates' };
  }
}

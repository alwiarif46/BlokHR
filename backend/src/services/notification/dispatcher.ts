import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';

/** Every notification event in the system. */
export interface NotificationEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  recipients: NotificationRecipient[];
  data: Record<string, unknown>;
  reminders?: ReminderConfig;
}

export interface NotificationRecipient {
  email: string;
  name: string;
  role: string; // 'employee', 'manager', 'hr', 'admin'
}

export interface ReminderConfig {
  /** Who to remind (email). */
  targetEmail: string;
  /** How many reminders to send. */
  count: number;
  /** Interval between reminders in minutes. */
  intervalMinutes: number;
  /** What entity action cancels the reminders. */
  cancelOnAction: string; // e.g. 'leave:approved', 'leave:rejected'
}

/** Channel adapter interface. Every notification channel implements this. */
export interface ChannelAdapter {
  readonly name: string;
  readonly isConfigured: boolean;

  /** Send a notification. Returns card reference for in-place updates. */
  send(
    recipient: NotificationRecipient,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; cardReference?: string; conversationId?: string; error?: string }>;

  /** Update an existing card in-place (e.g., mark as approved). */
  updateCard(
    conversationId: string,
    cardReference: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }>;
}

/**
 * Central notification dispatcher.
 * Receives events, routes to configured channels, manages reminders.
 * All operations are async and non-blocking — failures are logged, never thrown.
 */
export class NotificationDispatcher {
  private readonly adapters: Map<string, ChannelAdapter> = new Map();

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /** Register a channel adapter. */
  registerAdapter(adapter: ChannelAdapter): void {
    if (adapter.isConfigured) {
      this.adapters.set(adapter.name, adapter);
      this.logger.info({ channel: adapter.name }, 'Notification adapter registered');
    } else {
      this.logger.info({ channel: adapter.name }, 'Notification adapter skipped (not configured)');
    }
  }

  /** Dispatch a notification event to all configured channels. */
  async notify(event: NotificationEvent): Promise<void> {
    for (const recipient of event.recipients) {
      for (const [channelName, adapter] of this.adapters) {
        try {
          // Queue the notification
          await this.db.run(
            `INSERT INTO notification_queue
             (event_type, recipient_email, channel, payload_json, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [
              event.eventType,
              recipient.email,
              channelName,
              JSON.stringify({
                recipient,
                templateName: event.eventType,
                data: event.data,
                entityType: event.entityType,
                entityId: event.entityId,
              }),
            ],
          );

          // Send immediately (best-effort, queue is backup)
          const result = await adapter.send(recipient, event.eventType, event.data);

          if (result.success) {
            // Track the card reference for in-place updates
            if (result.cardReference || result.conversationId) {
              await this.db.run(
                `INSERT INTO notification_cards
                 (entity_type, entity_id, channel, recipient_email, card_reference, conversation_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  event.entityType,
                  event.entityId,
                  channelName,
                  recipient.email,
                  result.cardReference ?? '',
                  result.conversationId ?? '',
                ],
              );
            }

            // Mark queue entry as delivered
            await this.db.run(
              `UPDATE notification_queue SET status = 'delivered', processed_at = datetime('now')
               WHERE event_type = ? AND recipient_email = ? AND channel = ? AND status = 'pending'
               ORDER BY created_at DESC LIMIT 1`,
              [event.eventType, recipient.email, channelName],
            );
          } else {
            this.logger.warn(
              { channel: channelName, recipient: recipient.email, error: result.error },
              'Notification send failed — queued for retry',
            );
          }
        } catch (err) {
          this.logger.error(
            { err, channel: channelName, recipient: recipient.email, event: event.eventType },
            'Notification dispatch error',
          );
        }
      }
    }

    // Schedule reminders if configured
    if (event.reminders) {
      await this.scheduleReminders(event);
    }
  }

  /** Update all cards for an entity (e.g., mark leave as approved across all channels). */
  async updateCards(
    entityType: string,
    entityId: string,
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    interface CardRow {
      [key: string]: unknown;
      channel: string;
      recipient_email: string;
      card_reference: string;
      conversation_id: string;
    }

    const cards = await this.db.all<CardRow>(
      'SELECT * FROM notification_cards WHERE entity_type = ? AND entity_id = ? AND status = ?',
      [entityType, entityId, 'sent'],
    );

    for (const card of cards) {
      const adapter = this.adapters.get(card.channel);
      if (!adapter) continue;

      try {
        const result = await adapter.updateCard(
          card.conversation_id,
          card.card_reference,
          templateName,
          data,
        );

        if (result.success) {
          await this.db.run(
            "UPDATE notification_cards SET status = 'updated', updated_at = datetime('now') WHERE entity_type = ? AND entity_id = ? AND channel = ? AND recipient_email = ?",
            [entityType, entityId, card.channel, card.recipient_email],
          );
        }
      } catch (err) {
        this.logger.error(
          { err, channel: card.channel, entityType, entityId },
          'Card update failed',
        );
      }
    }
  }

  /** Cancel pending reminders for an entity. */
  async cancelReminders(entityType: string, entityId: string): Promise<void> {
    await this.db.run(
      "UPDATE notification_queue SET status = 'failed', error = 'cancelled' WHERE payload_json LIKE ? AND status = 'pending' AND event_type LIKE '%:reminder'",
      [`%"entityId":"${entityId}"%`],
    );
    this.logger.info({ entityType, entityId }, 'Reminders cancelled');
  }

  /** Schedule reminder notifications. */
  private async scheduleReminders(event: NotificationEvent): Promise<void> {
    const config = event.reminders;
    if (!config) return;

    for (let i = 1; i <= config.count; i++) {
      const delayMinutes = config.intervalMinutes * i;
      const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

      for (const [channelName] of this.adapters) {
        await this.db.run(
          `INSERT INTO notification_queue
           (event_type, recipient_email, channel, payload_json, status, next_retry_at)
           VALUES (?, ?, ?, ?, 'pending', ?)`,
          [
            event.eventType + ':reminder',
            config.targetEmail,
            channelName,
            JSON.stringify({
              recipient: { email: config.targetEmail, name: '', role: 'approver' },
              templateName: event.eventType + ':reminder',
              data: { ...event.data, reminderNumber: i, totalReminders: config.count },
              entityType: event.entityType,
              entityId: event.entityId,
            }),
            sendAt,
          ],
        );
      }
    }

    this.logger.info(
      {
        entityType: event.entityType,
        entityId: event.entityId,
        count: config.count,
        target: config.targetEmail,
      },
      'Reminders scheduled',
    );
  }

  /** Process due reminders (called by scheduler). */
  async processReminders(): Promise<number> {
    interface QueueRow {
      [key: string]: unknown;
      id: number;
      event_type: string;
      recipient_email: string;
      channel: string;
      payload_json: string;
      attempts: number;
      max_attempts: number;
    }

    const now = new Date().toISOString();
    const dueReminders = await this.db.all<QueueRow>(
      `SELECT * FROM notification_queue
       WHERE status = 'pending' AND event_type LIKE '%:reminder'
       AND next_retry_at <= ? AND attempts < max_attempts
       ORDER BY next_retry_at ASC LIMIT 50`,
      [now],
    );

    let processed = 0;
    for (const reminder of dueReminders) {
      const adapter = this.adapters.get(reminder.channel);
      if (!adapter) continue;

      try {
        const payload = JSON.parse(reminder.payload_json) as {
          recipient: NotificationRecipient;
          templateName: string;
          data: Record<string, unknown>;
        };

        const result = await adapter.send(payload.recipient, payload.templateName, payload.data);

        if (result.success) {
          await this.db.run(
            "UPDATE notification_queue SET status = 'delivered', processed_at = datetime('now'), attempts = attempts + 1 WHERE id = ?",
            [reminder.id],
          );
          processed++;
        } else {
          await this.db.run(
            'UPDATE notification_queue SET attempts = attempts + 1, error = ? WHERE id = ?',
            [result.error ?? 'send failed', reminder.id],
          );
        }
      } catch (err) {
        await this.db.run(
          'UPDATE notification_queue SET attempts = attempts + 1, error = ? WHERE id = ?',
          [err instanceof Error ? err.message : 'unknown error', reminder.id],
        );
      }
    }

    return processed;
  }

  /** Get count of registered adapters. */
  get adapterCount(): number {
    return this.adapters.size;
  }
}

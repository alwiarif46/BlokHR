import type { Logger } from 'pino';

export interface DomainEvent {
  type: string;
  tenantId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface EventPublisher {
  publish(e: DomainEvent): Promise<void>;
}

export class LogEventPublisher implements EventPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(e: DomainEvent): Promise<void> {
    this.logger.info({ event: e }, 'domain_event');
  }
}

export class HttpEventPublisher implements EventPublisher {
  constructor(
    private readonly logger: Logger,
    private readonly sinkUrl: string | undefined = process.env.EVENT_SINK_URL,
  ) {}

  async publish(e: DomainEvent): Promise<void> {
    if (!this.sinkUrl) return;
    try {
      await fetch(this.sinkUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.INTERNAL_SECRET
            ? { 'X-Blok-Internal': process.env.INTERNAL_SECRET }
            : {}),
        },
        body: JSON.stringify(e),
      });
    } catch (err) {
      this.logger.warn({ err, eventType: e.type }, 'event_sink_publish_failed');
    }
  }
}

/** Platform notification sink — same swallow-errors rule as EventPublisher. */
export interface NotifyPayload {
  channel: string;
  address: string;
  body: string;
}

export interface NotifySink {
  send(payload: NotifyPayload): Promise<void>;
}

export class HttpNotifySink implements NotifySink {
  constructor(
    private readonly logger: Logger,
    private readonly sinkUrl: string | undefined = process.env.NOTIFY_SINK_URL,
  ) {}

  async send(payload: NotifyPayload): Promise<void> {
    if (!this.sinkUrl) return;
    try {
      await fetch(this.sinkUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.warn({ err, channel: payload.channel }, 'notify_sink_failed');
    }
  }
}

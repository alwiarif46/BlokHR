import type { Logger } from 'pino';

export interface DomainEvent {
  type: string;
  tenantId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export class LogEventPublisher implements EventPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(event: DomainEvent): Promise<void> {
    this.logger.info({ event }, 'domain_event');
  }
}

export class HttpEventPublisher implements EventPublisher {
  constructor(
    private readonly logger: Logger,
    private readonly sinkUrl: string = process.env.EVENT_SINK_URL || '',
    private readonly internalSecret: string = process.env.INTERNAL_SECRET || '',
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    if (!this.sinkUrl) {
      this.logger.info({ event }, 'domain_event');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.internalSecret) headers['X-Blok-Internal'] = this.internalSecret;
      await fetch(this.sinkUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
    } catch (err) {
      this.logger.warn({ err, event }, 'event_publish_failed');
    }
  }
}

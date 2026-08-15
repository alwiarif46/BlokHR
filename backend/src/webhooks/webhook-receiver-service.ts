import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface WebhookLogRow {
  [key: string]: unknown;
  id: number;
  source: string;
  event_type: string;
  payload_json: string;
  headers_json: string;
  processed: number;
  created_at: string;
}

export interface WebhookLogEntry {
  id: number;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  processed: boolean;
  createdAt: string;
}

/** Webhook handler function. Returns true if processed successfully. */
export type WebhookHandler = (
  source: string,
  eventType: string,
  payload: Record<string, unknown>,
  headers: Record<string, unknown>,
) => Promise<boolean>;

/** Known inbound webhook sources with their expected payload shapes. */
export const WEBHOOK_SOURCES = [
  'payroll',
  'hris',
  'calendar',
  'erp',
  'custom',
] as const;

export type WebhookSource = (typeof WEBHOOK_SOURCES)[number];

export class WebhookReceiverService {
  private readonly handlers: Map<string, WebhookHandler> = new Map();

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /**
   * Register a handler for a specific source.
   * When a webhook arrives from this source, the handler is called after logging.
   */
  registerHandler(source: string, handler: WebhookHandler): void {
    this.handlers.set(source, handler);
    this.logger.info({ source }, 'Webhook handler registered');
  }

  /**
   * Receive an inbound webhook: log it, then process if a handler exists.
   */
  async receive(data: {
    source: string;
    eventType?: string;
    payload: Record<string, unknown>;
    headers: Record<string, unknown>;
  }): Promise<{ id: number; processed: boolean; error?: string }> {
    // Always log first — even if processing fails, we have the raw payload
    const id = await this.logWebhook(data);

    // Route to handler
    const handler = this.handlers.get(data.source);
    if (!handler) {
      this.logger.info(
        { source: data.source, webhookId: id },
        'Webhook received — no handler registered (logged only)',
      );
      return { id, processed: false };
    }

    try {
      const success = await handler(
        data.source,
        data.eventType ?? '',
        data.payload,
        data.headers,
      );

      if (success) {
        await this.markProcessed(id);
        this.logger.info({ source: data.source, webhookId: id }, 'Webhook processed');
      }

      return { id, processed: success };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        { source: data.source, webhookId: id, err: msg },
        'Webhook handler failed',
      );
      return { id, processed: false, error: msg };
    }
  }

  /**
   * Replay a previously logged webhook (re-run the handler).
   * Useful for retrying failed webhooks or reprocessing after a bug fix.
   */
  async replay(webhookId: number): Promise<{ processed: boolean; error?: string }> {
    const row = await this.db.get<WebhookLogRow>(
      'SELECT * FROM webhook_inbound_log WHERE id = ?', [webhookId],
    );
    if (!row) return { processed: false, error: 'Webhook log entry not found' };

    let payload: Record<string, unknown> = {};
    let headers: Record<string, unknown> = {};
    try { payload = JSON.parse(row.payload_json); } catch { /* empty */ }
    try { headers = JSON.parse(row.headers_json); } catch { /* empty */ }

    const handler = this.handlers.get(row.source);
    if (!handler) return { processed: false, error: `No handler for source: ${row.source}` };

    try {
      const success = await handler(row.source, row.event_type, payload, headers);
      if (success) await this.markProcessed(webhookId);
      return { processed: success };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { processed: false, error: msg };
    }
  }

  /** Query webhook logs with filters. */
  async query(filters: {
    source?: string;
    eventType?: string;
    processed?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: WebhookLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.source) { conditions.push('source = ?'); params.push(filters.source); }
    if (filters.eventType) { conditions.push('event_type = ?'); params.push(filters.eventType); }
    if (filters.processed !== undefined) { conditions.push('processed = ?'); params.push(filters.processed ? 1 : 0); }
    if (filters.startDate) { conditions.push('created_at >= ?'); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push('created_at <= ?'); params.push(filters.endDate + 'T23:59:59'); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) as cnt FROM webhook_inbound_log ${where}`, params,
    );
    const total = countRow?.cnt ?? 0;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const rows = await this.db.all<WebhookLogRow>(
      `SELECT * FROM webhook_inbound_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { entries: rows.map(r => this.toEntry(r)), total };
  }

  /** Get a single webhook log entry. */
  async getById(id: number): Promise<WebhookLogEntry | null> {
    const row = await this.db.get<WebhookLogRow>(
      'SELECT * FROM webhook_inbound_log WHERE id = ?', [id],
    );
    return row ? this.toEntry(row) : null;
  }

  /** Get stats: total, processed, unprocessed per source. */
  async getStats(): Promise<Array<{ source: string; total: number; processed: number; unprocessed: number }>> {
    return this.db.all<{ source: string; total: number; processed: number; unprocessed: number; [key: string]: unknown }>(
      `SELECT source,
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed
       FROM webhook_inbound_log GROUP BY source ORDER BY source`,
      [],
    );
  }

  // ── Private ──

  private async logWebhook(data: {
    source: string;
    eventType?: string;
    payload: Record<string, unknown>;
    headers: Record<string, unknown>;
  }): Promise<number> {
    await this.db.run(
      `INSERT INTO webhook_inbound_log (source, event_type, payload_json, headers_json)
       VALUES (?, ?, ?, ?)`,
      [
        data.source,
        data.eventType ?? '',
        JSON.stringify(data.payload),
        JSON.stringify(data.headers),
      ],
    );
    const row = await this.db.get<{ id: number; [key: string]: unknown }>(
      'SELECT MAX(id) as id FROM webhook_inbound_log WHERE source = ?', [data.source],
    );
    return row?.id ?? 0;
  }

  private async markProcessed(id: number): Promise<void> {
    await this.db.run('UPDATE webhook_inbound_log SET processed = 1 WHERE id = ?', [id]);
  }

  private toEntry(row: WebhookLogRow): WebhookLogEntry {
    let payload: Record<string, unknown> = {};
    let headers: Record<string, unknown> = {};
    try { payload = JSON.parse(row.payload_json); } catch { /* empty */ }
    try { headers = JSON.parse(row.headers_json); } catch { /* empty */ }
    return {
      id: row.id,
      source: row.source,
      eventType: row.event_type,
      payload,
      headers,
      processed: row.processed === 1,
      createdAt: row.created_at,
    };
  }
}

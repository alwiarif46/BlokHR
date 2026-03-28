import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface AuditLogRow {
  [key: string]: unknown;
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_email: string;
  actor_name: string;
  detail_json: string;
  ip_address: string;
  correlation_id: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string;
  actorName: string;
  detail: Record<string, unknown>;
  ipAddress: string;
  correlationId: string;
  createdAt: string;
}

/** Fields to redact from audit detail_json before storing. */
const PII_FIELDS = new Set([
  'password', 'token', 'secret', 'apikey', 'api_key',
  'aadhaar', 'aadhaar_number', 'pan_number', 'bank_account_number',
  'credit_card', 'ssn', 'social_security',
]);

/** Redact PII fields from an object (shallow — does not recurse into nested objects). */
function redactPii(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class AuditService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /**
   * Log an audit entry. Called by any service after a write operation.
   * detail is automatically PII-redacted before storage.
   */
  async log(data: {
    entityType: string;
    entityId: string;
    action: string;
    actorEmail: string;
    actorName?: string;
    detail?: Record<string, unknown>;
    ipAddress?: string;
    correlationId?: string;
  }): Promise<void> {
    const safeDetail = data.detail ? redactPii(data.detail) : {};
    await this.db.run(
      `INSERT INTO audit_log (entity_type, entity_id, action, actor_email, actor_name,
        detail_json, ip_address, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.entityType,
        data.entityId,
        data.action,
        data.actorEmail,
        data.actorName ?? '',
        JSON.stringify(safeDetail),
        data.ipAddress ?? '',
        data.correlationId ?? '',
      ],
    );
    this.logger.debug(
      { entityType: data.entityType, entityId: data.entityId, action: data.action, actor: data.actorEmail },
      'Audit entry logged',
    );
  }

  /** Query audit logs with filters. */
  async query(filters: {
    entityType?: string;
    entityId?: string;
    action?: string;
    actorEmail?: string;
    startDate?: string;
    endDate?: string;
    correlationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.entityType) { conditions.push('entity_type = ?'); params.push(filters.entityType); }
    if (filters.entityId) { conditions.push('entity_id = ?'); params.push(filters.entityId); }
    if (filters.action) { conditions.push('action = ?'); params.push(filters.action); }
    if (filters.actorEmail) { conditions.push('actor_email = ?'); params.push(filters.actorEmail); }
    if (filters.correlationId) { conditions.push('correlation_id = ?'); params.push(filters.correlationId); }
    if (filters.startDate) { conditions.push('created_at >= ?'); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push('created_at <= ?'); params.push(filters.endDate + 'T23:59:59'); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) as cnt FROM audit_log ${where}`, params,
    );
    const total = countRow?.cnt ?? 0;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const rows = await this.db.all<AuditLogRow>(
      `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const entries = rows.map((r) => this.toEntry(r));
    return { entries, total };
  }

  /** Get a single audit entry by ID. */
  async getById(id: number): Promise<AuditLogEntry | null> {
    const row = await this.db.get<AuditLogRow>('SELECT * FROM audit_log WHERE id = ?', [id]);
    return row ? this.toEntry(row) : null;
  }

  /** Get all audit entries for a specific entity. */
  async getEntityHistory(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    const rows = await this.db.all<AuditLogRow>(
      'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC',
      [entityType, entityId],
    );
    return rows.map((r) => this.toEntry(r));
  }

  /** Get distinct entity types in the log (for filter dropdowns). */
  async getEntityTypes(): Promise<string[]> {
    const rows = await this.db.all<{ entity_type: string; [key: string]: unknown }>(
      'SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type', [],
    );
    return rows.map((r) => r.entity_type);
  }

  /** Get distinct actions for an entity type. */
  async getActions(entityType?: string): Promise<string[]> {
    const conditions = entityType ? 'WHERE entity_type = ?' : '';
    const params = entityType ? [entityType] : [];
    const rows = await this.db.all<{ action: string; [key: string]: unknown }>(
      `SELECT DISTINCT action FROM audit_log ${conditions} ORDER BY action`, params,
    );
    return rows.map((r) => r.action);
  }

  private toEntry(row: AuditLogRow): AuditLogEntry {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(row.detail_json); } catch { /* empty */ }
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      actorEmail: row.actor_email,
      actorName: row.actor_name,
      detail,
      ipAddress: row.ip_address,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
    };
  }
}

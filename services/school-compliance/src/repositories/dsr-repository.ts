import type { SchoolComplianceDb } from '../db';
import type {
  DataRequest,
  DataRequestAudit,
  DataRequestKind,
  DataRequestState,
} from '../types';

interface RequestRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_ref: string;
  guardian_ref: string;
  kind: string;
  state: string;
  details_json: string;
  sla_due_on: string;
  resolution_note: string | null;
  handled_by: string | null;
  overdue_emitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  request_id: string;
  from_state: string;
  to_state: string;
  actor: string;
  at: string;
}

function parseDetails(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function mapRequest(row: RequestRow): DataRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentRef: row.student_ref,
    guardianRef: row.guardian_ref,
    kind: row.kind as DataRequestKind,
    state: row.state as DataRequestState,
    details: parseDetails(row.details_json),
    slaDueOn: row.sla_due_on,
    resolutionNote: row.resolution_note,
    handledBy: row.handled_by,
    overdueEmittedAt: row.overdue_emitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditRow): DataRequestAudit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    requestId: row.request_id,
    fromState: row.from_state as DataRequestState,
    toState: row.to_state as DataRequestState,
    actor: row.actor,
    at: row.at,
  };
}

export class DsrRepository {
  constructor(private readonly db: SchoolComplianceDb) {}

  async getConfig(tenantId: string, key: string): Promise<string | null> {
    const row = await this.db.get<{ value: string }>(
      `SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?`,
      [tenantId, key],
    );
    return row?.value ?? null;
  }

  async setConfig(tenantId: string, key: string, value: string): Promise<void> {
    await this.db.run(
      `INSERT INTO tenant_config (tenant_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`,
      [tenantId, key, value],
    );
  }

  async insertRequest(req: DataRequest): Promise<DataRequest> {
    await this.db.run(
      `INSERT INTO data_requests (
         id, tenant_id, student_ref, guardian_ref, kind, state, details_json,
         sla_due_on, resolution_note, handled_by, overdue_emitted_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.id,
        req.tenantId,
        req.studentRef,
        req.guardianRef,
        req.kind,
        req.state,
        JSON.stringify(req.details),
        req.slaDueOn,
        req.resolutionNote,
        req.handledBy,
        req.overdueEmittedAt,
        req.createdAt,
        req.updatedAt,
      ],
    );
    const row = await this.db.get<RequestRow>(
      `SELECT * FROM data_requests WHERE tenant_id = ? AND id = ?`,
      [req.tenantId, req.id],
    );
    if (!row) throw new Error('Failed to read inserted data request');
    return mapRequest(row);
  }

  async getRequest(
    tenantId: string,
    id: string,
  ): Promise<DataRequest | null> {
    const row = await this.db.get<RequestRow>(
      `SELECT * FROM data_requests WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return row ? mapRequest(row) : null;
  }

  async listRequests(
    tenantId: string,
    opts: {
      state?: string;
      overdueOnly?: boolean;
      todayIso?: string;
      studentRef?: string;
      guardianRef?: string;
    },
  ): Promise<DataRequest[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (opts.state) {
      clauses.push('state = ?');
      params.push(opts.state);
    }
    if (opts.studentRef) {
      clauses.push('student_ref = ?');
      params.push(opts.studentRef);
    }
    if (opts.guardianRef) {
      clauses.push('guardian_ref = ?');
      params.push(opts.guardianRef);
    }
    if (opts.overdueOnly && opts.todayIso) {
      clauses.push(`sla_due_on < ?`);
      clauses.push(`state NOT IN ('completed', 'rejected')`);
      params.push(opts.todayIso);
    }
    const rows = await this.db.all<RequestRow>(
      `SELECT * FROM data_requests
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at ASC`,
      params,
    );
    return rows.map(mapRequest);
  }

  async updateRequest(req: DataRequest): Promise<DataRequest> {
    await this.db.run(
      `UPDATE data_requests SET
         state = ?, details_json = ?, resolution_note = ?, handled_by = ?,
         overdue_emitted_at = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        req.state,
        JSON.stringify(req.details),
        req.resolutionNote,
        req.handledBy,
        req.overdueEmittedAt,
        req.updatedAt,
        req.tenantId,
        req.id,
      ],
    );
    const row = await this.getRequest(req.tenantId, req.id);
    if (!row) throw new Error('Failed to read updated data request');
    return row;
  }

  async insertAudit(audit: DataRequestAudit): Promise<DataRequestAudit> {
    await this.db.run(
      `INSERT INTO data_request_audit (
         id, tenant_id, request_id, from_state, to_state, actor, at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id,
        audit.tenantId,
        audit.requestId,
        audit.fromState,
        audit.toState,
        audit.actor,
        audit.at,
      ],
    );
    const row = await this.db.get<AuditRow>(
      `SELECT * FROM data_request_audit WHERE tenant_id = ? AND id = ?`,
      [audit.tenantId, audit.id],
    );
    if (!row) throw new Error('Failed to read inserted audit');
    return mapAudit(row);
  }

  async listAudit(
    tenantId: string,
    requestId: string,
  ): Promise<DataRequestAudit[]> {
    const rows = await this.db.all<AuditRow>(
      `SELECT * FROM data_request_audit
       WHERE tenant_id = ? AND request_id = ?
       ORDER BY at ASC`,
      [tenantId, requestId],
    );
    return rows.map(mapAudit);
  }

  async listOverdueUnnotified(
    tenantId: string,
    todayIso: string,
  ): Promise<DataRequest[]> {
    const rows = await this.db.all<RequestRow>(
      `SELECT * FROM data_requests
       WHERE tenant_id = ?
         AND sla_due_on < ?
         AND state NOT IN ('completed', 'rejected')
         AND overdue_emitted_at IS NULL
       ORDER BY sla_due_on ASC`,
      [tenantId, todayIso],
    );
    return rows.map(mapRequest);
  }
}

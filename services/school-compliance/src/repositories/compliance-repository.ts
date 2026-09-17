import type { SchoolComplianceDb } from '../db';
import { currentComplianceDb } from '../db-context';
import type {
  ComplianceAuthority,
  ComplianceItem,
  ComplianceItemKey,
  ComplianceStatusState,
  ExportErrorGroup,
  ExportKind,
  ExportRun,
  ExportRunState,
  TenantComplianceStatus,
} from '../types';
import { parseDueRule } from '../services/due-math';

interface ItemRow extends Record<string, unknown> {
  id: string;
  tenant_id: string | null;
  key: string;
  label: string;
  authority: string;
  due_rule_json: string;
  guidance: string;
  created_at: string;
}

interface StatusRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  item_key: string;
  academic_session_ref: string;
  state: string;
  note: string | null;
  updated_by: string;
  updated_at: string;
}

function mapItem(row: ItemRow): ComplianceItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    key: row.key as ComplianceItemKey,
    label: row.label,
    authority: row.authority as ComplianceAuthority,
    dueRule: parseDueRule(row.due_rule_json),
    guidance: row.guidance,
    createdAt: row.created_at,
  };
}

function mapStatus(row: StatusRow): TenantComplianceStatus {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    itemKey: row.item_key as ComplianceItemKey,
    academicSessionRef: row.academic_session_ref,
    state: row.state as ComplianceStatusState,
    note: row.note,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export class ComplianceRepository {
  constructor(private readonly fallbackDb: SchoolComplianceDb) {}

  private get db(): SchoolComplianceDb {
    return currentComplianceDb(this.fallbackDb);
  }

  async listItemsForTenant(tenantId: string): Promise<ComplianceItem[]> {
    const rows = await this.db.all<ItemRow>(
      `SELECT * FROM compliance_items
       WHERE tenant_id IS NULL OR tenant_id = ?
       ORDER BY key ASC`,
      [tenantId],
    );
    // Prefer tenant override over global for same key
    const byKey = new Map<string, ComplianceItem>();
    for (const row of rows) {
      const item = mapItem(row);
      const existing = byKey.get(item.key);
      if (!existing || item.tenantId != null) {
        byKey.set(item.key, item);
      }
    }
    return [...byKey.values()];
  }

  async getItemByKey(
    tenantId: string,
    key: string,
  ): Promise<ComplianceItem | null> {
    const items = await this.listItemsForTenant(tenantId);
    return items.find((i) => i.key === key) ?? null;
  }

  async getStatus(
    tenantId: string,
    itemKey: string,
    session: string,
  ): Promise<TenantComplianceStatus | null> {
    const row = await this.db.get<StatusRow>(
      `SELECT * FROM tenant_compliance_status
       WHERE tenant_id = ? AND item_key = ? AND academic_session_ref = ?`,
      [tenantId, itemKey, session],
    );
    return row ? mapStatus(row) : null;
  }

  async listStatuses(
    tenantId: string,
    session: string,
  ): Promise<TenantComplianceStatus[]> {
    const rows = await this.db.all<StatusRow>(
      `SELECT * FROM tenant_compliance_status
       WHERE tenant_id = ? AND academic_session_ref = ?`,
      [tenantId, session],
    );
    return rows.map(mapStatus);
  }

  async upsertStatus(s: TenantComplianceStatus): Promise<TenantComplianceStatus> {
    const existing = await this.getStatus(s.tenantId, s.itemKey, s.academicSessionRef);
    if (existing) {
      await this.db.run(
        `UPDATE tenant_compliance_status
         SET state = ?, note = ?, updated_by = ?, updated_at = ?
         WHERE tenant_id = ? AND item_key = ? AND academic_session_ref = ?`,
        [
          s.state,
          s.note,
          s.updatedBy,
          s.updatedAt,
          s.tenantId,
          s.itemKey,
          s.academicSessionRef,
        ],
      );
    } else {
      await this.db.run(
        `INSERT INTO tenant_compliance_status (
           id, tenant_id, item_key, academic_session_ref, state, note, updated_by, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.tenantId,
          s.itemKey,
          s.academicSessionRef,
          s.state,
          s.note,
          s.updatedBy,
          s.updatedAt,
        ],
      );
    }
    const saved = await this.getStatus(s.tenantId, s.itemKey, s.academicSessionRef);
    if (!saved) throw new Error('Failed to read upserted status');
    return saved;
  }

  async insertExportRun(r: ExportRun): Promise<ExportRun> {
    await this.db.run(
      `INSERT INTO export_runs (
         id, tenant_id, kind, academic_session_ref, state, total, passing, failing,
         file_ref, errors_json, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.kind,
        r.academicSessionRef,
        r.state,
        r.total,
        r.passing,
        r.failing,
        r.fileRef,
        r.errors == null ? null : JSON.stringify(r.errors),
        r.createdBy,
        r.createdAt,
      ],
    );
    const created = await this.getExportRun(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted export run');
    return created;
  }

  async updateExportRun(r: ExportRun): Promise<ExportRun | null> {
    await this.db.run(
      `UPDATE export_runs SET
         state = ?, total = ?, passing = ?, failing = ?, file_ref = ?, errors_json = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        r.state,
        r.total,
        r.passing,
        r.failing,
        r.fileRef,
        r.errors == null ? null : JSON.stringify(r.errors),
        r.tenantId,
        r.id,
      ],
    );
    return this.getExportRun(r.tenantId, r.id);
  }

  async getExportRun(tenantId: string, id: string): Promise<ExportRun | null> {
    const row = await this.db.get<ExportRow>(
      'SELECT * FROM export_runs WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapExport(row) : null;
  }

  async listExportRuns(
    tenantId: string,
    kind?: ExportKind,
  ): Promise<ExportRun[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (kind) {
      clauses.push('kind = ?');
      params.push(kind);
    }
    const rows = await this.db.all<ExportRow>(
      `SELECT * FROM export_runs
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    );
    return rows.map(mapExport);
  }
}

interface ExportRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  kind: string;
  academic_session_ref: string;
  state: string;
  total: number;
  passing: number;
  failing: number;
  file_ref: string | null;
  errors_json: string | null;
  created_by: string;
  created_at: string;
}

function mapExport(row: ExportRow): ExportRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind as ExportKind,
    academicSessionRef: row.academic_session_ref,
    state: row.state as ExportRunState,
    total: row.total,
    passing: row.passing,
    failing: row.failing,
    fileRef: row.file_ref,
    errors:
      row.errors_json == null
        ? null
        : (JSON.parse(row.errors_json) as ExportErrorGroup[]),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

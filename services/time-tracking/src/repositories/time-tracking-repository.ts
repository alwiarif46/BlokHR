import type { TimeTrackingDb } from '../db';

export interface ClientRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  billing_rate_hourly: number;
  currency: string;
  contact_name: string;
  contact_email: string;
  active: number;
}

export interface ProjectRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  code: string;
  billable: number;
  billing_rate_hourly: number | null;
  budget_hours: number | null;
  budget_amount: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface TimeEntryRow {
  [key: string]: unknown;
  id: number;
  tenant_id: string;
  email: string;
  project_id: string;
  date: string;
  hours: number;
  description: string;
  billable: number;
  billing_rate_hourly: number | null;
  approved: number;
  approved_by: string;
}

const CLIENT_COL_MAP: Record<string, string> = {
  name: 'name',
  code: 'code',
  billingRate: 'billing_rate_hourly',
  currency: 'currency',
  contactName: 'contact_name',
  contactEmail: 'contact_email',
  active: 'active',
};

const PROJECT_COL_MAP: Record<string, string> = {
  name: 'name',
  code: 'code',
  clientId: 'client_id',
  billable: 'billable',
  billingRate: 'billing_rate_hourly',
  budgetHours: 'budget_hours',
  budgetAmount: 'budget_amount',
  status: 'status',
  startDate: 'start_date',
  endDate: 'end_date',
};

const ENTRY_COL_MAP: Record<string, string> = {
  hours: 'hours',
  description: 'description',
  billable: 'billable',
  billingRate: 'billing_rate_hourly',
  projectId: 'project_id',
  date: 'date',
};

function buildUpdate(
  colMap: Record<string, string>,
  fields: Record<string, unknown>,
): { sets: string[]; vals: unknown[] } {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    const col = colMap[key];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
  }
  return { sets, vals };
}

export class TimeTrackingRepository {
  constructor(private readonly db: TimeTrackingDb) {}

  // ── Clients ──

  async getClients(tenantId: string, includeInactive = false): Promise<ClientRow[]> {
    const conditions: string[] = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (!includeInactive) conditions.push('active = 1');
    return this.db.all<ClientRow>(
      `SELECT * FROM clients WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params,
    );
  }

  async getClientById(tenantId: string, id: string): Promise<ClientRow | undefined> {
    return this.db.get<ClientRow>(
      'SELECT * FROM clients WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async createClient(
    tenantId: string,
    data: {
      id: string;
      name: string;
      code?: string;
      billingRate?: number;
      currency?: string;
      contactName?: string;
      contactEmail?: string;
    },
  ): Promise<ClientRow> {
    await this.db.run(
      `INSERT INTO clients (id, tenant_id, name, code, billing_rate_hourly, currency, contact_name, contact_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        tenantId,
        data.name,
        data.code ?? '',
        data.billingRate ?? 0,
        data.currency ?? 'INR',
        data.contactName ?? '',
        data.contactEmail ?? '',
      ],
    );
    const row = await this.getClientById(tenantId, data.id);
    if (!row) throw new Error('Failed to create client');
    return row;
  }

  async updateClient(
    tenantId: string,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const { sets, vals } = buildUpdate(CLIENT_COL_MAP, fields);
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE clients SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  // ── Projects ──

  async getProjects(
    tenantId: string,
    clientId?: string,
    includeInactive = false,
  ): Promise<ProjectRow[]> {
    const conditions: string[] = ['p.tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (clientId) {
      conditions.push('p.client_id = ?');
      params.push(clientId);
    }
    if (!includeInactive) conditions.push("p.status = 'active'");
    return this.db.all<ProjectRow>(
      `SELECT p.*, c.name as client_name FROM projects p
       LEFT JOIN clients c ON p.tenant_id = c.tenant_id AND p.client_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, p.name`,
      params,
    );
  }

  async getProjectById(tenantId: string, id: string): Promise<ProjectRow | undefined> {
    return this.db.get<ProjectRow>(
      'SELECT * FROM projects WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async createProject(
    tenantId: string,
    data: {
      id: string;
      clientId: string;
      name: string;
      code?: string;
      billable?: boolean;
      billingRate?: number;
      budgetHours?: number;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<ProjectRow> {
    await this.db.run(
      `INSERT INTO projects (id, tenant_id, client_id, name, code, billable, billing_rate_hourly,
         budget_hours, budget_amount, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        tenantId,
        data.clientId,
        data.name,
        data.code ?? '',
        data.billable !== false ? 1 : 0,
        data.billingRate ?? null,
        data.budgetHours ?? null,
        data.budgetAmount ?? null,
        data.startDate ?? null,
        data.endDate ?? null,
      ],
    );
    const row = await this.getProjectById(tenantId, data.id);
    if (!row) throw new Error('Failed to create project');
    return row;
  }

  async updateProject(
    tenantId: string,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const { sets, vals } = buildUpdate(PROJECT_COL_MAP, fields);
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE projects SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  // ── Time entries ──

  async getEntries(
    tenantId: string,
    filters: {
      email?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
      billable?: boolean;
    },
  ): Promise<TimeEntryRow[]> {
    const conditions: string[] = ['t.tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.email) {
      conditions.push('t.email = ?');
      params.push(filters.email);
    }
    if (filters.projectId) {
      conditions.push('t.project_id = ?');
      params.push(filters.projectId);
    }
    if (filters.startDate) {
      conditions.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('t.date <= ?');
      params.push(filters.endDate);
    }
    if (filters.billable !== undefined) {
      conditions.push('t.billable = ?');
      params.push(filters.billable ? 1 : 0);
    }
    return this.db.all<TimeEntryRow>(
      `SELECT t.*, p.name as project_name, p.client_id, c.name as client_name
       FROM time_entries t
       LEFT JOIN projects p ON t.tenant_id = p.tenant_id AND t.project_id = p.id
       LEFT JOIN clients c ON p.tenant_id = c.tenant_id AND p.client_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.date DESC, t.created_at DESC`,
      params,
    );
  }

  async getEntryById(tenantId: string, id: number): Promise<TimeEntryRow | undefined> {
    return this.db.get<TimeEntryRow>(
      'SELECT * FROM time_entries WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async createEntry(
    tenantId: string,
    data: {
      email: string;
      projectId: string;
      date: string;
      hours: number;
      description?: string;
      billable?: boolean;
      billingRate?: number;
    },
  ): Promise<TimeEntryRow> {
    await this.db.run(
      `INSERT INTO time_entries (tenant_id, email, project_id, date, hours, description, billable, billing_rate_hourly)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.email,
        data.projectId,
        data.date,
        data.hours,
        data.description ?? '',
        data.billable !== false ? 1 : 0,
        data.billingRate ?? null,
      ],
    );
    const row = await this.db.get<TimeEntryRow>(
      `SELECT * FROM time_entries
       WHERE tenant_id = ? AND email = ? AND project_id = ? AND date = ?
       ORDER BY id DESC LIMIT 1`,
      [tenantId, data.email, data.projectId, data.date],
    );
    if (!row) throw new Error('Failed to create time entry');
    return row;
  }

  async updateEntry(
    tenantId: string,
    id: number,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const { sets, vals } = buildUpdate(ENTRY_COL_MAP, fields);
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(tenantId, id);
    await this.db.run(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  async deleteEntry(tenantId: string, id: number): Promise<void> {
    await this.db.run(
      'DELETE FROM time_entries WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async approveEntry(tenantId: string, id: number, approverEmail: string): Promise<void> {
    await this.db.run(
      `UPDATE time_entries
       SET approved = 1, approved_by = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [approverEmail, tenantId, id],
    );
  }

  // ── Aggregation ──

  async getSummary(
    tenantId: string,
    filters: {
      email?: string;
      projectId?: string;
      clientId?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    entries: number;
  }> {
    const conditions: string[] = ['t.tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.email) {
      conditions.push('t.email = ?');
      params.push(filters.email);
    }
    if (filters.projectId) {
      conditions.push('t.project_id = ?');
      params.push(filters.projectId);
    }
    if (filters.clientId) {
      conditions.push('p.client_id = ?');
      params.push(filters.clientId);
    }
    if (filters.startDate) {
      conditions.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('t.date <= ?');
      params.push(filters.endDate);
    }

    const row = await this.db.get<{
      total_hours: number;
      billable_hours: number;
      nonbillable_hours: number;
      billable_amount: number;
      entry_count: number;
      [key: string]: unknown;
    }>(
      `SELECT
         COALESCE(SUM(t.hours), 0) as total_hours,
         COALESCE(SUM(CASE WHEN t.billable = 1 THEN t.hours ELSE 0 END), 0) as billable_hours,
         COALESCE(SUM(CASE WHEN t.billable = 0 THEN t.hours ELSE 0 END), 0) as nonbillable_hours,
         COALESCE(SUM(CASE WHEN t.billable = 1 THEN t.hours * COALESCE(t.billing_rate_hourly, p.billing_rate_hourly, c.billing_rate_hourly, 0) ELSE 0 END), 0) as billable_amount,
         COUNT(*) as entry_count
       FROM time_entries t
       LEFT JOIN projects p ON t.tenant_id = p.tenant_id AND t.project_id = p.id
       LEFT JOIN clients c ON p.tenant_id = c.tenant_id AND p.client_id = c.id
       WHERE ${conditions.join(' AND ')}`,
      params,
    );

    return {
      totalHours: row?.total_hours ?? 0,
      billableHours: row?.billable_hours ?? 0,
      nonBillableHours: row?.nonbillable_hours ?? 0,
      billableAmount: row?.billable_amount ?? 0,
      entries: row?.entry_count ?? 0,
    };
  }
}

import type { Logger } from 'pino';
import type { EventPublisher } from '../events';
import type {
  TimeTrackingRepository,
  ClientRow,
  ProjectRow,
  TimeEntryRow,
} from '../repositories/time-tracking-repository';
import type { Role } from '../role-guard';

export interface ClientView {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  billingRate: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  active: boolean;
}

export interface ProjectView {
  id: string;
  tenantId: string;
  clientId: string;
  clientName?: string;
  name: string;
  code: string;
  billable: boolean;
  billingRate: number | null;
  budgetHours: number | null;
  budgetAmount: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface TimeEntryView {
  id: number;
  tenantId: string;
  email: string;
  projectId: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  billingRate: number | null;
  approved: boolean;
  approvedBy: string;
}

export interface Actor {
  email: string;
  role: Role;
}

type ServiceResult<T> = { success: true } & T | { success: false; error: string; status?: number };

/** Employees are scoped to their own email; higher roles see everything. */
function selfScopedEmail(actor: Actor, requested?: string): string | undefined {
  if (actor.role === 'employee') return actor.email;
  return requested;
}

/** Employees can only mutate their own entries. */
function canMutateEntry(actor: Actor, entryEmail: string): boolean {
  if (actor.role === 'employee') return entryEmail === actor.email;
  return true;
}

export class TimeTrackingService {
  constructor(
    private readonly repo: TimeTrackingRepository,
    private readonly logger: Logger,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ── Clients ──

  async getClients(tenantId: string, includeInactive = false): Promise<ClientView[]> {
    const rows = await this.repo.getClients(tenantId, includeInactive);
    return rows.map((r) => this.toClientView(r));
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
  ): Promise<ServiceResult<{ client: ClientView }>> {
    if (!data.id?.trim()) return { success: false, error: 'Client ID is required', status: 400 };
    if (!data.name?.trim()) return { success: false, error: 'Client name is required', status: 400 };
    const existing = await this.repo.getClientById(tenantId, data.id);
    if (existing) return { success: false, error: 'Client ID already exists', status: 409 };
    try {
      const row = await this.repo.createClient(tenantId, data);
      this.logger.info({ tenantId, clientId: data.id }, 'Client created');
      return { success: true, client: this.toClientView(row) };
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return { success: false, error: 'Client ID already exists', status: 409 };
      }
      throw err;
    }
  }

  async updateClient(
    tenantId: string,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<ServiceResult<{ client: ClientView }>> {
    const existing = await this.repo.getClientById(tenantId, id);
    if (!existing) return { success: false, error: 'Client not found', status: 404 };
    await this.repo.updateClient(tenantId, id, fields);
    const updated = await this.repo.getClientById(tenantId, id);
    if (!updated) return { success: false, error: 'Client not found', status: 404 };
    return { success: true, client: this.toClientView(updated) };
  }

  // ── Projects ──

  async getProjects(tenantId: string, clientId?: string): Promise<ProjectView[]> {
    const rows = await this.repo.getProjects(tenantId, clientId);
    return rows.map((r) => this.toProjectView(r));
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
  ): Promise<ServiceResult<{ project: ProjectView }>> {
    if (!data.id?.trim()) return { success: false, error: 'Project ID is required', status: 400 };
    if (!data.clientId?.trim()) return { success: false, error: 'Client ID is required', status: 400 };
    if (!data.name?.trim()) return { success: false, error: 'Project name is required', status: 400 };

    const client = await this.repo.getClientById(tenantId, data.clientId);
    if (!client) return { success: false, error: 'Client not found', status: 404 };

    const existing = await this.repo.getProjectById(tenantId, data.id);
    if (existing) return { success: false, error: 'Project ID already exists', status: 409 };

    try {
      const row = await this.repo.createProject(tenantId, data);
      this.logger.info({ tenantId, projectId: data.id, clientId: data.clientId }, 'Project created');
      return { success: true, project: this.toProjectView(row) };
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return { success: false, error: 'Project ID already exists', status: 409 };
      }
      throw err;
    }
  }

  async updateProject(
    tenantId: string,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<ServiceResult<{ project: ProjectView }>> {
    const existing = await this.repo.getProjectById(tenantId, id);
    if (!existing) return { success: false, error: 'Project not found', status: 404 };
    await this.repo.updateProject(tenantId, id, fields);
    const updated = await this.repo.getProjectById(tenantId, id);
    if (!updated) return { success: false, error: 'Project not found', status: 404 };
    return { success: true, project: this.toProjectView(updated) };
  }

  // ── Time entries ──

  async getEntries(
    tenantId: string,
    actor: Actor,
    filters: {
      email?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
      billable?: boolean;
    },
  ): Promise<TimeEntryView[]> {
    const scopedEmail = selfScopedEmail(actor, filters.email);
    const rows = await this.repo.getEntries(tenantId, { ...filters, email: scopedEmail });
    return rows.map((r) => this.toEntryView(r));
  }

  async logTime(
    tenantId: string,
    actor: Actor,
    data: {
      email?: string;
      projectId: string;
      date: string;
      hours: number;
      description?: string;
      billable?: boolean;
      billingRate?: number;
    },
  ): Promise<ServiceResult<{ entry: TimeEntryView }>> {
    const email = selfScopedEmail(actor, data.email) ?? actor.email;
    if (!email) return { success: false, error: 'Email is required', status: 400 };
    if (!data.projectId) return { success: false, error: 'Project ID is required', status: 400 };
    if (!data.date) return { success: false, error: 'Date is required', status: 400 };
    if (!data.hours || data.hours <= 0) {
      return { success: false, error: 'Hours must be positive', status: 400 };
    }
    if (data.hours > 24) {
      return { success: false, error: 'Hours cannot exceed 24 in a single entry', status: 400 };
    }

    const project = await this.repo.getProjectById(tenantId, data.projectId);
    if (!project) return { success: false, error: 'Project not found', status: 404 };

    const billable = data.billable ?? project.billable === 1;

    let billingRate = data.billingRate ?? null;
    if (billingRate === null && billable) {
      if (project.billing_rate_hourly !== null) {
        billingRate = project.billing_rate_hourly;
      } else {
        const client = await this.repo.getClientById(tenantId, project.client_id);
        if (client) billingRate = client.billing_rate_hourly;
      }
    }

    const row = await this.repo.createEntry(tenantId, {
      email,
      projectId: data.projectId,
      date: data.date,
      hours: data.hours,
      description: data.description,
      billable,
      billingRate: billingRate ?? undefined,
    });

    this.logger.info(
      { tenantId, email, projectId: data.projectId, date: data.date, hours: data.hours, billable },
      'Time entry logged',
    );

    await this.events.publish({
      type: 'time_entry.logged',
      tenantId,
      occurredAt: this.clock().toISOString(),
      data: {
        entryId: row.id,
        email,
        projectId: data.projectId,
        date: data.date,
        hours: data.hours,
        billable,
        actor: actor.email,
      },
    });

    return { success: true, entry: this.toEntryView(row) };
  }

  async updateEntry(
    tenantId: string,
    actor: Actor,
    id: number,
    fields: Record<string, unknown>,
  ): Promise<ServiceResult<{ entry: TimeEntryView }>> {
    const existing = await this.repo.getEntryById(tenantId, id);
    if (!existing) return { success: false, error: 'Entry not found', status: 404 };
    if (!canMutateEntry(actor, existing.email)) {
      return { success: false, error: 'forbidden', status: 403 };
    }
    if (existing.approved === 1) {
      return { success: false, error: 'Cannot edit an approved entry', status: 409 };
    }
    await this.repo.updateEntry(tenantId, id, fields);
    const updated = await this.repo.getEntryById(tenantId, id);
    if (!updated) return { success: false, error: 'Entry not found', status: 404 };
    return { success: true, entry: this.toEntryView(updated) };
  }

  async deleteEntry(
    tenantId: string,
    actor: Actor,
    id: number,
  ): Promise<ServiceResult<{ deletedId: number }>> {
    const existing = await this.repo.getEntryById(tenantId, id);
    if (!existing) return { success: false, error: 'Entry not found', status: 404 };
    if (!canMutateEntry(actor, existing.email)) {
      return { success: false, error: 'forbidden', status: 403 };
    }
    if (existing.approved === 1) {
      return { success: false, error: 'Cannot delete an approved entry', status: 409 };
    }
    await this.repo.deleteEntry(tenantId, id);

    await this.events.publish({
      type: 'time_entry.deleted',
      tenantId,
      occurredAt: this.clock().toISOString(),
      data: {
        entryId: id,
        email: existing.email,
        projectId: existing.project_id,
        date: existing.date,
        hours: existing.hours,
        actor: actor.email,
      },
    });

    return { success: true, deletedId: id };
  }

  async approveEntry(
    tenantId: string,
    actor: Actor,
    id: number,
  ): Promise<ServiceResult<{ entry: TimeEntryView }>> {
    if (actor.role === 'employee') {
      return { success: false, error: 'forbidden', status: 403 };
    }
    const existing = await this.repo.getEntryById(tenantId, id);
    if (!existing) return { success: false, error: 'Entry not found', status: 404 };
    await this.repo.approveEntry(tenantId, id, actor.email);
    const updated = await this.repo.getEntryById(tenantId, id);
    if (!updated) return { success: false, error: 'Entry not found', status: 404 };

    await this.events.publish({
      type: 'time_entry.approved',
      tenantId,
      occurredAt: this.clock().toISOString(),
      data: {
        entryId: id,
        email: existing.email,
        projectId: existing.project_id,
        date: existing.date,
        hours: existing.hours,
        approver: actor.email,
      },
    });

    return { success: true, entry: this.toEntryView(updated) };
  }

  // ── Summary / reporting ──

  async getSummary(
    tenantId: string,
    actor: Actor,
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
    utilizationPercent: number;
  }> {
    const scopedEmail = selfScopedEmail(actor, filters.email);
    const raw = await this.repo.getSummary(tenantId, { ...filters, email: scopedEmail });
    const utilization =
      raw.totalHours > 0 ? Math.round((raw.billableHours / raw.totalHours) * 100) : 0;
    return { ...raw, utilizationPercent: utilization };
  }

  // ── View mappers ──

  private toClientView(r: ClientRow): ClientView {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      code: r.code,
      billingRate: r.billing_rate_hourly,
      currency: r.currency,
      contactName: r.contact_name,
      contactEmail: r.contact_email,
      active: r.active === 1,
    };
  }

  private toProjectView(r: ProjectRow): ProjectView {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      clientId: r.client_id,
      clientName: (r as { client_name?: string }).client_name,
      name: r.name,
      code: r.code,
      billable: r.billable === 1,
      billingRate: r.billing_rate_hourly,
      budgetHours: r.budget_hours,
      budgetAmount: r.budget_amount,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
    };
  }

  private toEntryView(r: TimeEntryRow): TimeEntryView {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      email: r.email,
      projectId: r.project_id,
      projectName: (r as { project_name?: string }).project_name,
      clientId: (r as { client_id?: string }).client_id,
      clientName: (r as { client_name?: string }).client_name,
      date: r.date,
      hours: r.hours,
      description: r.description,
      billable: r.billable === 1,
      billingRate: r.billing_rate_hourly,
      approved: r.approved === 1,
      approvedBy: r.approved_by,
    };
  }
}

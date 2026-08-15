import type { Logger } from 'pino';
import type {
  TimeTrackingRepository,
  ClientRow,
  ProjectRow,
  TimeEntryRow,
} from '../repositories/time-tracking-repository';

export interface ClientView {
  id: string;
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

export class TimeTrackingService {
  constructor(
    private readonly repo: TimeTrackingRepository,
    private readonly logger: Logger,
  ) {}

  // ── Clients ──

  async getClients(includeInactive = false): Promise<ClientView[]> {
    const rows = await this.repo.getClients(includeInactive);
    return rows.map((r) => this.toClientView(r));
  }

  async createClient(data: {
    id: string;
    name: string;
    code?: string;
    billingRate?: number;
    currency?: string;
    contactName?: string;
    contactEmail?: string;
  }): Promise<{ success: boolean; client?: ClientView; error?: string }> {
    if (!data.id?.trim()) return { success: false, error: 'Client ID is required' };
    if (!data.name?.trim()) return { success: false, error: 'Client name is required' };
    try {
      const row = await this.repo.createClient(data);
      this.logger.info({ clientId: data.id }, 'Client created');
      return { success: true, client: this.toClientView(row) };
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return { success: false, error: 'Client ID already exists' };
      }
      throw err;
    }
  }

  async updateClient(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getClientById(id);
    if (!existing) return { success: false, error: 'Client not found' };
    await this.repo.updateClient(id, fields);
    return { success: true };
  }

  // ── Projects ──

  async getProjects(clientId?: string): Promise<ProjectView[]> {
    const rows = await this.repo.getProjects(clientId);
    return rows.map((r) => this.toProjectView(r));
  }

  async createProject(data: {
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
  }): Promise<{ success: boolean; project?: ProjectView; error?: string }> {
    if (!data.id?.trim()) return { success: false, error: 'Project ID is required' };
    if (!data.clientId?.trim()) return { success: false, error: 'Client ID is required' };
    if (!data.name?.trim()) return { success: false, error: 'Project name is required' };

    const client = await this.repo.getClientById(data.clientId);
    if (!client) return { success: false, error: 'Client not found' };

    try {
      const row = await this.repo.createProject(data);
      this.logger.info({ projectId: data.id, clientId: data.clientId }, 'Project created');
      return { success: true, project: this.toProjectView(row) };
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return { success: false, error: 'Project ID already exists' };
      }
      throw err;
    }
  }

  async updateProject(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getProjectById(id);
    if (!existing) return { success: false, error: 'Project not found' };
    await this.repo.updateProject(id, fields);
    return { success: true };
  }

  // ── Time entries ──

  async getEntries(filters: {
    email?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    billable?: boolean;
  }): Promise<TimeEntryView[]> {
    const rows = await this.repo.getEntries(filters);
    return rows.map((r) => this.toEntryView(r));
  }

  async logTime(data: {
    email: string;
    projectId: string;
    date: string;
    hours: number;
    description?: string;
    billable?: boolean;
    billingRate?: number;
  }): Promise<{ success: boolean; entry?: TimeEntryView; error?: string }> {
    if (!data.email) return { success: false, error: 'Email is required' };
    if (!data.projectId) return { success: false, error: 'Project ID is required' };
    if (!data.date) return { success: false, error: 'Date is required' };
    if (!data.hours || data.hours <= 0) return { success: false, error: 'Hours must be positive' };
    if (data.hours > 24)
      return { success: false, error: 'Hours cannot exceed 24 in a single entry' };

    const project = await this.repo.getProjectById(data.projectId);
    if (!project) return { success: false, error: 'Project not found' };

    // Resolve billable flag: entry override → project default
    const billable = data.billable ?? project.billable === 1;

    // Resolve billing rate: entry override → project rate → client rate
    let billingRate = data.billingRate ?? null;
    if (billingRate === null && billable) {
      if (project.billing_rate_hourly !== null) {
        billingRate = project.billing_rate_hourly;
      } else {
        const client = await this.repo.getClientById(project.client_id);
        if (client) billingRate = client.billing_rate_hourly;
      }
    }

    const row = await this.repo.createEntry({
      email: data.email,
      projectId: data.projectId,
      date: data.date,
      hours: data.hours,
      description: data.description,
      billable,
      billingRate: billingRate ?? undefined,
    });

    this.logger.info(
      {
        email: data.email,
        projectId: data.projectId,
        date: data.date,
        hours: data.hours,
        billable,
      },
      'Time entry logged',
    );
    return { success: true, entry: this.toEntryView(row) };
  }

  async updateEntry(
    id: number,
    fields: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getEntryById(id);
    if (!existing) return { success: false, error: 'Entry not found' };
    if (existing.approved === 1) return { success: false, error: 'Cannot edit an approved entry' };
    await this.repo.updateEntry(id, fields);
    return { success: true };
  }

  async deleteEntry(id: number): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getEntryById(id);
    if (!existing) return { success: false, error: 'Entry not found' };
    if (existing.approved === 1)
      return { success: false, error: 'Cannot delete an approved entry' };
    await this.repo.deleteEntry(id);
    return { success: true };
  }

  async approveEntry(
    id: number,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getEntryById(id);
    if (!existing) return { success: false, error: 'Entry not found' };
    await this.repo.approveEntry(id, approverEmail);
    return { success: true };
  }

  // ── Summary / reporting ──

  async getSummary(filters: {
    email?: string;
    projectId?: string;
    clientId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    entries: number;
    utilizationPercent: number;
  }> {
    const raw = await this.repo.getSummary(filters);
    const utilization =
      raw.totalHours > 0 ? Math.round((raw.billableHours / raw.totalHours) * 100) : 0;
    return { ...raw, utilizationPercent: utilization };
  }

  // ── View mappers ──

  private toClientView(r: ClientRow): ClientView {
    return {
      id: r.id,
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

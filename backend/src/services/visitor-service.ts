import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import type { NotificationDispatcher } from './notification/dispatcher';
import {
  VisitorRepository,
  type VisitorVisitRow,
  type VisitorFormRow,
} from '../repositories/visitor-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}
interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

/** Map camelCase or snake_case update fields to DB column names. */
export function mapVisitUpdateFields(fields: Record<string, unknown>): Record<string, unknown> {
  const keyMap: Record<string, string> = {
    visitorName: 'visitor_name',
    visitor_name: 'visitor_name',
    visitorCompany: 'visitor_company',
    visitor_company: 'visitor_company',
    visitorEmail: 'visitor_email',
    visitor_email: 'visitor_email',
    visitorPhone: 'visitor_phone',
    visitor_phone: 'visitor_phone',
    purpose: 'purpose',
    expectedDate: 'expected_date',
    expected_date: 'expected_date',
    expectedTime: 'expected_time',
    expected_time: 'expected_time',
    expectedDurationMinutes: 'expected_duration_minutes',
    expected_duration_minutes: 'expected_duration_minutes',
    receptionNotes: 'reception_notes',
    reception_notes: 'reception_notes',
    badgeDataJson: 'badge_data_json',
    badge_data_json: 'badge_data_json',
    photoFileId: 'photo_file_id',
    photo_file_id: 'photo_file_id',
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = keyMap[k];
    if (col) out[col] = v;
  }
  return out;
}

export class VisitorService {
  private readonly repo: VisitorRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
    private readonly dispatcher?: NotificationDispatcher | null,
  ) {
    this.repo = new VisitorRepository(db);
  }

  async registerVisit(
    data: {
      visitorName: string;
      visitorCompany?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      hostEmail: string;
      purpose?: string;
      expectedDate: string;
      expectedTime?: string;
      expectedDurationMinutes?: number;
    },
    actorEmail: string,
  ): Promise<ServiceResult<VisitorVisitRow>> {
    if (!data.visitorName?.trim()) return { success: false, error: 'Visitor name is required' };
    if (!data.hostEmail?.trim()) return { success: false, error: 'Host email is required' };
    if (!data.expectedDate?.trim()) return { success: false, error: 'Expected date is required' };

    // Validate host exists
    const host = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [data.hostEmail],
    );
    if (!host) return { success: false, error: 'Host employee not found or inactive' };

    const visit = await this.repo.createVisit({
      ...data,
      visitorName: data.visitorName.trim(),
      createdBy: actorEmail,
    });

    this.logger.info(
      { visitId: visit.id, visitor: visit.visitor_name, host: visit.host_email },
      'Visitor registered',
    );
    this.logAudit('visitor_visit', visit.id, 'registered', actorEmail, {
      visitorName: visit.visitor_name,
      hostEmail: visit.host_email,
    });
    return { success: true, data: visit };
  }

  async checkIn(
    visitId: string,
    receptionNotes?: string,
    actorEmail?: string,
  ): Promise<ServiceResult> {
    const visit = await this.repo.getVisitById(visitId);
    if (!visit) return { success: false, error: 'Visit not found' };
    if (visit.status !== 'pre_registered')
      return { success: false, error: `Cannot check in with status "${visit.status}"` };

    await this.repo.checkIn(visitId, receptionNotes);
    this.logger.info({ visitId, visitor: visit.visitor_name }, 'Visitor checked in');
    this.logAudit('visitor_visit', visitId, 'checked_in', actorEmail ?? 'reception', {});

    // Notify host
    if (this.dispatcher) {
      this.notifyHost(visit, 'checked_in').catch((err) => {
        this.logger.error({ err, visitId }, 'Host notification failed');
      });
    }

    return { success: true };
  }

  async checkOut(visitId: string, actorEmail?: string): Promise<ServiceResult> {
    const visit = await this.repo.getVisitById(visitId);
    if (!visit) return { success: false, error: 'Visit not found' };
    if (visit.status !== 'checked_in')
      return { success: false, error: `Cannot check out with status "${visit.status}"` };

    await this.repo.checkOut(visitId);
    this.logger.info({ visitId, visitor: visit.visitor_name }, 'Visitor checked out');
    this.logAudit('visitor_visit', visitId, 'checked_out', actorEmail ?? 'reception', {});
    return { success: true };
  }

  async cancelVisit(visitId: string, actorEmail: string): Promise<ServiceResult> {
    const visit = await this.repo.getVisitById(visitId);
    if (!visit) return { success: false, error: 'Visit not found' };
    if (visit.status === 'checked_out' || visit.status === 'cancelled') {
      return { success: false, error: `Cannot cancel with status "${visit.status}"` };
    }
    await this.repo.cancelVisit(visitId);
    this.logAudit('visitor_visit', visitId, 'cancelled', actorEmail, {});
    return { success: true };
  }

  async markNoShow(visitId: string, actorEmail: string): Promise<ServiceResult> {
    const visit = await this.repo.getVisitById(visitId);
    if (!visit) return { success: false, error: 'Visit not found' };
    if (visit.status !== 'pre_registered') {
      return { success: false, error: `Cannot mark no-show with status "${visit.status}"` };
    }
    await this.repo.markNoShow(visitId);
    this.logAudit('visitor_visit', visitId, 'no_show', actorEmail, {});
    return { success: true };
  }

  async updateVisit(
    id: string,
    fields: Record<string, unknown>,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getVisitById(id);
    if (!existing) return { success: false, error: 'Visit not found' };
    if (existing.status === 'checked_out' || existing.status === 'cancelled') {
      return { success: false, error: `Cannot update visit with status "${existing.status}"` };
    }
    const mapped = mapVisitUpdateFields(fields);
    if (Object.keys(mapped).length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }
    await this.repo.updateVisit(id, mapped as Parameters<typeof this.repo.updateVisit>[1]);
    this.logAudit('visitor_visit', id, 'updated', actorEmail, mapped);
    return { success: true };
  }

  async getVisitById(id: string): Promise<VisitorVisitRow | null> {
    return this.repo.getVisitById(id);
  }

  async listVisits(filters?: {
    hostEmail?: string;
    date?: string;
    status?: string;
  }): Promise<VisitorVisitRow[]> {
    return this.repo.listVisits(filters);
  }

  async getMyExpectedVisitors(hostEmail: string): Promise<VisitorVisitRow[]> {
    return this.repo.listVisits({ hostEmail, status: 'pre_registered' });
  }

  async countCheckedIn(): Promise<number> {
    return this.repo.countCheckedIn();
  }

  // ── Forms ──
  async addForm(
    visitId: string,
    data: { formType?: string; signatureBase64?: string; fileId?: string | null },
    actorEmail: string,
  ): Promise<ServiceResult<VisitorFormRow>> {
    const visit = await this.repo.getVisitById(visitId);
    if (!visit) return { success: false, error: 'Visit not found' };

    const form = await this.repo.addForm({ visitId, ...data });
    this.logAudit('visitor_form', form.id, 'signed', actorEmail, {
      visitId,
      formType: form.form_type,
    });
    return { success: true, data: form };
  }

  async getFormsByVisit(visitId: string): Promise<VisitorFormRow[]> {
    return this.repo.getFormsByVisit(visitId);
  }

  // ── Notification ──
  private async notifyHost(visit: VisitorVisitRow, eventType: string): Promise<void> {
    if (!this.dispatcher) return;
    const host = await this.db.get<MemberRow>('SELECT email, name FROM members WHERE email = ?', [
      visit.host_email,
    ]);
    if (!host) return;
    await this.dispatcher.notify({
      eventType: `visitor:${eventType}`,
      entityType: 'visitor_visit',
      entityId: visit.id,
      recipients: [{ email: host.email, name: host.name, role: 'host' }],
      data: {
        visitId: visit.id,
        visitorName: visit.visitor_name,
        visitorCompany: visit.visitor_company,
        purpose: visit.purpose,
      },
    });
  }

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}

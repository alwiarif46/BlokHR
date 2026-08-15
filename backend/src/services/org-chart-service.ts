import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { EventBus } from '../events';
import type { AuditService } from '../audit/audit-service';
import {
  OrgChartRepository,
  type OrgPositionRow,
  type OrgTreeNode,
  type SuccessionPlanRow,
  type DirectReportRow,
  type SpanOfControlRow,
} from '../repositories/org-chart-repository';

// ── Result types ──

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface FlightRiskScore {
  email: string;
  name: string;
  overall: number;
  breakdown: {
    attendance: number;
    leaveFrequency: number;
    overtimeTrend: number;
    lateTrend: number;
    tenure: number;
    certification: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
}

// ── Internal row types ──

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string | null;
  position_id: string | null;
  reports_to: string;
  joining_date: string;
  certified_at: string | null;
  active: number;
}

/**
 * Org Chart service — business logic for position hierarchy, reporting lines,
 * succession planning, and flight risk scoring.
 *
 * Every reporting-line or position change is audit-logged.
 * EventBus fires member.position_changed when position assignments change.
 */
export class OrgChartService {
  private readonly repo: OrgChartRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
    private readonly eventBus?: EventBus,
  ) {
    this.repo = new OrgChartRepository(db);
  }

  // ── Position CRUD ──

  async createPosition(
    data: {
      title: string;
      parentPositionId?: string | null;
      groupId?: string | null;
      level?: number;
      maxHeadcount?: number;
      description?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult<OrgPositionRow>> {
    if (!data.title || !data.title.trim()) {
      return { success: false, error: 'Position title is required' };
    }

    // Validate parent exists if provided
    if (data.parentPositionId) {
      const parent = await this.repo.getPositionById(data.parentPositionId);
      if (!parent) {
        return { success: false, error: 'Parent position not found' };
      }
    }

    // Validate group exists if provided
    if (data.groupId) {
      const group = await this.db.get<{ id: string; [key: string]: unknown }>(
        'SELECT id FROM groups WHERE id = ?',
        [data.groupId],
      );
      if (!group) {
        return { success: false, error: 'Group not found' };
      }
    }

    const position = await this.repo.createPosition({
      ...data,
      title: data.title.trim(),
    });

    this.logger.info(
      { positionId: position.id, title: position.title, actor: actorEmail },
      'Org position created',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'org_position',
          entityId: position.id,
          action: 'created',
          actorEmail,
          detail: {
            title: position.title,
            parentPositionId: position.parent_position_id,
            groupId: position.group_id,
            level: position.level,
          },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true, data: position };
  }

  async updatePosition(
    id: string,
    fields: {
      title?: string;
      parentPositionId?: string | null;
      groupId?: string | null;
      level?: number;
      maxHeadcount?: number;
      description?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getPositionById(id);
    if (!existing) {
      return { success: false, error: 'Position not found' };
    }

    if (fields.title !== undefined && !fields.title.trim()) {
      return { success: false, error: 'Position title cannot be empty' };
    }

    // Prevent self-parenting
    if (fields.parentPositionId === id) {
      return { success: false, error: 'A position cannot be its own parent' };
    }

    // If reparenting, check the new parent exists and wouldn't create a cycle
    if (fields.parentPositionId !== undefined && fields.parentPositionId !== null) {
      const parent = await this.repo.getPositionById(fields.parentPositionId);
      if (!parent) {
        return { success: false, error: 'Parent position not found' };
      }
      // Walk up from the new parent — if we reach this position, it's a cycle
      const ancestors = await this.repo.getAncestors(fields.parentPositionId);
      if (ancestors.some((a) => a.id === id)) {
        return { success: false, error: 'Reparenting would create a circular hierarchy' };
      }
    }

    const dbFields: Record<string, unknown> = {};
    if (fields.title !== undefined) dbFields.title = fields.title.trim();
    if (fields.parentPositionId !== undefined)
      dbFields.parent_position_id = fields.parentPositionId;
    if (fields.groupId !== undefined) dbFields.group_id = fields.groupId;
    if (fields.level !== undefined) dbFields.level = fields.level;
    if (fields.maxHeadcount !== undefined) dbFields.max_headcount = fields.maxHeadcount;
    if (fields.description !== undefined) dbFields.description = fields.description;

    await this.repo.updatePosition(id, dbFields as Parameters<typeof this.repo.updatePosition>[1]);

    this.logger.info(
      { positionId: id, fields: Object.keys(dbFields), actor: actorEmail },
      'Org position updated',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'org_position',
          entityId: id,
          action: 'updated',
          actorEmail,
          detail: {
            before: { title: existing.title, parentPositionId: existing.parent_position_id },
            after: dbFields,
          },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true };
  }

  async deletePosition(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getPositionById(id);
    if (!existing) {
      return { success: false, error: 'Position not found' };
    }

    await this.repo.deletePosition(id);

    this.logger.info(
      { positionId: id, title: existing.title, actor: actorEmail },
      'Org position deleted',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'org_position',
          entityId: id,
          action: 'deleted',
          actorEmail,
          detail: { title: existing.title, parentPositionId: existing.parent_position_id },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true };
  }

  async getPositionById(id: string): Promise<OrgPositionRow | null> {
    return this.repo.getPositionById(id);
  }

  async getAllPositions(): Promise<OrgPositionRow[]> {
    return this.repo.getAllPositions();
  }

  // ── Hierarchy ──

  async getOrgTree(): Promise<OrgTreeNode[]> {
    return this.repo.getOrgTree();
  }

  async getSubtree(positionId: string): Promise<ServiceResult<OrgPositionRow[]>> {
    const pos = await this.repo.getPositionById(positionId);
    if (!pos) {
      return { success: false, error: 'Position not found' };
    }
    const tree = await this.repo.getSubtree(positionId);
    return { success: true, data: tree };
  }

  async getAncestors(positionId: string): Promise<ServiceResult<OrgPositionRow[]>> {
    const pos = await this.repo.getPositionById(positionId);
    if (!pos) {
      return { success: false, error: 'Position not found' };
    }
    const chain = await this.repo.getAncestors(positionId);
    return { success: true, data: chain };
  }

  // ── Reporting lines ──

  async setReportsTo(
    email: string,
    managerEmail: string,
    actorEmail: string,
  ): Promise<ServiceResult> {
    // Validate employee exists and is active
    const member = await this.db.get<MemberRow>(
      'SELECT * FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Empty string means "remove manager"
    if (managerEmail !== '') {
      // Validate manager exists and is active
      const manager = await this.db.get<MemberRow>(
        'SELECT email FROM members WHERE email = ? AND active = 1',
        [managerEmail],
      );
      if (!manager) {
        return { success: false, error: 'Manager not found or inactive' };
      }

      // Cycle detection
      const wouldCycle = await this.repo.wouldCreateCycle(email, managerEmail);
      if (wouldCycle) {
        return { success: false, error: 'Assignment would create a circular reporting chain' };
      }
    }

    const previousManager = member.reports_to;
    await this.repo.setReportsTo(email, managerEmail);

    this.logger.info(
      { email, managerEmail, previousManager, actor: actorEmail },
      'Reporting line changed',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'member',
          entityId: email,
          action: 'reports_to_changed',
          actorEmail,
          detail: { previousManager, newManager: managerEmail },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true };
  }

  async assignPosition(
    email: string,
    positionId: string | null,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const member = await this.db.get<MemberRow>(
      'SELECT * FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    if (positionId !== null) {
      const position = await this.repo.getPositionById(positionId);
      if (!position) {
        return { success: false, error: 'Position not found' };
      }
    }

    const previousPositionId = member.position_id;
    await this.repo.assignPosition(email, positionId);

    this.logger.info(
      { email, positionId, previousPositionId, actor: actorEmail },
      'Position assignment changed',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'member',
          entityId: email,
          action: 'position_changed',
          actorEmail,
          detail: { previousPositionId, newPositionId: positionId },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    this.eventBus?.emit('member.position_changed', {
      email,
      name: member.name,
      groupId: member.group_id ?? undefined,
    });

    return { success: true };
  }

  async getManagerEmail(email: string): Promise<string> {
    return this.repo.getManagerEmail(email);
  }

  async getDirectReports(managerEmail: string): Promise<DirectReportRow[]> {
    return this.repo.getDirectReports(managerEmail);
  }

  async getSubordinateCount(managerEmail: string): Promise<number> {
    return this.repo.getSubordinateCount(managerEmail);
  }

  async getSpanOfControl(): Promise<SpanOfControlRow[]> {
    return this.repo.getSpanOfControl();
  }

  // ── Succession planning ──

  async createSuccessionPlan(
    data: {
      positionId: string;
      nomineeEmail: string;
      readiness?: string;
      notes?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult<SuccessionPlanRow>> {
    // Validate position
    const position = await this.repo.getPositionById(data.positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    // Validate nominee exists and is active
    const nominee = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [data.nomineeEmail],
    );
    if (!nominee) {
      return { success: false, error: 'Nominee not found or inactive' };
    }

    // Validate readiness value
    const validReadiness = ['ready_now', '1_year', '2_year'];
    if (data.readiness && !validReadiness.includes(data.readiness)) {
      return {
        success: false,
        error: `Invalid readiness level. Must be one of: ${validReadiness.join(', ')}`,
      };
    }

    // Check for duplicate (UNIQUE constraint would catch this, but a clear message is better)
    const existing = await this.db.get<{ id: number; [key: string]: unknown }>(
      'SELECT id FROM succession_plans WHERE position_id = ? AND nominee_email = ?',
      [data.positionId, data.nomineeEmail],
    );
    if (existing) {
      return {
        success: false,
        error: 'This nominee is already on the succession plan for this position',
      };
    }

    const plan = await this.repo.createSuccessionPlan({
      positionId: data.positionId,
      nomineeEmail: data.nomineeEmail,
      readiness: data.readiness ?? 'ready_now',
      notes: data.notes ?? '',
      nominatedBy: actorEmail,
    });

    this.logger.info(
      {
        planId: plan.id,
        positionId: data.positionId,
        nominee: data.nomineeEmail,
        actor: actorEmail,
      },
      'Succession plan created',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'succession_plan',
          entityId: String(plan.id),
          action: 'created',
          actorEmail,
          detail: {
            positionId: data.positionId,
            positionTitle: position.title,
            nomineeEmail: data.nomineeEmail,
            readiness: plan.readiness,
          },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true, data: plan };
  }

  async updateSuccessionPlan(
    id: number,
    fields: { readiness?: string; notes?: string },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getSuccessionPlanById(id);
    if (!existing) {
      return { success: false, error: 'Succession plan entry not found' };
    }

    const validReadiness = ['ready_now', '1_year', '2_year'];
    if (fields.readiness && !validReadiness.includes(fields.readiness)) {
      return {
        success: false,
        error: `Invalid readiness level. Must be one of: ${validReadiness.join(', ')}`,
      };
    }

    await this.repo.updateSuccessionPlan(id, fields);

    this.logger.info(
      { planId: id, fields: Object.keys(fields), actor: actorEmail },
      'Succession plan updated',
    );

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'succession_plan',
          entityId: String(id),
          action: 'updated',
          actorEmail,
          detail: { before: { readiness: existing.readiness }, after: fields },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true };
  }

  async deleteSuccessionPlan(id: number, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getSuccessionPlanById(id);
    if (!existing) {
      return { success: false, error: 'Succession plan entry not found' };
    }

    await this.repo.deleteSuccessionPlan(id);

    this.logger.info({ planId: id, actor: actorEmail }, 'Succession plan deleted');

    if (this.auditService) {
      this.auditService
        .log({
          entityType: 'succession_plan',
          entityId: String(id),
          action: 'deleted',
          actorEmail,
          detail: { positionId: existing.position_id, nomineeEmail: existing.nominee_email },
        })
        .catch((err) => this.logger.error({ err }, 'Audit log failed'));
    }

    return { success: true };
  }

  async getSuccessionByPosition(positionId: string): Promise<SuccessionPlanRow[]> {
    return this.repo.getSuccessionByPosition(positionId);
  }

  async getAllSuccessionPlans(): Promise<(SuccessionPlanRow & { position_title: string })[]> {
    return this.repo.getAllSuccessionPlans();
  }

  // ── Vacancy tracking ──

  async getVacantPositions(): Promise<
    (OrgPositionRow & { holder_count: number; vacancies: number })[]
  > {
    return this.repo.getVacantPositions();
  }

  // ── Flight risk scoring ──

  /**
   * Computes a composite flight risk score for active employees.
   * Score 0–100 where higher = higher risk. Weighted components:
   *
   * - Attendance rate (25%): < 80% attendance → high risk
   * - Leave frequency (20%): > 15 leaves in 90 days → high risk
   * - Overtime trend (15%): > 60h OT in 90 days → burnout risk
   * - Late trend (15%): > 10 lates in 90 days → disengagement risk
   * - Tenure (15%): < 6 months or > 5 years without growth → risk
   * - Certification (10%): uncertified profile → minor risk signal
   *
   * Thresholds are deliberately conservative. This is a screening tool,
   * not a determination — HR reviews the flagged individuals.
   */
  async computeFlightRisk(filters?: {
    email?: string;
    groupId?: string;
  }): Promise<FlightRiskScore[]> {
    // Build member filter
    const conditions: string[] = ['m.active = 1'];
    const params: unknown[] = [];
    if (filters?.email) {
      conditions.push('m.email = ?');
      params.push(filters.email);
    }
    if (filters?.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }

    const members = await this.db.all<MemberRow>(
      `SELECT email, name, group_id, position_id, reports_to, joining_date, certified_at, active
       FROM members m
       WHERE ${conditions.join(' AND ')}
       ORDER BY name ASC`,
      params,
    );

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const periodStart = ninetyDaysAgo.toISOString().slice(0, 10);
    const periodEnd = now.toISOString().slice(0, 10);

    const results: FlightRiskScore[] = [];

    for (const member of members) {
      const breakdown = {
        attendance: await this.scoreAttendance(member.email, periodStart, periodEnd),
        leaveFrequency: await this.scoreLeaveFrequency(member.email, periodStart, periodEnd),
        overtimeTrend: await this.scoreOvertime(member.email, periodStart, periodEnd),
        lateTrend: await this.scoreLate(member.email, periodStart, periodEnd),
        tenure: this.scoreTenure(member.joining_date, now),
        certification: member.certified_at ? 0 : 30,
      };

      // Weighted composite
      const overall = Math.round(
        breakdown.attendance * 0.25 +
          breakdown.leaveFrequency * 0.2 +
          breakdown.overtimeTrend * 0.15 +
          breakdown.lateTrend * 0.15 +
          breakdown.tenure * 0.15 +
          breakdown.certification * 0.1,
      );

      const riskLevel: FlightRiskScore['riskLevel'] =
        overall >= 60 ? 'high' : overall >= 35 ? 'medium' : 'low';

      results.push({
        email: member.email,
        name: member.name,
        overall,
        breakdown,
        riskLevel,
      });
    }

    // Sort by risk descending
    results.sort((a, b) => b.overall - a.overall);
    return results;
  }

  // ── Flight risk component scorers (0–100 each, higher = worse) ──

  private async scoreAttendance(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const row = await this.db.get<{ total: number; present: number; [key: string]: unknown }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('in', 'out') THEN 1 ELSE 0 END) AS present
       FROM attendance_daily
       WHERE email = ? AND date >= ? AND date <= ?`,
      [email, startDate, endDate],
    );
    const total = row?.total ?? 0;
    if (total === 0) return 50; // No data → moderate risk
    const present = row?.present ?? 0;
    const rate = present / total;

    // 95%+ → 0 risk, 80% → 50, <70% → 100
    if (rate >= 0.95) return 0;
    if (rate >= 0.8) return Math.round((1 - (rate - 0.8) / 0.15) * 50);
    return Math.min(100, Math.round(50 + (1 - (rate - 0.6) / 0.2) * 50));
  }

  private async scoreLeaveFrequency(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) AS cnt FROM leave_requests
       WHERE person_email = ? AND start_date >= ? AND start_date <= ?
       AND status != 'cancelled'`,
      [email, startDate, endDate],
    );
    const count = row?.cnt ?? 0;
    // 0–5 → 0, 6–10 → linear to 50, 11–15 → linear to 80, 15+ → 100
    if (count <= 5) return 0;
    if (count <= 10) return Math.round(((count - 5) / 5) * 50);
    if (count <= 15) return Math.round(50 + ((count - 10) / 5) * 30);
    return 100;
  }

  private async scoreOvertime(email: string, startDate: string, endDate: string): Promise<number> {
    const row = await this.db.get<{ total_min: number; [key: string]: unknown }>(
      `SELECT COALESCE(SUM(ot_minutes), 0) AS total_min FROM overtime_records
       WHERE email = ? AND date >= ? AND date <= ? AND status = 'approved'`,
      [email, startDate, endDate],
    );
    const hours = (row?.total_min ?? 0) / 60;
    // 0–20h → 0, 20–40h → linear to 40, 40–60h → linear to 70, 60+ → 100
    if (hours <= 20) return 0;
    if (hours <= 40) return Math.round(((hours - 20) / 20) * 40);
    if (hours <= 60) return Math.round(40 + ((hours - 40) / 20) * 30);
    return 100;
  }

  private async scoreLate(email: string, startDate: string, endDate: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) AS cnt FROM attendance_daily
       WHERE email = ? AND date >= ? AND date <= ? AND is_late = 1`,
      [email, startDate, endDate],
    );
    const count = row?.cnt ?? 0;
    // 0–3 → 0, 4–7 → linear to 50, 8–10 → linear to 80, 10+ → 100
    if (count <= 3) return 0;
    if (count <= 7) return Math.round(((count - 3) / 4) * 50);
    if (count <= 10) return Math.round(50 + ((count - 7) / 3) * 30);
    return 100;
  }

  private scoreTenure(joiningDate: string, now: Date): number {
    if (!joiningDate) return 60; // No joining date → higher risk signal

    const joined = new Date(joiningDate);
    if (isNaN(joined.getTime())) return 60;

    const monthsDiff =
      (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());

    // < 6 months → 60 (new hire risk), 6–12 → 40, 12–36 → 10, 36–60 → 0, > 60 → 20 (stagnation)
    if (monthsDiff < 6) return 60;
    if (monthsDiff < 12) return 40;
    if (monthsDiff < 36) return 10;
    if (monthsDiff <= 60) return 0;
    return 20;
  }
}

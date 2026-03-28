import type { Logger } from 'pino';
import type { SettingsRepository, MemberRow } from '../repositories/settings-repository';
import type { LeaveRepository } from '../repositories/leave-repository';
import type { RegularizationRepository } from '../repositories/regularization-repository';
import type { BdMeetingRepository } from '../repositories/bd-meeting-repository';
import type { MeetingRepository } from '../repositories/meeting-repository';
import type { EventBus } from '../events';

/** Frontend settingsCache shape — returned by GET /api/settings. */
export interface SettingsBundle {
  groups: Array<{
    id: string;
    name: string;
    shiftStart: string;
    shiftEnd: string;
    timezone: string;
  }>;
  members: Array<{
    id: string;
    email: string;
    name: string;
    group: string;
    memberType: string;
    role: string;
    designation: string;
    active: boolean;
    photo: string;
    phone: string;
    emergencyContact: string;
    joiningDate: string;
    location: string;
    googleEmail: string;
    teamsUserId: string;
    msUserId: string;
    individualShift: { start: string; end: string } | null;
  }>;
  admins: string[];
  meetings: Array<{
    id: string;
    name: string;
    platform: string;
    client: string;
    purpose: string;
    enabled: boolean;
  }>;
  designations: Array<{ id: number; name: string }>;
  memberTypes: Array<{ id: string; name: string; description: string }>;
  lateRules: {
    graceMinutes: number;
    latesToDeduction: number;
    deductionDays: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
  };
  systemSettings: {
    logicalDayChangeTime: string;
    employeeOfMonthName: string;
    employeeOfMonthEmail: string;
  };
  branding: {
    companyName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    authProvider: string;
    authClientId: string;
    authTenantId: string;
    setupComplete: boolean;
  } | null;
}

/** Role resolution result for GET /api/user-roles. */
export interface UserRoles {
  isAdmin: boolean;
  isGlobalManager: boolean;
  isGlobalHR: boolean;
  managerOf: string[];
  hrOf: string[];
}

/** Pending action counts for GET /api/pending-actions. */
export interface PendingCounts {
  pendingLeaves: number;
  pendingMeetings: number;
  pendingRegularizations: number;
  pendingProfiles: number;
}

/**
 * Settings service — settings bundle, member CRUD, role resolution, pending actions.
 */
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly leaveRepo: LeaveRepository | null,
    private readonly regRepo: RegularizationRepository | null,
    private readonly bdMeetingRepo: BdMeetingRepository | null,
    private readonly meetingRepo: MeetingRepository | null,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  /** Build the full settings bundle the frontend caches. */
  async getSettings(): Promise<SettingsBundle> {
    const [
      groups,
      members,
      admins,
      designations,
      memberTypes,
      lateRules,
      systemSettings,
      branding,
    ] = await Promise.all([
      this.repo.getGroups(),
      this.repo.getMembers(),
      this.repo.getAdmins(),
      this.repo.getDesignations(),
      this.repo.getMemberTypes(),
      this.repo.getLateRules(),
      this.repo.getSystemSettings(),
      this.repo.getBranding(),
    ]);

    // Get tracked meetings for the settings bundle
    const meetings = this.meetingRepo ? await this.meetingRepo.getAll() : [];

    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        shiftStart: g.shift_start ?? '',
        shiftEnd: g.shift_end ?? '',
        timezone: g.timezone,
      })),
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        group: m.group_id ?? '',
        memberType: m.member_type_id,
        role: m.role,
        designation: m.designation,
        active: m.active === 1,
        photo: m.photo,
        phone: m.phone,
        emergencyContact: m.emergency_contact,
        joiningDate: m.joining_date,
        location: m.location,
        googleEmail: m.google_email,
        teamsUserId: m.teams_user_id,
        msUserId: m.ms_user_id,
        individualShift:
          m.individual_shift_start || m.individual_shift_end
            ? { start: m.individual_shift_start ?? '', end: m.individual_shift_end ?? '' }
            : null,
      })),
      admins,
      meetings: meetings.map((mt) => ({
        id: mt.id,
        name: mt.name,
        platform: mt.platform,
        client: mt.client,
        purpose: mt.purpose,
        enabled: mt.enabled === 1,
      })),
      designations: designations.map((d) => ({ id: d.id, name: d.name })),
      memberTypes: memberTypes.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
      lateRules: {
        graceMinutes: lateRules?.grace_minutes ?? 15,
        latesToDeduction: lateRules?.lates_to_deduction ?? 4,
        deductionDays: lateRules?.deduction_days ?? 0.5,
        tier1Count: lateRules?.tier1_count ?? 2,
        tier2Count: lateRules?.tier2_count ?? 3,
        tier3Count: lateRules?.tier3_count ?? 4,
      },
      systemSettings: {
        logicalDayChangeTime: systemSettings?.logical_day_change_time ?? '06:00',
        employeeOfMonthName: systemSettings?.employee_of_month_name ?? '',
        employeeOfMonthEmail: systemSettings?.employee_of_month_email ?? '',
      },
      branding: branding
        ? {
            companyName: branding.company_name ?? '',
            logoUrl: branding.logo_url ?? '',
            primaryColor: branding.primary_color ?? '',
            secondaryColor: branding.secondary_color ?? '',
            authProvider: branding.auth_provider ?? '',
            authClientId: branding.auth_client_id ?? '',
            authTenantId: branding.auth_tenant_id ?? '',
            setupComplete: branding.setup_complete === 1,
          }
        : null,
    };
  }

  /**
   * Create a new member. Single entry point for member creation.
   * Inserts into members table, emits member.created event.
   */
  async createMember(data: {
    email: string;
    name: string;
    groupId?: string;
    memberTypeId?: string;
    role?: string;
    designation?: string;
    phone?: string;
    joiningDate?: string;
    location?: string;
    timezone?: string;
    individualShiftStart?: string;
    individualShiftEnd?: string;
  }): Promise<{ success: boolean; member?: MemberRow; error?: string }> {
    if (!data.email) return { success: false, error: 'email is required' };
    if (!data.name) return { success: false, error: 'name is required' };

    const email = data.email.toLowerCase().trim();

    // Check for duplicate
    const existing = await this.repo.getMemberByEmail(email);
    if (existing) return { success: false, error: 'Member with this email already exists' };

    const member = await this.repo.createMember({
      id: email,
      email,
      name: data.name.trim(),
      groupId: data.groupId,
      memberTypeId: data.memberTypeId,
      role: data.role,
      designation: data.designation,
      phone: data.phone,
      joiningDate: data.joiningDate,
      location: data.location,
      timezone: data.timezone,
      individualShiftStart: data.individualShiftStart,
      individualShiftEnd: data.individualShiftEnd,
    });

    this.logger.info({ email, name: data.name, groupId: data.groupId }, 'Member created');

    this.eventBus?.emit('member.created', {
      email,
      name: data.name,
      groupId: data.groupId,
    });

    return { success: true, member };
  }

  /** Update a member's profile. */
  async updateMember(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    // Try by ID first, then by email
    let member = await this.repo.getMemberById(id);
    if (!member) {
      member = await this.repo.getMemberByEmail(id);
    }
    if (!member) return { success: false, error: 'Member not found' };

    const update: Record<string, unknown> = {};

    // Map frontend field names to DB column names
    const fieldMap: Record<string, string> = {
      name: 'name',
      group: 'group_id',
      designation: 'designation',
      role: 'role',
      photo: 'photo',
      phone: 'phone',
      emergencyContact: 'emergency_contact',
      joiningDate: 'joining_date',
      location: 'location',
      googleEmail: 'google_email',
      teamsUserId: 'teams_user_id',
      msUserId: 'ms_user_id',
      panNumber: 'pan_number',
      aadhaarNumber: 'aadhaar_number',
      uanNumber: 'uan_number',
      acParentage: 'ac_parentage',
      bankAccountNumber: 'bank_account_number',
      bankIfsc: 'bank_ifsc',
      bankName: 'bank_name',
      certifiedAt: 'certified_at',
      certifiedBy: 'certified_by',
      profileUnlocked: 'profile_unlocked',
      active: 'active',
      memberType: 'member_type_id',
      notificationConfig: 'notification_config_json',
      personalWebhookUrl: 'personal_webhook_url',
      individualShiftStart: 'individual_shift_start',
      individualShiftEnd: 'individual_shift_end',
      discordId: 'discord_id',
      telegramId: 'telegram_id',
    };

    for (const [key, val] of Object.entries(fields)) {
      const col = fieldMap[key];
      if (col && val !== undefined) {
        update[col] = val;
      }
    }

    if (Object.keys(update).length === 0) {
      return { success: true };
    }

    await this.repo.updateMember(member.id, update as Partial<MemberRow>);

    this.logger.info(
      { memberId: member.id, fields: Object.keys(update) },
      'Member profile updated',
    );

    // Emit member events for key changes
    if (update.active === 0 || update.active === false) {
      this.eventBus?.emit('member.deactivated', { email: member.email, name: member.name, groupId: member.group_id });
    }
    if (update.group_id !== undefined && update.group_id !== member.group_id) {
      this.eventBus?.emit('member.group_changed', {
        email: member.email, name: member.name,
        groupId: update.group_id as string,
        previousGroupId: member.group_id,
      });
    }

    return { success: true };
  }

  /** Resolve a user's roles across all scopes. */
  async getUserRoles(email: string): Promise<UserRoles> {
    const isAdmin = await this.repo.isAdmin(email);
    const assignments = await this.repo.getRolesForEmail(email);

    const result: UserRoles = {
      isAdmin,
      isGlobalManager: false,
      isGlobalHR: false,
      managerOf: [],
      hrOf: [],
    };

    for (const ra of assignments) {
      if (ra.role_type === 'manager') {
        if (ra.scope_type === 'global') {
          result.isGlobalManager = true;
        } else {
          result.managerOf.push(ra.scope_value);
        }
      } else if (ra.role_type === 'hr') {
        if (ra.scope_type === 'global') {
          result.isGlobalHR = true;
        } else {
          result.hrOf.push(ra.scope_value);
        }
      }
    }

    // Admins implicitly have global manager + HR
    if (isAdmin) {
      result.isGlobalManager = true;
      result.isGlobalHR = true;
    }

    return result;
  }

  /** Get pending action counts for the badge. */
  async getPendingCounts(): Promise<PendingCounts> {
    const [pendingLeaves, pendingRegularizations, pendingMeetings] = await Promise.all([
      this.leaveRepo?.countPendingLeaves() ?? Promise.resolve(0),
      this.regRepo?.countPending() ?? Promise.resolve(0),
      this.bdMeetingRepo?.countPending() ?? Promise.resolve(0),
    ]);

    // Count members with uncertified profiles (pending profile review)
    const members = await this.repo.getMembers();
    const pendingProfiles = members.filter((m) => m.active === 1 && !m.certified_at).length;

    return {
      pendingLeaves,
      pendingMeetings,
      pendingRegularizations,
      pendingProfiles,
    };
  }

  /** Get pending action detail for the modal. */
  async getPendingDetail(): Promise<{
    leaves: Array<Record<string, unknown>>;
    regularizations: Array<Record<string, unknown>>;
    meetings: Array<Record<string, unknown>>;
    profiles: Array<Record<string, unknown>>;
  }> {
    const [leaveRows, regRows, meetingRows] = await Promise.all([
      this.leaveRepo?.getPendingLeavesDetail() ?? Promise.resolve([]),
      this.regRepo?.getPendingDetail() ?? Promise.resolve([]),
      this.bdMeetingRepo?.getPendingDetail() ?? Promise.resolve([]),
    ]);

    const leaves = leaveRows.map((l) => ({
      email: l.person_email,
      name: l.person_name,
      type: l.leave_type,
      kind: l.kind,
      start: l.start_date,
      end: l.end_date,
      status: l.status,
    }));

    const regularizations = regRows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      date: r.date,
      type: r.correction_type,
      status: r.status,
    }));

    const meetings = meetingRows.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      client: m.client,
      date: m.date,
      status: m.status,
    }));

    // Uncertified active members
    const members = await this.repo.getMembers();
    const profiles = members
      .filter((m) => m.active === 1 && !m.certified_at)
      .map((m) => ({
        email: m.email,
        name: m.name,
        submittedAt: m.updated_at,
      }));

    return { leaves, regularizations, meetings, profiles };
  }

  /** Get employee of month. */
  async getEmployeeOfMonth(): Promise<{ name: string; email: string }> {
    return this.repo.getEmployeeOfMonth();
  }
}

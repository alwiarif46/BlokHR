import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface GroupRow {
  [key: string]: unknown;
  id: string;
  name: string;
  shift_start: string;
  shift_end: string;
  timezone: string;
}

export interface MemberRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  group_id: string;
  member_type_id: string;
  role: string;
  designation: string;
  active: number;
  photo: string;
  phone: string;
  emergency_contact: string;
  joining_date: string;
  location: string;
  timezone: string;
  individual_shift_start: string;
  individual_shift_end: string;
  google_email: string;
  teams_user_id: string;
  ms_user_id: string;
  pan_number: string;
  aadhaar_number: string;
  uan_number: string;
  ac_parentage: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  certified_at: string;
  certified_by: string;
  profile_unlocked: number;
  notification_config_json: string;
  personal_webhook_url: string;
  created_at: string;
  updated_at: string;
}

export interface AdminRow {
  [key: string]: unknown;
  email: string;
}

export interface RoleAssignmentRow {
  [key: string]: unknown;
  id: number;
  assignee_email: string;
  role_type: string;
  scope_type: string;
  scope_value: string;
}

export interface LateRulesRow {
  [key: string]: unknown;
  grace_minutes: number;
  lates_to_deduction: number;
  deduction_days: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
}

export interface SystemSettingsRow {
  [key: string]: unknown;
  logical_day_change_time: string;
  employee_of_month_name: string;
  employee_of_month_email: string;
}

export interface BrandingRow {
  [key: string]: unknown;
  company_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  auth_provider: string;
  auth_client_id: string;
  auth_tenant_id: string;
  license_key: string;
  setup_complete: number;
}

export interface DesignationRow {
  [key: string]: unknown;
  id: number;
  name: string;
}

export interface MemberTypeRow {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
}

/**
 * Settings repository — read/write for all configuration tables.
 * Provides the master settings bundle the frontend caches on load.
 */
export class SettingsRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Bulk reads ──

  async getGroups(): Promise<GroupRow[]> {
    return this.db.all<GroupRow>('SELECT * FROM groups ORDER BY name');
  }

  async getMembers(): Promise<MemberRow[]> {
    return this.db.all<MemberRow>('SELECT * FROM members ORDER BY name');
  }

  async getAdmins(): Promise<string[]> {
    const rows = await this.db.all<AdminRow>('SELECT email FROM admins');
    return rows.map((r) => r.email);
  }

  async getRoleAssignments(): Promise<RoleAssignmentRow[]> {
    return this.db.all<RoleAssignmentRow>('SELECT * FROM role_assignments');
  }

  async getLateRules(): Promise<LateRulesRow | null> {
    return this.db.get<LateRulesRow>('SELECT * FROM late_rules WHERE id = 1');
  }

  async getSystemSettings(): Promise<SystemSettingsRow | null> {
    return this.db.get<SystemSettingsRow>('SELECT * FROM system_settings WHERE id = 1');
  }

  async getBranding(): Promise<BrandingRow | null> {
    return this.db.get<BrandingRow>('SELECT * FROM branding WHERE id = 1');
  }

  async getDesignations(): Promise<DesignationRow[]> {
    return this.db.all<DesignationRow>('SELECT * FROM designations ORDER BY name');
  }

  async getMemberTypes(): Promise<MemberTypeRow[]> {
    return this.db.all<MemberTypeRow>('SELECT * FROM member_types ORDER BY name');
  }

  // ── Member CRUD ──

  async getMemberById(id: string): Promise<MemberRow | null> {
    return this.db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [id]);
  }

  async getMemberByEmail(email: string): Promise<MemberRow | null> {
    return this.db.get<MemberRow>('SELECT * FROM members WHERE email = ?', [email]);
  }

  /** Create a new member. Returns the created row. */
  async createMember(data: {
    id: string;
    email: string;
    name: string;
    groupId?: string | null;
    memberTypeId?: string;
    role?: string;
    designation?: string;
    phone?: string;
    joiningDate?: string;
    location?: string;
    timezone?: string;
    individualShiftStart?: string | null;
    individualShiftEnd?: string | null;
  }): Promise<MemberRow> {
    await this.db.run(
      `INSERT INTO members (
        id, email, name, group_id, member_type_id, role, designation,
        phone, joining_date, location, timezone,
        individual_shift_start, individual_shift_end, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        data.id,
        data.email,
        data.name,
        data.groupId ?? null,
        data.memberTypeId ?? 'fte',
        data.role ?? 'employee',
        data.designation ?? '',
        data.phone ?? '',
        data.joiningDate ?? '',
        data.location ?? '',
        data.timezone ?? 'Asia/Kolkata',
        data.individualShiftStart ?? null,
        data.individualShiftEnd ?? null,
      ],
    );
    const row = await this.getMemberByEmail(data.email);
    if (!row) throw new Error('Failed to create member');
    return row;
  }

  /**
   * Update a member's profile fields.
   * Only updates fields that are explicitly provided (not undefined).
   */
  async updateMember(
    id: string,
    fields: Partial<
      Pick<
        MemberRow,
        | 'name'
        | 'group_id'
        | 'designation'
        | 'role'
        | 'photo'
        | 'phone'
        | 'emergency_contact'
        | 'joining_date'
        | 'location'
        | 'individual_shift_start'
        | 'individual_shift_end'
        | 'google_email'
        | 'teams_user_id'
        | 'ms_user_id'
        | 'pan_number'
        | 'aadhaar_number'
        | 'uan_number'
        | 'ac_parentage'
        | 'bank_account_number'
        | 'bank_ifsc'
        | 'bank_name'
        | 'certified_at'
        | 'certified_by'
        | 'profile_unlocked'
        | 'active'
        | 'member_type_id'
        | 'notification_config_json'
        | 'personal_webhook_url'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  // ── Role resolution ──

  /**
   * Get all role assignments for a specific email.
   * Returns scoped assignments so the caller can check per-group or per-member access.
   */
  async getRolesForEmail(email: string): Promise<RoleAssignmentRow[]> {
    return this.db.all<RoleAssignmentRow>(
      'SELECT * FROM role_assignments WHERE assignee_email = ?',
      [email],
    );
  }

  /** Check if an email is in the admins table. */
  async isAdmin(email: string): Promise<boolean> {
    const row = await this.db.get<AdminRow>('SELECT email FROM admins WHERE email = ?', [email]);
    return !!row;
  }

  // ── System settings ──

  async getEmployeeOfMonth(): Promise<{ name: string; email: string }> {
    const row = await this.getSystemSettings();
    return {
      name: row?.employee_of_month_name ?? '',
      email: row?.employee_of_month_email ?? '',
    };
  }
}

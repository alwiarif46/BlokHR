/**
 * Tenant-scoped role → module visibility (Roles & Access).
 * Sparse: missing row = visible. Matrix can only restrict further than
 * static ceilings; school /svc/* modules are UI-only (service RoutePolicy unchanged).
 */
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import {
  deleteTenantAdmin,
  insertTenantAdmin,
  listTenantAdmins,
} from '../tenant/admin-access';
import type { TenantVertical } from './vertical-defaults';
import { featureRouteMapKeys, resolveFeatureKeyForPath } from './feature-flags';

export type AssignableRole =
  | 'admin'
  | 'manager'
  | 'hr'
  | 'employee'
  | 'school_admin'
  | 'office'
  | 'teacher'
  | 'parent';

export const HR_ROLES: AssignableRole[] = ['admin', 'manager', 'hr', 'employee'];
export const SCHOOL_ROLES: AssignableRole[] = [
  'admin',
  'school_admin',
  'office',
  'teacher',
  'parent',
];

/** Modules that role=admin can never hide from themselves. */
export const ADMIN_HARD_CEILING: string[] = [
  'role_access',
  'feature_flags',
  'people',
  'settings',
];

export type ModuleEnforcement = 'api' | 'ui_only';

export interface ModuleCatalogEntry {
  key: string;
  label: string;
  section: string;
  /** Roles that may ever see this module (static ceiling). */
  ceilings: AssignableRole[];
}

/**
 * Static ceilings (UI + PUT validation). enforcement is derived from FEATURE_ROUTE_MAP.
 * Do not import per-service route-policies — copy intent only.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  // Overview
  { key: 'dashboard', label: 'Dashboard', section: 'Overview', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  { key: 'my_preferences', label: 'My Preferences', section: 'Overview', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  // Attendance & Time
  { key: 'attendance', label: 'Attendance', section: 'Attendance & Time', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  { key: 'time_tracking', label: 'Time Tracking', section: 'Attendance & Time', ceilings: [...HR_ROLES] },
  { key: 'overtime', label: 'Overtime', section: 'Attendance & Time', ceilings: [...HR_ROLES] },
  { key: 'geo_fencing', label: 'Geo-Fencing', section: 'Attendance & Time', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'face_recognition', label: 'Face Recognition', section: 'Attendance & Time', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'iris_scan', label: 'Iris Scan', section: 'Attendance & Time', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'holidays', label: 'Holidays', section: 'Attendance & Time', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  // People
  { key: 'leaves', label: 'Leaves', section: 'People', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'regularizations', label: 'Regularizations', section: 'People', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'profiles', label: 'Profiles', section: 'People', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'timesheets', label: 'Timesheets', section: 'People', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'org_chart', label: 'Org Chart', section: 'People', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  // Work & Collaboration
  { key: 'meetings', label: 'Meetings', section: 'Work & Collaboration', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  { key: 'document_mgmt', label: 'Documents', section: 'Work & Collaboration', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'workflows', label: 'Workflows', section: 'Work & Collaboration', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'asset_mgmt', label: 'Assets', section: 'Work & Collaboration', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'visitor_mgmt', label: 'Visitors', section: 'Work & Collaboration', ceilings: ['admin', 'manager', 'hr'] },
  { key: 'expense_mgmt', label: 'Expenses', section: 'Work & Collaboration', ceilings: ['admin', 'manager', 'hr'] },
  // Growth
  { key: 'training_lms', label: 'Training', section: 'Growth', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  { key: 'surveys', label: 'Surveys', section: 'Growth', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  { key: 'ai_chatbot', label: 'AI Chatbot', section: 'Growth', ceilings: [...HR_ROLES, ...SCHOOL_ROLES] },
  // School (ui_only except school_register / capture_admin which are in FEATURE_ROUTE_MAP)
  { key: 'school_register', label: 'School Register', section: 'School', ceilings: ['admin', 'school_admin', 'office'] },
  { key: 'school_students', label: 'Students', section: 'School', ceilings: ['admin', 'school_admin', 'office'] },
  { key: 'school_roll_call', label: 'Roll Call', section: 'School', ceilings: ['admin', 'school_admin', 'teacher'] },
  {
    key: 'school_attendance_admin',
    label: 'Attendance Admin',
    section: 'School',
    ceilings: ['admin', 'school_admin', 'office'],
  },
  { key: 'school_timetable', label: 'Timetable', section: 'School', ceilings: ['admin', 'school_admin', 'office'] },
  { key: 'school_academics', label: 'Academics', section: 'School', ceilings: ['admin', 'school_admin', 'teacher'] },
  { key: 'school_exams', label: 'Exams', section: 'School', ceilings: ['admin', 'school_admin', 'teacher'] },
  { key: 'school_hpc', label: 'HPC', section: 'School', ceilings: ['admin', 'school_admin', 'teacher'] },
  { key: 'school_library', label: 'Library', section: 'School', ceilings: ['admin', 'school_admin', 'office'] },
  { key: 'school_circulars', label: 'Circulars', section: 'School', ceilings: ['admin', 'school_admin', 'office'] },
  {
    key: 'school_parent_surveys',
    label: 'Parents & Guardians',
    section: 'School',
    ceilings: ['admin', 'school_admin'],
  },
  { key: 'capture_admin', label: 'Capture Admin', section: 'School', ceilings: ['admin', 'school_admin'] },
  // Family
  { key: 'parent_hub', label: 'Parent Portal', section: 'Family', ceilings: ['admin', 'parent'] },
  // Insights
  { key: 'analytics', label: 'Analytics', section: 'Insights', ceilings: ['admin', 'manager', 'hr'] },
  // Admin
  { key: 'people', label: 'People', section: 'Admin', ceilings: ['admin'] },
  { key: 'leave_policies', label: 'Leave Policies', section: 'Admin', ceilings: ['admin'] },
  { key: 'feature_flags', label: 'Feature Flags', section: 'Admin', ceilings: ['admin'] },
  { key: 'audit_trail', label: 'Audit Trail', section: 'Admin', ceilings: ['admin'] },
  { key: 'webhooks', label: 'Webhooks', section: 'Admin', ceilings: ['admin'] },
  { key: 'school_settings', label: 'School Settings', section: 'Admin', ceilings: ['admin', 'school_admin'] },
  { key: 'settings', label: 'Settings', section: 'Admin', ceilings: ['admin'] },
  { key: 'role_access', label: 'Roles & Access', section: 'Admin', ceilings: ['admin'] },
];

export function rolesForVertical(vertical: TenantVertical | null): AssignableRole[] {
  if (vertical === 'school') return [...SCHOOL_ROLES];
  return [...HR_ROLES];
}

export function isRoleForVertical(
  role: string,
  vertical: TenantVertical | null,
): role is AssignableRole {
  return (rolesForVertical(vertical) as string[]).includes(role);
}

export function enforcementForModule(moduleKey: string): ModuleEnforcement {
  return featureRouteMapKeys().has(moduleKey) ? 'api' : 'ui_only';
}

export function isWithinCeiling(role: AssignableRole, moduleKey: string): boolean {
  const entry = MODULE_CATALOG.find((m) => m.key === moduleKey);
  if (!entry) return false;
  if (role === 'admin' && ADMIN_HARD_CEILING.includes(moduleKey)) return true;
  return entry.ceilings.includes(role);
}

type CacheBucket = {
  /** role → module_key → visible (false only when overridden off) */
  hidden: Map<string, Map<string, boolean>>;
  /** email → members.role */
  memberRoles: Map<string, string>;
};

export class RoleAccessService {
  /** tenantId → cache */
  private cache = new Map<string, CacheBucket>();

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<void> {
    await this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    this.cache.clear();
    const hideRows = await this.db.all<{
      tenant_id: string;
      role: string;
      module_key: string;
      visible: number;
    }>('SELECT tenant_id, role, module_key, visible FROM role_module_visibility', []);

    for (const row of hideRows) {
      const bucket = this.ensureBucket(row.tenant_id);
      if (row.visible === 0) {
        let byMod = bucket.hidden.get(row.role);
        if (!byMod) {
          byMod = new Map();
          bucket.hidden.set(row.role, byMod);
        }
        byMod.set(row.module_key, false);
      }
    }

    const members = await this.db.all<{ tenant_id: string; email: string; role: string }>(
      'SELECT tenant_id, email, role FROM members WHERE active = 1',
      [],
    );
    for (const m of members) {
      const bucket = this.ensureBucket(m.tenant_id);
      bucket.memberRoles.set(m.email.toLowerCase(), String(m.role || '').toLowerCase());
    }
  }

  invalidateTenant(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  async refreshTenant(tenantId: string): Promise<void> {
    this.cache.delete(tenantId);
    const hideRows = await this.db.all<{
      role: string;
      module_key: string;
      visible: number;
    }>(
      'SELECT role, module_key, visible FROM role_module_visibility WHERE tenant_id = ?',
      [tenantId],
    );
    const bucket = this.ensureBucket(tenantId);
    for (const row of hideRows) {
      if (row.visible === 0) {
        let byMod = bucket.hidden.get(row.role);
        if (!byMod) {
          byMod = new Map();
          bucket.hidden.set(row.role, byMod);
        }
        byMod.set(row.module_key, false);
      }
    }
    const members = await this.db.all<{ email: string; role: string }>(
      'SELECT email, role FROM members WHERE tenant_id = ? AND active = 1',
      [tenantId],
    );
    for (const m of members) {
      bucket.memberRoles.set(m.email.toLowerCase(), String(m.role || '').toLowerCase());
    }
  }

  private ensureBucket(tenantId: string): CacheBucket {
    let b = this.cache.get(tenantId);
    if (!b) {
      b = { hidden: new Map(), memberRoles: new Map() };
      this.cache.set(tenantId, b);
    }
    return b;
  }

  getEffectiveRoleCached(tenantId: string, email: string): string | null {
    const bucket = this.cache.get(tenantId);
    if (!bucket) return null;
    const role = bucket.memberRoles.get(email.toLowerCase().trim());
    return role ?? null;
  }

  /**
   * Missing override / no member row = visible (fail-open).
   */
  isModuleVisible(tenantId: string, role: string, moduleKey: string): boolean {
    if (!role) return true;
    const bucket = this.cache.get(tenantId);
    if (!bucket) return true;
    const byMod = bucket.hidden.get(role);
    if (!byMod) return true;
    if (byMod.get(moduleKey) === false) return false;
    return true;
  }

  /**
   * Longest-prefix-wins: only the owning FEATURE_ROUTE_MAP key is checked.
   * Hiding `attendance` does not hide `/api/clock/geo` (owned by `geo_fencing`) — intended containment.
   */
  isPathVisibleForRole(tenantId: string, role: string, path: string): boolean {
    const key = resolveFeatureKeyForPath(path);
    if (!key) return true;
    return this.isModuleVisible(tenantId, role, key);
  }

  async getBundle(vertical: TenantVertical | null): Promise<{
    vertical: TenantVertical | null;
    roles: AssignableRole[];
    modules: Array<ModuleCatalogEntry & { enforcement: ModuleEnforcement }>;
    matrix: Record<string, Record<string, boolean>>;
  }> {
    const tid = getTenantId();
    if (!this.cache.has(tid)) await this.refreshTenant(tid);

    const roles = rolesForVertical(vertical);
    const roleSet = new Set(roles);
    const modules = MODULE_CATALOG.filter((m) => m.ceilings.some((c) => roleSet.has(c))).map(
      (m) => ({
        ...m,
        ceilings: m.ceilings.filter((c) => roleSet.has(c)),
        enforcement: enforcementForModule(m.key),
      }),
    );

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const role of roles) {
      matrix[role] = {};
      for (const mod of modules) {
        const within = isWithinCeiling(role, mod.key);
        if (!within) {
          matrix[role][mod.key] = false;
          continue;
        }
        matrix[role][mod.key] = this.isModuleVisible(tid, role, mod.key);
      }
    }

    return { vertical, roles, modules, matrix };
  }

  async applyOverrides(
    overrides: Array<{ role: string; moduleKey: string; visible: boolean }>,
    updatedBy: string,
    vertical: TenantVertical | null,
  ): Promise<{ success: boolean; error?: string; status?: number }> {
    const tid = getTenantId();
    for (const o of overrides) {
      const role = String(o.role || '')
        .trim()
        .toLowerCase();
      const moduleKey = String(o.moduleKey || '').trim();
      if (!isRoleForVertical(role, vertical)) {
        return { success: false, error: 'invalid_role_for_vertical', status: 400 };
      }
      if (!MODULE_CATALOG.some((m) => m.key === moduleKey)) {
        return { success: false, error: 'unknown_module', status: 400 };
      }
      if (!isWithinCeiling(role, moduleKey)) {
        return { success: false, error: 'not_available_for_role', status: 400 };
      }
      if (role === 'admin' && ADMIN_HARD_CEILING.includes(moduleKey) && !o.visible) {
        return { success: false, error: 'not_available_for_role', status: 400 };
      }

      if (o.visible) {
        await this.db.run(
          'DELETE FROM role_module_visibility WHERE tenant_id = ? AND role = ? AND module_key = ?',
          [tid, role, moduleKey],
        );
      } else {
        await this.db.run(
          `INSERT INTO role_module_visibility (tenant_id, role, module_key, visible, updated_by, updated_at)
           VALUES (?, ?, ?, 0, ?, datetime('now'))
           ON CONFLICT(tenant_id, role, module_key) DO UPDATE SET
             visible = 0, updated_by = excluded.updated_by, updated_at = datetime('now')`,
          [tid, role, moduleKey, updatedBy],
        );
      }
    }
    await this.refreshTenant(tid);
    this.logger.info({ count: overrides.length, updatedBy, tid }, 'Role access overrides applied');
    return { success: true };
  }

  /**
   * Change member role with vertical validation, dual admin lockout, admins sync.
   */
  async changeMemberRole(opts: {
    memberId: string;
    newRole: string;
    vertical: TenantVertical | null;
    actorEmail: string;
    directory?: {
      updateMember: (
        id: string,
        input: { role?: string },
        tenantId: string,
      ) => Promise<{ success: boolean; error?: string; status?: number }>;
    };
  }): Promise<{
    success: boolean;
    error?: string;
    status?: number;
    from?: string;
    to?: string;
    memberId?: string;
    email?: string;
  }> {
    const tid = getTenantId();
    const newRole = String(opts.newRole || '')
      .trim()
      .toLowerCase();
    if (!isRoleForVertical(newRole, opts.vertical)) {
      return { success: false, error: 'invalid_role_for_vertical', status: 400 };
    }

    const member = await this.db.get<{
      id: string;
      email: string;
      role: string;
      active: number;
    }>('SELECT id, email, role, active FROM members WHERE tenant_id = ? AND (id = ? OR email = ?)', [
      tid,
      opts.memberId,
      opts.memberId,
    ]);
    if (!member || member.active !== 1) {
      return { success: false, error: 'member_not_found', status: 404 };
    }

    const from = String(member.role || '').toLowerCase();
    if (from === newRole) {
      return { success: true, from, to: newRole, memberId: member.id, email: member.email };
    }

    const lock = await this.assertRoleChangeAllowed(tid, member.email, from, newRole, opts.vertical);
    if (!lock.ok) {
      return { success: false, error: lock.error, status: 409 };
    }

    if (opts.directory) {
      const result = await opts.directory.updateMember(member.id, { role: newRole }, tid);
      if (!result.success) {
        return {
          success: false,
          error: result.error ?? 'update_failed',
          status: result.status ?? 400,
        };
      }
    } else {
      await this.db.run('UPDATE members SET role = ? WHERE tenant_id = ? AND id = ?', [
        newRole,
        tid,
        member.id,
      ]);
    }

    if (newRole === 'admin') {
      await insertTenantAdmin(this.db, member.email, tid);
    } else if (from === 'admin') {
      await deleteTenantAdmin(this.db, member.email, tid);
    }

    await this.refreshTenant(tid);
    return {
      success: true,
      from,
      to: newRole,
      memberId: member.id,
      email: member.email,
    };
  }

  private async assertRoleChangeAllowed(
    tenantId: string,
    email: string,
    from: string,
    to: string,
    vertical: TenantVertical | null,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const normalized = email.toLowerCase().trim();

    // Platform admin lockout: demoting last admins row
    if (from === 'admin' && to !== 'admin') {
      const admins = await listTenantAdmins(this.db, tenantId);
      const remaining = admins.filter((a) => a.toLowerCase() !== normalized);
      if (remaining.length === 0) {
        return { ok: false, error: 'last_admin' };
      }
    }

    // School API admin lockout
    if (vertical === 'school') {
      const wasSchoolAdmin = from === 'admin' || from === 'school_admin';
      const staysSchoolAdmin = to === 'admin' || to === 'school_admin';
      if (wasSchoolAdmin && !staysSchoolAdmin) {
        const rows = await this.db.all<{ email: string; role: string }>(
          `SELECT email, role FROM members WHERE tenant_id = ? AND active = 1
           AND lower(role) IN ('admin', 'school_admin')`,
          [tenantId],
        );
        const remaining = rows.filter((r) => r.email.toLowerCase() !== normalized);
        if (remaining.length === 0) {
          return { ok: false, error: 'last_admin' };
        }
      }
    }

    return { ok: true };
  }
}

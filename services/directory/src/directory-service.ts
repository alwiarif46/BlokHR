import type { DirectoryRepository } from './repositories/directory-repository';
import type {
  AuthPort,
  BackfillMemberRow,
  CreateMemberInput,
  DirectoryMember,
  EventPort,
  MemberProjectionPort,
  SeatChecker,
  UpdateMemberInput,
} from './types';

const DEFAULT_SHIFT_START = '09:00';
const DEFAULT_SHIFT_END = '18:00';
const DEFAULT_GROUP_ID = 'default';

/** Roles assignable by login email (directory.members.role). */
export const DIRECTORY_MEMBER_ROLES = [
  'employee',
  'manager',
  'hr',
  'teacher',
  'office',
  'school_admin',
  'admin',
  'parent',
] as const;

export type DirectoryMemberRole = (typeof DIRECTORY_MEMBER_ROLES)[number];

function normalizeMemberRole(role: string | undefined): DirectoryMemberRole | { error: string } {
  const raw = (role ?? 'employee').trim().toLowerCase();
  if ((DIRECTORY_MEMBER_ROLES as readonly string[]).includes(raw)) {
    return raw as DirectoryMemberRole;
  }
  return { error: `role must be one of: ${DIRECTORY_MEMBER_ROLES.join(', ')}` };
}

export interface DirectoryServiceDeps {
  repo: DirectoryRepository;
  seatChecker?: SeatChecker;
  auth?: AuthPort;
  projection?: MemberProjectionPort;
  events?: EventPort;
  defaultTenantId?: string;
}

export class DirectoryService {
  private readonly defaultTenantId: string;

  constructor(private readonly deps: DirectoryServiceDeps) {
    this.defaultTenantId = deps.defaultTenantId ?? 'default';
  }

  async listMembers(
    tenantId: string = this.defaultTenantId,
    opts: { includeInactive?: boolean } = {},
  ): Promise<DirectoryMember[]> {
    if (opts.includeInactive) return this.deps.repo.listAll(tenantId);
    return this.deps.repo.listActive(tenantId);
  }

  async getMember(
    emailOrId: string,
    tenantId: string = this.defaultTenantId,
  ): Promise<DirectoryMember | null> {
    const byId = await this.deps.repo.getById(tenantId, emailOrId);
    if (byId) return byId;
    return this.deps.repo.getByEmail(tenantId, emailOrId.toLowerCase().trim());
  }

  async countActive(tenantId: string = this.defaultTenantId): Promise<number> {
    return this.deps.repo.countActive(tenantId);
  }

  async createMember(
    input: CreateMemberInput,
  ): Promise<{ success: boolean; member?: DirectoryMember; error?: string; status?: number }> {
    const tenantId = input.tenantId ?? this.defaultTenantId;
    const email = (input.email || '').toLowerCase().trim();
    const name = (input.name || '').trim();

    if (!email || email.indexOf('@') < 0) {
      return { success: false, error: 'Valid email is required', status: 400 };
    }
    if (!name) {
      return { success: false, error: 'name is required', status: 400 };
    }

    const roleNorm = normalizeMemberRole(input.role);
    if (typeof roleNorm === 'object' && 'error' in roleNorm) {
      return { success: false, error: roleNorm.error, status: 400 };
    }

    const existing = await this.deps.repo.getByEmail(tenantId, email);
    if (existing) {
      return { success: false, error: 'Member with this email already exists', status: 409 };
    }

    if (!input.skipSeatCheck && this.deps.seatChecker) {
      const nextSeats = (await this.deps.repo.countActive(tenantId)) + 1;
      const seats = await this.deps.seatChecker.checkSeats(tenantId, nextSeats);
      if (!seats.allowed) {
        return {
          success: false,
          error: seats.reason || 'Seat limit exceeded',
          status: 403,
        };
      }
    }

    const temporaryPassword = input.temporaryPassword?.trim();
    const needsCredentials = !input.skipCredentials && Boolean(this.deps.auth);
    if (needsCredentials) {
      if (!temporaryPassword) {
        return { success: false, error: 'temporaryPassword is required', status: 400 };
      }
      // Allow seed password "admin" for first-run setup; otherwise enforce 8+
      if (temporaryPassword.length < 8 && temporaryPassword !== 'admin') {
        return {
          success: false,
          error: 'temporaryPassword must be at least 8 characters',
          status: 400,
        };
      }
    }

    const groupId = input.groupId === undefined ? DEFAULT_GROUP_ID : input.groupId;
    const shiftStart = input.individualShiftStart ?? DEFAULT_SHIFT_START;
    const shiftEnd = input.individualShiftEnd ?? DEFAULT_SHIFT_END;

    const member = await this.deps.repo.insert({
      id: email,
      tenantId,
      email,
      name,
      role: roleNorm,
      groupId,
      designation: input.designation ?? '',
      phone: input.phone ?? '',
      timezone: input.timezone ?? 'Asia/Kolkata',
      individualShiftStart: shiftStart,
      individualShiftEnd: shiftEnd,
      active: true,
    });

    if (!input.skipCredentials && temporaryPassword && this.deps.auth) {
      const cred = await this.deps.auth.createCredentials(email, temporaryPassword, true);
      if (!cred.success && !/already exist/i.test(cred.error || '')) {
        await this.deps.repo.update(tenantId, member.id, { active: false });
        return {
          success: false,
          error: cred.error || 'Failed to create login credentials',
          status: 400,
        };
      }
    }

    if (this.deps.projection) {
      await this.deps.projection.upsertMember(member);
    }

    this.deps.events?.emit('member.created', {
      email: member.email,
      name: member.name,
      groupId: member.groupId,
      tenantId,
    });

    return { success: true, member };
  }

  async updateMember(
    id: string,
    input: UpdateMemberInput,
    tenantId: string = this.defaultTenantId,
  ): Promise<{ success: boolean; member?: DirectoryMember; error?: string; status?: number }> {
    const existing = await this.deps.repo.getById(tenantId, id);
    if (!existing) {
      return { success: false, error: 'Member not found', status: 404 };
    }

    let patch: UpdateMemberInput = { ...input };
    if (input.role !== undefined) {
      const roleNorm = normalizeMemberRole(input.role);
      if (typeof roleNorm === 'object' && 'error' in roleNorm) {
        return { success: false, error: roleNorm.error, status: 400 };
      }
      patch = { ...patch, role: roleNorm };
    }

    const updated = await this.deps.repo.update(tenantId, id, patch);
    if (!updated) {
      return { success: false, error: 'Member not found', status: 404 };
    }

    if (this.deps.projection) {
      if (updated.active) {
        await this.deps.projection.upsertMember(updated);
      } else {
        await this.deps.projection.deactivateMember(updated.id, tenantId);
      }
    }

    return { success: true, member: updated };
  }

  async deactivateMember(
    id: string,
    tenantId: string = this.defaultTenantId,
  ): Promise<{ success: boolean; error?: string; status?: number }> {
    const result = await this.updateMember(id, { active: false }, tenantId);
    if (!result.success) return { success: false, error: result.error, status: result.status };
    return { success: true };
  }

  /**
   * One-time import when directory DB is empty but legacy members exist.
   * Does not create auth credentials (those already live in the monolith).
   */
  async backfillFromLegacy(
    rows: BackfillMemberRow[],
    tenantId: string = this.defaultTenantId,
  ): Promise<number> {
    const existing = await this.deps.repo.countAll(tenantId);
    if (existing > 0) return 0;

    let imported = 0;
    for (const row of rows) {
      const email = row.email.toLowerCase().trim();
      if (!email) continue;
      const already = await this.deps.repo.getByEmail(tenantId, email);
      if (already) continue;

      const member = await this.deps.repo.insert({
        id: row.id || email,
        tenantId,
        email,
        name: row.name || email.split('@')[0],
        role: row.role ?? 'employee',
        groupId: row.groupId ?? DEFAULT_GROUP_ID,
        designation: row.designation ?? '',
        phone: row.phone ?? '',
        timezone: row.timezone ?? 'Asia/Kolkata',
        individualShiftStart: row.individualShiftStart ?? DEFAULT_SHIFT_START,
        individualShiftEnd: row.individualShiftEnd ?? DEFAULT_SHIFT_END,
        active: row.active !== false,
      });

      if (this.deps.projection) {
        await this.deps.projection.upsertMember(member);
      }
      imported += 1;
    }
    return imported;
  }
}

export const DIRECTORY_DEFAULTS = {
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GROUP_ID,
};

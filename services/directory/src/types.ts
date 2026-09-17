export interface DirectoryMember {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  groupId: string | null;
  designation: string;
  phone: string;
  timezone: string;
  individualShiftStart: string | null;
  individualShiftEnd: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInput {
  tenantId?: string;
  email: string;
  name: string;
  temporaryPassword?: string;
  role?: string;
  groupId?: string | null;
  designation?: string;
  phone?: string;
  timezone?: string;
  individualShiftStart?: string | null;
  individualShiftEnd?: string | null;
  /** Skip seat check (setup seed of first admin). */
  skipSeatCheck?: boolean;
  /** Skip auth credential creation. */
  skipCredentials?: boolean;
}

export interface UpdateMemberInput {
  name?: string;
  role?: string;
  groupId?: string | null;
  designation?: string;
  phone?: string;
  timezone?: string;
  individualShiftStart?: string | null;
  individualShiftEnd?: string | null;
  active?: boolean;
}

export interface SeatCheckResult {
  allowed: boolean;
  seatLimit: number;
  activeSeats: number;
  reason?: string;
}

export interface SeatChecker {
  checkSeats(tenantId: string, activeSeats: number): Promise<SeatCheckResult>;
}

export interface AuthPort {
  createCredentials(
    email: string,
    password: string,
    mustChangePassword: boolean,
  ): Promise<{ success: boolean; error?: string }>;
}

/** Keeps legacy monolith members in sync so clock/shift still works during extraction. */
export interface MemberProjectionPort {
  upsertMember(member: DirectoryMember): Promise<void>;
  deactivateMember(id: string, tenantId?: string): Promise<void>;
}

export interface EventPort {
  emit(event: string, payload: Record<string, unknown>): void;
}

export interface BackfillMemberRow {
  id: string;
  email: string;
  name: string;
  role?: string;
  groupId?: string | null;
  designation?: string;
  phone?: string;
  timezone?: string;
  individualShiftStart?: string | null;
  individualShiftEnd?: string | null;
  active?: boolean;
}

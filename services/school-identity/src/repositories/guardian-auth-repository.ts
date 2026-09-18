import type { SchoolIdentityDb } from '../db';
import { currentIdentityDb } from '../db-context';

export interface GuardianCredential {
  guardianId: string;
  tenantId: string;
  phone: string;
  passwordHash: string | null;
  otpHash: string | null;
  otpExpiresAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianSession {
  tokenHash: string;
  tenantId: string;
  guardianId: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

interface CredRow extends Record<string, unknown> {
  guardian_id: string;
  tenant_id: string;
  phone: string;
  password_hash: string | null;
  otp_hash: string | null;
  otp_expires_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow extends Record<string, unknown> {
  token_hash: string;
  tenant_id: string;
  guardian_id: string;
  created_at: string;
  expires_at: string;
  revoked: number;
}

function mapCred(row: CredRow): GuardianCredential {
  return {
    guardianId: row.guardian_id,
    tenantId: row.tenant_id,
    phone: row.phone,
    passwordHash: row.password_hash,
    otpHash: row.otp_hash,
    otpExpiresAt: row.otp_expires_at,
    failedAttempts: Number(row.failed_attempts ?? 0),
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: SessionRow): GuardianSession {
  return {
    tokenHash: row.token_hash,
    tenantId: row.tenant_id,
    guardianId: row.guardian_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revoked: Number(row.revoked) === 1,
  };
}

export class GuardianAuthRepository {
  constructor(private readonly fallbackDb: SchoolIdentityDb) {}

  private get db(): SchoolIdentityDb {
    return currentIdentityDb(this.fallbackDb);
  }

  async getCredential(
    tenantId: string,
    guardianId: string,
  ): Promise<GuardianCredential | null> {
    const row = await this.db.get<CredRow>(
      `SELECT * FROM guardian_credentials
       WHERE tenant_id = ? AND guardian_id = ?`,
      [tenantId, guardianId],
    );
    return row ? mapCred(row) : null;
  }

  async listCredentialsByPhone(
    phone: string,
    tenantId?: string,
  ): Promise<GuardianCredential[]> {
    const rows = tenantId
      ? await this.db.all<CredRow>(
          `SELECT * FROM guardian_credentials WHERE phone = ? AND tenant_id = ?`,
          [phone, tenantId],
        )
      : await this.db.all<CredRow>(
          `SELECT * FROM guardian_credentials WHERE phone = ?`,
          [phone],
        );
    return rows.map(mapCred);
  }

  async upsertCredential(input: {
    guardianId: string;
    tenantId: string;
    phone: string;
    passwordHash: string;
    updatedAt: string;
  }): Promise<GuardianCredential> {
    const existing = await this.getCredential(input.tenantId, input.guardianId);
    if (existing) {
      await this.db.run(
        `UPDATE guardian_credentials SET
           phone = ?, password_hash = ?, failed_attempts = 0, locked_until = NULL,
           updated_at = ?
         WHERE tenant_id = ? AND guardian_id = ?`,
        [
          input.phone,
          input.passwordHash,
          input.updatedAt,
          input.tenantId,
          input.guardianId,
        ],
      );
    } else {
      await this.db.run(
        `INSERT INTO guardian_credentials (
           guardian_id, tenant_id, phone, password_hash, failed_attempts,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [
          input.guardianId,
          input.tenantId,
          input.phone,
          input.passwordHash,
          input.updatedAt,
          input.updatedAt,
        ],
      );
    }
    return (await this.getCredential(input.tenantId, input.guardianId))!;
  }

  async updateLockState(input: {
    guardianId: string;
    tenantId: string;
    failedAttempts: number;
    lockedUntil: string | null;
    updatedAt: string;
  }): Promise<void> {
    await this.db.run(
      `UPDATE guardian_credentials SET
         failed_attempts = ?, locked_until = ?, updated_at = ?
       WHERE tenant_id = ? AND guardian_id = ?`,
      [
        input.failedAttempts,
        input.lockedUntil,
        input.updatedAt,
        input.tenantId,
        input.guardianId,
      ],
    );
  }

  async insertSession(session: GuardianSession): Promise<void> {
    await this.db.run(
      `INSERT INTO guardian_sessions (
         token_hash, tenant_id, guardian_id, created_at, expires_at, revoked
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.tokenHash,
        session.tenantId,
        session.guardianId,
        session.createdAt,
        session.expiresAt,
        session.revoked ? 1 : 0,
      ],
    );
  }

  async getSessionByTokenHash(
    tokenHash: string,
  ): Promise<GuardianSession | null> {
    const row = await this.db.get<SessionRow>(
      `SELECT * FROM guardian_sessions WHERE token_hash = ?`,
      [tokenHash],
    );
    return row ? mapSession(row) : null;
  }

  async revokeSession(tokenHash: string): Promise<boolean> {
    const existing = await this.getSessionByTokenHash(tokenHash);
    if (!existing) return false;
    await this.db.run(
      `UPDATE guardian_sessions SET revoked = 1 WHERE token_hash = ?`,
      [tokenHash],
    );
    return true;
  }

  async revokeAllSessions(tenantId: string, guardianId: string): Promise<number> {
    const before = await this.db.all<{ token_hash: string }>(
      `SELECT token_hash FROM guardian_sessions
       WHERE tenant_id = ? AND guardian_id = ? AND revoked = 0`,
      [tenantId, guardianId],
    );
    await this.db.run(
      `UPDATE guardian_sessions SET revoked = 1
       WHERE tenant_id = ? AND guardian_id = ? AND revoked = 0`,
      [tenantId, guardianId],
    );
    return before.length;
  }

  async insertSessionAudit(row: {
    id: string;
    tenantId: string;
    guardianId: string;
    action: string;
    sessionTokenHash?: string | null;
    meta?: Record<string, unknown>;
    at: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO guardian_session_audit (
         id, tenant_id, guardian_id, action, session_token_hash, meta_json, at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.guardianId,
        row.action,
        row.sessionTokenHash ?? null,
        JSON.stringify(row.meta ?? {}),
        row.at,
      ],
    );
  }

  async insertOtpChallenge(row: {
    id: string;
    tenantId: string;
    guardianId: string;
    phone: string;
    purpose: string;
    otpHash: string;
    expiresAt: string;
    createdAt: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO guardian_otp_challenges (
         id, tenant_id, guardian_id, phone, purpose, otp_hash, expires_at, consumed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        row.id,
        row.tenantId,
        row.guardianId,
        row.phone,
        row.purpose,
        row.otpHash,
        row.expiresAt,
        row.createdAt,
      ],
    );
  }

  async consumeOtpChallenge(input: {
    phone: string;
    purpose: string;
    otpHash: string;
    nowIso: string;
    tenantId: string;
  }): Promise<{
    tenantId: string;
    guardianId: string;
    id: string;
  } | null> {
    const row = await this.db.get<{
      id: string;
      tenant_id: string;
      guardian_id: string;
      expires_at: string;
    }>(
      `SELECT id, tenant_id, guardian_id, expires_at FROM guardian_otp_challenges
       WHERE phone = ? AND purpose = ? AND otp_hash = ? AND tenant_id = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`,
      [input.phone, input.purpose, input.otpHash, input.tenantId],
    );
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < new Date(input.nowIso).getTime()) {
      return null;
    }
    await this.db.run(
      `UPDATE guardian_otp_challenges SET consumed = 1 WHERE id = ? AND tenant_id = ?`,
      [row.id, input.tenantId],
    );
    return {
      id: row.id,
      tenantId: row.tenant_id,
      guardianId: row.guardian_id,
    };
  }

  async insertInvitation(row: {
    id: string;
    tenantId: string;
    guardianId: string;
    studentId: string | null;
    phone: string;
    email: string | null;
    tokenHash: string;
    status: string;
    invitedBy: string;
    expiresAt: string;
    createdAt: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO guardian_invitations (
         id, tenant_id, guardian_id, student_id, phone, email, token_hash,
         status, invited_by, expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.guardianId,
        row.studentId,
        row.phone,
        row.email,
        row.tokenHash,
        row.status,
        row.invitedBy,
        row.expiresAt,
        row.createdAt,
        row.createdAt,
      ],
    );
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<{
    id: string;
    tenantId: string;
    guardianId: string;
    studentId: string | null;
    phone: string;
    email: string | null;
    status: string;
    invitedBy: string;
    expiresAt: string;
    acceptedAt: string | null;
  } | null> {
    const row = await this.db.get<{
      id: string;
      tenant_id: string;
      guardian_id: string;
      student_id: string | null;
      phone: string;
      email: string | null;
      status: string;
      invited_by: string;
      expires_at: string;
      accepted_at: string | null;
    }>(`SELECT * FROM guardian_invitations WHERE token_hash = ?`, [tokenHash]);
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      guardianId: row.guardian_id,
      studentId: row.student_id,
      phone: row.phone,
      email: row.email,
      status: row.status,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
    };
  }

  async listInvitations(tenantId: string, status?: string) {
    const rows = status
      ? await this.db.all<Record<string, unknown>>(
          `SELECT * FROM guardian_invitations
           WHERE tenant_id = ? AND status = ?
           ORDER BY created_at DESC`,
          [tenantId, status],
        )
      : await this.db.all<Record<string, unknown>>(
          `SELECT * FROM guardian_invitations
           WHERE tenant_id = ?
           ORDER BY created_at DESC`,
          [tenantId],
        );
    return rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      guardianId: String(row.guardian_id),
      studentId: (row.student_id as string | null) ?? null,
      phone: String(row.phone),
      email: (row.email as string | null) ?? null,
      status: String(row.status),
      invitedBy: String(row.invited_by ?? ''),
      expiresAt: String(row.expires_at),
      acceptedAt: (row.accepted_at as string | null) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  async updateInvitationStatus(
    id: string,
    status: string,
    acceptedAt: string | null,
    updatedAt: string,
  ): Promise<void> {
    await this.db.run(
      `UPDATE guardian_invitations
       SET status = ?, accepted_at = ?, updated_at = ?
       WHERE id = ?`,
      [status, acceptedAt, updatedAt, id],
    );
  }

  /** Test helper — never expose via API. */
  async listAllTokenHashes(): Promise<string[]> {
    const rows = await this.db.all<{ token_hash: string }>(
      `SELECT token_hash FROM guardian_sessions`,
    );
    return rows.map((r) => r.token_hash);
  }
}

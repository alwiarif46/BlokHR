import type { SchoolIdentityDb } from '../db';

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
  constructor(private readonly db: SchoolIdentityDb) {}

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

  async listCredentialsByPhone(phone: string): Promise<GuardianCredential[]> {
    const rows = await this.db.all<CredRow>(
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

  /** Test helper — never expose via API. */
  async listAllTokenHashes(): Promise<string[]> {
    const rows = await this.db.all<{ token_hash: string }>(
      `SELECT token_hash FROM guardian_sessions`,
    );
    return rows.map((r) => r.token_hash);
  }
}

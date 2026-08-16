import type { IdentityRepository } from '../repositories/identity-repository';
import type { GuardianAuthRepository } from '../repositories/guardian-auth-repository';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  LOCKOUT_ATTEMPTS,
  LOCKOUT_MS,
  SESSION_TTL_MS,
  verifyPassword,
} from './guardian-auth-crypto';

type ServiceError = { error: string; status: number };

export class GuardianAuthService {
  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly authRepo: GuardianAuthRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async setPassword(input: {
    tenantId: string;
    guardianId: string;
    password: string;
  }): Promise<{ ok?: true; error?: ServiceError }> {
    const tenantId = (input.tenantId || '').trim();
    const guardianId = (input.guardianId || '').trim();
    const password = input.password ?? '';
    if (!tenantId) {
      return { error: { error: 'tenant_id is required', status: 400 } };
    }
    if (!guardianId) {
      return { error: { error: 'guardian_id is required', status: 400 } };
    }
    if (password.length < 8) {
      return {
        error: { error: 'password must be at least 8 characters', status: 400 },
      };
    }

    const guardian = await this.identityRepo.getGuardian(tenantId, guardianId);
    if (!guardian) {
      return { error: { error: 'Guardian not found', status: 404 } };
    }

    const passwordHash = await hashPassword(password);
    const now = this.clock().toISOString();
    await this.authRepo.upsertCredential({
      guardianId,
      tenantId,
      phone: guardian.phone,
      passwordHash,
      updatedAt: now,
    });
    return { ok: true };
  }

  async login(input: {
    phone: string;
    password: string;
  }): Promise<{
    token?: string;
    tenantId?: string;
    guardianId?: string;
    expiresAt?: string;
    error?: ServiceError;
  }> {
    const phone = (input.phone || '').trim();
    const password = input.password ?? '';
    if (!phone || !password) {
      return { error: { error: 'phone and password are required', status: 400 } };
    }

    const matches = await this.authRepo.listCredentialsByPhone(phone);
    if (matches.length === 0) {
      return { error: { error: 'invalid credentials', status: 401 } };
    }
    if (matches.length > 1) {
      return { error: { error: 'ambiguous_phone', status: 409 } };
    }

    const cred = matches[0]!;
    const now = this.clock();
    const nowIso = now.toISOString();

    if (cred.lockedUntil) {
      const lockedUntil = new Date(cred.lockedUntil);
      if (lockedUntil.getTime() > now.getTime()) {
        return { error: { error: 'account locked', status: 423 } };
      }
      await this.authRepo.updateLockState({
        guardianId: cred.guardianId,
        tenantId: cred.tenantId,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: nowIso,
      });
      cred.failedAttempts = 0;
      cred.lockedUntil = null;
    }

    if (!cred.passwordHash) {
      return { error: { error: 'invalid credentials', status: 401 } };
    }

    const ok = await verifyPassword(password, cred.passwordHash);
    if (!ok) {
      const failedAttempts = cred.failedAttempts + 1;
      let lockedUntil: string | null = null;
      if (failedAttempts >= LOCKOUT_ATTEMPTS) {
        lockedUntil = new Date(now.getTime() + LOCKOUT_MS).toISOString();
      }
      await this.authRepo.updateLockState({
        guardianId: cred.guardianId,
        tenantId: cred.tenantId,
        failedAttempts,
        lockedUntil,
        updatedAt: nowIso,
      });
      if (lockedUntil) {
        return { error: { error: 'account locked', status: 423 } };
      }
      return { error: { error: 'invalid credentials', status: 401 } };
    }

    await this.authRepo.updateLockState({
      guardianId: cred.guardianId,
      tenantId: cred.tenantId,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: nowIso,
    });

    const token = generateOpaqueToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    await this.authRepo.insertSession({
      tokenHash,
      tenantId: cred.tenantId,
      guardianId: cred.guardianId,
      createdAt: nowIso,
      expiresAt,
      revoked: false,
    });

    return {
      token,
      tenantId: cred.tenantId,
      guardianId: cred.guardianId,
      expiresAt,
    };
  }

  async introspect(token: string): Promise<{
    active: boolean;
    tenantId?: string;
    guardianId?: string;
  }> {
    const raw = (token || '').trim();
    if (!raw) return { active: false };

    const session = await this.authRepo.getSessionByTokenHash(hashToken(raw));
    if (!session) return { active: false };
    if (session.revoked) return { active: false };
    if (new Date(session.expiresAt).getTime() <= this.clock().getTime()) {
      return { active: false };
    }
    return {
      active: true,
      tenantId: session.tenantId,
      guardianId: session.guardianId,
    };
  }

  async logout(token: string): Promise<{ ok: true }> {
    const raw = (token || '').trim();
    if (raw) {
      await this.authRepo.revokeSession(hashToken(raw));
    }
    return { ok: true };
  }
}

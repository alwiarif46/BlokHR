import { v4 as uuidv4 } from 'uuid';
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

const OTP_TTL_MS = 10 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashOtp(otp: string): string {
  return hashToken(otp.trim());
}

function generateOtpCode(): string {
  // 6-digit numeric OTP
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

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
    await this.authRepo.revokeAllSessions(tenantId, guardianId);
    await this.authRepo.insertSessionAudit({
      id: uuidv4(),
      tenantId,
      guardianId,
      action: 'password_reset',
      at: now,
    });
    return { ok: true };
  }

  async login(input: {
    phone: string;
    password: string;
    tenantId?: string;
  }): Promise<{
    token?: string;
    tenantId?: string;
    guardianId?: string;
    expiresAt?: string;
    tenants?: Array<{ tenantId: string; guardianId: string }>;
    error?: ServiceError;
  }> {
    const phone = (input.phone || '').trim();
    const password = input.password ?? '';
    const tenantHint = (input.tenantId || '').trim();
    if (!phone || !password) {
      return { error: { error: 'phone and password are required', status: 400 } };
    }
    if (!tenantHint) {
      return { error: { error: 'tenant_required', status: 400 } };
    }

    const matches = await this.authRepo.listCredentialsByPhone(phone, tenantHint);
    if (matches.length === 0) {
      return { error: { error: 'invalid credentials', status: 401 } };
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
        await this.authRepo.insertSessionAudit({
          id: uuidv4(),
          tenantId: cred.tenantId,
          guardianId: cred.guardianId,
          action: 'lockout',
          at: nowIso,
        });
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

    const session = await this.createSession(cred.tenantId, cred.guardianId);
    await this.authRepo.insertSessionAudit({
      id: uuidv4(),
      tenantId: cred.tenantId,
      guardianId: cred.guardianId,
      action: 'login',
      sessionTokenHash: hashToken(session.token),
      at: nowIso,
    });
    return session;
  }

  async requestOtp(input: {
    phone: string;
    purpose: 'login' | 'reset' | 'claim' | 'verify_phone';
    tenantId?: string;
  }): Promise<{ ok?: true; expiresAt?: string; debugOtp?: string; error?: ServiceError }> {
    const phone = (input.phone || '').trim();
    if (!phone) return { error: { error: 'phone is required', status: 400 } };
    const tenantId = (input.tenantId || '').trim();
    if (!tenantId) return { error: { error: 'tenant_required', status: 400 } };

    const matches = await this.authRepo.listCredentialsByPhone(phone, tenantId);
    if (matches.length === 0) {
      // Look up guardian by phone via identity if no credential yet (claim/set-password flow)
      return { error: { error: 'guardian not found', status: 404 } };
    }
    const cred = matches[0]!;
    const otp = generateOtpCode();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
    await this.authRepo.insertOtpChallenge({
      id: uuidv4(),
      tenantId: cred.tenantId,
      guardianId: cred.guardianId,
      phone,
      purpose: input.purpose,
      otpHash: hashOtp(otp),
      expiresAt,
      createdAt: now.toISOString(),
    });
    await this.authRepo.insertSessionAudit({
      id: uuidv4(),
      tenantId: cred.tenantId,
      guardianId: cred.guardianId,
      action: 'otp_sent',
      meta: { purpose: input.purpose },
      at: now.toISOString(),
    });
    // In production, OTP is sent via notify sink; tests read debugOtp when NODE_ENV=test
    const result: {
      ok: true;
      expiresAt: string;
      debugOtp?: string;
    } = { ok: true, expiresAt };
    if ((process.env.NODE_ENV ?? '') === 'test') {
      result.debugOtp = otp;
    }
    return result;
  }

  async verifyOtp(input: {
    phone: string;
    otp: string;
    purpose: 'login' | 'reset' | 'claim' | 'verify_phone';
    newPassword?: string;
    tenantId?: string;
  }): Promise<{
    token?: string;
    tenantId?: string;
    guardianId?: string;
    expiresAt?: string;
    ok?: true;
    error?: ServiceError;
  }> {
    const phone = (input.phone || '').trim();
    const otp = (input.otp || '').trim();
    const tenantId = (input.tenantId || '').trim();
    if (!phone || !otp) {
      return { error: { error: 'phone and otp are required', status: 400 } };
    }
    if (!tenantId) {
      return { error: { error: 'tenant_required', status: 400 } };
    }
    const nowIso = this.clock().toISOString();
    const challenge = await this.authRepo.consumeOtpChallenge({
      phone,
      purpose: input.purpose,
      otpHash: hashOtp(otp),
      nowIso,
      tenantId,
    });
    if (!challenge) {
      return { error: { error: 'invalid or expired otp', status: 401 } };
    }
    await this.authRepo.insertSessionAudit({
      id: uuidv4(),
      tenantId: challenge.tenantId,
      guardianId: challenge.guardianId,
      action: 'otp_verified',
      meta: { purpose: input.purpose },
      at: nowIso,
    });

    if (input.purpose === 'reset' || input.purpose === 'claim') {
      const password = input.newPassword ?? '';
      if (password.length < 8) {
        return {
          error: { error: 'password must be at least 8 characters', status: 400 },
        };
      }
      const set = await this.setPassword({
        tenantId: challenge.tenantId,
        guardianId: challenge.guardianId,
        password,
      });
      if (set.error) return { error: set.error };
      if (input.purpose === 'claim') {
        return this.createSession(challenge.tenantId, challenge.guardianId);
      }
      return { ok: true };
    }

    if (input.purpose === 'verify_phone') {
      const g = await this.identityRepo.getGuardian(
        challenge.tenantId,
        challenge.guardianId,
      );
      if (g) {
        await this.identityRepo.updateGuardian(challenge.tenantId, g.id, {
          firstName: g.firstName,
          lastName: g.lastName,
          relation: g.relation,
          phone: g.phone,
          email: g.email,
          preferredLanguage: g.preferredLanguage,
          timezone: g.timezone,
          accessibility: g.accessibility,
          privacy: g.privacy,
          phoneVerified: true,
        });
      }
      return { ok: true };
    }

    return this.createSession(challenge.tenantId, challenge.guardianId);
  }

  async createInvitation(input: {
    tenantId: string;
    guardianId: string;
    studentId?: string | null;
    invitedBy: string;
  }): Promise<{
    invitation?: {
      id: string;
      expiresAt: string;
      claimToken: string;
      phone: string;
    };
    error?: ServiceError;
  }> {
    const tenantId = (input.tenantId || '').trim();
    const guardianId = (input.guardianId || '').trim();
    const guardian = await this.identityRepo.getGuardian(tenantId, guardianId);
    if (!guardian) {
      return { error: { error: 'Guardian not found', status: 404 } };
    }
    if (input.studentId) {
      const link = await this.identityRepo.getLink(
        tenantId,
        input.studentId,
        guardianId,
      );
      if (!link) {
        return { error: { error: 'guardian not linked to student', status: 400 } };
      }
    }
    const claimToken = generateOpaqueToken();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
    const id = uuidv4();
    await this.authRepo.insertInvitation({
      id,
      tenantId,
      guardianId,
      studentId: input.studentId ?? null,
      phone: guardian.phone,
      email: guardian.email,
      tokenHash: hashToken(claimToken),
      status: 'pending',
      invitedBy: input.invitedBy || '',
      expiresAt,
      createdAt: now.toISOString(),
    });
    // Ensure credential row exists so OTP/claim can resolve by phone
    const existing = await this.authRepo.getCredential(tenantId, guardianId);
    if (!existing) {
      await this.authRepo.upsertCredential({
        guardianId,
        tenantId,
        phone: guardian.phone,
        passwordHash: await hashPassword(generateOpaqueToken().slice(0, 16)),
        updatedAt: now.toISOString(),
      });
    }
    return {
      invitation: {
        id,
        expiresAt,
        claimToken,
        phone: guardian.phone,
      },
    };
  }

  async acceptInvitation(input: {
    claimToken: string;
    password: string;
  }): Promise<{
    token?: string;
    tenantId?: string;
    guardianId?: string;
    expiresAt?: string;
    error?: ServiceError;
  }> {
    const token = (input.claimToken || '').trim();
    if (!token) return { error: { error: 'claim_token is required', status: 400 } };
    if ((input.password || '').length < 8) {
      return {
        error: { error: 'password must be at least 8 characters', status: 400 },
      };
    }
    const invite = await this.authRepo.getInvitationByTokenHash(hashToken(token));
    if (!invite || invite.status !== 'pending') {
      return { error: { error: 'invitation not found', status: 404 } };
    }
    const now = this.clock();
    if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
      await this.authRepo.updateInvitationStatus(
        invite.id,
        'expired',
        null,
        now.toISOString(),
      );
      return { error: { error: 'invitation expired', status: 410 } };
    }
    const set = await this.setPassword({
      tenantId: invite.tenantId,
      guardianId: invite.guardianId,
      password: input.password,
    });
    if (set.error) return { error: set.error };
    await this.authRepo.updateInvitationStatus(
      invite.id,
      'accepted',
      now.toISOString(),
      now.toISOString(),
    );
    const g = await this.identityRepo.getGuardian(
      invite.tenantId,
      invite.guardianId,
    );
    if (g) {
      await this.identityRepo.updateGuardian(invite.tenantId, invite.guardianId, {
        firstName: g.firstName,
        lastName: g.lastName,
        relation: g.relation,
        phone: g.phone,
        email: g.email,
        preferredLanguage: g.preferredLanguage,
        timezone: g.timezone,
        accessibility: g.accessibility,
        privacy: g.privacy,
        phoneVerified: true,
      });
    }
    return this.createSession(invite.tenantId, invite.guardianId);
  }

  async listInvitations(tenantId: string, status?: string) {
    return this.authRepo.listInvitations(tenantId, status);
  }

  async revokeInvitation(
    tenantId: string,
    invitationId: string,
  ): Promise<{ ok?: true; error?: ServiceError }> {
    const rows = await this.authRepo.listInvitations(tenantId);
    const invite = rows.find((r) => r.id === invitationId);
    if (!invite) return { error: { error: 'invitation not found', status: 404 } };
    if (invite.status !== 'pending') {
      return { error: { error: 'invitation not pending', status: 409 } };
    }
    await this.authRepo.updateInvitationStatus(
      invitationId,
      'revoked',
      null,
      this.clock().toISOString(),
    );
    return { ok: true };
  }

  async revokeAllSessions(
    tenantId: string,
    guardianId: string,
  ): Promise<{ revoked: number }> {
    const revoked = await this.authRepo.revokeAllSessions(tenantId, guardianId);
    await this.authRepo.insertSessionAudit({
      id: uuidv4(),
      tenantId,
      guardianId,
      action: 'revoke',
      meta: { count: revoked },
      at: this.clock().toISOString(),
    });
    return { revoked };
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
      const hash = hashToken(raw);
      const session = await this.authRepo.getSessionByTokenHash(hash);
      await this.authRepo.revokeSession(hash);
      if (session) {
        await this.authRepo.insertSessionAudit({
          id: uuidv4(),
          tenantId: session.tenantId,
          guardianId: session.guardianId,
          action: 'logout',
          sessionTokenHash: hash,
          at: this.clock().toISOString(),
        });
      }
    }
    return { ok: true };
  }

  private async createSession(
    tenantId: string,
    guardianId: string,
  ): Promise<{
    token: string;
    tenantId: string;
    guardianId: string;
    expiresAt: string;
  }> {
    const now = this.clock();
    const token = generateOpaqueToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    await this.authRepo.insertSession({
      tokenHash,
      tenantId,
      guardianId,
      createdAt: now.toISOString(),
      expiresAt,
      revoked: false,
    });
    return { token, tenantId, guardianId, expiresAt };
  }
}

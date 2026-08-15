import type { Logger } from 'pino';
import type { KioskRepository } from '../repositories/kiosk-repository';
import {
  createActionToken,
  hashPin,
  validatePinFormat,
  verifyPinHash,
} from '../pin-crypto';
import type {
  AttendanceSettings,
  ClockPort,
  ClockResult,
  KioskMemberSummary,
  KioskVerifyResult,
  RosterPort,
  SettingsPort,
} from '../types';

interface ActionTokenEntry {
  email: string;
  name: string;
  expiresAt: number;
}

interface FailCounter {
  count: number;
  windowStart: number;
}

const TOKEN_TTL_MS = 2 * 60 * 1000;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

export interface KioskServiceDeps {
  repo: KioskRepository;
  settings: SettingsPort;
  roster: RosterPort;
  clock: ClockPort;
  logger: Logger;
  defaultTenantId?: string;
}

export class KioskService {
  private readonly tokens = new Map<string, ActionTokenEntry>();
  private readonly failures = new Map<string, FailCounter>();
  private readonly tenantId: string;

  constructor(private readonly deps: KioskServiceDeps) {
    this.tenantId = deps.defaultTenantId ?? 'default';
  }

  async getStatus(): Promise<{ enabled: boolean }> {
    const s = await this.deps.settings.getAttendanceSettings();
    return { enabled: !!s.kioskEnabled };
  }

  async getAttendanceSettings(): Promise<AttendanceSettings> {
    return this.deps.settings.getAttendanceSettings();
  }

  async searchMembers(query: string, limit = 40): Promise<KioskMemberSummary[]> {
    await this.requireEnabled();
    return this.deps.roster.searchActiveMembers(query, limit);
  }

  async setPin(
    email: string,
    pin: string,
  ): Promise<{ success: boolean; error?: string }> {
    const formatError = validatePinFormat(pin);
    if (formatError) return { success: false, error: formatError };

    const member = await this.deps.roster.getMemberByEmail(email);
    if (!member) return { success: false, error: 'Member not found' };

    await this.deps.repo.upsertPin(this.tenantId, email, hashPin(pin));
    this.deps.logger.info({ email: email.toLowerCase().trim() }, 'Kiosk PIN set');
    return { success: true };
  }

  async clearPin(email: string): Promise<{ success: boolean; error?: string }> {
    const removed = await this.deps.repo.deletePin(this.tenantId, email);
    if (!removed) return { success: false, error: 'No PIN set for this member' };
    this.deps.logger.info({ email: email.toLowerCase().trim() }, 'Kiosk PIN cleared');
    return { success: true };
  }

  async hasPin(email: string): Promise<boolean> {
    return this.deps.repo.hasPin(this.tenantId, email);
  }

  async verify(
    email: string,
    pin: string,
    clientIp?: string,
  ): Promise<KioskVerifyResult> {
    await this.requireEnabled();
    await this.checkIp(clientIp);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return { success: false, error: 'email is required' };

    if (this.isRateLimited(cleanEmail, clientIp)) {
      return { success: false, error: 'Too many failed attempts. Try again later.' };
    }

    const member = await this.deps.roster.getMemberByEmail(cleanEmail);
    if (!member) {
      this.recordFailure(cleanEmail, clientIp);
      return { success: false, error: 'Invalid PIN or employee' };
    }

    const row = await this.deps.repo.getPin(this.tenantId, cleanEmail);
    if (!row || !verifyPinHash(pin, row.pin_hash)) {
      this.recordFailure(cleanEmail, clientIp);
      return { success: false, error: 'Invalid PIN or employee' };
    }

    this.clearFailures(cleanEmail, clientIp);
    const token = createActionToken();
    this.tokens.set(token, {
      email: cleanEmail,
      name: member.name,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return {
      success: true,
      token,
      email: cleanEmail,
      name: member.name,
    };
  }

  async clock(params: {
    email: string;
    action: string;
    pin?: string;
    token?: string;
    clientIp?: string;
  }): Promise<ClockResult & { name?: string }> {
    await this.requireEnabled();
    await this.checkIp(params.clientIp);

    const cleanEmail = params.email.toLowerCase().trim();
    const action = String(params.action || '').toLowerCase().trim();
    if (!cleanEmail) return { success: false, blocked: true, error: 'email is required' };
    if (!['in', 'out', 'break', 'back'].includes(action)) {
      return { success: false, blocked: true, error: 'action must be in, out, break, or back' };
    }

    let name = '';

    if (params.token) {
      const entry = this.tokens.get(params.token);
      if (!entry || entry.expiresAt < Date.now() || entry.email !== cleanEmail) {
        return { success: false, blocked: true, error: 'Invalid or expired kiosk token' };
      }
      name = entry.name;
      this.tokens.delete(params.token);
    } else if (params.pin) {
      const verified = await this.verify(cleanEmail, params.pin, params.clientIp);
      if (!verified.success || !verified.token) {
        return { success: false, blocked: true, error: verified.error || 'PIN verification failed' };
      }
      name = verified.name || cleanEmail;
      // Consume the freshly issued token so one-shot verify+clock doesn't leave a live token
      this.tokens.delete(verified.token);
    } else {
      return { success: false, blocked: true, error: 'pin or token is required' };
    }

    const result = await this.deps.clock.clock(action, cleanEmail, name, 'kiosk');
    this.deps.logger.info(
      { email: cleanEmail, action, success: result.success },
      'Kiosk clock action',
    );
    return { ...result, name };
  }

  private async requireEnabled(): Promise<void> {
    const s = await this.deps.settings.getAttendanceSettings();
    if (!s.kioskEnabled) {
      const err = new Error('Kiosk mode is disabled');
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  private async checkIp(clientIp?: string): Promise<void> {
    const s = await this.deps.settings.getAttendanceSettings();
    if (!s.ipRestrictionEnabled) return;
    const allowed = (s.allowedIPs || []).map((ip) => ip.trim()).filter(Boolean);
    if (!allowed.length) return;
    const ip = (clientIp || '').trim();
    if (!ip || !allowed.includes(ip)) {
      const err = new Error('Kiosk access not allowed from this IP');
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  private failKey(email: string, clientIp?: string): string {
    return `${email}|${clientIp || 'unknown'}`;
  }

  private isRateLimited(email: string, clientIp?: string): boolean {
    const key = this.failKey(email, clientIp);
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.windowStart > FAIL_WINDOW_MS) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILS;
  }

  private recordFailure(email: string, clientIp?: string): void {
    const key = this.failKey(email, clientIp);
    const now = Date.now();
    const entry = this.failures.get(key);
    if (!entry || now - entry.windowStart > FAIL_WINDOW_MS) {
      this.failures.set(key, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }

  private clearFailures(email: string, clientIp?: string): void {
    this.failures.delete(this.failKey(email, clientIp));
  }
}

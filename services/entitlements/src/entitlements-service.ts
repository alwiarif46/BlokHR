import { v4 as uuidv4 } from 'uuid';
import { LicenseSigner } from './license-signer';
import { EntitlementsRepository } from './repositories/entitlements-repository';
import {
  DEFAULT_CLOUD_MODULES,
  DEFAULT_ENTERPRISE_MODULES,
  DEFAULT_SCHOOL_MODULES,
  TRIAL_DAYS,
  TRIAL_SEAT_LIMIT,
  type Entitlement,
  type EntitlementPlan,
  type EntitlementStatus,
  type EntitlementVertical,
  type ModuleCheckResult,
  type SeatCheckResult,
  type SignedLicenseClaims,
} from './types';

const WRITABLE_STATUSES: EntitlementStatus[] = ['trialing', 'active', 'past_due'];

export class EntitlementsService {
  constructor(
    private readonly repo: EntitlementsRepository,
    private readonly licenseSigner: LicenseSigner,
  ) {}

  async get(tenantId: string): Promise<Entitlement | null> {
    const ent = await this.repo.get(tenantId);
    if (!ent) return null;
    return this.refreshExpiry(ent);
  }

  async startCloudTrial(
    tenantId: string,
    seatLimit = TRIAL_SEAT_LIMIT,
    vertical: EntitlementVertical = 'hr',
  ): Promise<Entitlement> {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const modules =
      vertical === 'school' ? [...DEFAULT_SCHOOL_MODULES] : [...DEFAULT_CLOUD_MODULES];
    const entitlement: Entitlement = {
      tenantId,
      channel: 'cloud',
      plan: 'trial',
      status: 'trialing',
      seatLimit,
      modules,
      trialEndsAt,
      renewsAt: null,
      currency: 'INR',
      source: 'manual',
      vertical,
    };
    await this.repo.upsert(entitlement);
    await this.repo.recordEvent(
      tenantId,
      'trial_started',
      { seatLimit, trialEndsAt, vertical },
      uuidv4(),
    );
    return entitlement;
  }

  async applySubscription(input: {
    tenantId: string;
    plan: EntitlementPlan;
    status: EntitlementStatus;
    seatLimit: number;
    modules?: string[];
    renewsAt?: string | null;
    source?: 'razorpay' | 'manual';
    vertical?: EntitlementVertical;
  }): Promise<Entitlement> {
    const existing = await this.repo.get(input.tenantId);
    const entitlement: Entitlement = {
      tenantId: input.tenantId,
      channel: 'cloud',
      plan: input.plan,
      status: input.status,
      seatLimit: input.seatLimit,
      modules: input.modules ?? existing?.modules ?? [...DEFAULT_CLOUD_MODULES],
      trialEndsAt: existing?.trialEndsAt ?? null,
      renewsAt: input.renewsAt ?? null,
      currency: 'INR',
      source: input.source ?? 'razorpay',
      vertical: input.vertical ?? existing?.vertical ?? 'hr',
    };
    await this.repo.upsert(entitlement);
    await this.repo.recordEvent(
      input.tenantId,
      'subscription_updated',
      { plan: input.plan, status: input.status, seatLimit: input.seatLimit },
      uuidv4(),
    );
    return entitlement;
  }

  async activateSignedLicense(
    tenantId: string,
    licenseToken: string,
  ): Promise<{ success: boolean; entitlement?: Entitlement; error?: string }> {
    const verified = this.licenseSigner.verify(licenseToken);
    if (!verified.valid || !verified.claims) {
      return { success: false, error: verified.error ?? 'Invalid license' };
    }
    const claims = verified.claims;
    if (claims.tenantId !== tenantId && claims.tenantId !== '*') {
      return { success: false, error: 'License tenant mismatch' };
    }

    const existing = await this.repo.get(tenantId);
    const entitlement: Entitlement = {
      tenantId,
      channel: 'self_hosted',
      plan: claims.plan,
      status: 'active',
      seatLimit: claims.seatLimit,
      modules: claims.modules?.length ? claims.modules : [...DEFAULT_ENTERPRISE_MODULES],
      trialEndsAt: null,
      renewsAt: claims.validTo,
      currency: 'INR',
      source: 'signed_license',
      vertical: existing?.vertical ?? 'hr',
    };
    await this.repo.upsert(entitlement, licenseToken);
    await this.repo.recordEvent(
      tenantId,
      'license_activated',
      { plan: claims.plan, validTo: claims.validTo, seatLimit: claims.seatLimit },
      uuidv4(),
    );
    return { success: true, entitlement };
  }

  issueSignedLicense(claims: SignedLicenseClaims): string {
    return this.licenseSigner.sign(claims);
  }

  async checkSeats(tenantId: string, activeSeats: number): Promise<SeatCheckResult> {
    const ent = await this.get(tenantId);
    if (!ent) {
      return { allowed: false, seatLimit: 0, activeSeats, reason: 'No entitlement found' };
    }
    if (!WRITABLE_STATUSES.includes(ent.status)) {
      return {
        allowed: false,
        seatLimit: ent.seatLimit,
        activeSeats,
        reason: `Subscription is ${ent.status}`,
      };
    }
    if (activeSeats > ent.seatLimit) {
      return {
        allowed: false,
        seatLimit: ent.seatLimit,
        activeSeats,
        reason: `Seat limit exceeded (${activeSeats}/${ent.seatLimit})`,
      };
    }
    return { allowed: true, seatLimit: ent.seatLimit, activeSeats };
  }

  async canUseModule(tenantId: string, moduleId: string): Promise<ModuleCheckResult> {
    const ent = await this.get(tenantId);
    if (!ent) return { allowed: false, reason: 'No entitlement found' };
    if (!WRITABLE_STATUSES.includes(ent.status) && ent.status !== 'past_due') {
      return { allowed: false, reason: `Subscription is ${ent.status}` };
    }
    if (ent.modules.length === 0) return { allowed: true };
    if (!ent.modules.includes(moduleId)) {
      return { allowed: false, reason: `Module "${moduleId}" not included in plan` };
    }
    return { allowed: true };
  }

  async canWrite(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const ent = await this.get(tenantId);
    if (!ent) return { allowed: false, reason: 'No entitlement found' };
    if (ent.status === 'expired' || ent.status === 'cancelled') {
      return { allowed: false, reason: `Subscription is ${ent.status}` };
    }
    return { allowed: true };
  }

  private async refreshExpiry(ent: Entitlement): Promise<Entitlement> {
    if (ent.status === 'trialing' && ent.trialEndsAt) {
      if (Date.now() > Date.parse(ent.trialEndsAt)) {
        const expired: Entitlement = { ...ent, status: 'expired' };
        await this.repo.upsert(expired);
        return expired;
      }
    }
    if (ent.channel === 'self_hosted' && ent.renewsAt) {
      if (Date.now() > Date.parse(ent.renewsAt)) {
        const expired: Entitlement = { ...ent, status: 'expired' };
        await this.repo.upsert(expired);
        return expired;
      }
    }
    return ent;
  }
}

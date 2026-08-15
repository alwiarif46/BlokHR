import type { Logger } from 'pino';
import type { BillingProvider, BillingPlanId, CheckoutSession, PaymentLink } from './providers/billing-provider';
import { PLAN_CATALOG } from './providers/billing-provider';

export interface EntitlementsHttpClient {
  applySubscription(input: {
    tenantId: string;
    plan: BillingPlanId | 'trial';
    status: 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled';
    seatLimit: number;
    renewsAt?: string | null;
    source?: 'razorpay' | 'manual';
  }): Promise<void>;
}

export class BillingService {
  constructor(
    private readonly provider: BillingProvider,
    private readonly entitlements: EntitlementsHttpClient,
    private readonly logger: Logger,
  ) {}

  getCatalog() {
    return {
      currency: 'INR',
      methods: ['upi', 'card', 'wallet', 'netbanking'],
      provider: this.provider.name,
      plans: Object.entries(PLAN_CATALOG).map(([id, plan]) => ({
        id,
        label: plan.label,
        monthlyPaise: plan.monthlyPaise,
        seatLimit: plan.seatLimit,
      })),
    };
  }

  async startCheckout(input: {
    tenantId: string;
    planId: BillingPlanId;
    customerEmail: string;
    customerName?: string;
    period?: 'monthly' | 'quarterly' | 'biannual';
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    const catalog = PLAN_CATALOG[input.planId];
    if (!catalog) throw new Error(`Unknown plan: ${input.planId}`);

    const period = input.period ?? 'monthly';
    let amountPaise = catalog.monthlyPaise;
    if (period === 'quarterly') amountPaise = catalog.monthlyPaise * 3;
    if (period === 'biannual') amountPaise = catalog.monthlyPaise * 6;

    const session = await this.provider.createCheckoutSession({
      tenantId: input.tenantId,
      planId: input.planId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      amountPaise,
      period,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    this.logger.info(
      { tenantId: input.tenantId, planId: input.planId, provider: session.provider },
      'Checkout session created',
    );
    return session;
  }

  async createEnterprisePaymentLink(input: {
    tenantId: string;
    customerEmail: string;
    customerName?: string;
    planId?: BillingPlanId;
    period: 'quarterly' | 'biannual';
    callbackUrl: string;
    description?: string;
  }): Promise<PaymentLink> {
    const planId = input.planId ?? 'enterprise';
    const catalog = PLAN_CATALOG[planId];
    const amountPaise =
      input.period === 'biannual' ? catalog.monthlyPaise * 6 : catalog.monthlyPaise * 3;

    const link = await this.provider.createPaymentLink({
      tenantId: input.tenantId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      amountPaise,
      description:
        input.description ||
        `BlokHR ${catalog.label} ${input.period} service fee`,
      period: input.period,
      callbackUrl: input.callbackUrl,
    });

    this.logger.info(
      { tenantId: input.tenantId, linkId: link.linkId, provider: link.provider },
      'Enterprise payment link created',
    );
    return link;
  }

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<{ ok: boolean }> {
    const result = await this.provider.verifyAndParseWebhook(rawBody, signature);
    if (!result.handled || !result.tenantId || !result.subscriptionUpdate) {
      return { ok: true };
    }

    await this.entitlements.applySubscription({
      tenantId: result.tenantId,
      plan: result.subscriptionUpdate.plan,
      status: result.subscriptionUpdate.status,
      seatLimit: result.subscriptionUpdate.seatLimit,
      renewsAt: result.subscriptionUpdate.renewsAt,
      source: 'razorpay',
    });

    this.logger.info(
      {
        tenantId: result.tenantId,
        eventType: result.eventType,
        status: result.subscriptionUpdate.status,
      },
      'Webhook applied to entitlements',
    );
    return { ok: true };
  }
}

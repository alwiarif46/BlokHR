import { v4 as uuidv4 } from 'uuid';
import {
  PAYMENT_METHODS,
  type BillingProvider,
  type CheckoutSession,
  type CheckoutSessionInput,
  type PaymentLink,
  type PaymentLinkInput,
  type WebhookResult,
} from './billing-provider';

/**
 * In-memory / test provider that advertises India payment methods.
 * Used when Razorpay keys are not configured.
 */
export class MockBillingProvider implements BillingProvider {
  readonly name = 'mock' as const;
  private readonly sessions = new Map<string, CheckoutSessionInput>();
  private readonly links = new Map<string, PaymentLinkInput>();

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const sessionId = `mock_sess_${uuidv4()}`;
    const orderId = `order_${uuidv4().replace(/-/g, '').slice(0, 14)}`;
    this.sessions.set(sessionId, input);
    return {
      provider: 'mock',
      sessionId,
      orderId,
      amountPaise: input.amountPaise,
      currency: 'INR',
      methods: [...PAYMENT_METHODS],
      checkoutUrl: `${input.successUrl}?mock_session=${sessionId}&tenant=${input.tenantId}`,
    };
  }

  async createPaymentLink(input: PaymentLinkInput): Promise<PaymentLink> {
    const linkId = `plink_${uuidv4().replace(/-/g, '').slice(0, 14)}`;
    this.links.set(linkId, input);
    return {
      provider: 'mock',
      linkId,
      shortUrl: `${input.callbackUrl}?mock_link=${linkId}&tenant=${input.tenantId}`,
      amountPaise: input.amountPaise,
      currency: 'INR',
      methods: [...PAYMENT_METHODS],
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    _signature: string | undefined,
  ): Promise<WebhookResult> {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { handled: false };
    }

    const event = (payload.event as string) || 'payment.captured';
    const tenantId =
      (payload.tenantId as string) ||
      ((payload.payload as { tenantId?: string } | undefined)?.tenantId);

    if (!tenantId) return { handled: false };

    if (event.includes('failed') || event.includes('halted')) {
      return {
        handled: true,
        tenantId,
        eventType: event,
        subscriptionUpdate: {
          plan: 'starter',
          status: 'past_due',
          seatLimit: 50,
        },
      };
    }

    if (event.includes('cancelled')) {
      return {
        handled: true,
        tenantId,
        eventType: event,
        subscriptionUpdate: {
          plan: 'starter',
          status: 'cancelled',
          seatLimit: 50,
        },
      };
    }

    const plan = (payload.planId as 'starter' | 'business' | 'enterprise') || 'starter';
    const seatLimit = plan === 'business' ? 200 : plan === 'enterprise' ? 1000 : 50;
    return {
      handled: true,
      tenantId,
      eventType: event,
      subscriptionUpdate: {
        plan,
        status: 'active',
        seatLimit,
        renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    };
  }
}

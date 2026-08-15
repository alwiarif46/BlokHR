import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  PAYMENT_METHODS,
  PLAN_CATALOG,
  type BillingProvider,
  type CheckoutSession,
  type CheckoutSessionInput,
  type PaymentLink,
  type PaymentLinkInput,
  type WebhookResult,
} from './billing-provider';
import { MockBillingProvider } from './mock-provider';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/**
 * Razorpay billing provider for India (UPI, cards, wallets, netbanking).
 * Uses Razorpay Orders + Payment Links REST APIs.
 * When network/API is unavailable in tests, prefer MockBillingProvider.
 */
export class RazorpayBillingProvider implements BillingProvider {
  readonly name = 'razorpay' as const;

  constructor(private readonly config: RazorpayConfig) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64')}`;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const receipt = `blk_${input.tenantId}_${Date.now()}`.slice(0, 40);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          tenant_id: input.tenantId,
          plan_id: input.planId,
          period: input.period,
          customer_email: input.customerEmail,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Razorpay order create failed: ${response.status} ${text}`);
    }

    const order = (await response.json()) as { id: string; amount: number };
    return {
      provider: 'razorpay',
      sessionId: `rzp_${uuidv4()}`,
      orderId: order.id,
      amountPaise: order.amount,
      currency: 'INR',
      methods: [...PAYMENT_METHODS],
      keyId: this.config.keyId,
    };
  }

  async createPaymentLink(input: PaymentLinkInput): Promise<PaymentLink> {
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: 'INR',
        accept_partial: false,
        description: input.description,
        customer: {
          name: input.customerName || input.customerEmail,
          email: input.customerEmail,
        },
        notify: { email: true, sms: false },
        reminder_enable: true,
        callback_url: input.callbackUrl,
        callback_method: 'get',
        notes: {
          tenant_id: input.tenantId,
          period: input.period,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Razorpay payment link failed: ${response.status} ${text}`);
    }

    const link = (await response.json()) as { id: string; short_url: string; amount: number };
    return {
      provider: 'razorpay',
      linkId: link.id,
      shortUrl: link.short_url,
      amountPaise: link.amount,
      currency: 'INR',
      methods: [...PAYMENT_METHODS],
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<WebhookResult> {
    if (!signature) return { handled: false };
    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      payload?: {
        payment?: { entity?: { notes?: Record<string, string>; amount?: number } };
        payment_link?: { entity?: { notes?: Record<string, string> } };
        subscription?: { entity?: { notes?: Record<string, string>; status?: string } };
      };
    };

    const notes =
      payload.payload?.payment?.entity?.notes ||
      payload.payload?.payment_link?.entity?.notes ||
      payload.payload?.subscription?.entity?.notes ||
      {};
    const tenantId = notes.tenant_id;
    if (!tenantId) return { handled: false, eventType: payload.event };

    const planId = (notes.plan_id as 'starter' | 'business' | 'enterprise') || 'starter';
    const catalog = PLAN_CATALOG[planId];

    if (
      payload.event === 'payment.captured' ||
      payload.event === 'payment_link.paid' ||
      payload.event === 'subscription.activated' ||
      payload.event === 'subscription.charged'
    ) {
      return {
        handled: true,
        tenantId,
        eventType: payload.event,
        subscriptionUpdate: {
          plan: planId,
          status: 'active',
          seatLimit: catalog.seatLimit,
          renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
      };
    }

    if (
      payload.event === 'payment.failed' ||
      payload.event === 'subscription.pending' ||
      payload.event === 'subscription.halted'
    ) {
      return {
        handled: true,
        tenantId,
        eventType: payload.event,
        subscriptionUpdate: {
          plan: planId,
          status: 'past_due',
          seatLimit: catalog.seatLimit,
        },
      };
    }

    if (payload.event === 'subscription.cancelled') {
      return {
        handled: true,
        tenantId,
        eventType: payload.event,
        subscriptionUpdate: {
          plan: planId,
          status: 'cancelled',
          seatLimit: catalog.seatLimit,
        },
      };
    }

    return { handled: false, tenantId, eventType: payload.event };
  }
}

export function createBillingProvider(env: {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
}): BillingProvider {
  if (env.razorpayKeyId && env.razorpayKeySecret) {
    return new RazorpayBillingProvider({
      keyId: env.razorpayKeyId,
      keySecret: env.razorpayKeySecret,
      webhookSecret: env.razorpayWebhookSecret || env.razorpayKeySecret,
    });
  }
  return new MockBillingProvider();
}

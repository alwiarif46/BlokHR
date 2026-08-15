/** PSP-agnostic billing contracts. Launch provider: Razorpay (INR). */

export type BillingPlanId = 'starter' | 'business' | 'enterprise';

export interface CheckoutSessionInput {
  tenantId: string;
  planId: BillingPlanId;
  customerEmail: string;
  customerName?: string;
  /** Amount in paise (INR * 100) */
  amountPaise: number;
  /** Billing cycle for subscriptions */
  period: 'monthly' | 'quarterly' | 'biannual';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  provider: 'razorpay' | 'mock';
  sessionId: string;
  /** Client checkout key / order id for Razorpay.js */
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  /** Methods advertised to the UI */
  methods: Array<'upi' | 'card' | 'wallet' | 'netbanking'>;
  /** Razorpay key id for Checkout (public) */
  keyId?: string;
  /** Mock/hosted redirect when not using Razorpay.js */
  checkoutUrl?: string;
}

export interface PaymentLinkInput {
  tenantId: string;
  customerEmail: string;
  customerName?: string;
  amountPaise: number;
  description: string;
  period: 'quarterly' | 'biannual';
  /** Absolute URL customer lands on after payment */
  callbackUrl: string;
}

export interface PaymentLink {
  provider: 'razorpay' | 'mock';
  linkId: string;
  shortUrl: string;
  amountPaise: number;
  currency: 'INR';
  methods: Array<'upi' | 'card' | 'wallet' | 'netbanking'>;
}

export interface WebhookResult {
  handled: boolean;
  tenantId?: string;
  eventType?: string;
  subscriptionUpdate?: {
    plan: BillingPlanId | 'trial';
    status: 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled';
    seatLimit: number;
    renewsAt?: string | null;
  };
}

export interface BillingProvider {
  readonly name: 'razorpay' | 'mock';
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  createPaymentLink(input: PaymentLinkInput): Promise<PaymentLink>;
  verifyAndParseWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<WebhookResult>;
}

export const PLAN_CATALOG: Record<
  BillingPlanId,
  { label: string; monthlyPaise: number; seatLimit: number }
> = {
  starter: { label: 'Starter', monthlyPaise: 99900, seatLimit: 50 },
  business: { label: 'Business', monthlyPaise: 249900, seatLimit: 200 },
  enterprise: { label: 'Enterprise', monthlyPaise: 999900, seatLimit: 1000 },
};

export const PAYMENT_METHODS: Array<'upi' | 'card' | 'wallet' | 'netbanking'> = [
  'upi',
  'card',
  'wallet',
  'netbanking',
];

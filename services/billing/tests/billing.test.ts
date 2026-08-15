import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createBillingApp } from '../src/index';
import { MockBillingProvider } from '../src/providers/mock-provider';
import type { Express } from 'express';

class FakeEntitlements {
  updates: Array<Record<string, unknown>> = [];

  async applySubscription(input: Record<string, unknown>): Promise<void> {
    this.updates.push(input);
  }
}

describe('Billing service', () => {
  let app: Express;
  let entitlements: FakeEntitlements;

  beforeEach(() => {
    entitlements = new FakeEntitlements();
    const created = createBillingApp({
      entitlementsBaseUrl: 'http://unused',
      logger: pino({ level: 'silent' }),
      provider: new MockBillingProvider(),
      entitlementsClient: entitlements as never,
    });
    app = created.app;
  });

  it('returns INR catalog with UPI/card/wallet methods', async () => {
    const res = await request(app).get('/api/billing/catalog');
    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('INR');
    expect(res.body.methods).toEqual(
      expect.arrayContaining(['upi', 'card', 'wallet', 'netbanking']),
    );
    expect(res.body.plans.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a checkout session for cloud SMB', async () => {
    const res = await request(app).post('/api/billing/checkout').send({
      tenantId: 'default',
      planId: 'starter',
      customerEmail: 'admin@acme.com',
      successUrl: 'http://localhost:3000/billing/success',
      cancelUrl: 'http://localhost:3000/billing/cancel',
    });
    expect(res.status).toBe(201);
    expect(res.body.currency).toBe('INR');
    expect(res.body.methods).toContain('upi');
    expect(res.body.orderId).toBeTruthy();
  });

  it('creates an enterprise quarterly payment link', async () => {
    const res = await request(app).post('/api/billing/payment-links').send({
      tenantId: 'acme',
      customerEmail: 'billing@acme.com',
      period: 'quarterly',
      callbackUrl: 'http://localhost:3000/billing/callback',
    });
    expect(res.status).toBe(201);
    expect(res.body.shortUrl).toContain('acme');
    expect(res.body.methods).toContain('upi');
  });

  it('applies simulated webhook to entitlements', async () => {
    const res = await request(app).post('/api/billing/webhooks/simulate').send({
      tenantId: 'default',
      planId: 'business',
      event: 'payment.captured',
    });
    expect(res.status).toBe(200);
    expect(entitlements.updates).toHaveLength(1);
    expect(entitlements.updates[0].plan).toBe('business');
    expect(entitlements.updates[0].status).toBe('active');
    expect(entitlements.updates[0].source).toBe('razorpay');
  });
});

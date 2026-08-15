import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { Logger } from 'pino';
import { BillingService } from './billing-service';
import { createBillingProvider } from './providers/razorpay-provider';
import { createBillingRouter } from './routes/billing';
import { EntitlementsHttpClient } from './clients/entitlements-client';
import type { BillingProvider } from './providers/billing-provider';

export interface BillingAppOptions {
  entitlementsBaseUrl: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  logger: Logger;
  /** Inject provider for tests */
  provider?: BillingProvider;
  entitlementsClient?: EntitlementsHttpClient;
}

export function createBillingApp(options: BillingAppOptions): {
  app: Express;
  service: BillingService;
} {
  const entitlements =
    options.entitlementsClient ?? new EntitlementsHttpClient(options.entitlementsBaseUrl);
  const provider =
    options.provider ??
    createBillingProvider({
      razorpayKeyId: options.razorpayKeyId,
      razorpayKeySecret: options.razorpayKeySecret,
      razorpayWebhookSecret: options.razorpayWebhookSecret,
    });

  const service = new BillingService(provider, entitlements, options.logger);
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/billing', createBillingRouter(service));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    options.logger.error({ err }, 'Billing error');
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return { app, service };
}

export { BillingService, createBillingProvider, createBillingRouter, EntitlementsHttpClient };
export * from './providers/billing-provider';
export { MockBillingProvider } from './providers/mock-provider';
export { RazorpayBillingProvider } from './providers/razorpay-provider';

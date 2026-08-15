import { Router, Request, Response, NextFunction } from 'express';
import { BillingService } from './billing-service';
import type { BillingPlanId } from './providers/billing-provider';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createBillingRouter(service: BillingService): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'billing' });
  });

  router.get('/catalog', (_req, res) => {
    res.json(service.getCatalog());
  });

  router.post(
    '/checkout',
    asyncHandler(async (req, res) => {
      const {
        tenantId,
        planId,
        customerEmail,
        customerName,
        period,
        successUrl,
        cancelUrl,
      } = req.body as {
        tenantId?: string;
        planId?: BillingPlanId;
        customerEmail?: string;
        customerName?: string;
        period?: 'monthly' | 'quarterly' | 'biannual';
        successUrl?: string;
        cancelUrl?: string;
      };

      if (!tenantId || !planId || !customerEmail || !successUrl || !cancelUrl) {
        res.status(400).json({
          error: 'tenantId, planId, customerEmail, successUrl, and cancelUrl are required',
        });
        return;
      }

      const session = await service.startCheckout({
        tenantId,
        planId,
        customerEmail,
        customerName,
        period,
        successUrl,
        cancelUrl,
      });
      res.status(201).json(session);
    }),
  );

  router.post(
    '/payment-links',
    asyncHandler(async (req, res) => {
      const {
        tenantId,
        customerEmail,
        customerName,
        planId,
        period,
        callbackUrl,
        description,
      } = req.body as {
        tenantId?: string;
        customerEmail?: string;
        customerName?: string;
        planId?: BillingPlanId;
        period?: 'quarterly' | 'biannual';
        callbackUrl?: string;
        description?: string;
      };

      if (!tenantId || !customerEmail || !period || !callbackUrl) {
        res.status(400).json({
          error: 'tenantId, customerEmail, period, and callbackUrl are required',
        });
        return;
      }

      const link = await service.createEnterprisePaymentLink({
        tenantId,
        customerEmail,
        customerName,
        planId,
        period,
        callbackUrl,
        description,
      });
      res.status(201).json(link);
    }),
  );

  router.post(
    '/webhooks/razorpay',
    asyncHandler(async (req, res) => {
      const signature = req.headers['x-razorpay-signature'] as string | undefined;
      const rawBody =
        typeof req.body === 'string'
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body.toString('utf8')
            : JSON.stringify(req.body);
      await service.handleWebhook(rawBody, signature);
      res.json({ ok: true });
    }),
  );

  /** Dev/test helper: simulate a successful payment webhook (mock provider). */
  router.post(
    '/webhooks/simulate',
    asyncHandler(async (req, res) => {
      const { tenantId, planId, event } = req.body as {
        tenantId?: string;
        planId?: string;
        event?: string;
      };
      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }
      await service.handleWebhook(
        JSON.stringify({
          event: event || 'payment.captured',
          tenantId,
          planId: planId || 'starter',
        }),
        undefined,
      );
      res.json({ ok: true });
    }),
  );

  return router;
}

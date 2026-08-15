import dotenv from 'dotenv';
import pino from 'pino';
import { createBillingApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3002', 10);
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = createBillingApp({
    entitlementsBaseUrl: process.env.ENTITLEMENTS_URL || 'http://127.0.0.1:3001',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'Billing service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

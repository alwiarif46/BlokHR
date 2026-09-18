import dotenv from 'dotenv';
import pino from 'pino';
import { createEntitlementsApp } from './index';

dotenv.config();

const DEV_LICENSE_SIGNING_SECRET = 'dev-license-signing-secret-change-me';

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3001', 10);
  const dbPath = process.env.ENTITLEMENTS_DB_PATH || './entitlements.db';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const licenseSigningSecret = (process.env.LICENSE_SIGNING_SECRET ?? '').trim();
  if (
    nodeEnv === 'production' &&
    (!licenseSigningSecret || licenseSigningSecret === DEV_LICENSE_SIGNING_SECRET)
  ) {
    throw new Error('FATAL: LICENSE_SIGNING_SECRET is required in production');
  }
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createEntitlementsApp({
    dbPath,
    licenseSigningSecret: licenseSigningSecret || DEV_LICENSE_SIGNING_SECRET,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'Entitlements service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

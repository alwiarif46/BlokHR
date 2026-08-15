import dotenv from 'dotenv';
import pino from 'pino';
import { createEntitlementsApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3001', 10);
  const dbPath = process.env.ENTITLEMENTS_DB_PATH || './entitlements.db';
  const licenseSigningSecret =
    process.env.LICENSE_SIGNING_SECRET || 'dev-license-signing-secret-change-me';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createEntitlementsApp({
    dbPath,
    licenseSigningSecret,
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

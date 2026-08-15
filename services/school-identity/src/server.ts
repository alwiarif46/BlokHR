import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolIdentityApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3011', 10);
  const dbPath = process.env.SCHOOL_IDENTITY_DB_PATH || './school-identity.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolIdentityApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School identity service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

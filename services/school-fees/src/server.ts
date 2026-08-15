import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolFeesApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3017', 10);
  const dbPath = process.env.SCHOOL_FEES_DB_PATH || './school-fees.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolFeesApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School fees service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

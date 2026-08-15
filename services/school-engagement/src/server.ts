import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolEngagementApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3016', 10);
  const dbPath = process.env.SCHOOL_ENGAGEMENT_DB_PATH || './school-engagement.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolEngagementApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School engagement service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

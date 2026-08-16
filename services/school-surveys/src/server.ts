import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolSurveysApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3022', 10);
  const dbPath = process.env.SCHOOL_SURVEYS_DB_PATH || './school-surveys.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolSurveysApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School surveys service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

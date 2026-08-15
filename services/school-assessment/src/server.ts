import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolAssessmentApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3015', 10);
  const dbPath = process.env.SCHOOL_ASSESSMENT_DB_PATH || './school-assessment.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolAssessmentApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School assessment service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

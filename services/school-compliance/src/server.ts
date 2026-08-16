import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolComplianceApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3019', 10);
  const dbPath = process.env.SCHOOL_COMPLIANCE_DB_PATH || './school-compliance.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolComplianceApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School compliance service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

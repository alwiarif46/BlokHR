import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolAcademicsApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3014', 10);
  const dbPath = process.env.SCHOOL_ACADEMICS_DB_PATH || './school-academics.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolAcademicsApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School academics service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

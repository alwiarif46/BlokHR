import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolTimetableApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3012', 10);
  const dbPath = process.env.SCHOOL_TIMETABLE_DB_PATH || './school-timetable.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolTimetableApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School timetable service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolAttendanceApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3013', 10);
  const dbPath = process.env.SCHOOL_ATTENDANCE_DB_PATH || './school-attendance.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolAttendanceApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School attendance service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

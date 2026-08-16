import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolLibraryApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3020', 10);
  const dbPath = process.env.SCHOOL_LIBRARY_DB_PATH || './school-library.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolLibraryApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School library service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

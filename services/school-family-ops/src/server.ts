import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolFamilyOpsApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3023', 10);
  const dbPath =
    process.env.SCHOOL_FAMILY_OPS_DB_PATH || './school-family-ops.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolFamilyOpsApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School family-ops service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

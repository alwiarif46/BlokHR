import dotenv from 'dotenv';
import pino from 'pino';
import { createSchoolTransportApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3018', 10);
  const dbPath = process.env.SCHOOL_TRANSPORT_DB_PATH || './school-transport.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createSchoolTransportApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'School transport service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import dotenv from 'dotenv';
import pino from 'pino';
import { createTimeTrackingApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3030', 10);
  const dbPath = process.env.TIME_TRACKING_DB_PATH || './time-tracking.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createTimeTrackingApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'Time tracking service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

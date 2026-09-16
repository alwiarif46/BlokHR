import dotenv from 'dotenv';
import pino from 'pino';
import { createOvertimeApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || '3031', 10);
  const dbPath = process.env.OVERTIME_DB_PATH || './overtime.db';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  const { app } = await createOvertimeApp({
    dbPath,
    logger,
  });

  app.listen(port, () => {
    logger.info({ port }, 'Overtime service listening');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

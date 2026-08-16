import 'dotenv/config';
import pino from 'pino';
import path from 'path';
import { createLearningApp } from './index';

async function main(): Promise<void> {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const port = Number(process.env.PORT || 3021);
  const dbPath = process.env.LEARNING_DB_PATH || './learning.db';

  const { app, db } = await createLearningApp({
    dbPath,
    migrationsDir: path.resolve(__dirname, '..', 'migrations'),
    logger,
    tenantId: process.env.DEFAULT_TENANT_ID || 'default',
  });

  const server = app.listen(port, () => {
    logger.info({ port, dbPath }, 'Learning service listening');
  });

  const shutdown = (): void => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

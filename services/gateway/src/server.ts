import dotenv from 'dotenv';
import pino from 'pino';
import { loadGatewayConfig } from './config';
import { createGatewayApp } from './index';

dotenv.config();

async function main(): Promise<void> {
  const config = loadGatewayConfig();
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const { app } = createGatewayApp({ config, logger });

  app.listen(config.port, () => {
    logger.info(
      { port: config.port, monolithUrl: config.monolithUrl, frontendDir: config.frontendDir },
      'Gateway listening',
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

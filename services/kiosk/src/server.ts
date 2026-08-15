import 'dotenv/config';
import pino from 'pino';
import { createKioskApp } from './index';

/**
 * Standalone kiosk process for local/dev. Production mounts via backend gateway.
 * Requires injected ports — this stub uses no-op defaults for health checks only.
 */
async function main(): Promise<void> {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const dbPath = process.env.KIOSK_DB_PATH || './kiosk.db';
  const port = Number(process.env.KIOSK_PORT || 3012);

  const { app, db } = await createKioskApp({
    dbPath,
    logger,
    settings: {
      async getAttendanceSettings() {
        return { kioskEnabled: true, ipRestrictionEnabled: false, allowedIPs: [] };
      },
    },
    roster: {
      async searchActiveMembers() {
        return [];
      },
      async getMemberByEmail() {
        return null;
      },
    },
    clock: {
      async clock() {
        return { success: false, blocked: true, error: 'Standalone mode: clock not wired' };
      },
    },
  });

  const server = app.listen(port, () => {
    logger.info({ port, dbPath }, 'Kiosk service listening');
  });

  const shutdown = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

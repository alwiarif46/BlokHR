import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import type { SseBroadcaster } from '../sse/broadcaster';

type PlatformName = 'zoom' | 'webex' | 'goto' | 'bluejeans';

const VALID_PLATFORMS = new Set<PlatformName>(['zoom', 'webex', 'goto', 'bluejeans']);

const SECRET_COLS = new Set([
  'zoom_client_secret',
  'webex_bot_token',
  'goto_client_secret',
  'bluejeans_api_key',
]);

const PLATFORM_COLS: Record<PlatformName, string[]> = {
  zoom: ['enabled', 'zoom_account_id', 'zoom_client_id', 'zoom_client_secret'],
  webex: ['enabled', 'webex_bot_token'],
  goto: ['enabled', 'goto_client_id', 'goto_client_secret'],
  bluejeans: ['enabled', 'bluejeans_api_key'],
};

function maskSecret(val: unknown): string {
  const s = String(val ?? '');
  if (!s) return '';
  return '****' + s.slice(-4);
}

function applyMask(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = SECRET_COLS.has(k) && v ? maskSecret(v) : v;
  }
  return out;
}

export function createMeetingPlatformsRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();

  async function requireAdmin(email: string): Promise<void> {
    const row = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
    if (!row) throw new AppError('Admin access required', 403);
  }

  /** GET /api/meeting-platforms — all 4 platforms, secrets masked. */
  router.get(
    '/meeting-platforms',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const rows = await db.all<Record<string, unknown>>(
        'SELECT * FROM meeting_platform_config ORDER BY platform',
      );
      res.json({ platforms: rows.map(applyMask) });
    }),
  );

  /** PUT /api/meeting-platforms/:platform — update credentials. */
  router.put(
    '/meeting-platforms/:platform',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const platform = req.params.platform as PlatformName;
      if (!VALID_PLATFORMS.has(platform)) throw new AppError('Invalid platform', 400);

      const body = req.body as Record<string, unknown>;
      const allowed = PLATFORM_COLS[platform];
      const sets: string[] = [];
      const params: unknown[] = [];

      for (const col of allowed) {
        if (col in body) {
          sets.push(`${col} = ?`);
          params.push(col === 'enabled' ? (body[col] ? 1 : 0) : body[col]);
        }
      }
      if (sets.length === 0) throw new AppError('No recognised fields to update', 400);

      sets.push("updated_at = datetime('now')");
      params.push(platform);
      await db.run(
        `UPDATE meeting_platform_config SET ${sets.join(', ')} WHERE platform = ?`,
        params,
      );

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'meeting_platforms' });
      logger.info({ platform, by: callerEmail }, 'Meeting platform updated');
      res.json({ success: true });
    }),
  );

  /** POST /api/meeting-platforms/:platform/test — test connection. */
  router.post(
    '/meeting-platforms/:platform/test',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const platform = req.params.platform as PlatformName;
      if (!VALID_PLATFORMS.has(platform)) throw new AppError('Invalid platform', 400);

      const row = await db.get<{ enabled: number } & Record<string, unknown>>(
        'SELECT * FROM meeting_platform_config WHERE platform = ?',
        [platform],
      );
      if (!row || !row.enabled) {
        res.json({ success: false, message: `${platform} is not enabled` });
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        let success = false;
        let message = 'Credentials missing or test not supported';

        if (
          platform === 'zoom' &&
          row.zoom_account_id &&
          row.zoom_client_id &&
          row.zoom_client_secret
        ) {
          // Zoom Server-to-Server OAuth: get access token then call /users/me
          const creds = Buffer.from(
            `${row.zoom_client_id as string}:${row.zoom_client_secret as string}`,
          ).toString('base64');
          const tokenRes = await fetch(
            `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${row.zoom_account_id as string}`,
            {
              method: 'POST',
              headers: { Authorization: `Basic ${creds}` },
              signal: controller.signal,
            },
          );
          success = tokenRes.ok;
          message = success ? 'Zoom connection successful' : 'Zoom token request failed';
        } else if (platform === 'webex' && row.webex_bot_token) {
          const r = await fetch('https://webexapis.com/v1/people/me', {
            headers: { Authorization: `Bearer ${row.webex_bot_token as string}` },
            signal: controller.signal,
          });
          success = r.ok;
          message = success ? 'Webex connection successful' : 'Webex auth failed';
        }

        clearTimeout(timeout);
        res.json({ success, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Test failed';
        res.json({ success: false, message });
      }
    }),
  );

  return router;
}

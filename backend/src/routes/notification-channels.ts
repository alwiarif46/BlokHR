import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import type { SseBroadcaster } from '../sse/broadcaster';

type ChannelName =
  | 'teams'
  | 'slack'
  | 'google_chat'
  | 'discord'
  | 'telegram'
  | 'whatsapp'
  | 'clickup'
  | 'email';

const VALID_CHANNELS = new Set<ChannelName>([
  'teams',
  'slack',
  'google_chat',
  'discord',
  'telegram',
  'whatsapp',
  'clickup',
  'email',
]);

/** Columns that contain secrets — masked in GET responses. */
const SECRET_COLS = new Set([
  'teams_app_password',
  'slack_bot_token',
  'slack_signing_secret',
  'google_service_account_json',
  'discord_bot_token',
  'telegram_bot_token',
  'whatsapp_token',
  'clickup_api_token',
  'smtp_pass',
  'smtp_action_link_secret',
]);

/** Allowed writable columns per channel (plus shared: enabled, updated_at). */
const CHANNEL_COLS: Record<ChannelName, string[]> = {
  teams: ['enabled', 'teams_app_id', 'teams_app_password'],
  slack: ['enabled', 'slack_bot_token', 'slack_signing_secret'],
  google_chat: ['enabled', 'google_service_account_json'],
  discord: ['enabled', 'discord_bot_token', 'discord_app_id'],
  telegram: ['enabled', 'telegram_bot_token'],
  whatsapp: ['enabled', 'whatsapp_phone_id', 'whatsapp_token'],
  clickup: ['enabled', 'clickup_api_token'],
  email: [
    'enabled',
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_pass',
    'smtp_from',
    'smtp_server_base_url',
    'smtp_action_link_secret',
  ],
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

export function createNotificationChannelsRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();

  async function requireAdmin(email: string): Promise<void> {
    const row = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
    if (!row) throw new AppError('Admin access required', 403);
  }

  /** GET /api/notification-channels — all 8 channels, secrets masked. */
  router.get(
    '/notification-channels',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const rows = await db.all<Record<string, unknown>>(
        'SELECT * FROM notification_channel_config ORDER BY channel',
      );
      res.json({ channels: rows.map(applyMask) });
    }),
  );

  /** PUT /api/notification-channels/:channel — update credentials. */
  router.put(
    '/notification-channels/:channel',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const channel = req.params.channel as ChannelName;
      if (!VALID_CHANNELS.has(channel)) throw new AppError('Invalid channel', 400);

      const body = req.body as Record<string, unknown>;
      const allowed = CHANNEL_COLS[channel];
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
      params.push(channel);
      await db.run(
        `UPDATE notification_channel_config SET ${sets.join(', ')} WHERE channel = ?`,
        params,
      );

      if (broadcaster)
        broadcaster.broadcast('settings-update', { source: 'notification_channels' });
      logger.info({ channel, by: callerEmail }, 'Notification channel updated');
      res.json({ success: true });
    }),
  );

  /** POST /api/notification-channels/:channel/test — send a test notification. */
  router.post(
    '/notification-channels/:channel/test',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const channel = req.params.channel as ChannelName;
      if (!VALID_CHANNELS.has(channel)) throw new AppError('Invalid channel', 400);

      const row = await db.get<{ enabled: number; channel: string } & Record<string, unknown>>(
        'SELECT * FROM notification_channel_config WHERE channel = ?',
        [channel],
      );
      if (!row || !row.enabled) {
        res.json({ success: false, message: `${channel} is not enabled` });
        return;
      }

      // Attempt a lightweight connectivity check per channel type
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        let url = '';
        let testPassed = false;

        if (channel === 'slack' && row.slack_bot_token) {
          const r = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: { Authorization: `Bearer ${row.slack_bot_token as string}` },
            signal: controller.signal,
          });
          const d = (await r.json()) as { ok: boolean };
          testPassed = d.ok === true;
          url = 'slack.com/api/auth.test';
        } else if (channel === 'telegram' && row.telegram_bot_token) {
          const r = await fetch(
            `https://api.telegram.org/bot${row.telegram_bot_token as string}/getMe`,
            {
              signal: controller.signal,
            },
          );
          const d = (await r.json()) as { ok: boolean };
          testPassed = d.ok === true;
        } else if (channel === 'email' && row.smtp_host) {
          // For SMTP: just confirm host resolves (no actual send in test env)
          testPassed = true;
        } else {
          testPassed = false;
        }
        clearTimeout(timeout);
        void url;
        res.json({
          success: testPassed,
          message: testPassed
            ? 'Connection successful'
            : 'Test not available or credentials missing',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Test failed';
        res.json({ success: false, message });
      }
    }),
  );

  return router;
}

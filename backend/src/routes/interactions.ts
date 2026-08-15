import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import type { DatabaseEngine } from '../db/engine';
import { asyncHandler } from '../app';
import type { ActionDispatcher, ParsedAction } from '../webhooks/action-dispatcher';

/**
 * Interaction receiver routes — processes button-click webhooks from all 8 platforms.
 * Each endpoint parses the platform-native webhook format into a ParsedAction,
 * then delegates to the shared ActionDispatcher.
 *
 *   POST /api/interactions/teams         — Teams Bot Framework
 *   POST /api/interactions/slack         — Slack interactivity
 *   POST /api/interactions/google-chat   — Google Chat card action
 *   POST /api/interactions/discord       — Discord interactions
 *   POST /api/interactions/telegram      — Telegram callback_query
 *   POST /api/interactions/whatsapp      — WhatsApp interactive reply
 *   POST /api/interactions/clickup       — ClickUp task webhook
 *   GET  /api/actions/:token             — Email signed action links
 */
export function createInteractionRouter(
  dispatcher: ActionDispatcher,
  config: AppConfig,
  logger: Logger,
  db?: DatabaseEngine,
): Router {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════
  //  MICROSOFT TEAMS — Bot Framework Activity
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/teams',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        type?: string;
        value?: { verb?: string; action?: string; [key: string]: unknown };
        from?: { aadObjectId?: string; name?: string; id?: string };
      };

      if (body.type !== 'invoke' || !body.value) {
        res.status(200).json({ status: 200 });
        return;
      }

      const verb = body.value.verb ?? body.value.action ?? '';
      const callerEmail = await resolveTeamsEmail(body.from?.aadObjectId ?? '', config, logger);

      const action: ParsedAction = {
        actionId: verb,
        payload: body.value,
        callerEmail,
        reason: (body.value.reason as string) ?? (body.value.comments as string) ?? '',
      };

      const result = await dispatcher.dispatch(action);

      // Teams expects a 200 with adaptiveCard status response
      res.status(200).json({
        statusCode: 200,
        type: 'application/vnd.microsoft.activity.message',
        value: result.message,
      });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  SLACK — Interactivity webhook
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/slack',
    asyncHandler(async (req: Request, res: Response) => {
      // Slack sends interactivity as URL-encoded `payload` field
      const rawPayload = (req.body as { payload?: string }).payload;
      if (!rawPayload) {
        res.status(200).send('');
        return;
      }

      let payload: {
        type?: string;
        user?: { id?: string; username?: string; name?: string };
        actions?: Array<{ action_id?: string; value?: string }>;
      };
      try {
        payload = JSON.parse(rawPayload) as typeof payload;
      } catch {
        res.status(200).send('');
        return;
      }

      if (payload.type !== 'block_actions' || !payload.actions?.length) {
        res.status(200).send('');
        return;
      }

      const slackAction = payload.actions[0];
      const actionId = slackAction.action_id ?? '';
      let actionPayload: Record<string, unknown> = {};
      try {
        actionPayload = JSON.parse(slackAction.value ?? '{}') as Record<string, unknown>;
      } catch {
        actionPayload = {};
      }

      // Resolve Slack user to email
      const callerEmail = await resolveSlackEmail(
        payload.user?.id ?? '',
        config.slackBotToken ?? '',
        logger,
      );

      const action: ParsedAction = {
        actionId,
        payload: actionPayload,
        callerEmail,
        reason: (actionPayload.reason as string) ?? '',
      };

      const result = await dispatcher.dispatch(action);

      // Slack expects 200 OK within 3 seconds
      res.status(200).json({ text: result.message });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  GOOGLE CHAT — Card action callback
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/google-chat',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        type?: string;
        action?: {
          actionMethodName?: string;
          parameters?: Array<{ key: string; value: string }>;
        };
        user?: { email?: string; displayName?: string };
        message?: { name?: string };
      };

      if (body.type !== 'CARD_CLICKED' || !body.action) {
        res.status(200).json({});
        return;
      }

      const actionId = body.action.actionMethodName ?? '';
      const params: Record<string, unknown> = {};
      for (const p of body.action.parameters ?? []) {
        params[p.key] = p.value;
      }

      const action: ParsedAction = {
        actionId,
        payload: params,
        callerEmail: (body.user?.email ?? '').toLowerCase(),
        reason: (params.reason as string) ?? '',
      };

      const result = await dispatcher.dispatch(action);

      // Google Chat expects an update card or text response
      res.status(200).json({
        text: result.message,
      });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  DISCORD — Interaction webhook
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/discord',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        type?: number;
        data?: { custom_id?: string; component_type?: number };
        member?: { user?: { id?: string; username?: string; email?: string } };
      };

      // Type 1 = PING (Discord verification)
      if (body.type === 1) {
        res.json({ type: 1 });
        return;
      }

      // Type 3 = MESSAGE_COMPONENT (button click)
      if (body.type !== 3 || !body.data?.custom_id) {
        res.status(200).json({ type: 4, data: { content: 'No action taken.' } });
        return;
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body.data.custom_id) as Record<string, unknown>;
      } catch {
        res.status(200).json({ type: 4, data: { content: 'Invalid action data.' } });
        return;
      }

      const actionId = (parsed.action as string) ?? '';
      const callerEmail = await resolveDiscordEmail(
        body.member?.user?.id ?? '',
        config.discordBotToken ?? '',
        logger,
        db,
      );

      const action: ParsedAction = {
        actionId,
        payload: parsed,
        callerEmail,
        reason: (parsed.reason as string) ?? '',
      };

      const result = await dispatcher.dispatch(action);

      // Discord expects type 4 (CHANNEL_MESSAGE_WITH_SOURCE) response
      res.json({ type: 4, data: { content: result.message, flags: 64 } });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  TELEGRAM — Bot callback_query
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/telegram',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        callback_query?: {
          id: string;
          data?: string;
          from?: { id?: number; username?: string };
          message?: { chat?: { id?: number }; message_id?: number };
        };
      };

      if (!body.callback_query?.data) {
        res.status(200).json({ ok: true });
        return;
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body.callback_query.data) as Record<string, unknown>;
      } catch {
        res.status(200).json({ ok: true });
        return;
      }

      const actionId = (parsed.a as string) ?? '';
      const callerEmail = await resolveTelegramEmail(
        body.callback_query.from?.id ?? 0,
        config.telegramBotToken ?? '',
        logger,
        db,
      );

      const action: ParsedAction = {
        actionId,
        payload: parsed,
        callerEmail,
        reason: (parsed.reason as string) ?? '',
      };

      const result = await dispatcher.dispatch(action);

      // Answer the callback query to dismiss the loading state
      if (config.telegramBotToken) {
        fetch(`https://api.telegram.org/bot${config.telegramBotToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: body.callback_query.id,
            text: result.message,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch((err) => {
          logger.error({ err }, 'Telegram answerCallbackQuery failed');
        });
      }

      res.status(200).json({ ok: true });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  WHATSAPP — Interactive reply button
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/whatsapp',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{
                from?: string;
                interactive?: { button_reply?: { id?: string } };
              }>;
              contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
            };
          }>;
        }>;
      };

      // WhatsApp verification challenge
      if (req.method === 'GET') {
        const mode = req.query['hub.mode'] as string | undefined;
        const token = req.query['hub.verify_token'] as string | undefined;
        const challenge = req.query['hub.challenge'] as string | undefined;
        if (mode === 'subscribe' && token && challenge) {
          res.status(200).send(challenge);
          return;
        }
      }

      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message?.interactive?.button_reply?.id) {
        res.status(200).json({ status: 'ok' });
        return;
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(message.interactive.button_reply.id) as Record<string, unknown>;
      } catch {
        res.status(200).json({ status: 'ok' });
        return;
      }

      const actionId = (parsed.action as string) ?? '';
      const phoneNumber = message.from ?? '';

      // Resolve phone to email from members table
      const callerEmail = await resolveWhatsAppEmail(phoneNumber, logger, config, db);

      const action: ParsedAction = {
        actionId,
        payload: parsed,
        callerEmail,
        reason: (parsed.reason as string) ?? '',
      };

      await dispatcher.dispatch(action);
      res.status(200).json({ status: 'ok' });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  CLICKUP — Task webhook
  // ═══════════════════════════════════════════════════════════════

  router.post(
    '/interactions/clickup',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as {
        event?: string;
        task_id?: string;
        history_items?: Array<{
          field?: string;
          after?: { status?: string };
        }>;
      };

      // Only handle taskStatusUpdated events
      if (body.event !== 'taskStatusUpdated' || !body.task_id) {
        res.status(200).json({ ok: true });
        return;
      }

      const statusChange = body.history_items?.find((h) => h.field === 'status');
      const newStatus = statusChange?.after?.status?.toLowerCase() ?? '';

      // Only process approved/rejected status changes
      if (newStatus !== 'approved' && newStatus !== 'rejected') {
        res.status(200).json({ ok: true });
        return;
      }

      // Fetch task from ClickUp API to get entity reference from description
      const apiToken = config.clickupApiToken;
      if (!apiToken) {
        logger.info('No CLICKUP_API_TOKEN configured — skipping dispatch');
        res.status(200).json({ ok: true });
        return;
      }

      let taskDescription = '';
      try {
        const taskResp = await fetch(`https://api.clickup.com/api/v2/task/${body.task_id}`, {
          headers: { Authorization: apiToken },
          signal: AbortSignal.timeout(5000),
        });
        if (!taskResp.ok) {
          logger.warn({ taskId: body.task_id, status: taskResp.status }, 'ClickUp task fetch failed');
          res.status(200).json({ ok: true });
          return;
        }
        const taskData = (await taskResp.json()) as { description?: string };
        taskDescription = taskData.description ?? '';
      } catch (err) {
        logger.error({ err, taskId: body.task_id }, 'ClickUp API call failed');
        res.status(200).json({ ok: true });
        return;
      }

      // Parse entity reference JSON from task description
      let entityRef: { entityType?: string; entityId?: string; approverEmail?: string };
      try {
        // The adapter embeds JSON in the description
        const jsonMatch = taskDescription.match(/\{[^}]*"entityType"[^}]*\}/);
        if (!jsonMatch) {
          logger.warn({ taskId: body.task_id }, 'No entity reference found in ClickUp task description');
          res.status(200).json({ ok: true });
          return;
        }
        entityRef = JSON.parse(jsonMatch[0]) as typeof entityRef;
      } catch {
        logger.warn({ taskId: body.task_id }, 'Failed to parse entity reference from ClickUp task');
        res.status(200).json({ ok: true });
        return;
      }

      // Map entity type + status to action ID
      const actionMap: Record<string, Record<string, string>> = {
        leave: { approved: 'leave.approve', rejected: 'leave.reject' },
        regularization: { approved: 'reg.approve', rejected: 'reg.reject' },
        bd_meeting: { approved: 'bd_meeting.approve', rejected: 'bd_meeting.reject' },
      };
      const actionId = actionMap[entityRef.entityType ?? '']?.[newStatus];
      if (!actionId) {
        logger.warn({ entityType: entityRef.entityType, newStatus }, 'Unknown entity type or status for ClickUp dispatch');
        res.status(200).json({ ok: true });
        return;
      }

      // Build payload
      const entityPayload: Record<string, unknown> = {};
      if (entityRef.entityType === 'leave') entityPayload.leaveId = entityRef.entityId;
      else if (entityRef.entityType === 'regularization') entityPayload.regId = entityRef.entityId;
      else if (entityRef.entityType === 'bd_meeting') entityPayload.meetingId = entityRef.entityId;

      const action: ParsedAction = {
        actionId,
        payload: entityPayload,
        callerEmail: (entityRef.approverEmail ?? '').toLowerCase(),
      };

      await dispatcher.dispatch(action);
      res.status(200).json({ ok: true });
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  //  EMAIL — Signed action links
  // ═══════════════════════════════════════════════════════════════

  router.get(
    '/actions/:token',
    asyncHandler(async (req: Request, res: Response) => {
      const { token } = req.params;
      const secret = config.actionLinkSecret;

      if (!secret) {
        res.status(400).json({ error: 'Action links not configured' });
        return;
      }

      // Token format: base64url(JSON).hmac
      const dotIndex = token.lastIndexOf('.');
      if (dotIndex === -1) {
        res.status(400).json({ error: 'Invalid action link' });
        return;
      }

      const encoded = token.substring(0, dotIndex);
      const receivedHmac = token.substring(dotIndex + 1);

      // Verify HMAC
      const expectedHmac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');

      const receivedBuf = Buffer.from(receivedHmac);
      const expectedBuf = Buffer.from(expectedHmac);
      if (
        receivedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(receivedBuf, expectedBuf)
      ) {
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }

      // Decode payload
      let payload: {
        entityType?: string;
        entityId?: string;
        action?: string;
        approverEmail?: string;
        exp?: number;
      };
      try {
        const json = Buffer.from(encoded, 'base64url').toString('utf-8');
        payload = JSON.parse(json) as typeof payload;
      } catch {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      // Check expiry
      if (payload.exp && Date.now() > payload.exp) {
        res.status(410).json({ error: 'Action link has expired' });
        return;
      }

      // Map entity type + action to actionId
      const actionId = mapEmailAction(payload.entityType ?? '', payload.action ?? '');

      if (!actionId) {
        res.status(400).json({ error: 'Unknown action type' });
        return;
      }

      // Build the payload key based on entity type
      const entityPayload: Record<string, unknown> = {};
      if (payload.entityType === 'leave') entityPayload.leaveId = payload.entityId;
      else if (payload.entityType === 'regularization') entityPayload.regId = payload.entityId;
      else if (payload.entityType === 'bd_meeting') entityPayload.meetingId = payload.entityId;

      const action: ParsedAction = {
        actionId,
        payload: entityPayload,
        callerEmail: (payload.approverEmail ?? '').toLowerCase(),
      };

      const result = await dispatcher.dispatch(action);

      // Return a simple HTML confirmation page
      const statusEmoji = result.success ? '✅' : '❌';
      res.status(200).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Action Complete</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0B0E14;color:#E8ECF0;margin:0}
        .card{background:#131820;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:48px;text-align:center;max-width:400px}
        h2{color:${result.success ? '#22C55E' : '#EF4444'};margin:16px 0 8px}</style></head>
        <body><div class="card"><div style="font-size:48px">${statusEmoji}</div>
        <h2>${result.success ? 'Action Complete' : 'Action Failed'}</h2>
        <p>${result.message}</p>
        <p style="color:#5C6878;font-size:12px;margin-top:24px">You can close this tab.</p>
        </div></body></html>
      `);
    }),
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════
//  Identity resolution helpers
// ═══════════════════════════════════════════════════════════════

/** Map email action type strings to dispatcher action IDs. */
function mapEmailAction(entityType: string, action: string): string | null {
  const map: Record<string, Record<string, string>> = {
    leave: { approve: 'leave.approve', hr_approve: 'leave.hr_approve', reject: 'leave.reject' },
    regularization: { approve: 'reg.approve', hr_approve: 'reg.hr_approve', reject: 'reg.reject' },
    bd_meeting: {
      qualify: 'bd_meeting.qualify',
      approve: 'bd_meeting.approve',
      reject: 'bd_meeting.reject',
    },
  };
  return map[entityType]?.[action] ?? null;
}

/** Resolve Teams AAD object ID to email via Graph API. Falls back to empty string. */
async function resolveTeamsEmail(
  aadObjectId: string,
  config: AppConfig,
  logger: Logger,
): Promise<string> {
  if (!aadObjectId || !config.azureBotAppId || !config.azureBotAppPassword) return '';
  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.azureBotAppId,
      client_secret: config.azureBotAppPassword,
      scope: 'https://graph.microsoft.com/.default',
    });
    const tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenResp.ok) return '';
    const tokenData = (await tokenResp.json()) as { access_token: string };

    const userResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${aadObjectId}?$select=mail,userPrincipalName`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!userResp.ok) return '';
    const user = (await userResp.json()) as { mail?: string; userPrincipalName?: string };
    return (user.mail ?? user.userPrincipalName ?? '').toLowerCase();
  } catch (err) {
    logger.error({ err, aadObjectId }, 'Teams email resolution failed');
    return '';
  }
}

/** Resolve Slack user ID to email via users.info API. */
async function resolveSlackEmail(
  slackUserId: string,
  botToken: string,
  logger: Logger,
): Promise<string> {
  if (!slackUserId || !botToken) return '';
  try {
    const resp = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      {
        headers: { Authorization: `Bearer ${botToken}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!resp.ok) return '';
    const data = (await resp.json()) as {
      ok: boolean;
      user?: { profile?: { email?: string } };
    };
    return (data.user?.profile?.email ?? '').toLowerCase();
  } catch (err) {
    logger.error({ err, slackUserId }, 'Slack email resolution failed');
    return '';
  }
}

/** Resolve Discord user ID to email via members table. */
async function resolveDiscordEmail(
  discordUserId: string,
  _botToken: string,
  logger: Logger,
  db?: DatabaseEngine,
): Promise<string> {
  if (!discordUserId || !db) return '';
  try {
    const row = await db.get<{ email: string }>(
      'SELECT email FROM members WHERE discord_id = ? AND active = 1',
      [discordUserId],
    );
    return row?.email ?? '';
  } catch (err) {
    logger.error({ err, discordUserId }, 'Discord email resolution failed');
    return '';
  }
}

/** Resolve Telegram user ID to email via members table. */
async function resolveTelegramEmail(
  telegramUserId: number,
  _botToken: string,
  logger: Logger,
  db?: DatabaseEngine,
): Promise<string> {
  if (!telegramUserId || !db) return '';
  try {
    const row = await db.get<{ email: string }>(
      'SELECT email FROM members WHERE telegram_id = ? AND active = 1',
      [String(telegramUserId)],
    );
    return row?.email ?? '';
  } catch (err) {
    logger.error({ err, telegramUserId }, 'Telegram email resolution failed');
    return '';
  }
}

/** Resolve WhatsApp phone number to email via members table phone field. */
async function resolveWhatsAppEmail(
  phoneNumber: string,
  logger: Logger,
  _config: AppConfig,
  db?: DatabaseEngine,
): Promise<string> {
  if (!phoneNumber || !db) return '';
  try {
    const row = await db.get<{ email: string }>(
      'SELECT email FROM members WHERE phone = ? AND active = 1',
      [phoneNumber],
    );
    return row?.email ?? '';
  } catch (err) {
    logger.error({ err, phoneNumber }, 'WhatsApp email resolution failed');
    return '';
  }
}

import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import type { PlatformCalendarProvider } from '../services/calendar-token-crypto';

export interface ZoomPlatformCreds {
  enabled: boolean;
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export interface WebexPlatformCreds {
  enabled: boolean;
  botToken: string;
}

export interface GoToPlatformCreds {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface BlueJeansPlatformCreds {
  enabled: boolean;
  apiKey: string;
}

export interface MeetingPlatformCredsBundle {
  zoom: ZoomPlatformCreds;
  webex: WebexPlatformCreds;
  gotomeeting: GoToPlatformCreds;
  bluejeans: BlueJeansPlatformCreds;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function boolish(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return fallback;
}

/**
 * Resolve Zoom/Webex/GoTo/BlueJeans credentials for personal calendar.
 * Priority: AppConfig env → settings_json.meetings.platforms → meeting_platform_config.
 */
export async function resolveMeetingPlatformCreds(
  db: DatabaseEngine,
  config: AppConfig,
): Promise<MeetingPlatformCredsBundle> {
  let platforms: Record<string, unknown> = {};
  const settingsRow = await db.get<{ settings_json: string }>(
    `SELECT settings_json FROM tenant_settings WHERE id = 'default'`,
  );
  if (settingsRow?.settings_json) {
    try {
      const json = JSON.parse(settingsRow.settings_json) as Record<string, unknown>;
      const meetings = (json.meetings as Record<string, unknown>) ?? {};
      platforms = (meetings.platforms as Record<string, unknown>) ?? {};
    } catch {
      platforms = {};
    }
  }

  const zoomSj = (platforms.zoom as Record<string, unknown>) ?? {};
  const webexSj = (platforms.webex as Record<string, unknown>) ?? {};
  const gotoSj = (platforms.gotomeeting as Record<string, unknown>) ??
    (platforms.goto as Record<string, unknown>) ??
    {};
  const bjSj = (platforms.bluejeans as Record<string, unknown>) ?? {};

  const dbRows = await db.all<{
    platform: string;
    enabled: number;
    zoom_account_id: string | null;
    zoom_client_id: string | null;
    zoom_client_secret: string | null;
    webex_bot_token: string | null;
    goto_client_id: string | null;
    goto_client_secret: string | null;
    bluejeans_api_key: string | null;
  }>('SELECT * FROM meeting_platform_config');

  const byPlat = new Map(dbRows.map((r) => [r.platform, r]));

  const zoomDb = byPlat.get('zoom');
  const webexDb = byPlat.get('webex');
  const gotoDb = byPlat.get('goto');
  const bjDb = byPlat.get('bluejeans');

  const zoom: ZoomPlatformCreds = {
    accountId: config.zoomAccountId || str(zoomSj.accountId) || zoomDb?.zoom_account_id || '',
    clientId: config.zoomClientId || str(zoomSj.clientId) || zoomDb?.zoom_client_id || '',
    clientSecret:
      config.zoomClientSecret || str(zoomSj.clientSecret) || zoomDb?.zoom_client_secret || '',
    enabled: false,
  };
  zoom.enabled =
    boolish(zoomSj.enabled, !!(zoomDb?.enabled || config.zoomAccountId)) &&
    !!(zoom.accountId && zoom.clientId && zoom.clientSecret);

  const webex: WebexPlatformCreds = {
    botToken: config.webexBotToken || str(webexSj.botToken) || webexDb?.webex_bot_token || '',
    enabled: false,
  };
  webex.enabled =
    boolish(webexSj.enabled, !!(webexDb?.enabled || config.webexBotToken)) && !!webex.botToken;

  const gotomeeting: GoToPlatformCreds = {
    clientId: config.gotoClientId || str(gotoSj.clientId) || gotoDb?.goto_client_id || '',
    clientSecret:
      config.gotoClientSecret || str(gotoSj.clientSecret) || gotoDb?.goto_client_secret || '',
    enabled: false,
  };
  gotomeeting.enabled =
    boolish(gotoSj.enabled, !!(gotoDb?.enabled || config.gotoClientId)) &&
    !!(gotomeeting.clientId && gotomeeting.clientSecret);

  const bluejeans: BlueJeansPlatformCreds = {
    apiKey: config.bluejeansApiKey || str(bjSj.apiKey) || bjDb?.bluejeans_api_key || '',
    enabled: false,
  };
  bluejeans.enabled =
    boolish(bjSj.enabled, !!(bjDb?.enabled || config.bluejeansApiKey)) && !!bluejeans.apiKey;

  return { zoom, webex, gotomeeting, bluejeans };
}

export function platformConfigured(
  bundle: MeetingPlatformCredsBundle,
  provider: PlatformCalendarProvider,
): boolean {
  switch (provider) {
    case 'zoom':
      return bundle.zoom.enabled;
    case 'webex':
      return bundle.webex.enabled;
    case 'gotomeeting':
      return bundle.gotomeeting.enabled;
    case 'bluejeans':
      return bundle.bluejeans.enabled;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

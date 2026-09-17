import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { UserCalendarRepository } from '../repositories/user-calendar-repository';
import { getBrandingForTenant } from '../tenant/branding-access';
import { getTenantId } from '../tenant/context';
import {
  decryptToken,
  encryptToken,
  mergeCalendarEvents,
  signOAuthState,
  verifyOAuthState,
  isOAuthCalendarProvider,
  isPlatformCalendarProvider,
  isCalendarProvider,
  ALL_CALENDAR_PROVIDERS,
  type CalendarEventView,
  type CalendarProvider,
  type OAuthCalendarProvider,
  type PlatformCalendarProvider,
} from './calendar-token-crypto';
import {
  platformConfigured,
  resolveMeetingPlatformCreds,
  type MeetingPlatformCredsBundle,
} from './meeting-platform-creds';

const API_TIMEOUT = 15_000;
const STATE_TTL_MS = 15 * 60 * 1000;
const MS_SCOPES = 'Calendars.Read offline_access openid profile email';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly email profile openid';

export type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface CalendarOauthClientConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface CalendarTenantConfig {
  microsoft: CalendarOauthClientConfig;
  google: CalendarOauthClientConfig;
}

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  accountEmail: string;
}

/**
 * Personal calendar: Microsoft/Google OAuth + Zoom/Webex/GoTo/BlueJeans via tenant creds.
 * Does not write into tracked_meetings.
 */
export class UserCalendarService {
  private readonly repo: UserCalendarRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly config: AppConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.repo = new UserCalendarRepository(db);
  }

  private tokenSecret(): string {
    return this.config.calendarTokenKey;
  }

  async resolveTenantCalendarConfig(): Promise<CalendarTenantConfig> {
    const branding = await getBrandingForTenant<{
      msal_client_id: string;
      msal_tenant_id: string;
      google_oauth_client_id: string;
    }>(this.db);

    const row = await this.db.get<{ settings_json: string }>(
      `SELECT settings_json FROM tenant_settings WHERE id = ?`,
      [getTenantId('default')],
    );
    let meetings: Record<string, unknown> = {};
    if (row?.settings_json) {
      try {
        const json = JSON.parse(row.settings_json) as Record<string, unknown>;
        meetings = (json.meetings as Record<string, unknown>) ?? {};
      } catch {
        meetings = {};
      }
    }
    const calendar = (meetings.calendar as Record<string, unknown>) ?? {};
    const ms = (calendar.microsoft as Record<string, unknown>) ?? {};
    const google = (calendar.google as Record<string, unknown>) ?? {};

    const base = (this.config.serverBaseUrl ?? 'http://localhost:3000').replace(/\/$/, '');

    return {
      microsoft: {
        clientId: String(ms.clientId ?? branding?.msal_client_id ?? ''),
        clientSecret: String(ms.clientSecret ?? ''),
        tenantId: String(ms.tenantId ?? branding?.msal_tenant_id ?? 'common'),
        redirectUri: String(
          ms.redirectUri ?? `${base}/api/meetings/calendar/callback/microsoft`,
        ),
      },
      google: {
        clientId: String(google.clientId ?? branding?.google_oauth_client_id ?? ''),
        clientSecret: String(google.clientSecret ?? ''),
        tenantId: '',
        redirectUri: String(
          google.redirectUri ?? `${base}/api/meetings/calendar/callback/google`,
        ),
      },
    };
  }

  providerConfigured(cfg: CalendarTenantConfig, provider: OAuthCalendarProvider): boolean {
    if (provider === 'microsoft') {
      return !!(cfg.microsoft.clientId && cfg.microsoft.clientSecret);
    }
    return !!(cfg.google.clientId && cfg.google.clientSecret);
  }

  async getStatus(email: string): Promise<{
    providers: Array<{
      provider: CalendarProvider;
      connected: boolean;
      accountEmail: string;
      externalUserId: string;
      status: string;
      configured: boolean;
      authMode: 'oauth' | 'link';
    }>;
  }> {
    const cfg = await this.resolveTenantCalendarConfig();
    const platforms = await resolveMeetingPlatformCreds(this.db, this.config);
    const connections = await this.repo.listByEmail(email);
    const byProvider = new Map(connections.map((c) => [c.provider, c]));

    return {
      providers: ALL_CALENDAR_PROVIDERS.map((provider) => {
        const row = byProvider.get(provider);
        const oauth = isOAuthCalendarProvider(provider);
        const configured = oauth
          ? this.providerConfigured(cfg, provider)
          : platformConfigured(platforms, provider);
        const connected = oauth
          ? !!(row && row.status === 'active' && row.refresh_token_enc)
          : !!(
              row &&
              row.status === 'active' &&
              (row.external_user_id || row.account_email)
            );
        return {
          provider,
          connected,
          accountEmail: row?.account_email ?? '',
          externalUserId: row?.external_user_id ?? '',
          status: row?.status ?? 'disconnected',
          configured,
          authMode: oauth ? ('oauth' as const) : ('link' as const),
        };
      }),
    };
  }

  async buildAuthorizeUrl(
    email: string,
    provider: CalendarProvider,
  ): Promise<{ authorizeUrl: string }> {
    if (!isOAuthCalendarProvider(provider)) {
      throw new Error(`${provider} uses identity link, not OAuth — POST /calendar/link/${provider}`);
    }
    const cfg = await this.resolveTenantCalendarConfig();
    if (!this.providerConfigured(cfg, provider)) {
      throw new Error(`${provider} calendar OAuth is not configured`);
    }

    const state = signOAuthState(
      {
        email: email.toLowerCase().trim(),
        provider,
        exp: Date.now() + STATE_TTL_MS,
        nonce: crypto.randomBytes(8).toString('hex'),
      },
      this.tokenSecret(),
    );

    if (provider === 'microsoft') {
      const tenant = cfg.microsoft.tenantId || 'common';
      const params = new URLSearchParams({
        client_id: cfg.microsoft.clientId,
        response_type: 'code',
        redirect_uri: cfg.microsoft.redirectUri,
        response_mode: 'query',
        scope: MS_SCOPES,
        state,
        prompt: 'consent',
      });
      return {
        authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params}`,
      };
    }

    const params = new URLSearchParams({
      client_id: cfg.google.clientId,
      response_type: 'code',
      redirect_uri: cfg.google.redirectUri,
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return {
      authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    };
  }

  /**
   * Link Zoom/Webex/GoTo/BlueJeans identity for the caller (tenant must enable the platform).
   * externalUserId defaults to the BlokHR email (Zoom/Webex accept email as user id).
   */
  async linkPlatform(
    email: string,
    provider: PlatformCalendarProvider,
    externalUserId?: string,
  ): Promise<{ success: boolean; externalUserId: string }> {
    const platforms = await resolveMeetingPlatformCreds(this.db, this.config);
    if (!platformConfigured(platforms, provider)) {
      throw new Error(`${provider} is not enabled for this tenant`);
    }
    const ext = (externalUserId ?? email).trim();
    if (!ext) throw new Error('externalUserId is required');

    await this.repo.upsert({
      id: uuidv4(),
      email,
      provider,
      refreshTokenEnc: '',
      accessTokenEnc: '',
      expiresAt: null,
      accountEmail: email.toLowerCase().trim(),
      externalUserId: ext,
      scopes: 'platform-link',
      status: 'active',
    });
    this.logger.info({ email, provider, externalUserId: ext }, 'Platform calendar linked');
    return { success: true, externalUserId: ext };
  }

  async handleCallback(
    provider: CalendarProvider,
    code: string,
    state: string,
  ): Promise<{ email: string }> {
    if (!isOAuthCalendarProvider(provider)) {
      throw new Error(`${provider} does not use OAuth callback`);
    }
    const parsed = verifyOAuthState(state, this.tokenSecret());
    if (parsed.provider !== provider) {
      throw new Error('OAuth provider mismatch');
    }

    const cfg = await this.resolveTenantCalendarConfig();
    if (!this.providerConfigured(cfg, provider)) {
      throw new Error(`${provider} calendar OAuth is not configured`);
    }

    const tokens =
      provider === 'microsoft'
        ? await this.exchangeMicrosoftCode(cfg, code)
        : await this.exchangeGoogleCode(cfg, code);

    await this.repo.upsert({
      id: uuidv4(),
      email: parsed.email,
      provider,
      refreshTokenEnc: encryptToken(tokens.refreshToken, this.tokenSecret()),
      accessTokenEnc: encryptToken(tokens.accessToken, this.tokenSecret()),
      expiresAt: tokens.expiresAt,
      accountEmail: tokens.accountEmail,
      scopes: provider === 'microsoft' ? MS_SCOPES : GOOGLE_SCOPES,
      status: 'active',
    });

    this.logger.info(
      { email: parsed.email, provider, accountEmail: tokens.accountEmail },
      'User calendar connected',
    );
    return { email: parsed.email };
  }

  async disconnect(email: string, provider: CalendarProvider): Promise<boolean> {
    const removed = await this.repo.delete(email, provider);
    if (removed) {
      this.logger.info({ email, provider }, 'User calendar disconnected');
    }
    return removed;
  }

  async getMyCalendar(
    email: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    const connections = await this.repo.listActiveByEmail(email);
    const lists = await Promise.all(
      connections.map((c) => this.fetchEventsForConnection(c, fromIso, toIso)),
    );
    return mergeCalendarEvents(lists);
  }

  async getOrgCalendar(
    fromIso: string,
    toIso: string,
    filterEmail?: string,
  ): Promise<CalendarEventView[]> {
    const connections = filterEmail
      ? await this.repo.listActiveByEmail(filterEmail)
      : await this.repo.listActive();
    const lists = await Promise.all(
      connections.map((c) => this.fetchEventsForConnection(c, fromIso, toIso)),
    );
    return mergeCalendarEvents(lists);
  }

  frontendRedirectUrl(ok: boolean, error?: string): string {
    const base = (this.config.serverBaseUrl ?? 'http://localhost:3000').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('module', 'meetings');
    if (ok) params.set('calendar', 'connected');
    else params.set('calendar', 'error');
    if (error) params.set('calendar_error', error.slice(0, 120));
    return `${base}/?${params.toString()}`;
  }

  // ── Token exchange ──

  private async exchangeMicrosoftCode(
    cfg: CalendarTenantConfig,
    code: string,
  ): Promise<TokenSet> {
    const tenant = cfg.microsoft.tenantId || 'common';
    const body = new URLSearchParams({
      client_id: cfg.microsoft.clientId,
      client_secret: cfg.microsoft.clientSecret,
      code,
      redirect_uri: cfg.microsoft.redirectUri,
      grant_type: 'authorization_code',
      scope: MS_SCOPES,
    });
    const resp = await this.fetchFn(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.warn({ status: resp.status, text }, 'Microsoft token exchange failed');
      throw new Error('Microsoft token exchange failed');
    }
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
    };
    if (!data.refresh_token) throw new Error('Microsoft did not return a refresh token');
    const accountEmail = this.emailFromIdToken(data.id_token) || '';
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      accountEmail,
    };
  }

  private async exchangeGoogleCode(
    cfg: CalendarTenantConfig,
    code: string,
  ): Promise<TokenSet> {
    const body = new URLSearchParams({
      client_id: cfg.google.clientId,
      client_secret: cfg.google.clientSecret,
      code,
      redirect_uri: cfg.google.redirectUri,
      grant_type: 'authorization_code',
    });
    const resp = await this.fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(API_TIMEOUT),
    });
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.warn({ status: resp.status, text }, 'Google token exchange failed');
      throw new Error('Google token exchange failed');
    }
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
    };
    if (!data.refresh_token) throw new Error('Google did not return a refresh token');
    let accountEmail = this.emailFromIdToken(data.id_token) || '';
    if (!accountEmail) {
      accountEmail = await this.fetchGoogleEmail(data.access_token);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      accountEmail,
    };
  }

  private emailFromIdToken(idToken: string | undefined): string {
    if (!idToken) return '';
    try {
      const parts = idToken.split('.');
      if (parts.length < 2) return '';
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        email?: string;
        preferred_username?: string;
      };
      return (payload.email || payload.preferred_username || '').toLowerCase();
    } catch {
      return '';
    }
  }

  private async fetchGoogleEmail(accessToken: string): Promise<string> {
    try {
      const resp = await this.fetchFn('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      });
      if (!resp.ok) return '';
      const data = (await resp.json()) as { email?: string };
      return (data.email ?? '').toLowerCase();
    } catch {
      return '';
    }
  }

  // ── Access token refresh + events ──

  private async getValidAccessToken(
    connectionId: string,
    provider: OAuthCalendarProvider,
    refreshTokenEnc: string,
    accessTokenEnc: string,
    expiresAt: string | null,
  ): Promise<string | null> {
    const secret = this.tokenSecret();
    try {
      if (accessTokenEnc && expiresAt) {
        const exp = Date.parse(expiresAt);
        if (!Number.isNaN(exp) && exp > Date.now() + 60_000) {
          return decryptToken(accessTokenEnc, secret);
        }
      }
    } catch {
      // fall through to refresh
    }

    if (!refreshTokenEnc) return null;
    let refreshToken: string;
    try {
      refreshToken = decryptToken(refreshTokenEnc, secret);
    } catch {
      await this.repo.updateTokens(connectionId, { status: 'error' });
      return null;
    }

    const cfg = await this.resolveTenantCalendarConfig();
    try {
      const tokens =
        provider === 'microsoft'
          ? await this.refreshMicrosoft(cfg, refreshToken)
          : await this.refreshGoogle(cfg, refreshToken);

      await this.repo.updateTokens(connectionId, {
        refreshTokenEnc: tokens.refreshToken
          ? encryptToken(tokens.refreshToken, secret)
          : undefined,
        accessTokenEnc: encryptToken(tokens.accessToken, secret),
        expiresAt: tokens.expiresAt,
        status: 'active',
      });
      return tokens.accessToken;
    } catch (err) {
      this.logger.warn({ err, provider, connectionId }, 'Calendar token refresh failed');
      await this.repo.updateTokens(connectionId, { status: 'error' });
      return null;
    }
  }

  private async refreshMicrosoft(
    cfg: CalendarTenantConfig,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string | null }> {
    const tenant = cfg.microsoft.tenantId || 'common';
    const body = new URLSearchParams({
      client_id: cfg.microsoft.clientId,
      client_secret: cfg.microsoft.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    });
    const resp = await this.fetchFn(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) throw new Error(`Microsoft refresh failed: ${resp.status}`);
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  }

  private async refreshGoogle(
    cfg: CalendarTenantConfig,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string | null }> {
    const body = new URLSearchParams({
      client_id: cfg.google.clientId,
      client_secret: cfg.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const resp = await this.fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(API_TIMEOUT),
    });
    if (!resp.ok) throw new Error(`Google refresh failed: ${resp.status}`);
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  }

  private async fetchEventsForConnection(
    conn: {
      id: string;
      email: string;
      provider: CalendarProvider;
      refresh_token_enc: string;
      access_token_enc: string;
      expires_at: string | null;
      account_email: string;
      external_user_id?: string;
    },
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    try {
      if (isPlatformCalendarProvider(conn.provider)) {
        const platforms = await resolveMeetingPlatformCreds(this.db, this.config);
        if (!platformConfigured(platforms, conn.provider)) return [];
        const userId = conn.external_user_id || conn.account_email || conn.email;
        return await this.fetchPlatformEvents(
          conn.provider,
          platforms,
          userId,
          conn.email,
          fromIso,
          toIso,
        );
      }

      if (!isOAuthCalendarProvider(conn.provider)) return [];

      const access = await this.getValidAccessToken(
        conn.id,
        conn.provider,
        conn.refresh_token_enc,
        conn.access_token_enc,
        conn.expires_at,
      );
      if (!access) return [];

      if (conn.provider === 'microsoft') {
        return await this.fetchMicrosoftEvents(access, conn.email, conn.account_email, fromIso, toIso);
      }
      return await this.fetchGoogleEvents(access, conn.email, conn.account_email, fromIso, toIso);
    } catch (err) {
      this.logger.warn({ err, provider: conn.provider, email: conn.email }, 'Calendar fetch failed');
      return [];
    }
  }

  private async fetchPlatformEvents(
    provider: PlatformCalendarProvider,
    platforms: MeetingPlatformCredsBundle,
    userId: string,
    ownerEmail: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    switch (provider) {
      case 'zoom':
        return this.fetchZoomEvents(platforms, userId, ownerEmail, fromIso, toIso);
      case 'webex':
        return this.fetchWebexEvents(platforms, userId, ownerEmail, fromIso, toIso);
      case 'gotomeeting':
        return this.fetchGoToEvents(platforms, userId, ownerEmail);
      case 'bluejeans':
        return this.fetchBlueJeansEvents(platforms, userId, ownerEmail);
      default: {
        const _exhaustive: never = provider;
        return _exhaustive;
      }
    }
  }

  private async getZoomAccessToken(platforms: MeetingPlatformCredsBundle): Promise<string | null> {
    const { accountId, clientId, clientSecret } = platforms.zoom;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await this.fetchFn(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { access_token: string };
    return data.access_token;
  }

  private async fetchZoomEvents(
    platforms: MeetingPlatformCredsBundle,
    userId: string,
    ownerEmail: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    const token = await this.getZoomAccessToken(platforms);
    if (!token) return [];
    const resp = await this.fetchFn(
      `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings?type=scheduled&page_size=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status, userId }, 'Zoom meetings fetch failed');
      return [];
    }
    const data = (await resp.json()) as {
      meetings?: Array<{
        id: number;
        topic?: string;
        join_url?: string;
        start_time?: string;
        duration?: number;
      }>;
    };
    const fromMs = Date.parse(fromIso);
    const toMs = Date.parse(toIso);
    return (data.meetings ?? [])
      .map((m) => {
        const start = m.start_time ? new Date(m.start_time).toISOString() : '';
        const startMs = start ? Date.parse(start) : NaN;
        const end =
          start && m.duration
            ? new Date(startMs + m.duration * 60_000).toISOString()
            : '';
        return {
          id: `zoom:${m.id}`,
          provider: 'zoom' as const,
          subject: m.topic || 'Zoom Meeting',
          start,
          end,
          location: '',
          joinUrl: m.join_url ?? '',
          organizer: ownerEmail,
          accountEmail: userId,
          ownerEmail,
        };
      })
      .filter((e) => {
        if (!e.start) return true;
        const t = Date.parse(e.start);
        if (Number.isNaN(fromMs) || Number.isNaN(toMs) || Number.isNaN(t)) return true;
        return t >= fromMs && t <= toMs;
      });
  }

  private async fetchWebexEvents(
    platforms: MeetingPlatformCredsBundle,
    hostEmail: string,
    ownerEmail: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    const resp = await this.fetchFn(
      `https://webexapis.com/v1/meetings?meetingType=scheduledMeeting&hostEmail=${encodeURIComponent(hostEmail)}&max=50&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      {
        headers: { Authorization: `Bearer ${platforms.webex.botToken}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status, hostEmail }, 'Webex meetings fetch failed');
      return [];
    }
    const data = (await resp.json()) as {
      items?: Array<{
        id: string;
        title?: string;
        webLink?: string;
        start?: string;
        end?: string;
      }>;
    };
    return (data.items ?? []).map((m) => ({
      id: `webex:${m.id}`,
      provider: 'webex' as const,
      subject: m.title || 'Webex Meeting',
      start: m.start ? new Date(m.start).toISOString() : '',
      end: m.end ? new Date(m.end).toISOString() : '',
      location: '',
      joinUrl: m.webLink ?? '',
      organizer: hostEmail,
      accountEmail: hostEmail,
      ownerEmail,
    }));
  }

  private async getGoToToken(platforms: MeetingPlatformCredsBundle): Promise<string | null> {
    const credentials = Buffer.from(
      `${platforms.gotomeeting.clientId}:${platforms.gotomeeting.clientSecret}`,
    ).toString('base64');
    const resp = await this.fetchFn('https://authentication.logmeininc.com/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(API_TIMEOUT),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { access_token: string };
    return data.access_token;
  }

  private async fetchGoToEvents(
    platforms: MeetingPlatformCredsBundle,
    organizerKey: string,
    ownerEmail: string,
  ): Promise<CalendarEventView[]> {
    const token = await this.getGoToToken(platforms);
    if (!token) return [];
    const resp = await this.fetchFn(
      `https://api.getgo.com/G2M/rest/v2/organizers/${encodeURIComponent(organizerKey)}/meetings`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status, organizerKey }, 'GoTo meetings fetch failed');
      return [];
    }
    const data = (await resp.json()) as Array<{
      meetingId: number;
      subject?: string;
      joinURL?: string;
      startTime?: string;
      endTime?: string;
    }>;
    return (data ?? []).map((m) => ({
      id: `gotomeeting:${m.meetingId}`,
      provider: 'gotomeeting' as const,
      subject: m.subject || 'GoTo Meeting',
      start: m.startTime ? new Date(m.startTime).toISOString() : '',
      end: m.endTime ? new Date(m.endTime).toISOString() : '',
      location: '',
      joinUrl: m.joinURL ?? '',
      organizer: organizerKey,
      accountEmail: organizerKey,
      ownerEmail,
    }));
  }

  private async fetchBlueJeansEvents(
    platforms: MeetingPlatformCredsBundle,
    bluejeansUserId: string,
    ownerEmail: string,
  ): Promise<CalendarEventView[]> {
    const resp = await this.fetchFn(
      `https://api.bluejeans.com/v1/user/${encodeURIComponent(bluejeansUserId)}/scheduled_meeting`,
      {
        headers: { Authorization: `Bearer ${platforms.bluejeans.apiKey}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status, bluejeansUserId }, 'BlueJeans meetings fetch failed');
      return [];
    }
    const data = (await resp.json()) as Array<{
      id?: string | number;
      title?: string;
      meetingUri?: string;
      numericMeetingId?: number;
      start?: string;
      end?: string;
    }>;
    return (data ?? []).map((m) => ({
      id: `bluejeans:${m.id ?? m.numericMeetingId}`,
      provider: 'bluejeans' as const,
      subject: m.title || 'BlueJeans Meeting',
      start: m.start ? new Date(m.start).toISOString() : '',
      end: m.end ? new Date(m.end).toISOString() : '',
      location: '',
      joinUrl: m.meetingUri
        ? m.meetingUri
        : m.numericMeetingId
          ? `https://bluejeans.com/${m.numericMeetingId}`
          : '',
      organizer: bluejeansUserId,
      accountEmail: bluejeansUserId,
      ownerEmail,
    }));
  }

  private async fetchMicrosoftEvents(
    accessToken: string,
    ownerEmail: string,
    accountEmail: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    const params = new URLSearchParams({
      startDateTime: fromIso,
      endDateTime: toIso,
      $select: 'id,subject,start,end,location,onlineMeeting,organizer,isOnlineMeeting',
      $orderby: 'start/dateTime',
      $top: '50',
    });
    const resp = await this.fetchFn(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status }, 'Microsoft calendarView failed');
      return [];
    }
    const data = (await resp.json()) as {
      value?: Array<{
        id: string;
        subject?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        location?: { displayName?: string };
        onlineMeeting?: { joinUrl?: string };
        organizer?: { emailAddress?: { address?: string; name?: string } };
      }>;
    };

    return (data.value ?? []).map((e) => ({
      id: `microsoft:${e.id}`,
      provider: 'microsoft' as const,
      subject: e.subject || '(No title)',
      start: this.graphDate(e.start),
      end: this.graphDate(e.end),
      location: e.location?.displayName ?? '',
      joinUrl: e.onlineMeeting?.joinUrl ?? '',
      organizer: e.organizer?.emailAddress?.address || e.organizer?.emailAddress?.name || '',
      accountEmail: accountEmail || ownerEmail,
      ownerEmail,
    }));
  }

  private graphDate(d?: { dateTime?: string; date?: string }): string {
    if (!d) return '';
    if (d.dateTime) {
      const normalized = d.dateTime.endsWith('Z') ? d.dateTime : `${d.dateTime}Z`;
      return new Date(normalized).toISOString();
    }
    if (d.date) return `${d.date}T00:00:00.000Z`;
    return '';
  }

  private async fetchGoogleEvents(
    accessToken: string,
    ownerEmail: string,
    accountEmail: string,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEventView[]> {
    const params = new URLSearchParams({
      timeMin: fromIso,
      timeMax: toIso,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });
    const resp = await this.fetchFn(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );
    if (!resp.ok) {
      this.logger.warn({ status: resp.status }, 'Google calendar events failed');
      return [];
    }
    const data = (await resp.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        location?: string;
        hangoutLink?: string;
        conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
        organizer?: { email?: string; displayName?: string };
      }>;
    };

    return (data.items ?? []).map((e) => {
      const joinFromConf =
        e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri ?? '';
      return {
        id: `google:${e.id}`,
        provider: 'google' as const,
        subject: e.summary || '(No title)',
        start: e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00.000Z` : ''),
        end: e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00.000Z` : ''),
        location: e.location ?? '',
        joinUrl: e.hangoutLink || joinFromConf || '',
        organizer: e.organizer?.email || e.organizer?.displayName || '',
        accountEmail: accountEmail || ownerEmail,
        ownerEmail,
      };
    });
  }
}

export function defaultCalendarRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function parseCalendarProvider(raw: string): CalendarProvider | null {
  return isCalendarProvider(raw) ? raw : null;
}

export function parseOAuthCalendarProvider(raw: string): OAuthCalendarProvider | null {
  return isOAuthCalendarProvider(raw) ? raw : null;
}

export function parsePlatformCalendarProvider(raw: string): PlatformCalendarProvider | null {
  return isPlatformCalendarProvider(raw) ? raw : null;
}

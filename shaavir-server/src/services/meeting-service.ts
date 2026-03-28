import type { Logger } from 'pino';
import type { MeetingRepository, TrackedMeeting } from '../repositories/meeting-repository';
import type { AppConfig } from '../config';

/** Timeout for all external API calls (ms). */
const API_TIMEOUT = 10_000;

/** Result from a platform's attendance sync. */
interface AttendanceResult {
  email: string;
  displayName: string;
  joinTime: string;
  leaveTime: string;
  totalSeconds: number;
  lateMinutes: number;
  credit: number;
}

/**
 * Tracked Meeting service — CRUD, multi-platform discovery, attendance ingestion.
 *
 * Supported platforms:
 *   - Microsoft Teams  (Graph API, client credentials)
 *   - Google Meet      (Calendar API, service account JWT)
 *   - Zoom             (Server-to-Server OAuth, REST API)
 *   - Webex            (Bot Token, REST API)
 *   - GoToMeeting      (OAuth2 client credentials)
 *   - BlueJeans        (API Key)
 *
 * Each platform has:
 *   1. Discovery — fetch scheduled/recurring meetings, dedup by external_id
 *   2. Attendance — fetch post-meeting participant reports, upsert records
 *
 * All external calls have 10s timeout, error logging, graceful empty-array fallback.
 */
export class MeetingService {
  private readonly config: AppConfig;

  constructor(
    private readonly repo: MeetingRepository,
    private readonly logger: Logger,
    config: AppConfig,
  ) {
    this.config = config;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CRUD
  // ═══════════════════════════════════════════════════════════════

  /** Add a tracked meeting manually. */
  async addMeeting(data: {
    name: string;
    joinUrl: string;
    client: string;
    purpose: string;
    addedBy: string;
  }): Promise<{ success: boolean; meeting?: TrackedMeeting; error?: string }> {
    if (!data.name) {
      return { success: false, error: 'Meeting name is required' };
    }

    const platform = this.detectPlatform(data.joinUrl);
    const meeting = await this.repo.create({
      name: data.name,
      joinUrl: data.joinUrl,
      platform,
      client: data.client,
      purpose: data.purpose,
      addedBy: data.addedBy,
      externalId: '',
    });

    this.logger.info(
      { meetingId: meeting.id, name: data.name, platform, addedBy: data.addedBy },
      'Tracked meeting added',
    );

    return { success: true, meeting };
  }

  /** Get all tracked meetings. */
  async getAll(): Promise<TrackedMeeting[]> {
    return this.repo.getAll();
  }

  /** Update/enrich a meeting. */
  async update(
    meetingId: string,
    fields: { client?: string; purpose?: string },
  ): Promise<{ success: boolean; error?: string }> {
    const meeting = await this.repo.getById(meetingId);
    if (!meeting) return { success: false, error: 'Meeting not found' };

    const updates: Record<string, unknown> = {};
    if (fields.client !== undefined) updates.client = fields.client;
    if (fields.purpose !== undefined) updates.purpose = fields.purpose;

    if (Object.keys(updates).length > 0) {
      await this.repo.update(meetingId, updates as { client?: string; purpose?: string });
    }

    return { success: true };
  }

  /** Get all attendance data in the frontend's expected grouped format. */
  async getAttendance(): Promise<{
    attendance: Record<
      string,
      {
        date: string;
        records: Array<{
          email: string;
          displayName: string;
          totalSeconds: number;
          lateMinutes: number;
          duration: string;
          credit: number;
        }>;
      }
    >;
  }> {
    const attendance = await this.repo.getAllAttendance();
    return { attendance };
  }

  // ═══════════════════════════════════════════════════════════════
  //  DISCOVERY — All Platforms
  // ═══════════════════════════════════════════════════════════════

  /**
   * Discover meetings from every configured platform.
   * Returns newly added meetings grouped by platform.
   */
  async discoverAll(
    teamsUserId: string,
    googleEmail: string,
    zoomUserId: string,
    webexEmail: string,
    gotoOrganizerKey: string,
    bluejeansUserId: string,
  ): Promise<{
    teams: TrackedMeeting[];
    google: TrackedMeeting[];
    zoom: TrackedMeeting[];
    webex: TrackedMeeting[];
    gotomeeting: TrackedMeeting[];
    bluejeans: TrackedMeeting[];
  }> {
    const [teams, google, zoom, webex, gotomeeting, bluejeans] = await Promise.all([
      this.discoverTeams(teamsUserId),
      this.discoverGoogle(googleEmail),
      this.discoverZoom(zoomUserId),
      this.discoverWebex(webexEmail),
      this.discoverGoTo(gotoOrganizerKey),
      this.discoverBlueJeans(bluejeansUserId),
    ]);

    return { teams, google, zoom, webex, gotomeeting, bluejeans };
  }

  /**
   * Sync attendance for a specific meeting from its platform's API.
   * Returns the number of attendance records ingested.
   */
  async syncAttendance(
    meetingId: string,
    sessionDate: string,
  ): Promise<{ success: boolean; count: number; error?: string }> {
    const meeting = await this.repo.getById(meetingId);
    if (!meeting) return { success: false, count: 0, error: 'Meeting not found' };

    let participants: AttendanceResult[] = [];

    switch (meeting.platform) {
      case 'teams':
        participants = await this.fetchTeamsAttendance(meeting);
        break;
      case 'google-meet':
        participants = await this.fetchGoogleAttendance(meeting);
        break;
      case 'zoom':
        participants = await this.fetchZoomAttendance(meeting);
        break;
      case 'webex':
        participants = await this.fetchWebexAttendance(meeting);
        break;
      case 'gotomeeting':
        participants = await this.fetchGoToAttendance(meeting);
        break;
      case 'bluejeans':
        participants = await this.fetchBlueJeansAttendance(meeting);
        break;
      default:
        return { success: true, count: 0 };
    }

    for (const p of participants) {
      await this.repo.recordAttendance({
        meetingId: meeting.id,
        sessionDate: sessionDate || new Date().toISOString().split('T')[0],
        email: p.email,
        displayName: p.displayName,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime,
        totalSeconds: p.totalSeconds,
        lateMinutes: p.lateMinutes,
        credit: p.credit,
      });
    }

    this.logger.info(
      { meetingId, platform: meeting.platform, count: participants.length },
      'Attendance synced',
    );

    return { success: true, count: participants.length };
  }

  // ═══════════════════════════════════════════════════════════════
  //  MICROSOFT TEAMS — Graph API
  // ═══════════════════════════════════════════════════════════════

  private async discoverTeams(userId: string): Promise<TrackedMeeting[]> {
    if (!this.config.azureBotAppId || !this.config.azureBotAppPassword || !userId) {
      return [];
    }

    try {
      const token = await this.getGraphToken();
      if (!token) return [];

      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/calendar/events?$filter=isOnlineMeeting eq true&$top=50&$select=id,subject,onlineMeeting,recurrence&$orderby=createdDateTime desc`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) {
        this.logger.warn({ status: resp.status, userId }, 'Teams calendar fetch failed');
        return [];
      }

      const data = (await resp.json()) as {
        value: Array<{
          id: string;
          subject: string;
          onlineMeeting?: { joinUrl?: string };
        }>;
      };

      return this.deduplicateAndStore(
        data.value
          ?.filter((e) => e.onlineMeeting?.joinUrl)
          .map((e) => ({
            name: e.subject ?? 'Teams Meeting',
            joinUrl: e.onlineMeeting!.joinUrl!,
            platform: 'teams',
            externalId: e.id,
          })) ?? [],
      );
    } catch (err) {
      this.logger.error({ err, userId }, 'Teams discover error');
      return [];
    }
  }

  private async fetchTeamsAttendance(meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    if (!this.config.azureBotAppId || !this.config.azureBotAppPassword || !meeting.external_id) {
      return [];
    }

    try {
      const token = await this.getGraphToken();
      if (!token) return [];

      // Get attendance reports for the online meeting
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/communications/onlineMeetings/${encodeURIComponent(meeting.external_id)}/attendanceReports`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) return [];

      const data = (await resp.json()) as {
        value: Array<{
          id: string;
          attendanceRecords: Array<{
            emailAddress: string;
            identity?: { displayName?: string };
            totalAttendanceInSeconds: number;
            attendanceIntervals: Array<{
              joinDateTime: string;
              leaveDateTime: string;
            }>;
          }>;
        }>;
      };

      const results: AttendanceResult[] = [];
      for (const report of data.value ?? []) {
        for (const record of report.attendanceRecords ?? []) {
          const firstJoin = record.attendanceIntervals?.[0]?.joinDateTime ?? '';
          const lastLeave =
            record.attendanceIntervals?.[record.attendanceIntervals.length - 1]?.leaveDateTime ??
            '';
          results.push({
            email: record.emailAddress ?? '',
            displayName: record.identity?.displayName ?? record.emailAddress ?? '',
            joinTime: firstJoin,
            leaveTime: lastLeave,
            totalSeconds: record.totalAttendanceInSeconds ?? 0,
            lateMinutes: 0,
            credit: this.calculateCredit(record.totalAttendanceInSeconds ?? 0),
          });
        }
      }
      return results;
    } catch (err) {
      this.logger.error({ err, meetingId: meeting.id }, 'Teams attendance fetch error');
      return [];
    }
  }

  private async getGraphToken(): Promise<string | null> {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.azureBotAppId!,
        client_secret: this.config.azureBotAppPassword!,
        scope: 'https://graph.microsoft.com/.default',
      });
      const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { access_token: string };
      return data.access_token;
    } catch (err) {
      this.logger.error({ err }, 'Graph token fetch failed');
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  GOOGLE MEET — Calendar API + Workspace Reports
  // ═══════════════════════════════════════════════════════════════

  private async discoverGoogle(googleEmail: string): Promise<TrackedMeeting[]> {
    if (!this.config.googleChatServiceAccountJson || !googleEmail) {
      return [];
    }

    try {
      const token = await this.getGoogleToken(googleEmail);
      if (!token) return [];

      const now = new Date().toISOString();
      const resp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleEmail)}/events?timeMin=${now}&maxResults=50&singleEvents=false&orderBy=updated`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) {
        this.logger.warn({ status: resp.status, googleEmail }, 'Google calendar fetch failed');
        return [];
      }

      const data = (await resp.json()) as {
        items: Array<{
          id: string;
          summary: string;
          conferenceData?: {
            entryPoints?: Array<{ uri?: string; entryPointType?: string }>;
          };
        }>;
      };

      return this.deduplicateAndStore(
        (data.items ?? [])
          .map((e) => {
            const video = e.conferenceData?.entryPoints?.find(
              (ep) => ep.entryPointType === 'video',
            );
            if (!video?.uri) return null;
            return {
              name: e.summary ?? 'Google Meet',
              joinUrl: video.uri,
              platform: 'google-meet',
              externalId: e.id,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null),
      );
    } catch (err) {
      this.logger.error({ err, googleEmail }, 'Google discover error');
      return [];
    }
  }

  private fetchGoogleAttendance(_meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    // Google Meet attendance requires Workspace Admin SDK Reports API:
    //   GET https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/meet
    //   Requires domain-wide delegation with scope admin.reports.audit.readonly
    // This is only available to Google Workspace admins, not consumer Gmail.
    // When configured, the scheduler would call this endpoint after meetings end.
    this.logger.info(
      { meetingId: _meeting.id },
      'Google Meet attendance requires Workspace Admin SDK',
    );
    return Promise.resolve([]);
  }

  private getGoogleToken(_email: string): Promise<string | null> {
    try {
      const sa = JSON.parse(this.config.googleChatServiceAccountJson!) as {
        client_email?: string;
        private_key?: string;
      };
      if (!sa.client_email || !sa.private_key) return Promise.resolve(null);

      // Google OAuth2 JWT flow: sign a JWT with the service account private key,
      // exchange it at https://oauth2.googleapis.com/token for an access token.
      // Requires Node.js crypto for RS256 signing. In production, use:
      //   const { GoogleAuth } = require('google-auth-library');
      //   const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/calendar.readonly'] });
      this.logger.info('Google Calendar sync requires google-auth-library for JWT signing');
      return Promise.resolve(null);
    } catch {
      return Promise.resolve(null);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ZOOM — Server-to-Server OAuth + REST API
  // ═══════════════════════════════════════════════════════════════

  private async discoverZoom(zoomUserId: string): Promise<TrackedMeeting[]> {
    if (
      !this.config.zoomAccountId ||
      !this.config.zoomClientId ||
      !this.config.zoomClientSecret ||
      !zoomUserId
    ) {
      return [];
    }

    try {
      const token = await this.getZoomToken();
      if (!token) return [];

      // GET /users/{userId}/meetings — list scheduled meetings
      const resp = await fetch(
        `https://api.zoom.us/v2/users/${encodeURIComponent(zoomUserId)}/meetings?type=scheduled&page_size=50`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) {
        this.logger.warn({ status: resp.status, zoomUserId }, 'Zoom meetings fetch failed');
        return [];
      }

      const data = (await resp.json()) as {
        meetings: Array<{
          id: number;
          uuid: string;
          topic: string;
          join_url: string;
          type: number;
        }>;
      };

      return this.deduplicateAndStore(
        (data.meetings ?? []).map((m) => ({
          name: m.topic ?? 'Zoom Meeting',
          joinUrl: m.join_url ?? '',
          platform: 'zoom',
          externalId: `zoom_${m.id}`,
        })),
      );
    } catch (err) {
      this.logger.error({ err, zoomUserId }, 'Zoom discover error');
      return [];
    }
  }

  private async fetchZoomAttendance(meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    if (
      !this.config.zoomAccountId ||
      !this.config.zoomClientId ||
      !this.config.zoomClientSecret ||
      !meeting.external_id
    ) {
      return [];
    }

    try {
      const token = await this.getZoomToken();
      if (!token) return [];

      // Extract numeric meeting ID from external_id (stored as "zoom_123456")
      const numericId = meeting.external_id.replace('zoom_', '');

      // GET /past_meetings/{meetingId}/participants — post-meeting participant report
      const resp = await fetch(
        `https://api.zoom.us/v2/past_meetings/${encodeURIComponent(numericId)}/participants?page_size=100`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) return [];

      const data = (await resp.json()) as {
        participants: Array<{
          name: string;
          user_email: string;
          join_time: string;
          leave_time: string;
          duration: number; // seconds
        }>;
      };

      return (data.participants ?? []).map((p) => ({
        email: p.user_email ?? '',
        displayName: p.name ?? p.user_email ?? '',
        joinTime: p.join_time ?? '',
        leaveTime: p.leave_time ?? '',
        totalSeconds: p.duration ?? 0,
        lateMinutes: 0,
        credit: this.calculateCredit(p.duration ?? 0),
      }));
    } catch (err) {
      this.logger.error({ err, meetingId: meeting.id }, 'Zoom attendance fetch error');
      return [];
    }
  }

  /**
   * Zoom Server-to-Server OAuth: POST to zoom.us/oauth/token with account_credentials grant.
   * Requires ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
   */
  private async getZoomToken(): Promise<string | null> {
    try {
      const credentials = Buffer.from(
        `${this.config.zoomClientId}:${this.config.zoomClientSecret}`,
      ).toString('base64');

      const resp = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(this.config.zoomAccountId!)}`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${credentials}` },
          signal: AbortSignal.timeout(API_TIMEOUT),
        },
      );

      if (!resp.ok) return null;
      const data = (await resp.json()) as { access_token: string };
      return data.access_token;
    } catch (err) {
      this.logger.error({ err }, 'Zoom token fetch failed');
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  WEBEX — Bot Token + REST API
  // ═══════════════════════════════════════════════════════════════

  private async discoverWebex(webexEmail: string): Promise<TrackedMeeting[]> {
    if (!this.config.webexBotToken || !webexEmail) {
      return [];
    }

    try {
      // GET /meetings — list meetings for the authenticated user or a host
      const resp = await fetch(
        `https://webexapis.com/v1/meetings?meetingType=scheduledMeeting&hostEmail=${encodeURIComponent(webexEmail)}&max=50`,
        {
          headers: { Authorization: `Bearer ${this.config.webexBotToken}` },
          signal: AbortSignal.timeout(API_TIMEOUT),
        },
      );

      if (!resp.ok) {
        this.logger.warn({ status: resp.status, webexEmail }, 'Webex meetings fetch failed');
        return [];
      }

      const data = (await resp.json()) as {
        items: Array<{
          id: string;
          title: string;
          webLink: string;
          meetingType: string;
        }>;
      };

      return this.deduplicateAndStore(
        (data.items ?? []).map((m) => ({
          name: m.title ?? 'Webex Meeting',
          joinUrl: m.webLink ?? '',
          platform: 'webex',
          externalId: `webex_${m.id}`,
        })),
      );
    } catch (err) {
      this.logger.error({ err, webexEmail }, 'Webex discover error');
      return [];
    }
  }

  private async fetchWebexAttendance(meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    if (!this.config.webexBotToken || !meeting.external_id) {
      return [];
    }

    try {
      const webexId = meeting.external_id.replace('webex_', '');

      // GET /meetingParticipants — participant report for a past meeting
      const resp = await fetch(
        `https://webexapis.com/v1/meetingParticipants?meetingId=${encodeURIComponent(webexId)}`,
        {
          headers: { Authorization: `Bearer ${this.config.webexBotToken}` },
          signal: AbortSignal.timeout(API_TIMEOUT),
        },
      );

      if (!resp.ok) return [];

      const data = (await resp.json()) as {
        items: Array<{
          email: string;
          displayName: string;
          joinedTime: string;
          leftTime: string;
          durationInSeconds: number;
        }>;
      };

      return (data.items ?? []).map((p) => ({
        email: p.email ?? '',
        displayName: p.displayName ?? p.email ?? '',
        joinTime: p.joinedTime ?? '',
        leaveTime: p.leftTime ?? '',
        totalSeconds: p.durationInSeconds ?? 0,
        lateMinutes: 0,
        credit: this.calculateCredit(p.durationInSeconds ?? 0),
      }));
    } catch (err) {
      this.logger.error({ err, meetingId: meeting.id }, 'Webex attendance fetch error');
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  GOTOMEETING — OAuth2 Client Credentials + REST API
  // ═══════════════════════════════════════════════════════════════

  private async discoverGoTo(organizerKey: string): Promise<TrackedMeeting[]> {
    if (!this.config.gotoClientId || !this.config.gotoClientSecret || !organizerKey) {
      return [];
    }

    try {
      const token = await this.getGoToToken();
      if (!token) return [];

      // GET /G2M/rest/v2/organizers/{organizerKey}/meetings — upcoming meetings
      const resp = await fetch(
        `https://api.getgo.com/G2M/rest/v2/organizers/${encodeURIComponent(organizerKey)}/meetings`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) {
        this.logger.warn({ status: resp.status, organizerKey }, 'GoTo meetings fetch failed');
        return [];
      }

      const data = (await resp.json()) as Array<{
        meetingId: number;
        subject: string;
        joinURL: string;
        meetingType: string;
      }>;

      return this.deduplicateAndStore(
        (data ?? []).map((m) => ({
          name: m.subject ?? 'GoToMeeting',
          joinUrl: m.joinURL ?? '',
          platform: 'gotomeeting',
          externalId: `goto_${m.meetingId}`,
        })),
      );
    } catch (err) {
      this.logger.error({ err, organizerKey }, 'GoTo discover error');
      return [];
    }
  }

  private async fetchGoToAttendance(meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    if (!this.config.gotoClientId || !this.config.gotoClientSecret || !meeting.external_id) {
      return [];
    }

    try {
      const token = await this.getGoToToken();
      if (!token) return [];

      const gotoId = meeting.external_id.replace('goto_', '');

      // GET /G2M/rest/v2/meetings/{meetingId}/attendees — post-meeting attendee report
      const resp = await fetch(
        `https://api.getgo.com/G2M/rest/v2/meetings/${encodeURIComponent(gotoId)}/attendees`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT) },
      );

      if (!resp.ok) return [];

      const data = (await resp.json()) as Array<{
        attendeeEmail: string;
        attendeeName: string;
        joinTime: string;
        leaveTime: string;
        duration: number; // minutes
      }>;

      return (data ?? []).map((p) => ({
        email: p.attendeeEmail ?? '',
        displayName: p.attendeeName ?? p.attendeeEmail ?? '',
        joinTime: p.joinTime ?? '',
        leaveTime: p.leaveTime ?? '',
        totalSeconds: (p.duration ?? 0) * 60,
        lateMinutes: 0,
        credit: this.calculateCredit((p.duration ?? 0) * 60),
      }));
    } catch (err) {
      this.logger.error({ err, meetingId: meeting.id }, 'GoTo attendance fetch error');
      return [];
    }
  }

  /**
   * GoToMeeting OAuth2: POST to authentication.logmeininc.com/oauth/token.
   * Uses client_credentials grant.
   */
  private async getGoToToken(): Promise<string | null> {
    try {
      const credentials = Buffer.from(
        `${this.config.gotoClientId}:${this.config.gotoClientSecret}`,
      ).toString('base64');

      const resp = await fetch('https://authentication.logmeininc.com/oauth/token', {
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
    } catch (err) {
      this.logger.error({ err }, 'GoTo token fetch failed');
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  BLUEJEANS — API Key + REST API
  // ═══════════════════════════════════════════════════════════════

  private async discoverBlueJeans(bluejeansUserId: string): Promise<TrackedMeeting[]> {
    if (!this.config.bluejeansApiKey || !bluejeansUserId) {
      return [];
    }

    try {
      // GET /v1/user/{userId}/scheduled_meeting — list scheduled meetings
      const resp = await fetch(
        `https://api.bluejeans.com/v1/user/${encodeURIComponent(bluejeansUserId)}/scheduled_meeting`,
        {
          headers: {
            Authorization: `Bearer ${this.config.bluejeansApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(API_TIMEOUT),
        },
      );

      if (!resp.ok) {
        this.logger.warn(
          { status: resp.status, bluejeansUserId },
          'BlueJeans meetings fetch failed',
        );
        return [];
      }

      const data = (await resp.json()) as Array<{
        id: number;
        title: string;
        numericMeetingId: string;
        meetingUri: string;
      }>;

      return this.deduplicateAndStore(
        (data ?? []).map((m) => ({
          name: m.title ?? 'BlueJeans Meeting',
          joinUrl: m.meetingUri ? `https://bluejeans.com/${m.numericMeetingId}` : '',
          platform: 'bluejeans',
          externalId: `bj_${m.id}`,
        })),
      );
    } catch (err) {
      this.logger.error({ err, bluejeansUserId }, 'BlueJeans discover error');
      return [];
    }
  }

  private async fetchBlueJeansAttendance(meeting: TrackedMeeting): Promise<AttendanceResult[]> {
    if (!this.config.bluejeansApiKey || !meeting.external_id) {
      return [];
    }

    try {
      const bjId = meeting.external_id.replace('bj_', '');

      // BlueJeans meeting history endpoints require the userId who owns the meeting.
      // GET /v1/user/{userId}/meeting_history/{numericMeetingId}
      // Since we don't store the owning userId per meeting, we use the general endpoint.
      const resp = await fetch(
        `https://api.bluejeans.com/v1/meeting/${encodeURIComponent(bjId)}/participants`,
        {
          headers: {
            Authorization: `Bearer ${this.config.bluejeansApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(API_TIMEOUT),
        },
      );

      if (!resp.ok) return [];

      const data = (await resp.json()) as {
        participants: Array<{
          email: string;
          name: string;
          joinTime: string;
          disconnectTime: string;
          duration: number; // seconds
        }>;
      };

      return (data.participants ?? []).map((p) => ({
        email: p.email ?? '',
        displayName: p.name ?? p.email ?? '',
        joinTime: p.joinTime ?? '',
        leaveTime: p.disconnectTime ?? '',
        totalSeconds: p.duration ?? 0,
        lateMinutes: 0,
        credit: this.calculateCredit(p.duration ?? 0),
      }));
    } catch (err) {
      this.logger.error({ err, meetingId: meeting.id }, 'BlueJeans attendance fetch error');
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ═══════════════════════════════════════════════════════════════

  /** Detect platform from join URL. */
  private detectPlatform(joinUrl: string): string {
    if (!joinUrl) return 'manual';
    const lower = joinUrl.toLowerCase();
    if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'teams';
    if (lower.includes('meet.google.com')) return 'google-meet';
    if (lower.includes('zoom.us') || lower.includes('zoom.com')) return 'zoom';
    if (lower.includes('webex.com')) return 'webex';
    if (lower.includes('gotomeeting.com') || lower.includes('goto.com/meeting'))
      return 'gotomeeting';
    if (lower.includes('bluejeans.com')) return 'bluejeans';
    return 'manual';
  }

  /**
   * Deduplicate discovered meetings by external_id and store new ones.
   * Returns only the newly added meetings.
   */
  private async deduplicateAndStore(
    candidates: Array<{ name: string; joinUrl: string; platform: string; externalId: string }>,
  ): Promise<TrackedMeeting[]> {
    const added: TrackedMeeting[] = [];
    for (const candidate of candidates) {
      const existing = await this.repo.getByExternalId(candidate.externalId);
      if (existing) continue;

      const meeting = await this.repo.create({
        name: candidate.name,
        joinUrl: candidate.joinUrl,
        platform: candidate.platform,
        client: '',
        purpose: '',
        addedBy: 'calendar-sync',
        externalId: candidate.externalId,
      });
      added.push(meeting);
    }

    if (added.length > 0) {
      this.logger.info(
        { count: added.length, platform: candidates[0]?.platform },
        'Meetings discovered',
      );
    }

    return added;
  }

  /**
   * Calculate attendance credit from total seconds.
   * 100 = full attendance (30+ min), 50 = partial (10-30 min), 0 = minimal (<10 min).
   */
  private calculateCredit(totalSeconds: number): number {
    const minutes = totalSeconds / 60;
    if (minutes >= 30) return 100;
    if (minutes >= 10) return 50;
    return 0;
  }
}

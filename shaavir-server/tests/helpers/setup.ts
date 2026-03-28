import path from 'path';
import pino from 'pino';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';
import { createApp } from '../../src/app';
import { createClockRouter } from '../../src/routes/clock';
import { createLeaveRouter } from '../../src/routes/leaves';
import { createRegularizationRouter } from '../../src/routes/regularizations';
import { createBdMeetingRouter } from '../../src/routes/bd-meetings';
import { createMeetingRouter } from '../../src/routes/meetings';
import { createSettingsRouter } from '../../src/routes/settings';
import { createSseRouter } from '../../src/routes/sse';
import { createSetupRouter } from '../../src/routes/setup';
import { createAuthRouter } from '../../src/routes/auth';
import { createProfileRouter } from '../../src/routes/profile';
import { createInteractionRouter } from '../../src/routes/interactions';
import { createLeavePolicyRouter } from '../../src/routes/leave-policies';
import { createHolidayRouter } from '../../src/routes/holidays';
import { createTimeTrackingRouter } from '../../src/routes/time-tracking';
import { createOvertimeRouter } from '../../src/routes/overtime';
import { createTimesheetRouter } from '../../src/routes/timesheets';
import { createAnalyticsRouter } from '../../src/routes/analytics';
import { createFaceRecognitionRouter } from '../../src/routes/face-recognition';
import { createGeoFencingRouter } from '../../src/routes/geo-fencing';
import { createChatbotRouter } from '../../src/routes/chatbot';
import { createLiveChatRouter } from '../../src/routes/live-chat';
import { createStorageRouter } from '../../src/routes/storage';
import { createAuditRouter } from '../../src/routes/audit';
import { createWebhookReceiverRouter } from '../../src/routes/webhook-receivers';
import { createFeatureFlagsRouter } from '../../src/routes/feature-flags';
import { createOrgChartRouter } from '../../src/routes/org-chart';
import { createDocumentRouter } from '../../src/routes/documents';
import { createTrainingRouter } from '../../src/routes/training';
import { createWorkflowRouter } from '../../src/routes/workflows';
import { createSurveyRouter } from '../../src/routes/surveys';
import { createAssetRouter } from '../../src/routes/assets';
import { createVisitorRouter } from '../../src/routes/visitors';
import { createIrisScanRouter } from '../../src/routes/iris-scan';
import { createMobileRouter } from '../../src/routes/mobile';
import { createMultiAuthRouter } from '../../src/routes/multi-auth';
import { createMemberPreferencesRouter } from '../../src/routes/member-preferences';
import { createExportRouter } from '../../src/routes/export';
import { FeatureFlagService } from '../../src/services/feature-flags';
import { MockStorageProvider } from '../../src/services/storage';
import { MockLlmClient } from '../../src/services/llm';
import { MockFaceApiClient } from '../../src/services/face-recognition';
import { SseBroadcaster } from '../../src/sse/broadcaster';
import { ActionDispatcher } from '../../src/webhooks/action-dispatcher';
import { createNotificationDispatcher } from '../../src/services/notification';
import { LeaveNotificationService } from '../../src/services/leave-notifications';
import { LeaveRepository } from '../../src/repositories/leave-repository';
import { LeaveService } from '../../src/services/leave-service';
import { RegularizationRepository } from '../../src/repositories/regularization-repository';
import { ClockRepository } from '../../src/repositories/clock-repository';
import { RegularizationService } from '../../src/services/regularization-service';
import { BdMeetingRepository } from '../../src/repositories/bd-meeting-repository';
import { BdMeetingService } from '../../src/services/bd-meeting-service';
import type { AppConfig } from '../../src/config';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';

export const testLogger = pino({ level: 'silent' });

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    nodeEnv: 'test',
    logLevel: 'silent',
    corsOrigins: '*',
    dbEngine: 'sqlite',
    dbPath: ':memory:',
    dbUrl: '',
    azureBlobConnectionString: 'test',
    azureBlobContainer: 'test',
    azureBotAppId: undefined,
    azureBotAppPassword: undefined,
    slackBotToken: undefined,
    slackSigningSecret: undefined,
    googleChatServiceAccountJson: undefined,
    clickupApiToken: undefined,
    discordBotToken: undefined,
    discordAppId: undefined,
    whatsappPhoneId: undefined,
    whatsappToken: undefined,
    telegramBotToken: undefined,
    smtpHost: undefined,
    smtpPort: 587,
    smtpUser: undefined,
    smtpPass: undefined,
    smtpFrom: undefined,
    llmProvider: undefined,
    llmApiKey: undefined,
    llmBaseUrl: undefined,
    llmModel: undefined,
    azureFaceEndpoint: undefined,
    azureFaceKey: undefined,
    serverBaseUrl: undefined,
    actionLinkSecret: 'test-action-secret-32chars-long!',
    zoomAccountId: undefined,
    zoomClientId: undefined,
    zoomClientSecret: undefined,
    webexBotToken: undefined,
    gotoClientId: undefined,
    gotoClientSecret: undefined,
    bluejeansApiKey: undefined,
    defaultTimezone: 'Asia/Kolkata',
    logicalDayChangeTime: '06:00',
    publicDir: '/tmp/shaavir-test-public',
    migrationsDir: path.resolve(__dirname, '../../migrations'),
    redisUrl: undefined,
    eventRetentionDays: 90,
    ...overrides,
  };
}

/**
 * Creates a fully-wired test app with in-memory SQLite, migrations applied,
 * and all routes mounted. Returns the app, db, and SSE broadcaster.
 */
export async function createTestApp(): Promise<{
  app: Express;
  db: DatabaseEngine;
  broadcaster: SseBroadcaster;
  mockFaceApi: MockFaceApiClient;
  mockLlm: MockLlmClient;
  mockStorage: MockStorageProvider;
  featureFlags: FeatureFlagService;
}> {
  const db = new SqliteEngine(':memory:');
  await (db as SqliteEngine).initialize();

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const runner = new MigrationRunner(db, migrationsDir, testLogger);
  await runner.run();

  const config = testConfig();
  const broadcaster = new SseBroadcaster(testLogger, 60_000);
  const mockFaceApi = new MockFaceApiClient();
  const mockLlm = new MockLlmClient();
  const mockStorage = new MockStorageProvider();
  const featureFlags = new FeatureFlagService(db, testLogger);

  const app = createApp(config, testLogger, (a) => {
    // Feature flag guard — BEFORE all route handlers
    // Uses basic guard() for backward compatibility with existing tests
    a.use(featureFlags.guard());

    // Wire notification dispatcher
    const notificationDispatcher = createNotificationDispatcher(config, db, testLogger);
    const leaveNotifier = new LeaveNotificationService(notificationDispatcher, db, testLogger);

    const clockRouter = createClockRouter(db, testLogger);
    const leaveRouter = createLeaveRouter(db, testLogger, leaveNotifier);
    a.use('/api', clockRouter);
    a.use('/api', leaveRouter);
    const regRouter = createRegularizationRouter(db, testLogger, notificationDispatcher);
    a.use('/api', regRouter);
    const bdMeetingRouter = createBdMeetingRouter(db, testLogger, notificationDispatcher);
    a.use('/api', bdMeetingRouter);
    const meetingRouter = createMeetingRouter(db, testLogger, config);
    a.use('/api', meetingRouter);
    const settingsRouter = createSettingsRouter(db, testLogger, broadcaster);
    a.use('/api', settingsRouter);
    const sseRouter = createSseRouter(broadcaster);
    a.use('/api', sseRouter);
    const setupRouter = createSetupRouter(db, testLogger);
    a.use('/api', setupRouter);
    const authRouter = createAuthRouter(testLogger);
    a.use('/api', authRouter);
    const profileRouter = createProfileRouter(db, testLogger);
    a.use('/api', profileRouter);
    const memberPrefsRouter = createMemberPreferencesRouter(db, testLogger);
    a.use('/api', memberPrefsRouter);
    const exportRouter = createExportRouter(db, testLogger);
    a.use('/api', exportRouter);

    // Build action dispatcher for interaction receivers
    const leaveRepo = new LeaveRepository(db);
    const leaveService = new LeaveService(leaveRepo, testLogger);
    const regRepo = new RegularizationRepository(db);
    const clockRepo = new ClockRepository(db);
    const regService = new RegularizationService(regRepo, clockRepo, db, null, testLogger);
    const bdRepo = new BdMeetingRepository(db);
    const bdService = new BdMeetingService(bdRepo, db, null, testLogger);
    const actionDispatcher = new ActionDispatcher(leaveService, regService, bdService, testLogger);
    const interactionRouter = createInteractionRouter(actionDispatcher, config, testLogger, db);
    a.use('/api', interactionRouter);
    const leavePolicyRouter = createLeavePolicyRouter(db, testLogger);
    a.use('/api', leavePolicyRouter);
    const holidayRouter = createHolidayRouter(db, testLogger);
    a.use('/api', holidayRouter);
    const timeTrackingRouter = createTimeTrackingRouter(db, testLogger);
    a.use('/api', timeTrackingRouter);
    const overtimeRouter = createOvertimeRouter(db, testLogger);
    a.use('/api', overtimeRouter);
    const timesheetRouter = createTimesheetRouter(db, testLogger);
    a.use('/api', timesheetRouter);
    const analyticsRouter = createAnalyticsRouter(db, testLogger);
    a.use('/api', analyticsRouter);
    const faceRouter = createFaceRecognitionRouter(db, config, testLogger, mockFaceApi);
    a.use('/api', faceRouter);
    const geoRouter = createGeoFencingRouter(db, testLogger);
    a.use('/api', geoRouter);
    const chatbotRouter = createChatbotRouter(db, config, testLogger, mockLlm);
    a.use('/api', chatbotRouter);
    const liveChatRouter = createLiveChatRouter(db, broadcaster, testLogger);
    a.use('/api', liveChatRouter);
    const storageRouter = createStorageRouter(db, testLogger, mockStorage);
    a.use('/api', storageRouter);
    const auditRouter = createAuditRouter(db, testLogger);
    a.use('/api', auditRouter);
    const webhookReceiverRouter = createWebhookReceiverRouter(db, testLogger);
    a.use('/api', webhookReceiverRouter);
    const ffRouter = createFeatureFlagsRouter(featureFlags, testLogger, db);
    a.use('/api', ffRouter);
    const orgChartRouter = createOrgChartRouter(db, testLogger);
    a.use('/api', orgChartRouter);
    const documentRouter = createDocumentRouter(db, testLogger);
    a.use('/api', documentRouter);
    const trainingRouter = createTrainingRouter(db, testLogger);
    a.use('/api', trainingRouter);
    const workflowRouter = createWorkflowRouter(db, testLogger);
    a.use('/api', workflowRouter);
    const surveyRouter = createSurveyRouter(db, testLogger);
    a.use('/api', surveyRouter);
    const assetRouter = createAssetRouter(db, testLogger);
    a.use('/api', assetRouter);
    const visitorRouter = createVisitorRouter(db, testLogger);
    a.use('/api', visitorRouter);
    const irisScanRouter = createIrisScanRouter(db, testLogger);
    a.use('/api', irisScanRouter);
    const mobileRouter = createMobileRouter(db, testLogger);
    a.use('/api', mobileRouter);
    const multiAuthRouter = createMultiAuthRouter(db, testLogger);
    a.use('/api', multiAuthRouter);
  });

  // Load feature flags into cache (must be after migrations)
  await featureFlags.load();

  return { app, db, broadcaster, mockFaceApi, mockLlm, mockStorage, featureFlags };
}

/** Seed a member and group so clock actions can succeed. */
export async function seedMember(
  db: DatabaseEngine,
  opts: {
    email?: string;
    name?: string;
    groupId?: string;
    groupName?: string;
    groupShiftStart?: string;
    groupShiftEnd?: string;
    individualShiftStart?: string;
    individualShiftEnd?: string;
  } = {},
): Promise<void> {
  const email = opts.email || 'test@shaavir.com';
  const name = opts.name || 'Test User';
  const groupId = opts.groupId || 'engineering';
  const groupName = opts.groupName || 'Engineering';
  const shiftStart = opts.groupShiftStart || '00:00';
  const shiftEnd = opts.groupShiftEnd || '23:59';

  await db.run(
    'INSERT OR IGNORE INTO groups (id, name, shift_start, shift_end) VALUES (?, ?, ?, ?)',
    [groupId, groupName, shiftStart, shiftEnd],
  );
  await db.run(
    `INSERT OR IGNORE INTO members (id, email, name, group_id, active, individual_shift_start, individual_shift_end)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [
      email,
      email,
      name,
      groupId,
      opts.individualShiftStart || null,
      opts.individualShiftEnd || null,
    ],
  );
}

/** Seed tenant_settings row. */
export async function seedTenantSettings(
  db: DatabaseEngine,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const defaults = {
    id: 'default',
    platform_name: 'TestHR',
    primary_timezone: 'Asia/Kolkata',
    settings_json: JSON.stringify({
      attendance: { autoCutoffMinutes: 120, gracePeriodMinutes: 15 },
      shifts: { default: { start: '09:00', end: '18:00', overnight: false }, workDays: [1, 2, 3, 4, 5] },
      leaves: { types: [], accrualEngine: { enabled: false } },
      ui: { gridColumns: { desktop: 3, tablet: 2, mobile: 1 }, toastDurationMs: 3500, boardRefreshMs: 30000 },
      lottie: {
        'clock-in': { enabled: false, duration: 3 },
        'clock-out': { enabled: false, duration: 3 },
        break: { enabled: false, duration: 3 },
        back: { enabled: false, duration: 3 },
      },
      ai: { provider: 'mock', visibility: 'off' },
      compliance: { country: 'IN' },
      colourSchemes: [],
    }),
  };
  const merged = { ...defaults, ...overrides };
  await db.run(
    `INSERT OR REPLACE INTO tenant_settings (id, platform_name, primary_timezone, settings_json)
     VALUES (?, ?, ?, ?)`,
    [merged.id, merged.platform_name, merged.primary_timezone, merged.settings_json],
  );
}

/** Seed member_preferences row. */
export async function seedMemberPreferences(
  db: DatabaseEngine,
  memberId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const defaults = {
    tenant_id: 'default',
    theme: 'chromium',
    dark_mode: 'system',
    bg_opacity: 30,
    bg_blur: 0,
    bg_darken: 70,
  };
  const merged = { ...defaults, ...overrides };
  await db.run(
    `INSERT OR REPLACE INTO member_preferences
     (member_id, tenant_id, theme, dark_mode, bg_opacity, bg_blur, bg_darken)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [memberId, merged.tenant_id, merged.theme, merged.dark_mode, merged.bg_opacity, merged.bg_blur, merged.bg_darken],
  );
}

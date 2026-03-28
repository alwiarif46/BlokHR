import type { Express } from 'express';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import type { DatabaseEngine } from '../db/engine';
import type { EventBus } from '../events';
import { FeatureFlagService } from '../services/feature-flags';
import { SseBroadcaster } from '../sse/broadcaster';
import { createNotificationDispatcher } from '../services/notification';
import { LeaveNotificationService } from '../services/leave-notifications';

// ── Phase 1 route factories ──
import { createClockRouter } from './clock';
import { createLeaveRouter } from './leaves';
import { createRegularizationRouter } from './regularizations';
import { createBdMeetingRouter } from './bd-meetings';
import { createMeetingRouter } from './meetings';
import { createSettingsRouter } from './settings';
import { createSseRouter } from './sse';
import { createSetupRouter } from './setup';
import { createAuthRouter } from './auth';
import { createProfileRouter } from './profile';
import { createInteractionRouter } from './interactions';
import { createLeavePolicyRouter } from './leave-policies';
import { createHolidayRouter } from './holidays';
import { createTimeTrackingRouter } from './time-tracking';
import { createOvertimeRouter } from './overtime';
import { createTimesheetRouter } from './timesheets';
import { createAnalyticsRouter } from './analytics';
import { createFaceRecognitionRouter } from './face-recognition';
import { createGeoRouter } from './geo';
import { createChatbotRouter } from './chatbot';
import { createLiveChatRouter } from './live-chat';
import { createStorageRouter } from './storage';
import { createAuditRouter } from './audit';
import { createWebhookReceiverRouter } from './webhook-receivers';
import { createFeatureFlagsRouter } from './feature-flags';

// ── Phase 2 route factories ──
import { createOrgChartRouter } from './org-chart';
import { createDocumentRouter } from './documents';
import { createTrainingRouter } from './training';
import { createWorkflowRouter } from './workflows';
import { createSurveyRouter } from './surveys';
import { createAssetRouter } from './assets';
import { createVisitorRouter } from './visitors';
import { createIrisScanRouter } from './iris-scan';
import { createMobileRouter } from './mobile';
import { createMultiAuthRouter } from './multi-auth';

// ── Action dispatcher dependencies ──
import { LeaveRepository } from '../repositories/leave-repository';
import { LeaveService } from '../services/leave-service';
import { RegularizationRepository } from '../repositories/regularization-repository';
import { ClockRepository } from '../repositories/clock-repository';
import { RegularizationService } from '../services/regularization-service';
import { BdMeetingRepository } from '../repositories/bd-meeting-repository';
import { BdMeetingService } from '../services/bd-meeting-service';
import { ActionDispatcher } from '../webhooks/action-dispatcher';

/**
 * All dependencies needed for route registration.
 * Created by the bootstrap function and passed here.
 */
export interface RouteDependencies {
  db: DatabaseEngine;
  config: AppConfig;
  logger: Logger;
  broadcaster: SseBroadcaster;
  featureFlags: FeatureFlagService;
  eventBus?: EventBus;
}

/**
 * Registers all API routes on the Express app in the correct order.
 *
 * Order matters:
 * 1. Feature flag guard (before all route handlers)
 * 2. Phase 1 routes (core HRMS)
 * 3. Phase 2 routes (extended modules)
 *
 * Feature flag guard returns 404 for disabled features before
 * the route handler runs — disabled modules are invisible, not forbidden.
 */
export function registerAllRoutes(app: Express, deps: RouteDependencies): void {
  const { db, config, logger, broadcaster, featureFlags, eventBus } = deps;

  // ── Notification dispatcher wiring ──
  const notificationDispatcher = createNotificationDispatcher(config, db, logger);
  const leaveNotifier = new LeaveNotificationService(notificationDispatcher, db, logger);

  // ── Feature flag guard with admin-only enforcement — BEFORE all route handlers ──
  app.use(featureFlags.guardWithAdmin(db));

  // ── Phase 1: Core HRMS ──

  app.use('/api', createClockRouter(db, logger));
  app.use('/api', createLeaveRouter(db, logger, leaveNotifier));
  app.use('/api', createRegularizationRouter(db, logger, notificationDispatcher));
  app.use('/api', createBdMeetingRouter(db, logger, notificationDispatcher));
  app.use('/api', createMeetingRouter(db, logger, config));
  app.use('/api', createSettingsRouter(db, logger, broadcaster));
  app.use('/api', createSseRouter(broadcaster));
  app.use('/api', createSetupRouter(db, logger));
  app.use('/api', createAuthRouter(logger));
  app.use('/api', createMultiAuthRouter(db, logger));
  app.use('/api', createProfileRouter(db, logger));

  // Action dispatcher for interaction receivers
  const leaveRepo = new LeaveRepository(db);
  const leaveService = new LeaveService(leaveRepo, logger);
  const regRepo = new RegularizationRepository(db);
  const clockRepo = new ClockRepository(db);
  const regService = new RegularizationService(regRepo, clockRepo, db, null, logger);
  const bdRepo = new BdMeetingRepository(db);
  const bdService = new BdMeetingService(bdRepo, db, null, logger);
  const actionDispatcher = new ActionDispatcher(leaveService, regService, bdService, logger);
  app.use('/api', createInteractionRouter(actionDispatcher, config, logger, db));

  app.use('/api', createLeavePolicyRouter(db, logger));
  app.use('/api', createHolidayRouter(db, logger));
  app.use('/api', createTimeTrackingRouter(db, logger));
  app.use('/api', createOvertimeRouter(db, logger));
  app.use('/api', createTimesheetRouter(db, logger));
  app.use('/api', createAnalyticsRouter(db, logger));
  app.use('/api', createFaceRecognitionRouter(db, config, logger));
  app.use('/api', createGeoRouter(db, logger));
  app.use('/api', createChatbotRouter(db, config, logger));
  app.use('/api', createLiveChatRouter(db, broadcaster, logger));
  app.use('/api', createStorageRouter(db, logger));
  app.use('/api', createAuditRouter(db, logger));
  app.use('/api', createWebhookReceiverRouter(db, logger));
  app.use('/api', createFeatureFlagsRouter(featureFlags, logger, db));

  // ── Phase 2: Extended Modules ──

  app.use('/api', createOrgChartRouter(db, logger, eventBus));
  app.use('/api', createDocumentRouter(db, logger));
  app.use('/api', createTrainingRouter(db, logger));
  app.use('/api', createWorkflowRouter(db, logger, eventBus));
  app.use('/api', createSurveyRouter(db, logger));
  app.use('/api', createAssetRouter(db, logger));
  app.use('/api', createVisitorRouter(db, logger));
  app.use('/api', createIrisScanRouter(db, logger));
  app.use('/api', createMobileRouter(db, logger));
}

/**
 * modules/settings/settings.js
 *
 * Admin settings panel with 36 collapsible sections.
 * Data-driven: each section defined as config, generic renderer builds UI.
 * Every save → POST /api/settings → SSE broadcast.
 *
 * Pattern: renderSettingsPage() → settingsLoadData() → settingsRenderStats()
 *          → settingsRender() → section saves → settingsCloseModal()
 *
 * EXCLUDED by client request: app name field, favicon upload.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';
import { onSSE } from '../../shared/sse.js';

/* ── Module state ── */
let _container = null;
let _settings = {};
let _settingsJson = {};

/* ══════════════════════════════════════════════════════════════
   SECTION DEFINITIONS — all 36 sections
   Each: { key, title, icon, fields: [...] }
   Field types: text, number, toggle, select, textarea, time, color,
                checkbox_group, secret, file
   ══════════════════════════════════════════════════════════════ */

const SECTIONS = [
  /* §6.1 */ { key: 'branding', title: 'Branding', icon: '\uD83C\uDFA8', fields: [
    { id: 'logo_upload', label: 'Logo', type: 'file', hint: 'Max 500 KB, image/*', path: 'logo_data_url', topLevel: true },
    { id: 'login_tagline', label: 'Login Tagline', type: 'text', max: 200, path: 'login_tagline', topLevel: true },
  ]},
  /* §6.2 */ { key: 'attendance', title: 'Attendance Rules', icon: '\u23F0', fields: [
    { id: 'autoCutoffMinutes', label: 'Auto-cutoff minutes', type: 'number', min: 15, max: 180, path: 'attendance.autoCutoffMinutes' },
    { id: 'autoCutoffNotify', label: 'Notify on auto-cutoff', type: 'toggle', path: 'attendance.autoCutoffNotify' },
    { id: 'autoCutoffGraceWarningMinutes', label: 'Grace warning minutes', type: 'number', min: 0, max: 60, path: 'attendance.autoCutoffGraceWarningMinutes' },
    { id: 'clockOutShowMinutes', label: 'Clock-out show minutes (0=always)', type: 'number', min: 0, max: 600, path: 'attendance.clockOutShowMinutes' },
    { id: 'clockInEarlyMinutes', label: 'Clock-in early minutes', type: 'number', min: 0, max: 120, path: 'attendance.clockInEarlyMinutes' },
    { id: 'dayBoundaryHour', label: 'Day boundary hour', type: 'number', min: 1, max: 8, path: 'attendance.dayBoundaryHour' },
    { id: 'gracePeriodMinutes', label: 'Grace period minutes', type: 'number', min: 0, max: 60, path: 'attendance.gracePeriodMinutes' },
    { id: 'roundingRules', label: 'Rounding rules', type: 'select', options: ['none','5','10','15'], path: 'attendance.roundingRules' },
    { id: 'geofenceEnabled', label: 'Geofence enabled', type: 'toggle', path: 'attendance.geofenceEnabled' },
    { id: 'geofenceStrict', label: 'Geofence strict mode', type: 'toggle', path: 'attendance.geofenceStrict' },
    { id: 'ipRestrictionEnabled', label: 'IP restriction', type: 'toggle', path: 'attendance.ipRestrictionEnabled' },
    { id: 'allowedIPs', label: 'Allowed IPs (one per line)', type: 'textarea', path: 'attendance.allowedIPs', isArray: true },
    { id: 'kioskEnabled', label: 'Kiosk mode', type: 'toggle', path: 'attendance.kioskEnabled' },
  ]},
  /* §6.3 */ { key: 'overtime', title: 'Overtime', icon: '\u231B', fields: [
    { id: 'overtimeEnabled', label: 'Overtime enabled', type: 'toggle', path: 'attendance.overtimeEnabled' },
    { id: 'overtimeDailyThresholdMinutes', label: 'Daily threshold (min)', type: 'number', min: 0, max: 720, path: 'attendance.overtimeDailyThresholdMinutes' },
    { id: 'overtimeWeeklyThresholdMinutes', label: 'Weekly threshold (min)', type: 'number', min: 0, max: 3600, path: 'attendance.overtimeWeeklyThresholdMinutes' },
    { id: 'overtimeMultiplier', label: 'Multiplier', type: 'number', min: 1.0, max: 4.0, step: 0.25, path: 'attendance.overtimeMultiplier' },
  ]},
  /* §6.4 */ { key: 'shifts', title: 'Shifts', icon: '\uD83D\uDD53', fields: [
    { id: 'shiftStart', label: 'Default shift start', type: 'time', path: 'shifts.default.start' },
    { id: 'shiftEnd', label: 'Default shift end', type: 'time', path: 'shifts.default.end' },
    { id: 'overnight', label: 'Overnight shift', type: 'toggle', path: 'shifts.default.overnight' },
    { id: 'workDays', label: 'Work days', type: 'checkbox_group', options: [{v:0,l:'Sun'},{v:1,l:'Mon'},{v:2,l:'Tue'},{v:3,l:'Wed'},{v:4,l:'Thu'},{v:5,l:'Fri'},{v:6,l:'Sat'}], path: 'shifts.workDays' },
  ]},
  /* §6.5 */ { key: 'leaves', title: 'Leave Configuration', icon: '\uD83C\uDF34', fields: [
    { id: 'accrualEnabled', label: 'Accrual engine enabled', type: 'toggle', path: 'leaves.accrualEngine.enabled' },
    { id: 'accrualPeriod', label: 'Accrual period', type: 'select', options: ['monthly','quarterly','annually'], path: 'leaves.accrualEngine.period' },
    { id: 'accrualRate', label: 'Accrual rate', type: 'number', min: 0, max: 10, step: 0.5, path: 'leaves.accrualEngine.rate' },
    { id: 'sandwichPolicy', label: 'Sandwich policy', type: 'toggle', path: 'leaves.sandwichPolicy' },
    { id: 'encashmentEnabled', label: 'Encashment enabled', type: 'toggle', path: 'leaves.encashmentEnabled' },
    { id: 'maxEncashPerYear', label: 'Max encash per year', type: 'number', min: 0, max: 365, path: 'leaves.maxEncashPerYear' },
    { id: 'yearEndCarryover', label: 'Year-end carryover days', type: 'number', min: 0, max: 365, path: 'leaves.yearEndCarryover' },
    { id: 'compOffEnabled', label: 'Comp-off enabled', type: 'toggle', path: 'leaves.compOffEnabled' },
    { id: 'compOffExpiryDays', label: 'Comp-off expiry (days)', type: 'number', min: 0, max: 365, path: 'leaves.compOffExpiryDays' },
  ]},
  /* §6.6 */ { key: 'approvals', title: 'Approval Flows', icon: '\u2705', fields: [
    { id: 'approvalNote', label: 'Configure multi-step approval workflows per entity type (leave, regularization, overtime, expense, training). Each entity can have 1-5 approval steps with role-based routing and auto-escalation.', type: 'note' },
  ]},
  /* §6.7 */ { key: 'digest', title: 'Digest / Notifications', icon: '\uD83D\uDCE8', fields: [
    { id: 'dailyEnabled', label: 'Daily digest enabled', type: 'toggle', path: 'digest.dailyEnabled' },
    { id: 'dailyTime', label: 'Daily time', type: 'time', path: 'digest.dailyTime' },
    { id: 'showPresent', label: 'Show present', type: 'toggle', path: 'digest.dailySections.present' },
    { id: 'showAbsent', label: 'Show absent', type: 'toggle', path: 'digest.dailySections.absent' },
    { id: 'showLate', label: 'Show late', type: 'toggle', path: 'digest.dailySections.late' },
    { id: 'showOnLeave', label: 'Show on leave', type: 'toggle', path: 'digest.dailySections.onLeave' },
    { id: 'weeklyEnabled', label: 'Weekly digest enabled', type: 'toggle', path: 'digest.weeklyEnabled' },
    { id: 'weeklyDay', label: 'Weekly day', type: 'select', options: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], path: 'digest.weeklyDay' },
    { id: 'weeklyTime', label: 'Weekly time', type: 'time', path: 'digest.weeklyTime' },
  ]},
  /* §6.8 */ { key: 'analytics', title: 'Analytics', icon: '\uD83D\uDCC8', fields: [
    { id: 'bradfordScoreEnabled', label: 'Bradford score enabled', type: 'toggle', path: 'analytics.bradfordScoreEnabled' },
    { id: 'bradfordAlertThreshold', label: 'Bradford alert threshold', type: 'number', min: 0, max: 1000, path: 'analytics.bradfordAlertThreshold' },
    { id: 'pointSystemEnabled', label: 'Point system enabled', type: 'toggle', path: 'analytics.pointSystemEnabled' },
    { id: 'auditTrailEnabled', label: 'Audit trail enabled', type: 'toggle', path: 'analytics.auditTrailEnabled' },
  ]},
  /* §6.9 */ { key: 'profiles', title: 'Profile Requirements', icon: '\uD83D\uDCCB', fields: [
    { id: 'requiredFields', label: 'Required fields', type: 'checkbox_group', options: [{v:'name',l:'Name'},{v:'phone',l:'Phone'},{v:'emergency_contact',l:'Emergency'},{v:'parentage',l:'Parentage'},{v:'pan',l:'PAN'},{v:'aadhaar',l:'Aadhaar'},{v:'uan',l:'UAN'},{v:'bank_account',l:'Bank Acc'},{v:'ifsc',l:'IFSC'},{v:'bank_name',l:'Bank Name'}], path: 'profiles.requiredFields' },
    { id: 'photoMaxKB', label: 'Photo max KB', type: 'number', min: 50, max: 5120, path: 'profiles.photoMaxKB' },
    { id: 'faceRecognitionEnabled', label: 'Face recognition', type: 'toggle', path: 'profiles.faceRecognitionEnabled' },
    { id: 'irisEnabled', label: 'Iris scan', type: 'toggle', path: 'profiles.irisEnabled' },
  ]},
  /* §6.10 */ { key: 'ui', title: 'UI Defaults', icon: '\uD83D\uDDA5', fields: [
    { id: 'gridDesktop', label: 'Grid columns (desktop)', type: 'number', min: 2, max: 6, path: 'ui.gridColumns.desktop' },
    { id: 'gridTablet', label: 'Grid columns (tablet)', type: 'number', min: 1, max: 4, path: 'ui.gridColumns.tablet' },
    { id: 'gridMobile', label: 'Grid columns (mobile)', type: 'number', min: 1, max: 2, path: 'ui.gridColumns.mobile' },
    { id: 'toastDurationMs', label: 'Toast duration (ms)', type: 'number', min: 1000, max: 10000, path: 'ui.toastDurationMs' },
    { id: 'boardRefreshMs', label: 'Board refresh (ms)', type: 'number', min: 5000, max: 120000, path: 'ui.boardRefreshMs' },
  ]},
  /* §6.11 */ { key: 'ai', title: 'AI Chatbot', icon: '\uD83E\uDD16', fields: [
    { id: 'aiProvider', label: 'Provider', type: 'select', options: ['ollama','anthropic','gemini','mock'], path: 'ai.provider' },
    { id: 'aiAssistantName', label: 'Assistant name', type: 'text', path: 'ai.assistantName' },
    { id: 'aiWelcome', label: 'Welcome message', type: 'textarea', path: 'ai.welcomeMessage' },
    { id: 'aiSystemPrompt', label: 'System prompt prefix', type: 'textarea', path: 'ai.systemPromptPrefix' },
    { id: 'aiVisibility', label: 'Visibility', type: 'select', options: ['off','admin-only','all','specific-roles'], path: 'ai.visibility' },
    { id: 'aiPosition', label: 'Position', type: 'select', options: ['bottom-left','bottom-right'], path: 'ai.position' },
    { id: 'aiRateLimit', label: 'Rate limit (req/min)', type: 'number', min: 1, max: 100, path: 'ai.rateLimit' },
  ]},
  /* §6.12 */ { key: 'colourSchemes', title: 'Colour Schemes', icon: '\uD83C\uDFA8', fields: [
    { id: 'csNote', label: 'Admin creates up to 3 named colour scheme presets. Users can override via preferences.', type: 'note' },
  ]},
  /* §6.13 */ { key: 'compliance', title: 'Compliance', icon: '\u2696', fields: [
    { id: 'compCountry', label: 'Country', type: 'select', options: ['India','United States','United Kingdom','Australia','Canada','Singapore','UAE'], path: 'compliance.country' },
    { id: 'compState', label: 'State', type: 'text', path: 'compliance.state' },
    { id: 'compTemplate', label: 'Labour law template', type: 'select', options: ['none','shops_and_establishments','factories_act','it_act'], path: 'compliance.labourLawTemplate' },
  ]},
  /* §6.14 */ { key: 'auth', title: 'Auth Providers', icon: '\uD83D\uDD11', fields: [
    { id: 'authNote', label: 'Post-setup editing of SSO/auth provider configurations. Each provider has an enabled toggle plus credentials. Supported: MSAL, Google, Okta, Teams SSO, GitHub, SAML, Custom JWT, Magic Link, Local PIN.', type: 'note' },
  ]},
  /* §6.15 */ { key: 'tabs', title: 'Tabs', icon: '\uD83D\uDCCE', fields: [
    { id: 'tabsNote', label: 'CRUD list for application tab configuration. Each tab: id, label, source URL, enabled toggle, icon, group visibility.', type: 'note' },
  ]},
  /* §6.16 */ { key: 'lottie', title: 'Lottie Animations', icon: '\u2728', fields: [
    { id: 'lottieNote', label: 'Upload Lottie JSON files for clock-in, clock-out, break, and back animations. Max 2 MB per file. Each action has a configurable display duration.', type: 'note' },
  ]},
  /* §6.17 */ { key: 'storage', title: 'Storage Provider', icon: '\uD83D\uDCC2', fields: [
    { id: 'storageProvider', label: 'Provider', type: 'select', options: ['local','azure_blob','aws_s3','s3_compatible','none'], path: 'storage.provider' },
    { id: 'maxFileSizeMB', label: 'Max file size (MB)', type: 'number', min: 1, max: 100, path: 'storage.maxFileSizeMB' },
  ]},
  /* §6.18 */ { key: 'notifications', title: 'Notification Channels', icon: '\uD83D\uDD14', fields: [
    { id: 'notifNote', label: '8 channels: Teams, Slack, Google Chat, Discord, Telegram, WhatsApp, ClickUp, Email/SMTP. Each channel has enabled toggle, credentials, and Test Connection button. Secret fields are masked (****XXXX).', type: 'note' },
  ]},
  /* §6.19 */ { key: 'meetings', title: 'Meeting Integrations', icon: '\uD83D\uDCF9', fields: [
    { id: 'meetNote', label: 'Zoom, Webex, GoToMeeting, BlueJeans. Each platform: enabled toggle, credentials, Test Connection.', type: 'note' },
  ]},
  /* §6.20 */ { key: 'security', title: 'Security & Session', icon: '\uD83D\uDD12', fields: [
    { id: 'sessionTimeoutMinutes', label: 'Session timeout (min)', type: 'number', min: 15, max: 1440, path: 'security.sessionTimeoutMinutes' },
    { id: 'passwordMinLength', label: 'Password min length', type: 'number', min: 6, max: 32, path: 'security.passwordMinLength' },
    { id: 'maxLoginAttempts', label: 'Max login attempts', type: 'number', min: 3, max: 20, path: 'security.maxLoginAttempts' },
    { id: 'lockoutDurationMinutes', label: 'Lockout duration (min)', type: 'number', min: 5, max: 120, path: 'security.lockoutDurationMinutes' },
    { id: 'magicLinkExpiryMinutes', label: 'Magic link expiry (min)', type: 'number', min: 5, max: 60, path: 'security.magicLinkExpiryMinutes' },
    { id: 'actionLinkExpiryHours', label: 'Action link expiry (hrs)', type: 'number', min: 1, max: 168, path: 'security.actionLinkExpiryHours' },
    { id: 'rateLimitGlobal', label: 'Rate limit (req/min/IP)', type: 'number', min: 10, max: 1000, path: 'security.rateLimitGlobal' },
    { id: 'rateLimitAuth', label: 'Auth rate limit (15min/IP)', type: 'number', min: 5, max: 100, path: 'security.rateLimitAuth' },
    { id: 'mfaEnabled', label: 'MFA enabled', type: 'toggle', path: 'security.mfaEnabled' },
    { id: 'mfaProvider', label: 'MFA provider', type: 'select', options: ['totp','sms'], path: 'security.mfaProvider' },
  ]},
  /* §6.21 */ { key: 'scheduler', title: 'Scheduler', icon: '\u23F1', fields: [
    { id: 'autoCutoffIntervalMinutes', label: 'Auto-cutoff interval (min)', type: 'number', min: 5, max: 60, path: 'scheduler.autoCutoffIntervalMinutes' },
    { id: 'absenceMarkingIntervalMinutes', label: 'Absence marking interval (min)', type: 'number', min: 15, max: 120, path: 'scheduler.absenceMarkingIntervalMinutes' },
    { id: 'ptoAccrualIntervalHours', label: 'PTO accrual interval (hrs)', type: 'number', min: 1, max: 24, path: 'scheduler.ptoAccrualIntervalHours' },
    { id: 'reminderIntervalHours', label: 'Reminder interval (hrs)', type: 'number', min: 1, max: 12, path: 'scheduler.reminderIntervalHours' },
  ]},
  /* §6.22 */ { key: 'regularization', title: 'Regularization Rules', icon: '\uD83D\uDCDD', fields: [
    { id: 'maxDaysBack', label: 'Max days back', type: 'number', min: 1, max: 90, path: 'regularization.maxDaysBack' },
    { id: 'maxPerMonth', label: 'Max per month (0=unlimited)', type: 'number', min: 0, max: 30, path: 'regularization.maxPerMonth' },
    { id: 'autoApproveMinor', label: 'Auto-approve minor corrections', type: 'toggle', path: 'regularization.autoApproveMinorCorrections' },
    { id: 'minorThreshold', label: 'Minor correction threshold (min)', type: 'number', min: 1, max: 60, path: 'regularization.minorCorrectionThresholdMinutes' },
  ]},
  /* §6.23 */ { key: 'bdMeetings', title: 'BD Meetings', icon: '\uD83E\uDD1D', fields: [
    { id: 'bdDeptId', label: 'BD Department ID', type: 'text', path: 'bdMeetings.departmentId' },
    { id: 'bdRequireQual', label: 'Require qualification step', type: 'toggle', path: 'bdMeetings.requireQualification' },
  ]},
  /* §6.24 */ { key: 'dataRetention', title: 'Data Retention', icon: '\uD83D\uDDD1', fields: [
    { id: 'auditLogDays', label: 'Audit log retention (days)', type: 'number', min: 30, max: 3650, path: 'dataRetention.auditLogDays' },
    { id: 'chatMessageDays', label: 'Chat message retention (days)', type: 'number', min: 30, max: 3650, path: 'dataRetention.chatMessageDays' },
    { id: 'clockEventDays', label: 'Clock event retention (days)', type: 'number', min: 90, max: 3650, path: 'dataRetention.clockEventDays' },
    { id: 'notifQueueDays', label: 'Notification queue (days)', type: 'number', min: 7, max: 365, path: 'dataRetention.notificationQueueDays' },
    { id: 'webhookLogDays', label: 'Webhook log retention (days)', type: 'number', min: 7, max: 365, path: 'dataRetention.webhookLogDays' },
    { id: 'eventBusDays', label: 'Event bus retention (days)', type: 'number', min: 7, max: 365, path: 'dataRetention.eventBusRetentionDays' },
  ]},
  /* §6.25 */ { key: 'localization', title: 'Localization', icon: '\uD83C\uDF10', fields: [
    { id: 'dateFormat', label: 'Date format', type: 'select', options: ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'], path: 'localization.dateFormat' },
    { id: 'timeFormat', label: 'Time format', type: 'select', options: ['12h','24h'], path: 'localization.timeFormat' },
    { id: 'weekStartDay', label: 'Week start day', type: 'select', options: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], path: 'localization.weekStartDay' },
    { id: 'currencyCode', label: 'Currency code (ISO 4217)', type: 'text', max: 3, path: 'localization.currencyCode' },
    { id: 'currencySymbol', label: 'Currency symbol', type: 'text', max: 5, path: 'localization.currencySymbol' },
    { id: 'numberLocale', label: 'Number locale', type: 'text', path: 'localization.numberLocale' },
  ]},
  /* §6.26 */ { key: 'payroll', title: 'Payroll / Formula Parameters', icon: '\uD83D\uDCB0', fields: [
    { id: 'epfEmployeeRate', label: 'EPF employee rate (%)', type: 'number', min: 0, max: 20, step: 0.01, path: 'payroll.epfEmployeeRate' },
    { id: 'epfEmployerRate', label: 'EPF employer rate (%)', type: 'number', min: 0, max: 20, step: 0.01, path: 'payroll.epfEmployerRate' },
    { id: 'epsRate', label: 'EPS rate (%)', type: 'number', min: 0, max: 20, step: 0.01, path: 'payroll.epsRate' },
    { id: 'epfSalaryCap', label: 'EPF salary cap (\u20B9)', type: 'number', min: 0, max: 100000, path: 'payroll.epfSalaryCap' },
    { id: 'esiEmployeeRate', label: 'ESI employee rate (%)', type: 'number', min: 0, max: 10, step: 0.01, path: 'payroll.esiEmployeeRate' },
    { id: 'esiEmployerRate', label: 'ESI employer rate (%)', type: 'number', min: 0, max: 10, step: 0.01, path: 'payroll.esiEmployerRate' },
    { id: 'esiThreshold', label: 'ESI threshold (\u20B9)', type: 'number', min: 0, max: 100000, path: 'payroll.esiThreshold' },
    { id: 'gratuityTaxExemptCap', label: 'Gratuity tax-exempt cap (\u20B9)', type: 'number', min: 0, max: 10000000, path: 'payroll.gratuityTaxExemptCap' },
    { id: 'bonusMinRate', label: 'Bonus min rate (%)', type: 'number', min: 0, max: 30, step: 0.01, path: 'payroll.bonusMinRate' },
    { id: 'bonusMaxRate', label: 'Bonus max rate (%)', type: 'number', min: 0, max: 30, step: 0.01, path: 'payroll.bonusMaxRate' },
    { id: 'bonusSalaryCap', label: 'Bonus salary cap (\u20B9)', type: 'number', min: 0, max: 100000, path: 'payroll.bonusSalaryCap' },
    { id: 'tdsEnabled', label: 'TDS enabled', type: 'toggle', path: 'payroll.tdsEnabled' },
  ]},
  /* §6.27 */ { key: 'liveChat', title: 'Live Chat', icon: '\uD83D\uDCAC', fields: [
    { id: 'maxMessageLength', label: 'Max message length', type: 'number', min: 100, max: 5000, path: 'liveChat.maxMessageLength' },
    { id: 'fileSharingEnabled', label: 'File sharing', type: 'toggle', path: 'liveChat.fileSharingEnabled' },
    { id: 'autoCreateDeptChannels', label: 'Auto-create dept channels', type: 'toggle', path: 'liveChat.autoCreateDepartmentChannels' },
    { id: 'messageEditWindow', label: 'Message edit window (min, 0=off)', type: 'number', min: 0, max: 1440, path: 'liveChat.messageEditWindowMinutes' },
    { id: 'messageDeleteEnabled', label: 'Message delete enabled', type: 'toggle', path: 'liveChat.messageDeleteEnabled' },
    { id: 'typingIndicator', label: 'Typing indicator', type: 'toggle', path: 'liveChat.typingIndicatorEnabled' },
  ]},
  /* §6.28 */ { key: 'trainingLms', title: 'Training / LMS', icon: '\uD83C\uDF93', fields: [
    { id: 'defaultBudget', label: 'Default budget per dept', type: 'number', min: 0, max: 10000000, path: 'trainingLms.defaultBudgetPerDepartment' },
    { id: 'perEmployeeBudget', label: 'Per-employee budget cap', type: 'number', min: 0, max: 1000000, path: 'trainingLms.perEmployeeBudgetCap' },
    { id: 'certTemplateId', label: 'Certificate template ID', type: 'text', path: 'trainingLms.certificateTemplateId' },
    { id: 'mandatoryOnNewHire', label: 'Mandatory on new hire', type: 'toggle', path: 'trainingLms.mandatoryOnNewHire' },
    { id: 'recertMonths', label: 'Recertification months (0=off)', type: 'number', min: 0, max: 60, path: 'trainingLms.recertificationMonths' },
  ]},
  /* §6.29 */ { key: 'workflowDefaults', title: 'Workflow Defaults', icon: '\u2699', fields: [
    { id: 'defaultSlaHours', label: 'Default SLA (hours)', type: 'number', min: 24, max: 720, path: 'workflowDefaults.defaultSlaHours' },
    { id: 'maxSteps', label: 'Max steps per workflow', type: 'number', min: 2, max: 20, path: 'workflowDefaults.maxStepsPerWorkflow' },
    { id: 'maxActiveInstances', label: 'Max active instances', type: 'number', min: 10, max: 10000, path: 'workflowDefaults.maxActiveInstances' },
    { id: 'prebuiltTemplates', label: 'Enable pre-built templates', type: 'toggle', path: 'workflowDefaults.enablePrebuiltTemplates' },
  ]},
  /* §6.30 */ { key: 'surveyDefaults', title: 'Survey Defaults', icon: '\uD83D\uDCCA', fields: [
    { id: 'defaultAnonymous', label: 'Default anonymous', type: 'toggle', path: 'surveyDefaults.defaultAnonymous' },
    { id: 'maxQuestions', label: 'Max questions per survey', type: 'number', min: 5, max: 100, path: 'surveyDefaults.maxQuestionsPerSurvey' },
    { id: 'responseDeadline', label: 'Response deadline (days, 0=none)', type: 'number', min: 0, max: 365, path: 'surveyDefaults.responseDeadlineDays' },
    { id: 'minResponseRate', label: 'Min response rate for results (%)', type: 'number', min: 0, max: 100, path: 'surveyDefaults.minResponseRateForResults' },
  ]},
  /* §6.31 */ { key: 'assetConfig', title: 'Asset Configuration', icon: '\uD83D\uDCBB', fields: [
    { id: 'depreciationMethod', label: 'Depreciation method', type: 'select', options: ['straight_line','declining_balance'], path: 'assetConfig.defaultDepreciationMethod' },
    { id: 'warrantyAlertDays', label: 'Warranty alert days', type: 'number', min: 7, max: 365, path: 'assetConfig.warrantyAlertDays' },
  ]},
  /* §6.32 */ { key: 'visitorConfig', title: 'Visitor Configuration', icon: '\uD83D\uDC65', fields: [
    { id: 'autoCheckoutHours', label: 'Auto-checkout reminder (hrs)', type: 'number', min: 1, max: 24, path: 'visitorConfig.autoCheckoutReminderHours' },
    { id: 'ndaTemplate', label: 'NDA template text', type: 'textarea', path: 'visitorConfig.ndaTemplateText' },
    { id: 'badgePrinterUrl', label: 'Badge printer URL', type: 'text', path: 'visitorConfig.badgePrinterUrl' },
    { id: 'preRegDays', label: 'Pre-registration lead time (days)', type: 'number', min: 0, max: 30, path: 'visitorConfig.preRegistrationLeadTimeDays' },
    { id: 'maxVisitHours', label: 'Max visit duration (hrs)', type: 'number', min: 1, max: 48, path: 'visitorConfig.maxVisitDurationHours' },
    { id: 'photoRequired', label: 'Photo required', type: 'toggle', path: 'visitorConfig.photoRequired' },
    { id: 'hostApprovalRequired', label: 'Host approval required', type: 'toggle', path: 'visitorConfig.hostApprovalRequired' },
  ]},
  /* §6.33 */ { key: 'mobileConfig', title: 'Mobile / Location', icon: '\uD83D\uDCF1', fields: [
    { id: 'locationTrackingSec', label: 'Location tracking interval (sec)', type: 'number', min: 60, max: 3600, path: 'mobileConfig.locationTrackingIntervalSeconds' },
    { id: 'pushBatchSize', label: 'Push batch size', type: 'number', min: 10, max: 1000, path: 'mobileConfig.pushBatchSize' },
    { id: 'deepLinkUrl', label: 'Deep link web base URL', type: 'text', path: 'mobileConfig.deepLinkWebBaseUrl' },
    { id: 'biometricAuth', label: 'Biometric auth enabled', type: 'toggle', path: 'mobileConfig.biometricAuthEnabled' },
    { id: 'offlineRegPrompt', label: 'Offline regularization prompt', type: 'toggle', path: 'mobileConfig.offlineRegularizationPrompt' },
  ]},
  /* §6.34 */ { key: 'exportConfig', title: 'Export Defaults', icon: '\uD83D\uDCE4', fields: [
    { id: 'defaultDateRange', label: 'Default date range (days)', type: 'number', min: 7, max: 365, path: 'exportConfig.defaultDateRangeDays' },
    { id: 'maxRows', label: 'Max rows per export', type: 'number', min: 1000, max: 100000, path: 'exportConfig.maxRowsPerExport' },
    { id: 'scheduledEnabled', label: 'Scheduled export', type: 'toggle', path: 'exportConfig.scheduledExportEnabled' },
    { id: 'scheduledTime', label: 'Scheduled time', type: 'time', path: 'exportConfig.scheduledExportTime' },
    { id: 'scheduledFormat', label: 'Format', type: 'select', options: ['csv','xlsx'], path: 'exportConfig.scheduledExportFormat' },
    { id: 'exportRetention', label: 'Export retention (days)', type: 'number', min: 7, max: 365, path: 'exportConfig.exportRetentionDays' },
  ]},
  /* §6.35 */ { key: 'emailTemplates', title: 'Email Templates', icon: '\uD83D\uDCE7', fields: [
    { id: 'logoInHeader', label: 'Logo in email headers', type: 'toggle', path: 'emailTemplates.logoInHeader' },
    { id: 'footerText', label: 'Footer text', type: 'textarea', path: 'emailTemplates.footerText' },
    { id: 'customCss', label: 'Custom CSS', type: 'textarea', path: 'emailTemplates.customCss' },
    { id: 'replyToAddress', label: 'Reply-to address', type: 'text', path: 'emailTemplates.replyToAddress' },
    { id: 'companyAddress', label: 'Company address', type: 'textarea', path: 'emailTemplates.companyAddress' },
  ]},
  /* §6.36 */ { key: 'calendar', title: 'Calendar & Time', icon: '\uD83D\uDCC5', fields: [
    { id: 'fiscalYearStart', label: 'Fiscal year start month', type: 'select', options: ['January','February','March','April','May','June','July','August','September','October','November','December'], path: 'calendar.fiscalYearStartMonth' },
    { id: 'payPeriodType', label: 'Pay period type', type: 'select', options: ['monthly','biweekly','weekly'], path: 'calendar.payPeriodType' },
    { id: 'payDayOfMonth', label: 'Pay day of month', type: 'number', min: 1, max: 28, path: 'calendar.payDayOfMonth' },
    { id: 'holidayImportUrl', label: 'Holiday import source URL', type: 'text', path: 'calendar.holidayImportSourceUrl' },
  ]},
];

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

export function renderSettingsPage(container) {
  _container = container;
  const session = getSession();
  if (!session || !session.is_admin) {
    container.innerHTML = '<div class="set-loading">Admin access required</div>';
    return;
  }

  container.innerHTML =
    '<div class="set-wrap" id="setWrap">' +
      '<div class="set-header">' +
        '<div class="set-title">Admin Settings</div>' +
        '<span class="set-admin-badge">Admin Only</span>' +
      '</div>' +
      '<div id="setSections"><div class="set-loading">Loading settings\u2026</div></div>' +
    '</div>';

  settingsLoadData();
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING
   ══════════════════════════════════════════════════════════════ */

export async function settingsLoadData() {
  const data = await api.get('/api/settings');
  if (data && !data._error) {
    _settings = data;
    _settingsJson = data.settings_json || {};
  } else {
    _settings = {};
    _settingsJson = {};
  }
  settingsRenderStats();
  settingsRender();
}

/* ══════════════════════════════════════════════════════════════
   STATS (no-op — kept for pattern)
   ══════════════════════════════════════════════════════════════ */

export function settingsRenderStats() { /* no stats bar for settings */ }

/* ══════════════════════════════════════════════════════════════
   RENDER ALL SECTIONS
   ══════════════════════════════════════════════════════════════ */

export function settingsRender() {
  const el = _container && _container.querySelector('#setSections');
  if (!el) return;

  let html = '';
  SECTIONS.forEach(function (sec, idx) {
    html += '<div class="set-section" data-sec-key="' + _esc(sec.key) + '" id="sec-' + idx + '">';
    html += '<div class="set-section-hdr" data-sec-idx="' + idx + '">';
    html += '<span class="set-section-icon">' + (sec.icon || '') + '</span>';
    html += '<span class="set-section-name">' + _esc(sec.title) + '</span>';
    html += '<span class="set-section-arrow">\u25BC</span>';
    html += '</div>';
    html += '<div class="set-section-body">';
    sec.fields.forEach(function (f) { html += _renderField(f); });
    html += '<button class="set-section-save" data-sec-key="' + _esc(sec.key) + '">Save ' + _esc(sec.title) + '</button>';
    html += '</div></div>';
  });

  el.innerHTML = html;
  _bindSectionEvents();
}

/* ══════════════════════════════════════════════════════════════
   FIELD RENDERER
   ══════════════════════════════════════════════════════════════ */

function _renderField(f) {
  if (f.type === 'note') {
    return '<div class="set-field"><div class="set-field-hint" style="font-size:11px;color:var(--tx2);padding:8px 0">' + _esc(f.label) + '</div></div>';
  }

  const val = f.topLevel ? (_settings[f.path] || '') : _getNestedVal(_settingsJson, f.path);
  let html = '<div class="set-field"><label class="set-field-label">' + _esc(f.label) + '</label>';

  switch (f.type) {
    case 'text':
      html += '<input class="set-input" type="text" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') +
        ' value="' + _esc(val || '') + '"' +
        (f.max ? ' maxlength="' + f.max + '"' : '') +
        (f.placeholder ? ' placeholder="' + _esc(f.placeholder) + '"' : '') + '>';
      break;

    case 'number':
      html += '<input class="set-input" type="number" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') +
        ' value="' + (val != null ? val : '') + '"' +
        (f.min != null ? ' min="' + f.min + '"' : '') +
        (f.max != null ? ' max="' + f.max + '"' : '') +
        (f.step ? ' step="' + f.step + '"' : '') + '>';
      break;

    case 'toggle': {
      const checked = val ? ' checked' : '';
      html += '<div class="set-toggle"><span class="set-toggle-label">' + _esc(f.label) + '</span>' +
        '<label class="set-toggle-switch"><input type="checkbox" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') + checked + '>' +
        '<span class="set-toggle-track"></span></label></div>';
      break;
    }

    case 'select': {
      const opts = (f.options || []).map(function (o) {
        const ov = typeof o === 'object' ? o.v : o;
        const ol = typeof o === 'object' ? o.l : o;
        return '<option value="' + _esc(ov) + '"' + (String(val) === String(ov) ? ' selected' : '') + '>' + _esc(ol) + '</option>';
      }).join('');
      html += '<select class="set-select" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') + '>' + opts + '</select>';
      break;
    }

    case 'textarea': {
      const txtVal = f.isArray && Array.isArray(val) ? val.join('\n') : (val || '');
      html += '<textarea class="set-textarea" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') +
        (f.isArray ? ' data-array="1"' : '') + '>' + _esc(txtVal) + '</textarea>';
      break;
    }

    case 'time':
      html += '<input class="set-input" type="time" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') +
        ' value="' + _esc(val || '') + '">';
      break;

    case 'color':
      html += '<input class="set-input" type="color" data-path="' + _esc(f.path || '') + '"' +
        (f.topLevel ? ' data-top="1"' : '') +
        ' value="' + _esc(val || '#000000') + '">';
      break;

    case 'checkbox_group': {
      const arrVal = Array.isArray(val) ? val : [];
      html += '<div class="set-checkbox-grid">';
      (f.options || []).forEach(function (o) {
        const ov = typeof o === 'object' ? o.v : o;
        const ol = typeof o === 'object' ? o.l : o;
        const chk = arrVal.indexOf(ov) >= 0 ? ' checked' : '';
        html += '<label class="set-checkbox-item"><input type="checkbox" data-path="' + _esc(f.path || '') + '" data-cbval="' + _esc(ov) + '"' + chk + '>' + _esc(ol) + '</label>';
      });
      html += '</div>';
      break;
    }

    case 'file':
      html += '<div class="set-upload-zone"><div class="set-upload-icon">\uD83D\uDCC1</div><div class="set-upload-text">Drop file or click to upload</div>' +
        '<input type="file" data-path="' + _esc(f.path || '') + '"' + (f.topLevel ? ' data-top="1"' : '') + ' accept="image/*"></div>';
      if (f.hint) html += '<div class="set-field-hint">' + _esc(f.hint) + '</div>';
      break;

    case 'secret':
      html += '<div class="set-secret"><input class="set-input" type="password" data-path="' + _esc(f.path || '') + '"' +
        ' value="' + _esc(val || '') + '" placeholder="****XXXX">' +
        '<button class="set-secret-toggle" type="button">Show</button></div>';
      break;
  }

  if (f.hint && f.type !== 'file') html += '<div class="set-field-hint">' + _esc(f.hint) + '</div>';
  html += '</div>';
  return html;
}

/* ══════════════════════════════════════════════════════════════
   EVENT BINDING
   ══════════════════════════════════════════════════════════════ */

function _bindSectionEvents() {
  if (!_container) return;

  /* Collapsible headers */
  _container.querySelectorAll('.set-section-hdr').forEach(function (hdr) {
    hdr.addEventListener('click', function () {
      const sec = hdr.closest('.set-section');
      if (sec) sec.classList.toggle('open');
    });
  });

  /* Section save buttons */
  _container.querySelectorAll('.set-section-save').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _saveSection(btn.dataset.secKey);
    });
  });

  /* Secret toggle */
  _container.querySelectorAll('.set-secret-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const inp = btn.previousElementSibling;
      if (inp) {
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   SAVE SECTION
   ══════════════════════════════════════════════════════════════ */

async function _saveSection(secKey) {
  const sec = SECTIONS.find(function (s) { return s.key === secKey; });
  if (!sec) return;

  const body = { settings_json: {} };

  sec.fields.forEach(function (f) {
    if (f.type === 'note' || !f.path) return;

    if (f.topLevel) {
      const el = _container.querySelector('[data-path="' + f.path + '"]');
      if (el) body[f.path] = f.type === 'toggle' ? el.checked : el.value;
      return;
    }

    if (f.type === 'checkbox_group') {
      const cbs = _container.querySelectorAll('[data-path="' + f.path + '"]');
      const arr = [];
      cbs.forEach(function (cb) { if (cb.checked) arr.push(cb.dataset.cbval); });
      _setNestedVal(body.settings_json, f.path, arr);
      return;
    }

    if (f.type === 'textarea' && f.isArray) {
      const el = _container.querySelector('[data-path="' + f.path + '"]');
      if (el) {
        const lines = el.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        _setNestedVal(body.settings_json, f.path, lines);
      }
      return;
    }

    const el = _container.querySelector('[data-path="' + f.path + '"]');
    if (!el) return;

    let val;
    if (f.type === 'toggle') val = el.checked;
    else if (f.type === 'number') val = el.value !== '' ? parseFloat(el.value) : null;
    else val = el.value;

    _setNestedVal(body.settings_json, f.path, val);
  });

  const result = await api.post('/api/settings', body);
  if (result && result._error) {
    toast(result.message || 'Failed to save settings', 'error');
    return;
  }
  toast(sec.title + ' saved', 'success');
}

/* ══════════════════════════════════════════════════════════════
   CLOSE MODAL (pattern compliance — settings has no modal)
   ══════════════════════════════════════════════════════════════ */

export function settingsCloseModal() { }

/* ══════════════════════════════════════════════════════════════
   SSE: reload settings when broadcast received
   ══════════════════════════════════════════════════════════════ */

onSSE('settings-update', function () {
  settingsLoadData();
});

/* ══════════════════════════════════════════════════════════════
   NESTED PATH HELPERS
   ══════════════════════════════════════════════════════════════ */

function _getNestedVal(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function _setNestedVal(obj, path, val) {
  if (!path) return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

/* ── Utility ── */
function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ══════════════════════════════════════════════════════════════
   TEST HELPERS
   ══════════════════════════════════════════════════════════════ */

export function _getSettings() { return _settings; }
export function _getSettingsJson() { return _settingsJson; }
export function _setSettings(s) { _settings = s; }
export function _setSettingsJson(sj) { _settingsJson = sj; }
export { SECTIONS as _SECTIONS };

export function _resetState() {
  _container = null;
  _settings = {};
  _settingsJson = {};
}

/* ── Register ── */
registerModule('settings', renderSettingsPage);

/**
 * One-shot wipe of all tenant/org data (Host-per-tenant factory reset).
 * Keeps schema, _migrations, feature_flags, colour_scheme_presets, lottie seeds.
 */
import fs from 'fs';
import path from 'path';
import type { Logger } from 'pino';
import type { DatabaseEngine } from './engine';

const WIPE_KV_KEY = 'full_tenant_wipe_v1';

/** Org / fact tables to empty when present. Order: children before parents where FKs exist. */
const WIPE_TABLES = [
  'auth_sessions',
  'password_reset_tokens',
  'auth_credentials',
  'admins',
  'member_preferences',
  'members',
  'role_assignments',
  'attendance_daily',
  'clock_events',
  'monthly_late_counts',
  'leave_requests',
  'pto_balances',
  'leave_clubbing_rules',
  'leave_policies',
  'regularizations',
  'overtime_records',
  'overtime_requests',
  'timesheet_adjustments',
  'timesheet_entries',
  'timesheets',
  'time_entries',
  'employee_holiday_selections',
  'holidays',
  'groups',
  'designations',
  'member_types',
  'late_rules',
  'employee_acknowledgments',
  'generated_documents',
  'documents',
  'document_templates',
  'visitor_forms',
  'visitor_visits',
  'maintenance_records',
  'asset_assignments',
  'assets',
  'expense_approvals',
  'expense_policies',
  'expense_receipts',
  'survey_peer_assignments',
  'survey_action_items',
  'survey_completions',
  'survey_responses_anonymous',
  'surveys',
  'face_enrollments',
  'iris_enrollments',
  'chat_messages',
  'chat_sessions',
  'channel_members',
  'message_reads',
  'feed_messages',
  'direct_messages',
  'channels',
  'projects',
  'clients',
  'bd_meetings',
  'tracked_meetings',
  'meeting_attendance',
  'meeting_platform_config',
  'org_positions',
  'succession_plans',
  'enrollments',
  'employee_skills',
  'course_skills',
  'courses',
  'skills',
  'training_budgets',
  'external_training_requests',
  'workflow_instances',
  'form_submissions',
  'form_definitions',
  'workflows',
  'approval_steps',
  'approval_flows',
  'geo_clock_logs',
  'geo_zones',
  'device_tokens',
  'biometric_credentials',
  'location_breadcrumbs',
  'user_calendar_connections',
  'custom_tab_visibility',
  'custom_tabs',
  'file_uploads',
  'notification_cards',
  'notification_queue',
  'audit_log',
  'outbound_webhook_deliveries',
  'outbound_webhook_subscriptions',
  'webhook_inbound_log',
] as const;

async function listTables(db: DatabaseEngine): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>('SELECT name FROM sqlite_master WHERE type = ?', [
    'table',
  ]);
  return new Set(rows.map((r) => r.name));
}

/**
 * Wipe monolith org data and reset branding/tenant_settings to empty `default`.
 * Idempotent when `full_tenant_wipe_v1` is already set in kv_store.
 */
export async function wipeAllTenantOrgData(
  db: DatabaseEngine,
  logger: Logger,
): Promise<{ wiped: boolean }> {
  const done = await db.get<{ value_json: string }>(
    'SELECT value_json FROM kv_store WHERE key = ?',
    [WIPE_KV_KEY],
  );
  if (done?.value_json) {
    return { wiped: false };
  }

  const tables = await listTables(db);

  // Per-table deletes: some schemas have broken FK defs (SQLite "foreign key mismatch")
  // that abort a single transaction; skip failures and continue.
  for (const name of WIPE_TABLES) {
    if (!tables.has(name)) continue;
    try {
      await db.run(`DELETE FROM ${name}`);
    } catch (err) {
      logger.warn({ err, table: name }, 'Tenant wipe skipped table');
    }
  }

  await db.transaction(async (tx) => {
    if (tables.has('branding')) {
      await tx.run('DELETE FROM branding');
      await tx.run(
        `INSERT INTO branding (tenant_id, setup_complete, primary_color, auth_local_enabled)
         VALUES ('default', 0, '#F5A623', 1)`,
      );
    }

    if (tables.has('tenant_settings')) {
      await tx.run('DELETE FROM tenant_settings');
      await tx.run(
        `INSERT INTO tenant_settings (id, platform_name, settings_json)
         VALUES ('default', 'BlokHR', '{}')`,
      );
    }

    if (tables.has('kv_store')) {
      await tx.run(`DELETE FROM kv_store WHERE key LIKE 'setup_step2_complete%'`);
      await tx.run(`INSERT OR REPLACE INTO kv_store (key, value_json) VALUES (?, ?)`, [
        WIPE_KV_KEY,
        JSON.stringify({ at: new Date().toISOString() }),
      ]);
    }
  });

  logger.warn('Full tenant org wipe applied — default wizard reopened');
  return { wiped: true };
}

/** Remove on-disk tenant split dirs and common sidecar DB files under /data or cwd. */
export function wipeSidecarTenantFiles(logger: Logger, dataRoot?: string): void {
  const roots = [dataRoot, process.cwd(), path.resolve(process.cwd(), '..')].filter(
    (r): r is string => !!r,
  );
  const names = [
    'directory.db',
    'entitlements.db',
    'learning.db',
    'kiosk.db',
    'consent.db',
    'capture.db',
    'school-attendance.db',
    'transport.db',
  ];

  for (const root of roots) {
    for (const name of names) {
      const fp = path.join(root, name);
      try {
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
          logger.warn({ fp }, 'Removed sidecar DB after tenant wipe');
        }
      } catch (err) {
        logger.warn({ err, fp }, 'Could not remove sidecar DB');
      }
    }
    const tenantsDir = path.join(root, 'tenants');
    try {
      if (fs.existsSync(tenantsDir)) {
        fs.rmSync(tenantsDir, { recursive: true, force: true });
        logger.warn({ tenantsDir }, 'Removed tenants/ directory after wipe');
      }
    } catch (err) {
      logger.warn({ err, tenantsDir }, 'Could not remove tenants/ directory');
    }
  }
}

export { WIPE_KV_KEY };

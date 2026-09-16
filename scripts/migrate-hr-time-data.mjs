#!/usr/bin/env node
/**
 * Idempotent migration: copy legacy monolith time-tracking / overtime rows
 * into service-owned SQLite DBs under tenant `default`.
 *
 * Never drops source tables. Re-runs skip existing unique keys.
 *
 * Usage:
 *   node scripts/migrate-hr-time-data.mjs
 *   node scripts/migrate-hr-time-data.mjs --dry-run
 *
 * Env (optional):
 *   MONOLITH_DB_PATH   default: backend/shaavir.db
 *   TIME_TRACKING_DB   default: services/time-tracking/time-tracking.db
 *   OVERTIME_DB        default: services/overtime/overtime.db
 *   TENANT_ID          default: default
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const TENANT = process.env.TENANT_ID || 'default';

const requireFromTime = createRequire(
  path.join(root, 'services', 'time-tracking', 'package.json'),
);
const initSqlJs = requireFromTime('sql.js');

function resolveMonolithDb() {
  const candidates = [
    process.env.MONOLITH_DB_PATH,
    path.join(root, 'backend', 'shaavir.db'),
    path.join(root, 'shaavir.db'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[1];
}

const SOURCE = resolveMonolithDb();
const TIME_DB =
  process.env.TIME_TRACKING_DB ||
  path.join(root, 'services', 'time-tracking', 'time-tracking.db');
const OT_DB =
  process.env.OVERTIME_DB || path.join(root, 'services', 'overtime', 'overtime.db');

function tableExists(db, name) {
  const stmt = db.prepare(
    `SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`,
  );
  stmt.bind([name]);
  const ok = stmt.step();
  stmt.free();
  return ok;
}

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function count(db, sql, params = []) {
  const rows = all(db, sql, params);
  return Number(rows[0]?.c ?? 0);
}

function run(db, sql, params = []) {
  db.run(sql, params);
}

function applyMigrationSql(db, filePath) {
  const mig = fs.readFileSync(filePath, 'utf8');
  for (const stmt of mig.split(';')) {
    const s = stmt.trim();
    if (s) db.run(s);
  }
}

function migrateTime(source, target) {
  const report = { clients: 0, projects: 0, entries: 0 };
  if (!tableExists(source, 'clients')) {
    console.log('  time: source clients table missing — skip');
    return report;
  }

  for (const c of all(source, 'SELECT * FROM clients')) {
    report.clients += 1;
    if (dryRun) continue;
    run(
      target,
      `INSERT OR IGNORE INTO clients
        (id, tenant_id, name, code, billing_rate_hourly, currency, contact_name, contact_email, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
      [
        c.id,
        TENANT,
        c.name,
        c.code ?? '',
        c.billing_rate_hourly ?? 0,
        c.currency ?? 'INR',
        c.contact_name ?? '',
        c.contact_email ?? '',
        c.active ?? 1,
        c.created_at ?? null,
        c.updated_at ?? null,
      ],
    );
  }

  if (tableExists(source, 'projects')) {
    for (const p of all(source, 'SELECT * FROM projects')) {
      report.projects += 1;
      if (dryRun) continue;
      run(
        target,
        `INSERT OR IGNORE INTO projects
          (id, tenant_id, client_id, name, code, billable, billing_rate_hourly, budget_hours, budget_amount, status, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
        [
          p.id,
          TENANT,
          p.client_id,
          p.name,
          p.code ?? '',
          p.billable ?? 1,
          p.billing_rate_hourly ?? null,
          p.budget_hours ?? null,
          p.budget_amount ?? null,
          p.status ?? 'active',
          p.start_date ?? null,
          p.end_date ?? null,
          p.created_at ?? null,
          p.updated_at ?? null,
        ],
      );
    }
  }

  if (tableExists(source, 'time_entries')) {
    for (const e of all(source, 'SELECT * FROM time_entries')) {
      if (dryRun) {
        report.entries += 1;
        continue;
      }
      const existing = all(
        target,
        `SELECT id FROM time_entries
         WHERE tenant_id = ? AND email = ? AND project_id = ? AND date = ? AND hours = ? AND description = ?
         LIMIT 1`,
        [TENANT, e.email, e.project_id, e.date, e.hours, e.description ?? ''],
      );
      if (existing.length) continue;
      run(
        target,
        `INSERT INTO time_entries
          (tenant_id, email, project_id, date, hours, description, billable, billing_rate_hourly, approved, approved_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
        [
          TENANT,
          e.email,
          e.project_id,
          e.date,
          e.hours,
          e.description ?? '',
          e.billable ?? 1,
          e.billing_rate_hourly ?? null,
          e.approved ?? 0,
          e.approved_by ?? '',
          e.created_at ?? null,
          e.updated_at ?? null,
        ],
      );
      report.entries += 1;
    }
  }

  return report;
}

function migrateOvertime(source, target) {
  const report = { records: 0, requests: 0, policy: 0, compensation: 0 };

  if (tableExists(source, 'overtime_records')) {
    for (const r of all(source, 'SELECT * FROM overtime_records')) {
      report.records += 1;
      if (dryRun) continue;
      run(
        target,
        `INSERT OR IGNORE INTO overtime_records
          (tenant_id, email, date, shift_start, shift_end, actual_worked_minutes, standard_minutes,
           ot_minutes, ot_type, hourly_rate, multiplier, ot_pay, source, status, approved_by,
           rejection_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
        [
          TENANT,
          r.email,
          r.date,
          r.shift_start,
          r.shift_end,
          r.actual_worked_minutes ?? 0,
          r.standard_minutes ?? 0,
          r.ot_minutes ?? 0,
          r.ot_type ?? 'weekday',
          r.hourly_rate ?? 0,
          r.multiplier ?? 2,
          r.ot_pay ?? 0,
          r.source ?? 'auto',
          r.status ?? 'pending',
          r.approved_by ?? '',
          r.rejection_reason ?? '',
          r.created_at ?? null,
          r.updated_at ?? null,
        ],
      );
    }
  }

  if (tableExists(source, 'overtime_requests')) {
    for (const r of all(source, 'SELECT * FROM overtime_requests')) {
      report.requests += 1;
      if (dryRun) continue;
      run(
        target,
        `INSERT OR IGNORE INTO overtime_requests
          (id, tenant_id, email, name, date, planned_hours, reason, status, approved_by,
           rejection_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
        [
          r.id,
          TENANT,
          r.email,
          r.name ?? '',
          r.date,
          r.planned_hours ?? 0,
          r.reason ?? '',
          r.status ?? 'pending',
          r.approved_by ?? '',
          r.rejection_reason ?? '',
          r.created_at ?? null,
          r.updated_at ?? null,
        ],
      );
    }
  }

  if (tableExists(source, 'system_settings')) {
    const settings = all(source, 'SELECT * FROM system_settings LIMIT 1')[0];
    if (settings) {
      report.policy = 1;
      if (!dryRun) {
        run(
          target,
          `INSERT INTO overtime_policy
            (tenant_id, ot_enabled, daily_threshold_minutes, weekly_threshold_minutes, multiplier,
             holiday_multiplier, requires_approval, requires_prior_approval, max_daily_minutes,
             max_quarterly_hours, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(tenant_id) DO UPDATE SET
             ot_enabled = excluded.ot_enabled,
             daily_threshold_minutes = excluded.daily_threshold_minutes,
             weekly_threshold_minutes = excluded.weekly_threshold_minutes,
             multiplier = excluded.multiplier,
             holiday_multiplier = excluded.holiday_multiplier,
             requires_approval = excluded.requires_approval,
             requires_prior_approval = excluded.requires_prior_approval,
             max_daily_minutes = excluded.max_daily_minutes,
             max_quarterly_hours = excluded.max_quarterly_hours,
             updated_at = datetime('now')`,
          [
            TENANT,
            settings.ot_enabled ?? 1,
            settings.ot_daily_threshold_minutes ?? 540,
            settings.ot_weekly_threshold_minutes ?? 2880,
            settings.ot_multiplier ?? 2.0,
            settings.ot_holiday_multiplier ?? 3.0,
            settings.ot_requires_approval ?? 1,
            settings.ot_requires_prior_approval ?? 1,
            settings.ot_max_daily_minutes ?? 240,
            settings.ot_max_quarterly_hours ?? 125,
          ],
        );
      }
    }
  }

  if (tableExists(source, 'members')) {
    let members = [];
    try {
      members = all(
        source,
        `SELECT email, name,
                COALESCE(basic_salary, 0) AS basic_salary,
                COALESCE(da, 0) AS da,
                COALESCE(shift_start, '09:00') AS shift_start,
                COALESCE(shift_end, '18:00') AS shift_end
         FROM members
         WHERE COALESCE(basic_salary, 0) > 0 OR COALESCE(da, 0) > 0`,
      );
    } catch {
      members = [];
    }
    for (const m of members) {
      report.compensation += 1;
      if (dryRun) continue;
      run(
        target,
        `INSERT INTO member_compensation_cache
          (tenant_id, email, basic_salary, da, shift_start, shift_end, name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(tenant_id, email) DO UPDATE SET
           basic_salary = excluded.basic_salary,
           da = excluded.da,
           shift_start = excluded.shift_start,
           shift_end = excluded.shift_end,
           name = excluded.name,
           updated_at = datetime('now')`,
        [
          TENANT,
          m.email,
          m.basic_salary ?? 0,
          m.da ?? 0,
          m.shift_start ?? '09:00',
          m.shift_end ?? '18:00',
          m.name ?? '',
        ],
      );
    }
  }

  return report;
}

function verify(label, sourceCount, targetCount) {
  const ok = targetCount >= sourceCount || sourceCount === 0;
  console.log(
    `  ${ok ? 'OK' : 'WARN'} ${label}: source=${sourceCount} target=${targetCount}`,
  );
  return ok;
}

async function main() {
  console.log(`migrate-hr-time-data ${dryRun ? '(dry-run) ' : ''}tenant=${TENANT}`);
  console.log(`  source: ${SOURCE}`);
  console.log(`  time:   ${TIME_DB}`);
  console.log(`  ot:     ${OT_DB}`);

  if (!fs.existsSync(SOURCE)) {
    console.error(`Source DB missing: ${SOURCE}`);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const source = new SQL.Database(fs.readFileSync(SOURCE));
  const timeDb = fs.existsSync(TIME_DB)
    ? new SQL.Database(fs.readFileSync(TIME_DB))
    : new SQL.Database();
  const otDb = fs.existsSync(OT_DB)
    ? new SQL.Database(fs.readFileSync(OT_DB))
    : new SQL.Database();

  applyMigrationSql(
    timeDb,
    path.join(root, 'services', 'time-tracking', 'migrations', '001_init.sql'),
  );
  applyMigrationSql(
    otDb,
    path.join(root, 'services', 'overtime', 'migrations', '001_init.sql'),
  );

  const timeReport = migrateTime(source, timeDb);
  const otReport = migrateOvertime(source, otDb);

  if (!dryRun) {
    fs.mkdirSync(path.dirname(TIME_DB), { recursive: true });
    fs.mkdirSync(path.dirname(OT_DB), { recursive: true });
    fs.writeFileSync(TIME_DB, Buffer.from(timeDb.export()));
    fs.writeFileSync(OT_DB, Buffer.from(otDb.export()));
  }

  console.log('\nCopied (attempted):');
  console.log('  time', timeReport);
  console.log('  overtime', otReport);

  console.log('\nCount verification:');
  let ok = true;
  if (tableExists(source, 'clients')) {
    ok =
      verify(
        'clients',
        count(source, 'SELECT COUNT(*) AS c FROM clients'),
        count(timeDb, 'SELECT COUNT(*) AS c FROM clients WHERE tenant_id = ?', [TENANT]),
      ) && ok;
  }
  if (tableExists(source, 'projects')) {
    ok =
      verify(
        'projects',
        count(source, 'SELECT COUNT(*) AS c FROM projects'),
        count(timeDb, 'SELECT COUNT(*) AS c FROM projects WHERE tenant_id = ?', [TENANT]),
      ) && ok;
  }
  if (tableExists(source, 'time_entries')) {
    ok =
      verify(
        'time_entries',
        count(source, 'SELECT COUNT(*) AS c FROM time_entries'),
        count(timeDb, 'SELECT COUNT(*) AS c FROM time_entries WHERE tenant_id = ?', [
          TENANT,
        ]),
      ) && ok;
  }
  if (tableExists(source, 'overtime_records')) {
    ok =
      verify(
        'overtime_records',
        count(source, 'SELECT COUNT(*) AS c FROM overtime_records'),
        count(otDb, 'SELECT COUNT(*) AS c FROM overtime_records WHERE tenant_id = ?', [
          TENANT,
        ]),
      ) && ok;
  }
  if (tableExists(source, 'overtime_requests')) {
    ok =
      verify(
        'overtime_requests',
        count(source, 'SELECT COUNT(*) AS c FROM overtime_requests'),
        count(otDb, 'SELECT COUNT(*) AS c FROM overtime_requests WHERE tenant_id = ?', [
          TENANT,
        ]),
      ) && ok;
  }

  source.close();
  timeDb.close();
  otDb.close();

  console.log(ok ? '\nMigration verification passed.' : '\nMigration finished with warnings.');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

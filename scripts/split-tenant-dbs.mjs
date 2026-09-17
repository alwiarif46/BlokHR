/**
 * Phase 2 cutover: split a legacy multi-tenant SQLite file into
 * TENANT_DATA_ROOT/{tenantId}/{serviceFile} files.
 *
 * Usage:
 *   node scripts/split-tenant-dbs.mjs \
 *     --legacy ./data/school-identity.db \
 *     --service-file school-identity.db \
 *     [--root ./data/tenants] \
 *     [--dry-run]
 *
 * Requires TENANT_DB_SPLIT=1 after cutover. Legacy file is left untouched
 * (read-only backup for one release).
 */
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const TENANT_RE = /^[a-z0-9_-]{1,64}$/;

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  return process.argv[i + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function openDb(SQL, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`legacy file not found: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);
  return new SQL.Database(buf);
}

function tableNames(db) {
  const rows = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  );
  if (!rows.length) return [];
  return rows[0].values.map((v) => String(v[0]));
}

function tableHasColumn(db, table, col) {
  const info = db.exec(`PRAGMA table_info(${quoteIdent(table)})`);
  if (!info.length) return false;
  return info[0].values.some((r) => String(r[1]) === col);
}

function distinctTenants(db, tables) {
  const set = new Set();
  for (const t of tables) {
    if (!tableHasColumn(db, t, 'tenant_id')) continue;
    const rows = db.exec(
      `SELECT DISTINCT tenant_id FROM ${quoteIdent(t)} WHERE tenant_id IS NOT NULL AND trim(tenant_id) != ''`,
    );
    if (!rows.length) continue;
    for (const [tid] of rows[0].values) {
      const id = String(tid).trim().toLowerCase();
      if (TENANT_RE.test(id)) set.add(id);
    }
  }
  return [...set].sort();
}

function copySchema(src, dst) {
  const master = src.exec(
    `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type='table' DESC, name`,
  );
  if (!master.length) return;
  for (const [sql] of master[0].values) {
    try {
      dst.run(String(sql));
    } catch {
      // ignore duplicate index/table on re-run
    }
  }
}

function insertRows(dst, table, columns, values) {
  if (!values.length) return 0;
  const cols = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = dst.prepare(
    `INSERT OR IGNORE INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders})`,
  );
  let n = 0;
  for (const row of values) {
    stmt.run(row);
    n += 1;
  }
  stmt.free();
  return n;
}

function selectAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const cols = stmt.getColumnNames();
  const values = [];
  while (stmt.step()) {
    values.push(stmt.get());
  }
  stmt.free();
  return { cols, values };
}

function persist(db, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(filePath, Buffer.from(data));
}

async function main() {
  const legacy = path.resolve(arg('legacy'));
  const serviceFile = arg('service-file');
  const root = path.resolve(
    arg('root') || process.env.TENANT_DATA_ROOT || path.join('data', 'tenants'),
  );
  const dryRun = hasFlag('dry-run');

  if (!legacy || !serviceFile) {
    console.error(
      'Usage: node scripts/split-tenant-dbs.mjs --legacy <file> --service-file <name.db> [--root <dir>] [--dry-run]',
    );
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const src = await openDb(SQL, legacy);
  const tables = tableNames(src);
  const tenants = distinctTenants(src, tables);

  console.log(
    JSON.stringify(
      {
        legacy,
        serviceFile,
        root,
        dryRun,
        tenants,
        tables: tables.length,
      },
      null,
      2,
    ),
  );

  if (!tenants.length) {
    console.warn('No tenant_id values found; nothing to split.');
    src.close();
    return;
  }

  for (const tid of tenants) {
    const outPath = path.join(root, tid, serviceFile);
    if (dryRun) {
      console.log(`[dry-run] would create ${outPath}`);
      continue;
    }
    const dst = new SQL.Database();
    copySchema(src, dst);
    let copied = 0;
    for (const table of tables) {
      const hasTenant = tableHasColumn(src, table, 'tenant_id');
      let sql;
      let params = [];
      if (hasTenant) {
        sql = `SELECT * FROM ${quoteIdent(table)} WHERE tenant_id = ? OR tenant_id IS NULL`;
        params = [tid];
      } else {
        // Shared / catalog tables without tenant_id — copy fully into each tenant DB.
        sql = `SELECT * FROM ${quoteIdent(table)}`;
      }
      const { cols, values } = selectAll(src, sql, params);
      if (!cols.length) continue;
      copied += insertRows(dst, table, cols, values);
    }
    persist(dst, outPath);
    dst.close();
    console.log(`wrote ${outPath} (${copied} rows)`);
  }

  src.close();
  console.log('Done. Keep legacy as read-only backup; set TENANT_DB_SPLIT=1 and TENANT_DATA_ROOT.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

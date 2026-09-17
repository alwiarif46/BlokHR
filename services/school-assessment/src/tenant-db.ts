/**
 * Shared Phase-2 helpers: per-tenant SQLite paths under TENANT_DATA_ROOT.
 * Each service copies or imports this module (no cross-service runtime package).
 */
import fs from 'fs';
import path from 'path';

const TENANT_RE = /^[a-z0-9_-]{1,64}$/;

export function assertSafeTenantId(tenantId: string): string {
  const tid = String(tenantId || '')
    .trim()
    .toLowerCase();
  if (!TENANT_RE.test(tid)) {
    throw new Error(`invalid_tenant_id:${tenantId}`);
  }
  return tid;
}

export function getTenantDataRoot(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.TENANT_DATA_ROOT || '').trim();
  return raw || path.resolve(process.cwd(), 'data', 'tenants');
}

export function isTenantDbSplitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = String(env.TENANT_DB_SPLIT || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function resolveTenantDbPath(opts: {
  tenantId: string;
  serviceFile: string;
  legacyPath: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = opts.env ?? process.env;
  if (!isTenantDbSplitEnabled(env)) {
    return opts.legacyPath;
  }
  if (opts.legacyPath === ':memory:') {
    return ':memory:';
  }
  const tid = assertSafeTenantId(opts.tenantId);
  const root = getTenantDataRoot(env);
  const dir = path.join(root, tid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = opts.serviceFile.replace(/^.*[/\\]/, '');
  return path.join(dir, file);
}

export type DbFactory<T> = (dbPath: string) => Promise<T>;

export class TenantSqlitePool<T extends { close(): Promise<void> }> {
  private readonly cache = new Map<string, T>();

  constructor(
    private readonly opts: {
      legacyPath: string;
      serviceFile: string;
      create: DbFactory<T>;
      migrate: (db: T) => Promise<void>;
      env?: NodeJS.ProcessEnv;
    },
  ) {}

  async get(tenantId: string): Promise<T> {
    const tid = assertSafeTenantId(tenantId);
    const hit = this.cache.get(tid);
    if (hit) return hit;
    const dbPath = resolveTenantDbPath({
      tenantId: tid,
      serviceFile: this.opts.serviceFile,
      legacyPath: this.opts.legacyPath,
      env: this.opts.env,
    });
    const db = await this.opts.create(dbPath);
    await this.opts.migrate(db);
    this.cache.set(tid, db);
    return db;
  }

  async closeAll(): Promise<void> {
    const dbs = [...this.cache.values()];
    this.cache.clear();
    await Promise.all(dbs.map((d) => d.close()));
  }
}

/** Extract tenant from X-Blok-Tenant or first :tenantId path segment after /api/{domain}/. */
export function extractRequestTenant(opts: {
  headerTenant?: string;
  path: string;
  apiPrefix: string;
}): string | null {
  const fromHeader = String(opts.headerTenant || '')
    .trim()
    .toLowerCase();
  if (fromHeader && TENANT_RE.test(fromHeader)) return fromHeader;

  const clean = String(opts.path || '').split('?')[0];
  const prefix = opts.apiPrefix.endsWith('/') ? opts.apiPrefix.slice(0, -1) : opts.apiPrefix;
  let rest = clean;
  const idx = clean.indexOf(prefix);
  if (idx >= 0) {
    rest = clean.slice(idx + prefix.length);
  }
  const seg = rest.split('/').filter(Boolean)[0] || '';
  const tid = seg.toLowerCase();
  return TENANT_RE.test(tid) ? tid : null;
}


import { SchoolAssessmentSqlite, runSchoolAssessmentMigrations } from './db';

export function createAssessmentTenantPool(opts: {
  legacyPath: string;
  migrationsDir: string;
  env?: NodeJS.ProcessEnv;
}): TenantSqlitePool<SchoolAssessmentSqlite> {
  return new TenantSqlitePool({
    legacyPath: opts.legacyPath,
    serviceFile: 'school-assessment.db',
    env: opts.env,
    create: (p) => SchoolAssessmentSqlite.create(p),
    migrate: (db) => runSchoolAssessmentMigrations(db, opts.migrationsDir),
  });
}

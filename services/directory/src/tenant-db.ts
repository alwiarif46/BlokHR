/**
 * Per-tenant SQLite path resolution + connection pool (Phase 2).
 */
import fs from 'fs';
import path from 'path';
import type { DirectorySqlite } from './db';
import { runDirectoryMigrations } from './db';

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

export class DirectoryTenantPool {
  private readonly cache = new Map<string, DirectorySqlite>();

  constructor(
    private readonly opts: {
      legacyPath: string;
      migrationsDir: string;
      create: (dbPath: string) => Promise<DirectorySqlite>;
      env?: NodeJS.ProcessEnv;
    },
  ) {}

  async get(tenantId: string): Promise<DirectorySqlite> {
    const tid = assertSafeTenantId(tenantId);
    const hit = this.cache.get(tid);
    if (hit) return hit;
    const dbPath = resolveTenantDbPath({
      tenantId: tid,
      serviceFile: 'directory.db',
      legacyPath: this.opts.legacyPath,
      env: this.opts.env,
    });
    const db = await this.opts.create(dbPath);
    await runDirectoryMigrations(db, this.opts.migrationsDir);
    this.cache.set(tid, db);
    return db;
  }

  async closeAll(): Promise<void> {
    const dbs = [...this.cache.values()];
    this.cache.clear();
    await Promise.all(dbs.map((d) => d.close()));
  }
}

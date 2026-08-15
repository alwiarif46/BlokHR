import path from 'path';
import type { Express } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import { TenantSettingsService } from '../services/tenant-settings-service';
import type { DirectoryService } from '@blokhr/directory';
import {
  KioskSqlite,
  runKioskMigrations,
  KioskRepository,
  KioskService,
  createKioskRouter,
  type AttendanceSettings,
  type KioskMemberSummary,
} from '@blokhr/kiosk';

export interface KioskBundle {
  service: KioskService;
  db: KioskSqlite;
  close: () => Promise<void>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

export async function createKioskBundle(
  config: AppConfig,
  logger: Logger,
  deps: {
    monolithDb: DatabaseEngine;
    directory?: DirectoryService;
  },
): Promise<KioskBundle> {
  const kioskDbPath = config.kioskDbPath;
  const db = await KioskSqlite.create(kioskDbPath);
  const migrationsDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'services',
    'kiosk',
    'migrations',
  );
  await runKioskMigrations(db, migrationsDir);

  const tenantSettings = new TenantSettingsService(deps.monolithDb, logger);
  await tenantSettings.load().catch(() => undefined);

  const clockRepo = new ClockRepository(deps.monolithDb);
  const clockService = new ClockService(clockRepo, logger);

  const settingsPort = {
    async getAttendanceSettings(): Promise<AttendanceSettings> {
      const bundle = await tenantSettings.getFullBundle(false);
      const attendance = (bundle.settings_json?.attendance ?? {}) as Record<string, unknown>;
      return {
        kioskEnabled: attendance.kioskEnabled === true,
        ipRestrictionEnabled: attendance.ipRestrictionEnabled === true,
        allowedIPs: asStringArray(attendance.allowedIPs),
      };
    },
  };

  const rosterPort = {
    async searchActiveMembers(query: string, limit = 40): Promise<KioskMemberSummary[]> {
      const q = query.toLowerCase().trim();

      if (deps.directory) {
        const all = await deps.directory.listMembers(config.defaultTenantId);
        const fromDir = all
          .filter((m) => m.active)
          .filter(
            (m) =>
              !q ||
              m.name.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q),
          )
          .slice(0, limit)
          .map((m) => ({
            email: m.email,
            name: m.name,
            designation: m.designation,
            groupId: m.groupId,
          }));
        if (fromDir.length > 0) return fromDir;
      }

      const rows = await deps.monolithDb.all<{
        email: string;
        name: string;
        designation: string;
        group_id: string | null;
        [key: string]: unknown;
      }>(
        `SELECT email, name, designation, group_id FROM members
         WHERE active = 1
         ORDER BY name ASC
         LIMIT ?`,
        [Math.max(limit * 3, 120)],
      );
      return rows
        .filter(
          (r) =>
            !q ||
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q),
        )
        .slice(0, limit)
        .map((r) => ({
          email: r.email,
          name: r.name,
          designation: r.designation,
          groupId: r.group_id,
        }));
    },

    async getMemberByEmail(email: string): Promise<KioskMemberSummary | null> {
      const clean = email.toLowerCase().trim();
      if (deps.directory) {
        const all = await deps.directory.listMembers(config.defaultTenantId);
        const m = all.find((x) => x.active && x.email.toLowerCase() === clean);
        if (m) {
          return {
            email: m.email,
            name: m.name,
            designation: m.designation,
            groupId: m.groupId,
          };
        }
      }
      const row = await deps.monolithDb.get<{
        email: string;
        name: string;
        designation: string;
        group_id: string | null;
        [key: string]: unknown;
      }>(
        'SELECT email, name, designation, group_id FROM members WHERE active = 1 AND lower(email) = ?',
        [clean],
      );
      if (!row) return null;
      return {
        email: row.email,
        name: row.name,
        designation: row.designation,
        groupId: row.group_id,
      };
    },
  };

  const service = new KioskService({
    repo: new KioskRepository(db),
    settings: settingsPort,
    roster: rosterPort,
    clock: {
      clock: (action, email, name, source) =>
        clockService.clock(action, email, name, source ?? 'kiosk'),
    },
    logger,
    defaultTenantId: config.defaultTenantId,
  });

  logger.info({ kioskDbPath }, 'Kiosk service ready');

  return {
    service,
    db,
    close: async () => {
      await db.close();
    },
  };
}

export function mountKioskRouter(
  app: Express,
  bundle: KioskBundle,
  config: AppConfig,
  monolithDb: DatabaseEngine,
): void {
  app.use(
    '/api/kiosk',
    createKioskRouter(bundle.service, {
      tenantId: config.defaultTenantId,
      isAdmin: async (email: string) => {
        const row = await monolithDb.get<{ email: string }>(
          'SELECT email FROM admins WHERE email = ?',
          [email],
        );
        return !!row;
      },
    }),
  );
}

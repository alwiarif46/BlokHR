import path from 'path';
import type { Express } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import type { EventBus } from '../events';
import type { EntitlementsService } from '@blokhr/entitlements';
import {
  DirectorySqlite,
  runDirectoryMigrations,
  DirectoryRepository,
  DirectoryService,
  createDirectoryRouter,
  DIRECTORY_DEFAULTS,
  type DirectoryMember,
} from '@blokhr/directory';
import { MultiAuthService } from '../services/multi-auth-service';
import { SettingsRepository } from '../repositories/settings-repository';
import { SettingsService } from '../services/settings-service';

export interface DirectoryBundle {
  service: DirectoryService;
  db: DirectorySqlite;
  close: () => Promise<void>;
}

/**
 * Ensure the default General group exists so new members can clock in.
 */
export async function ensureDefaultGroup(
  db: DatabaseEngine,
  timezone: string = 'Asia/Kolkata',
): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO groups (id, name, shift_start, shift_end, timezone)
     VALUES (?, 'General', ?, ?, ?)`,
    [
      DIRECTORY_DEFAULTS.DEFAULT_GROUP_ID,
      DIRECTORY_DEFAULTS.DEFAULT_SHIFT_START,
      DIRECTORY_DEFAULTS.DEFAULT_SHIFT_END,
      timezone,
    ],
  );
}

function createProjectionPort(db: DatabaseEngine, logger: Logger) {
  return {
    async upsertMember(member: DirectoryMember): Promise<void> {
      await ensureDefaultGroup(db, member.timezone);
      const existing = await db.get<{ id: string }>(
        'SELECT id FROM members WHERE email = ? OR id = ?',
        [member.email, member.id],
      );
      if (existing) {
        await db.run(
          `UPDATE members SET
            name = ?,
            group_id = ?,
            role = ?,
            designation = ?,
            phone = ?,
            timezone = ?,
            individual_shift_start = ?,
            individual_shift_end = ?,
            active = ?,
            updated_at = datetime('now')
           WHERE id = ? OR email = ?`,
          [
            member.name,
            member.groupId,
            member.role,
            member.designation,
            member.phone,
            member.timezone,
            member.individualShiftStart,
            member.individualShiftEnd,
            member.active ? 1 : 0,
            member.id,
            member.email,
          ],
        );
      } else {
        await db.run(
          `INSERT INTO members (
            id, email, name, group_id, member_type_id, role, designation,
            phone, timezone, individual_shift_start, individual_shift_end, active
          ) VALUES (?, ?, ?, ?, 'fte', ?, ?, ?, ?, ?, ?, ?)`,
          [
            member.id,
            member.email,
            member.name,
            member.groupId,
            member.role,
            member.designation,
            member.phone,
            member.timezone,
            member.individualShiftStart,
            member.individualShiftEnd,
            member.active ? 1 : 0,
          ],
        );
      }
      logger.debug({ email: member.email }, 'Projected directory member to monolith');
    },

    async deactivateMember(id: string): Promise<void> {
      await db.run(
        "UPDATE members SET active = 0, updated_at = datetime('now') WHERE id = ? OR email = ?",
        [id, id],
      );
    },
  };
}

export async function createDirectoryBundle(
  config: AppConfig,
  logger: Logger,
  deps: {
    monolithDb: DatabaseEngine;
    entitlements: EntitlementsService;
    eventBus?: EventBus;
  },
): Promise<DirectoryBundle> {
  const directoryDbPath =
    config.nodeEnv === 'test' ? ':memory:' : config.directoryDbPath;

  const db = await DirectorySqlite.create(directoryDbPath);
  const migrationsDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'services',
    'directory',
    'migrations',
  );
  await runDirectoryMigrations(db, migrationsDir);

  const settingsService = new SettingsService(
    new SettingsRepository(deps.monolithDb),
    null,
    null,
    null,
    null,
    logger,
  );
  const authService = new MultiAuthService(deps.monolithDb, logger, settingsService);
  const projection = createProjectionPort(deps.monolithDb, logger);

  const service = new DirectoryService({
    repo: new DirectoryRepository(db),
    defaultTenantId: config.defaultTenantId,
    seatChecker: {
      checkSeats: (tenantId, activeSeats) =>
        deps.entitlements.checkSeats(tenantId, activeSeats),
    },
    auth: {
      createCredentials: (email, password, mustChange) =>
        authService.createCredentials(email, password, mustChange),
    },
    projection,
    events: deps.eventBus
      ? {
          emit: (event, payload) => {
            deps.eventBus?.emit(event as never, payload as never);
          },
        }
      : undefined,
  });

  await ensureDefaultGroup(deps.monolithDb);

  // One-time backfill from legacy monolith members when directory is empty
  const legacy = await deps.monolithDb.all<{
    id: string;
    email: string;
    name: string;
    role: string;
    group_id: string | null;
    designation: string;
    phone: string;
    timezone: string;
    individual_shift_start: string | null;
    individual_shift_end: string | null;
    active: number;
  }>(
    `SELECT id, email, name, role, group_id, designation, phone, timezone,
            individual_shift_start, individual_shift_end, active
     FROM members`,
  );

  const imported = await service.backfillFromLegacy(
    legacy.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      groupId: row.group_id,
      designation: row.designation,
      phone: row.phone,
      timezone: row.timezone,
      individualShiftStart: row.individual_shift_start,
      individualShiftEnd: row.individual_shift_end,
      active: row.active === 1,
    })),
    config.defaultTenantId,
  );

  // Ensure projected shifts/groups for backfilled actives (clock-ready)
  if (imported > 0) {
    const actives = await service.listMembers(config.defaultTenantId);
    for (const m of actives) {
      await projection.upsertMember(m);
    }
    logger.info({ imported }, 'Directory backfilled from monolith members');
  }

  logger.info({ directoryDbPath }, 'Directory service ready');

  return {
    service,
    db,
    close: async () => {
      await db.close();
    },
  };
}

export function mountDirectoryRouter(
  app: Express,
  bundle: DirectoryBundle,
  config: AppConfig,
  _monolithDb: DatabaseEngine,
): void {
  // P12-04: admin gating is role-guard on gateway X-Blok-* headers (not X-User-Email).
  app.use(
    '/api/directory',
    createDirectoryRouter(bundle.service, {
      tenantId: config.defaultTenantId,
    }),
  );
}

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { SchoolFamilyOpsDb } from '../db';
import { currentFamilyOpsDb } from '../db-context';
import { enforceGuardianAccess, isGuardianPrincipal } from '../internal-auth';
import { guardRoutes } from '../role-guard';
import { FAMILY_OPS_ROUTE_POLICIES } from '../route-policies';

const MODULE_KEYS = [
  'health',
  'meals',
  'activities',
  'pickup',
  'community',
  'fundraising',
  'ai',
] as const;

type ModuleKey = (typeof MODULE_KEYS)[number];

const ENTITLEMENT_BY_MODULE: Record<ModuleKey, string> = {
  health: 'school_family_health',
  meals: 'school_family_meals',
  activities: 'school_family_activities',
  pickup: 'school_family_pickup',
  community: 'school_family_community',
  fundraising: 'school_family_fundraising',
  ai: 'school_family_ai',
};

const GUARDIAN_AREAS = ['health', 'meals', 'activities', 'pickup'] as const;
type GuardianArea = (typeof GUARDIAN_AREAS)[number];

const AREA_TABLE: Record<GuardianArea, string> = {
  health: 'health_forms',
  meals: 'meal_orders',
  activities: 'activity_regs',
  pickup: 'pickup_authorizations',
};

const STAFF_AREAS = [
  'health',
  'meals',
  'activities',
  'pickup',
  'community',
  'fundraising',
] as const;

const STAFF_TABLE: Record<(typeof STAFF_AREAS)[number], string> = {
  health: 'health_forms',
  meals: 'meal_orders',
  activities: 'activity_regs',
  pickup: 'pickup_authorizations',
  community: 'community_posts',
  fundraising: 'fundraising_pledges',
};

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function modulesPayload(): Record<
  ModuleKey,
  { enabled: boolean; message: string }
> {
  const out = {} as Record<ModuleKey, { enabled: boolean; message: string }>;
  for (const key of MODULE_KEYS) {
    out[key] = {
      enabled: false,
      message: `requires ${ENTITLEMENT_BY_MODULE[key]} entitlement`,
    };
  }
  return out;
}

export function createFamilyOpsRouter(
  fallbackDb: SchoolFamilyOpsDb,
  internalSecret: string,
): Router {
  const db = (): SchoolFamilyOpsDb => currentFamilyOpsDb(fallbackDb);
  const router = Router({ mergeParams: true });
  guardRoutes(router, FAMILY_OPS_ROUTE_POLICIES, { internalSecret });

  router.get(
    '/:tenantId/modules',
    asyncHandler(async (_req, res) => {
      res.json({ modules: modulesPayload() });
    }),
  );

  for (const area of GUARDIAN_AREAS) {
    router.get(
      `/:tenantId/guardian/students/:studentId/${area}`,
      asyncHandler(async (req, res) => {
        if (!isGuardianPrincipal(req)) {
          res.status(401).json({ error: 'unauthorized' });
          return;
        }
        const studentId = req.params.studentId;
        const gate = enforceGuardianAccess(req, internalSecret, studentId);
        if ('error' in gate) {
          res.status(gate.status).json({ error: gate.error });
          return;
        }
        const table = AREA_TABLE[area];
        const rows = await db().all(
          `SELECT id, tenant_id, student_ref, status, created_at, updated_at
           FROM ${table}
           WHERE tenant_id = ? AND student_ref = ?
           ORDER BY created_at DESC`,
          [req.params.tenantId, studentId],
        );
        res.json({
          area,
          enabled: false,
          message: `requires ${ENTITLEMENT_BY_MODULE[area]} entitlement`,
          items: rows,
        });
      }),
    );
  }

  router.post(
    '/:tenantId/guardian/students/:studentId/pickup',
    asyncHandler(async (req, res) => {
      if (!isGuardianPrincipal(req)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentId = req.params.studentId;
      const gate = enforceGuardianAccess(req, internalSecret, studentId);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const id = uuidv4();
      const tenantId = req.params.tenantId;
      await db().run(
        `INSERT INTO pickup_authorizations
           (id, tenant_id, student_ref, guardian_ref, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [id, tenantId, studentId, gate.guardianId],
      );
      const row = await db().get(
        `SELECT id, tenant_id, student_ref, guardian_ref, status, created_at, updated_at
         FROM pickup_authorizations WHERE id = ? AND tenant_id = ?`,
        [id, tenantId],
      );
      res.status(201).json(row);
    }),
  );

  for (const area of STAFF_AREAS) {
    router.get(
      `/:tenantId/${area}`,
      asyncHandler(async (req, res) => {
        const table = STAFF_TABLE[area];
        const rows = await db().all(
          `SELECT id, tenant_id, student_ref, status, created_at, updated_at
           FROM ${table}
           WHERE tenant_id = ?
           ORDER BY created_at DESC
           LIMIT 100`,
          [req.params.tenantId],
        );
        res.json({
          area,
          enabled: false,
          message: `requires ${ENTITLEMENT_BY_MODULE[area]} entitlement`,
          items: rows,
        });
      }),
    );
  }

  router.post(
    '/:tenantId/ai/draft',
    asyncHandler(async (_req, res) => {
      res.status(501).json({
        error: 'ai_not_enabled',
        note: 'requires school_family_ai entitlement + human review',
      });
    }),
  );

  return router;
}

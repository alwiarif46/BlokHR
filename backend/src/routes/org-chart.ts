import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { EventBus } from '../events';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { OrgChartService } from '../services/org-chart-service';

/**
 * Org Chart routes:
 *
 * Positions:
 *   POST   /api/org/positions                — create a position
 *   GET    /api/org/positions                 — list all positions
 *   GET    /api/org/positions/:id             — get a single position
 *   PUT    /api/org/positions/:id             — update a position
 *   DELETE /api/org/positions/:id             — delete a position (reparents children)
 *
 * Hierarchy:
 *   GET    /api/org/tree                      — full org tree (flat with linkage)
 *   GET    /api/org/positions/:id/subtree     — subtree rooted at position
 *   GET    /api/org/positions/:id/ancestors   — ancestor chain to root
 *
 * Reporting lines:
 *   PUT    /api/org/reports-to                — set a member's manager
 *   GET    /api/org/manager?email=            — get manager for an employee
 *   GET    /api/org/direct-reports?email=     — get direct reports for a manager
 *
 * Succession planning:
 *   POST   /api/org/succession                — create a succession plan entry
 *   GET    /api/org/succession                — list all succession plans
 *   GET    /api/org/succession/position/:id   — succession plans for a position
 *   PUT    /api/org/succession/:id            — update a succession plan entry
 *   DELETE /api/org/succession/:id            — delete a succession plan entry
 *
 * Analytics:
 *   GET    /api/org/span-of-control           — span-of-control per manager
 *   GET    /api/org/vacancies                 — positions with unfilled headcount
 *   GET    /api/org/flight-risk               — flight risk scores (optional ?email= or ?groupId=)
 */
export function createOrgChartRouter(
  db: DatabaseEngine,
  logger: Logger,
  eventBus?: EventBus,
): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new OrgChartService(db, logger, auditService, eventBus);

  // ── Positions CRUD ──

  /** POST /api/org/positions — create a new org position. */
  router.post(
    '/org/positions',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { title, parentPositionId, groupId, level, maxHeadcount, description } = req.body as {
        title?: string;
        parentPositionId?: string | null;
        groupId?: string | null;
        level?: number;
        maxHeadcount?: number;
        description?: string;
      };

      if (!title) throw new AppError('title is required', 400);

      const result = await service.createPosition(
        {
          title,
          parentPositionId: parentPositionId ?? null,
          groupId: groupId ?? null,
          level: level ?? 0,
          maxHeadcount: maxHeadcount ?? 1,
          description: description ?? '',
        },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to create position', 400);
      res.status(201).json({ position: result.data });
    }),
  );

  /** GET /api/org/positions — list all positions. */
  router.get(
    '/org/positions',
    asyncHandler(async (_req: Request, res: Response) => {
      const positions = await service.getAllPositions();
      res.json({ positions });
    }),
  );

  /** GET /api/org/positions/:id — get a single position. */
  router.get(
    '/org/positions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const position = await service.getPositionById(req.params.id);
      if (!position) throw new AppError('Position not found', 404);
      res.json({ position });
    }),
  );

  /** PUT /api/org/positions/:id — update a position. */
  router.put(
    '/org/positions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { title, parentPositionId, groupId, level, maxHeadcount, description } = req.body as {
        title?: string;
        parentPositionId?: string | null;
        groupId?: string | null;
        level?: number;
        maxHeadcount?: number;
        description?: string;
      };

      const result = await service.updatePosition(
        req.params.id,
        { title, parentPositionId, groupId, level, maxHeadcount, description },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to update position', 400);
      res.json({ success: true });
    }),
  );

  /** DELETE /api/org/positions/:id — delete a position. */
  router.delete(
    '/org/positions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deletePosition(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed to delete position', 400);
      res.json({ success: true });
    }),
  );

  // ── Hierarchy ──

  /** GET /api/org/tree — full org tree as flat list with holder info. */
  router.get(
    '/org/tree',
    asyncHandler(async (_req: Request, res: Response) => {
      const tree = await service.getOrgTree();
      res.json({ tree });
    }),
  );

  /** GET /api/org/positions/:id/subtree — subtree from a position down. */
  router.get(
    '/org/positions/:id/subtree',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getSubtree(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Failed to get subtree', 404);
      res.json({ positions: result.data });
    }),
  );

  /** GET /api/org/positions/:id/ancestors — ancestor chain to root. */
  router.get(
    '/org/positions/:id/ancestors',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getAncestors(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Failed to get ancestors', 404);
      res.json({ ancestors: result.data });
    }),
  );

  // ── Reporting lines ──

  /** PUT /api/org/reports-to — set reporting line (manager assignment). */
  router.put(
    '/org/reports-to',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { email, managerEmail } = req.body as {
        email?: string;
        managerEmail?: string;
      };

      if (!email) throw new AppError('email is required', 400);
      if (managerEmail === undefined) throw new AppError('managerEmail is required', 400);

      const result = await service.setReportsTo(
        email.toLowerCase().trim(),
        managerEmail === '' ? '' : managerEmail.toLowerCase().trim(),
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to set reporting line', 400);
      res.json({ success: true });
    }),
  );

  /** PUT /api/org/assign-position — assign a member to a position. */
  router.put(
    '/org/assign-position',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { email, positionId } = req.body as {
        email?: string;
        positionId?: string | null;
      };

      if (!email) throw new AppError('email is required', 400);
      if (positionId === undefined)
        throw new AppError('positionId is required (null to unassign)', 400);

      const result = await service.assignPosition(email.toLowerCase().trim(), positionId, actor);

      if (!result.success) throw new AppError(result.error ?? 'Failed to assign position', 400);
      res.json({ success: true });
    }),
  );

  /** GET /api/org/manager?email= — get manager for an employee. */
  router.get(
    '/org/manager',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) throw new AppError('email query parameter is required', 400);
      const managerEmail = await service.getManagerEmail(email.toLowerCase().trim());
      res.json({ managerEmail });
    }),
  );

  /** GET /api/org/direct-reports?email= — get direct reports for a manager. */
  router.get(
    '/org/direct-reports',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) throw new AppError('email query parameter is required', 400);
      const reports = await service.getDirectReports(email.toLowerCase().trim());
      const totalSubordinates = await service.getSubordinateCount(email.toLowerCase().trim());
      res.json({ directReports: reports, totalSubordinates });
    }),
  );

  // ── Succession planning ──

  /** POST /api/org/succession — create a succession plan entry. */
  router.post(
    '/org/succession',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { positionId, nomineeEmail, readiness, notes } = req.body as {
        positionId?: string;
        nomineeEmail?: string;
        readiness?: string;
        notes?: string;
      };

      if (!positionId) throw new AppError('positionId is required', 400);
      if (!nomineeEmail) throw new AppError('nomineeEmail is required', 400);

      const result = await service.createSuccessionPlan(
        {
          positionId,
          nomineeEmail: nomineeEmail.toLowerCase().trim(),
          readiness,
          notes,
        },
        actor,
      );

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to create succession plan', 400);
      }
      res.status(201).json({ plan: result.data });
    }),
  );

  /** GET /api/org/succession — list all succession plans. */
  router.get(
    '/org/succession',
    asyncHandler(async (_req: Request, res: Response) => {
      const plans = await service.getAllSuccessionPlans();
      res.json({ plans });
    }),
  );

  /** GET /api/org/succession/position/:id — succession plans for a position. */
  router.get(
    '/org/succession/position/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const plans = await service.getSuccessionByPosition(req.params.id);
      res.json({ plans });
    }),
  );

  /** PUT /api/org/succession/:id — update a succession plan entry. */
  router.put(
    '/org/succession/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid succession plan ID', 400);

      const { readiness, notes } = req.body as {
        readiness?: string;
        notes?: string;
      };

      const result = await service.updateSuccessionPlan(id, { readiness, notes }, actor);
      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to update succession plan', 400);
      }
      res.json({ success: true });
    }),
  );

  /** DELETE /api/org/succession/:id — delete a succession plan entry. */
  router.delete(
    '/org/succession/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid succession plan ID', 400);

      const result = await service.deleteSuccessionPlan(id, actor);
      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to delete succession plan', 400);
      }
      res.json({ success: true });
    }),
  );

  // ── Analytics ──

  /** GET /api/org/span-of-control — span-of-control per manager. */
  router.get(
    '/org/span-of-control',
    asyncHandler(async (_req: Request, res: Response) => {
      const spans = await service.getSpanOfControl();
      res.json({ spans });
    }),
  );

  /** GET /api/org/vacancies — positions with unfilled headcount. */
  router.get(
    '/org/vacancies',
    asyncHandler(async (_req: Request, res: Response) => {
      const vacancies = await service.getVacantPositions();
      res.json({ vacancies });
    }),
  );

  /** GET /api/org/flight-risk — flight risk scores (optional ?email= or ?groupId=). */
  router.get(
    '/org/flight-risk',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      const groupId = req.query.groupId as string | undefined;

      const scores = await service.computeFlightRisk({
        email: email?.toLowerCase().trim(),
        groupId,
      });
      res.json({ scores });
    }),
  );

  return router;
}

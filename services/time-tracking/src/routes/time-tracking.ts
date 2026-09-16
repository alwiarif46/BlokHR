import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { TimeTrackingService, Actor } from '../services/time-tracking-service';
import { resolveInternalSecret } from '../internal-auth';
import { guardRoutes, type Role, type StaffClaims } from '../role-guard';
import { TIME_TRACKING_ROUTE_POLICIES } from '../route-policies';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function actorFrom(req: Request): Actor | null {
  const staff = (req as Request & { staff?: StaffClaims }).staff;
  if (!staff || !('ok' in staff) || !staff.ok) return null;
  return { email: staff.email, role: staff.role };
}

function parseIntegerId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseBoolQuery(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  const s = String(raw).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function optString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function sendError(res: Response, status: number | undefined, error: string): void {
  res.status(status ?? 400).json({ error });
}

export function createTimeTrackingRouter(
  service: TimeTrackingService,
  opts: { internalSecret?: string } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts.internalSecret ?? resolveInternalSecret();
  guardRoutes(router, TIME_TRACKING_ROUTE_POLICIES, { internalSecret });

  // ── Clients ─────────────────────────────────────────────────────────
  router.get(
    '/:tenantId/clients',
    asyncHandler(async (req, res) => {
      const includeInactive = parseBoolQuery(req.query.include_inactive) === true;
      const clients = await service.getClients(req.params.tenantId, includeInactive);
      res.json({ clients });
    }),
  );

  router.post(
    '/:tenantId/clients',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const rawId = optString(body.id);
      const result = await service.createClient(req.params.tenantId, {
        id: rawId ?? uuidv4(),
        name: String(body.name ?? ''),
        code: optString(body.code),
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
        currency: optString(body.currency),
        contactName: optString(body.contactName),
        contactEmail: optString(body.contactEmail),
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.status(201).json(result.client);
    }),
  );

  router.put(
    '/:tenantId/clients/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateClient(req.params.tenantId, req.params.id, {
        name: optString(body.name),
        code: body.code !== undefined ? String(body.code) : undefined,
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
        currency: optString(body.currency),
        contactName: body.contactName !== undefined ? String(body.contactName) : undefined,
        contactEmail: body.contactEmail !== undefined ? String(body.contactEmail) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.json(result.client);
    }),
  );

  // ── Projects ────────────────────────────────────────────────────────
  router.get(
    '/:tenantId/projects',
    asyncHandler(async (req, res) => {
      const clientId = optString(req.query.client_id) ?? optString(req.query.clientId);
      const projects = await service.getProjects(req.params.tenantId, clientId);
      res.json({ projects });
    }),
  );

  router.post(
    '/:tenantId/projects',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const rawId = optString(body.id);
      const result = await service.createProject(req.params.tenantId, {
        id: rawId ?? uuidv4(),
        clientId: String(body.clientId ?? body.client_id ?? ''),
        name: String(body.name ?? ''),
        code: optString(body.code),
        billable: body.billable !== undefined ? Boolean(body.billable) : undefined,
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
        budgetHours: body.budgetHours !== undefined ? Number(body.budgetHours) : undefined,
        budgetAmount: body.budgetAmount !== undefined ? Number(body.budgetAmount) : undefined,
        startDate: optString(body.startDate),
        endDate: optString(body.endDate),
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.status(201).json(result.project);
    }),
  );

  router.put(
    '/:tenantId/projects/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateProject(req.params.tenantId, req.params.id, {
        name: optString(body.name),
        code: body.code !== undefined ? String(body.code) : undefined,
        clientId: optString(body.clientId ?? body.client_id),
        billable: body.billable !== undefined ? Boolean(body.billable) : undefined,
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
        budgetHours: body.budgetHours !== undefined ? Number(body.budgetHours) : undefined,
        budgetAmount: body.budgetAmount !== undefined ? Number(body.budgetAmount) : undefined,
        status: optString(body.status),
        startDate: body.startDate !== undefined ? String(body.startDate) : undefined,
        endDate: body.endDate !== undefined ? String(body.endDate) : undefined,
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.json(result.project);
    }),
  );

  // ── Time entries ────────────────────────────────────────────────────
  router.get(
    '/:tenantId/time-entries',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const entries = await service.getEntries(req.params.tenantId, actor, {
        email: optString(req.query.email),
        projectId: optString(req.query.project_id) ?? optString(req.query.projectId),
        startDate: optString(req.query.start_date) ?? optString(req.query.startDate),
        endDate: optString(req.query.end_date) ?? optString(req.query.endDate),
        billable: parseBoolQuery(req.query.billable),
      });
      res.json({ entries });
    }),
  );

  router.post(
    '/:tenantId/time-entries',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const result = await service.logTime(req.params.tenantId, actor, {
        email: optString(body.email),
        projectId: String(body.projectId ?? body.project_id ?? ''),
        date: String(body.date ?? ''),
        hours: Number(body.hours),
        description: body.description !== undefined ? String(body.description) : undefined,
        billable: body.billable !== undefined ? Boolean(body.billable) : undefined,
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.status(201).json(result.entry);
    }),
  );

  router.put(
    '/:tenantId/time-entries/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const id = parseIntegerId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid entry id' });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const result = await service.updateEntry(req.params.tenantId, actor, id, {
        hours: body.hours !== undefined ? Number(body.hours) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        billable: body.billable !== undefined ? Boolean(body.billable) : undefined,
        billingRate: body.billingRate !== undefined ? Number(body.billingRate) : undefined,
        projectId: optString(body.projectId ?? body.project_id),
        date: body.date !== undefined ? String(body.date) : undefined,
      });
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.json(result.entry);
    }),
  );

  router.delete(
    '/:tenantId/time-entries/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const id = parseIntegerId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid entry id' });
        return;
      }
      const result = await service.deleteEntry(req.params.tenantId, actor, id);
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.json({ ok: true, id: result.deletedId });
    }),
  );

  router.post(
    '/:tenantId/time-entries/:id/approve',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const id = parseIntegerId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid entry id' });
        return;
      }
      const result = await service.approveEntry(req.params.tenantId, actor, id);
      if (!result.success) {
        sendError(res, result.status, result.error);
        return;
      }
      res.json(result.entry);
    }),
  );

  // ── Summary ─────────────────────────────────────────────────────────
  router.get(
    '/:tenantId/time-summary',
    asyncHandler(async (req, res) => {
      const actor = actorFrom(req);
      if (!actor) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const summary = await service.getSummary(req.params.tenantId, actor, {
        email: optString(req.query.email),
        projectId: optString(req.query.project_id) ?? optString(req.query.projectId),
        clientId: optString(req.query.client_id) ?? optString(req.query.clientId),
        startDate: optString(req.query.start_date) ?? optString(req.query.startDate),
        endDate: optString(req.query.end_date) ?? optString(req.query.endDate),
      });
      res.json(summary);
    }),
  );

  return router;
}

// Re-exported for callers who need direct access to actor typing.
export type { Actor, Role };

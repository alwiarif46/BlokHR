import { Router, Request, Response, NextFunction } from 'express';
import type { OvertimeService } from '../services/overtime-service';
import { guardRoutes, type StaffClaims } from '../role-guard';
import { OVERTIME_ROUTE_POLICIES } from '../route-policies';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function staffOf(req: Request): Extract<StaffClaims, { ok: true }> | undefined {
  const claims = (req as Request & { staff?: StaffClaims }).staff;
  if (claims && 'ok' in claims && claims.ok === true) return claims;
  return undefined;
}

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function createOvertimeRouter(
  service: OvertimeService,
  opts: { internalSecret: string },
): Router {
  const router = Router({ mergeParams: true });
  guardRoutes(router, OVERTIME_ROUTE_POLICIES, {
    internalSecret: opts.internalSecret,
  });

  // ─── records: mine ───────────────────────────────────────────────

  router.get(
    '/:tenantId/records/mine',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const start = req.query.start ? String(req.query.start) : undefined;
      const end = req.query.end ? String(req.query.end) : undefined;
      const items = await service.getByEmail(
        req.params.tenantId,
        staff.email,
        start,
        end,
      );
      res.json({ items, records: items });
    }),
  );

  router.get(
    '/:tenantId/summary/mine',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const start = String(req.query.start ?? '1970-01-01');
      const end = String(req.query.end ?? '9999-12-31');
      const summary = await service.getSummary(
        req.params.tenantId,
        staff.email,
        start,
        end,
      );
      res.json(summary);
    }),
  );

  // ─── records: log manual ─────────────────────────────────────────

  router.post(
    '/:tenantId/records',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const body = (req.body ?? {}) as {
        email?: string;
        date?: string;
        otMinutes?: number;
        otType?: string;
      };
      const targetEmail =
        typeof body.email === 'string' && body.email
          ? body.email
          : staff.email;
      const isSelf =
        targetEmail.toLowerCase() === staff.email.toLowerCase();
      const canLogOthers =
        staff.role === 'admin' ||
        staff.role === 'hr' ||
        staff.role === 'manager';
      if (!isSelf && !canLogOthers) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const result = await service.logManual({
        tenantId: req.params.tenantId,
        email: targetEmail,
        date: String(body.date ?? ''),
        otMinutes: Number(body.otMinutes ?? 0),
        otType: body.otType,
      });
      if (!result.success) {
        const status =
          result.code === 'prior_approval_required'
            ? 403
            : result.code === 'ot_disabled'
              ? 409
              : 400;
        res.status(status).json({ error: result.error, code: result.code });
        return;
      }
      res.status(201).json(result.record);
    }),
  );

  // ─── records: manager visibility ────────────────────────────────

  router.get(
    '/:tenantId/records/by-email/:email',
    asyncHandler(async (req, res) => {
      const start = req.query.start ? String(req.query.start) : undefined;
      const end = req.query.end ? String(req.query.end) : undefined;
      const items = await service.getByEmail(
        req.params.tenantId,
        req.params.email,
        start,
        end,
      );
      res.json({ items, records: items });
    }),
  );

  router.get(
    '/:tenantId/summary/by-email/:email',
    asyncHandler(async (req, res) => {
      const start = String(req.query.start ?? '1970-01-01');
      const end = String(req.query.end ?? '9999-12-31');
      const summary = await service.getSummary(
        req.params.tenantId,
        req.params.email,
        start,
        end,
      );
      res.json(summary);
    }),
  );

  router.get(
    '/:tenantId/records/pending',
    asyncHandler(async (req, res) => {
      const items = await service.getPending(req.params.tenantId);
      res.json({ items, records: items });
    }),
  );

  router.post(
    '/:tenantId/records/:id/approve',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const id = toInt(req.params.id, 0);
      if (!id) {
        res.status(400).json({ error: 'Invalid record id' });
        return;
      }
      const result = await service.approve(req.params.tenantId, id, staff.email);
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result.record);
    }),
  );

  router.post(
    '/:tenantId/records/:id/reject',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const id = toInt(req.params.id, 0);
      if (!id) {
        res.status(400).json({ error: 'Invalid record id' });
        return;
      }
      const reason = String((req.body ?? {}).reason ?? '');
      const result = await service.reject(
        req.params.tenantId,
        id,
        staff.email,
        reason,
      );
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result.record);
    }),
  );

  // ─── detect ──────────────────────────────────────────────────────

  router.post(
    '/:tenantId/detect',
    asyncHandler(async (req, res) => {
      const date = String((req.body ?? {}).date ?? '');
      if (!date) {
        res.status(400).json({ error: 'Date is required' });
        return;
      }
      const result = await service.detectForDate(req.params.tenantId, date);
      res.json(result);
    }),
  );

  // ─── policy ──────────────────────────────────────────────────────

  router.get(
    '/:tenantId/policy',
    asyncHandler(async (req, res) => {
      const policy = await service.getPolicy(req.params.tenantId);
      res.json(policy);
    }),
  );

  router.put(
    '/:tenantId/policy',
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      const keys = [
        'otEnabled',
        'dailyThresholdMinutes',
        'weeklyThresholdMinutes',
        'multiplier',
        'holidayMultiplier',
        'requiresApproval',
        'requiresPriorApproval',
        'maxDailyMinutes',
        'maxQuarterlyHours',
      ];
      for (const k of keys) {
        if (k in body) patch[k] = body[k];
      }
      const policy = await service.updatePolicy(req.params.tenantId, patch);
      res.json(policy);
    }),
  );

  // ─── requests ────────────────────────────────────────────────────

  router.post(
    '/:tenantId/requests',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const body = (req.body ?? {}) as {
        email?: string;
        name?: string;
        date?: string;
        plannedHours?: number;
        reason?: string;
      };
      const target =
        typeof body.email === 'string' && body.email
          ? body.email
          : staff.email;
      const isSelf = target.toLowerCase() === staff.email.toLowerCase();
      const canOnBehalf =
        staff.role === 'admin' ||
        staff.role === 'hr' ||
        staff.role === 'manager';
      if (!isSelf && !canOnBehalf) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const result = await service.createRequest({
        tenantId: req.params.tenantId,
        email: target,
        name: body.name,
        date: String(body.date ?? ''),
        plannedHours: Number(body.plannedHours ?? 0),
        reason: body.reason,
      });
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(201).json(result.request);
    }),
  );

  router.get(
    '/:tenantId/requests/mine',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const items = await service.listRequests(req.params.tenantId, {
        email: staff.email,
      });
      res.json({ items });
    }),
  );

  router.get(
    '/:tenantId/requests',
    asyncHandler(async (req, res) => {
      const status = req.query.status ? String(req.query.status) : undefined;
      const email = req.query.email ? String(req.query.email) : undefined;
      const items = await service.listRequests(req.params.tenantId, {
        status,
        email,
      });
      res.json({ items });
    }),
  );

  router.post(
    '/:tenantId/requests/:id/approve',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const result = await service.approveRequest(
        req.params.tenantId,
        req.params.id,
        staff.email,
      );
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result.request);
    }),
  );

  router.post(
    '/:tenantId/requests/:id/reject',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const reason = String((req.body ?? {}).reason ?? '');
      const result = await service.rejectRequest(
        req.params.tenantId,
        req.params.id,
        staff.email,
        reason,
      );
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result.request);
    }),
  );

  // ─── internal compensation sync ─────────────────────────────────

  router.post(
    '/:tenantId/internal/compensation',
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as {
        rows?: Array<{
          email: string;
          basicSalary?: number;
          da?: number;
          shiftStart?: string;
          shiftEnd?: string;
          name?: string;
        }>;
      };
      const rows = Array.isArray(body.rows) ? body.rows : [];
      let upserted = 0;
      for (const r of rows) {
        if (!r || typeof r.email !== 'string' || !r.email) continue;
        await service.upsertCompensation({
          tenantId: req.params.tenantId,
          email: r.email,
          basicSalary: Number(r.basicSalary ?? 0),
          da: Number(r.da ?? 0),
          shiftStart: r.shiftStart ?? '09:00',
          shiftEnd: r.shiftEnd ?? '18:00',
          name: r.name ?? '',
        });
        upserted++;
      }
      res.json({ upserted });
    }),
  );

  return router;
}

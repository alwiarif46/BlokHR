import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import type { SseBroadcaster } from '../sse/broadcaster';

interface FlowRow {
  [key: string]: unknown;
  id: string;
  entity_type: string;
  auto_escalation_enabled: number;
  auto_escalation_hours: number;
}

interface StepRow {
  [key: string]: unknown;
  id: string;
  flow_id: string;
  level: number;
  role: string;
  escalate_after_hours: number;
}

export function createApprovalFlowsRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function requireAdmin(email: string): Promise<void> {
    const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
      email,
    ]);
    if (!row) throw new AppError('Admin access required', 403);
  }

  async function requireFlow(id: string): Promise<FlowRow> {
    const row = await db.get<FlowRow>('SELECT * FROM approval_flows WHERE id = ?', [id]);
    if (!row) throw new AppError('Approval flow not found', 404);
    return row;
  }

  // ── GET /api/approval-flows ───────────────────────────────────────────────
  // CHUNK 1 END / CHUNK 2 START

  /** GET /api/approval-flows — all flows with their steps joined. */
  router.get(
    '/approval-flows',
    asyncHandler(async (_req: Request, res: Response) => {
      const flows = await db.all<FlowRow>(
        'SELECT id, entity_type, auto_escalation_enabled, auto_escalation_hours FROM approval_flows ORDER BY entity_type',
      );
      const steps = await db.all<StepRow>(
        'SELECT id, flow_id, level, role, escalate_after_hours FROM approval_steps ORDER BY flow_id, level',
      );
      const stepsByFlow = new Map<string, StepRow[]>();
      for (const s of steps) {
        if (!stepsByFlow.has(s.flow_id)) stepsByFlow.set(s.flow_id, []);
        stepsByFlow.get(s.flow_id)!.push(s);
      }
      res.json({
        flows: flows.map((f) => ({
          ...f,
          auto_escalation_enabled: f.auto_escalation_enabled === 1,
          steps: stepsByFlow.get(f.id) ?? [],
        })),
      });
    }),
  );

  // ── PUT /api/approval-flows/:id ───────────────────────────────────────────
  // CHUNK 2 END / CHUNK 3 START

  /** PUT /api/approval-flows/:id — update escalation settings (admin-only). */
  router.put(
    '/approval-flows/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);
      await requireFlow(req.params.id);

      const body = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      if (body.auto_escalation_enabled !== undefined) {
        sets.push('auto_escalation_enabled = ?');
        params.push(body.auto_escalation_enabled ? 1 : 0);
      }
      if (body.auto_escalation_hours !== undefined) {
        const h = Number(body.auto_escalation_hours);
        if (isNaN(h) || h < 1 || h > 168)
          throw new AppError('auto_escalation_hours must be 1–168', 400);
        sets.push('auto_escalation_hours = ?');
        params.push(h);
      }
      if (sets.length === 0) throw new AppError('No fields to update', 400);

      sets.push("updated_at = datetime('now')");
      params.push(req.params.id);
      await db.run(`UPDATE approval_flows SET ${sets.join(', ')} WHERE id = ?`, params);

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'approval_flows' });
      logger.info({ id: req.params.id, by: callerEmail }, 'Approval flow updated');
      res.json({ success: true });
    }),
  );

  // ── POST /api/approval-flows/:id/steps ───────────────────────────────────
  // CHUNK 3 END / CHUNK 4 START

  /** POST /api/approval-flows/:id/steps — add a step (auto-assigns next level). */
  router.post(
    '/approval-flows/:id/steps',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);
      await requireFlow(req.params.id);

      const body = req.body as Record<string, unknown>;
      const role = ((body.role as string) ?? 'manager').trim();
      if (!role) throw new AppError('role is required', 400);

      const escalateHours =
        body.escalate_after_hours !== undefined ? Number(body.escalate_after_hours) : 24;
      if (isNaN(escalateHours) || escalateHours < 1 || escalateHours > 168)
        throw new AppError('escalate_after_hours must be 1–168', 400);

      // Auto-assign next level
      const maxRow = await db.get<{ max_level: number | null }>(
        'SELECT MAX(level) as max_level FROM approval_steps WHERE flow_id = ?',
        [req.params.id],
      );
      const nextLevel = (maxRow?.max_level ?? 0) + 1;

      await db.run(
        'INSERT INTO approval_steps (flow_id, level, role, escalate_after_hours) VALUES (?, ?, ?, ?)',
        [req.params.id, nextLevel, role, escalateHours],
      );

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'approval_steps' });
      logger.info(
        { flowId: req.params.id, level: nextLevel, by: callerEmail },
        'Approval step added',
      );
      res.status(201).json({ success: true, level: nextLevel });
    }),
  );

  /** PUT /api/approval-flows/:id/steps/reorder — bulk reorder by step ID array. */
  router.put(
    '/approval-flows/:id/steps/reorder',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);
      await requireFlow(req.params.id);

      const body = req.body as Record<string, unknown>;
      const stepIds = body.stepIds as string[] | undefined;
      if (!Array.isArray(stepIds) || stepIds.length === 0)
        throw new AppError('stepIds array is required', 400);

      // Validate all step IDs belong to this flow
      const existing = await db.all<{ id: string }>(
        'SELECT id FROM approval_steps WHERE flow_id = ?',
        [req.params.id],
      );
      const existingSet = new Set(existing.map((r) => r.id));
      for (const sid of stepIds) {
        if (!existingSet.has(sid)) throw new AppError(`Step ${sid} not in this flow`, 400);
      }

      // Fetch current step data, then atomically delete + re-insert in new order
      // This avoids UNIQUE(flow_id, level) collision and the CHECK level >= 1 constraint
      const stepData = await db.all<{ id: string; role: string; escalate_after_hours: number }>(
        'SELECT id, role, escalate_after_hours FROM approval_steps WHERE flow_id = ?',
        [req.params.id],
      );
      const stepMap = new Map(stepData.map((s) => [s.id, s]));

      await db.run('DELETE FROM approval_steps WHERE flow_id = ?', [req.params.id]);
      for (let i = 0; i < stepIds.length; i++) {
        const s = stepMap.get(stepIds[i])!;
        await db.run(
          'INSERT INTO approval_steps (id, flow_id, level, role, escalate_after_hours) VALUES (?, ?, ?, ?, ?)',
          [s.id, req.params.id, i + 1, s.role, s.escalate_after_hours],
        );
      }

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'approval_steps' });
      res.json({ success: true });
    }),
  );

  /** PUT /api/approval-flows/:id/steps/:stepId — update a step. */
  router.put(
    '/approval-flows/:id/steps/:stepId',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const step = await db.get<StepRow>(
        'SELECT * FROM approval_steps WHERE id = ? AND flow_id = ?',
        [req.params.stepId, req.params.id],
      );
      if (!step) throw new AppError('Step not found', 404);

      const body = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      if (body.role !== undefined) {
        const role = ((body.role as string) ?? '').trim();
        if (!role) throw new AppError('role cannot be empty', 400);
        sets.push('role = ?');
        params.push(role);
      }
      if (body.escalate_after_hours !== undefined) {
        const h = Number(body.escalate_after_hours);
        if (isNaN(h) || h < 1 || h > 168)
          throw new AppError('escalate_after_hours must be 1–168', 400);
        sets.push('escalate_after_hours = ?');
        params.push(h);
      }
      if (sets.length === 0) throw new AppError('No fields to update', 400);

      sets.push("updated_at = datetime('now')");
      params.push(req.params.stepId);
      await db.run(`UPDATE approval_steps SET ${sets.join(', ')} WHERE id = ?`, params);

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'approval_steps' });
      res.json({ success: true });
    }),
  );

  // ── DELETE + REORDER ──────────────────────────────────────────────────────
  // CHUNK 4 END / CHUNK 5 START

  /** DELETE /api/approval-flows/:id/steps/:stepId — delete a step, renumber remaining. */
  router.delete(
    '/approval-flows/:id/steps/:stepId',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const step = await db.get<StepRow>(
        'SELECT * FROM approval_steps WHERE id = ? AND flow_id = ?',
        [req.params.stepId, req.params.id],
      );
      if (!step) throw new AppError('Step not found', 404);

      await db.run('DELETE FROM approval_steps WHERE id = ?', [req.params.stepId]);

      // Renumber remaining steps by current order
      const remaining = await db.all<{ id: string }>(
        'SELECT id FROM approval_steps WHERE flow_id = ? ORDER BY level',
        [req.params.id],
      );
      for (let i = 0; i < remaining.length; i++) {
        await db.run('UPDATE approval_steps SET level = ? WHERE id = ?', [i + 1, remaining[i].id]);
      }

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'approval_steps' });
      logger.info({ stepId: req.params.stepId, by: callerEmail }, 'Approval step deleted');
      res.json({ success: true });
    }),
  );

  return router;
}

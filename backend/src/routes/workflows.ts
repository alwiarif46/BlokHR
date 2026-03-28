import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { EventBus } from '../events';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { WorkflowService } from '../services/workflow-service';

export function createWorkflowRouter(
  db: DatabaseEngine,
  logger: Logger,
  eventBus?: EventBus,
): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new WorkflowService(db, logger, auditService, eventBus);

  // ── Definitions ──
  router.post(
    '/workflows',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { name, description, triggerType, triggerConfig, steps } = req.body as Record<
        string,
        unknown
      >;
      if (!name) throw new AppError('name is required', 400);
      const result = await service.createWorkflow(
        {
          name: name as string,
          description: description as string | undefined,
          triggerType: triggerType as string | undefined,
          triggerConfig: triggerConfig as Record<string, unknown> | undefined,
          steps: steps as { type: 'approval'; config: Record<string, unknown> }[] | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ workflow: result.data });
    }),
  );

  router.get(
    '/workflows',
    asyncHandler(async (req: Request, res: Response) => {
      const activeOnly = req.query.active === 'true';
      const workflows = await service.listWorkflows(activeOnly || undefined);
      res.json({ workflows });
    }),
  );

  router.get(
    '/workflows/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const workflow = await service.getWorkflowById(req.params.id);
      if (!workflow) throw new AppError('Workflow not found', 404);
      res.json({ workflow });
    }),
  );

  router.put(
    '/workflows/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.updateWorkflow(
        req.params.id,
        req.body as Record<string, unknown>,
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/workflows/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteWorkflow(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Execution ──
  router.post(
    '/workflows/:id/trigger',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const triggerData = (req.body as { triggerData?: Record<string, unknown> }).triggerData ?? {};
      const result = await service.triggerWorkflow(req.params.id, triggerData, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ instance: result.data });
    }),
  );

  router.get(
    '/workflow-instances',
    asyncHandler(async (req: Request, res: Response) => {
      const workflowId = req.query.workflowId as string | undefined;
      const status = req.query.status as string | undefined;
      const instances = await service.listInstances({ workflowId, status });
      res.json({ instances });
    }),
  );

  router.get(
    '/workflow-instances/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const instance = await service.getInstanceById(req.params.id);
      if (!instance) throw new AppError('Instance not found', 404);
      res.json({ instance });
    }),
  );

  router.post(
    '/workflow-instances/:id/advance',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.advanceInstance(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/workflow-instances/:id/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.cancelInstance(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Forms ──
  router.post(
    '/workflow-forms',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { name, fieldsJson, workflowId } = req.body as {
        name?: string;
        fieldsJson?: string;
        workflowId?: string;
      };
      if (!name) throw new AppError('name is required', 400);
      const result = await service.createForm(
        { name, fieldsJson: fieldsJson ?? '[]', workflowId },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ form: result.data });
    }),
  );

  router.get(
    '/workflow-forms',
    asyncHandler(async (_req: Request, res: Response) => {
      const forms = await service.listForms();
      res.json({ forms });
    }),
  );

  router.get(
    '/workflow-forms/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const form = await service.getFormById(req.params.id);
      if (!form) throw new AppError('Form not found', 404);
      res.json({ form });
    }),
  );

  router.delete(
    '/workflow-forms/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteForm(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/workflow-forms/:id/submit',
    asyncHandler(async (req: Request, res: Response) => {
      const submitter = req.identity?.email ?? '';
      const { data, workflowInstanceId } = req.body as {
        data?: Record<string, unknown>;
        workflowInstanceId?: string;
      };
      const result = await service.submitForm(
        req.params.id,
        submitter,
        data ?? {},
        workflowInstanceId,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ submission: result.data });
    }),
  );

  router.get(
    '/workflow-forms/:id/submissions',
    asyncHandler(async (req: Request, res: Response) => {
      const submissions = await service.getFormSubmissions(req.params.id);
      res.json({ submissions });
    }),
  );

  return router;
}

import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import type { EventBus } from '../events';
import {
  WorkflowRepository,
  type WorkflowRow,
  type WorkflowInstanceRow,
  type FormDefinitionRow,
  type FormSubmissionRow,
} from '../repositories/workflow-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

interface WorkflowStep {
  type:
    | 'approval'
    | 'notification'
    | 'create_task'
    | 'update_field'
    | 'conditional_branch'
    | 'delay';
  config: Record<string, unknown>;
  deadline_hours?: number;
}

const VALID_TRIGGER_TYPES = ['manual', 'event', 'scheduled'];

export class WorkflowService {
  private readonly repo: WorkflowRepository;

  constructor(
    db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
    private readonly eventBus?: EventBus,
  ) {
    this.repo = new WorkflowRepository(db);
  }

  // ── Definitions ──

  async createWorkflow(
    data: {
      name: string;
      description?: string;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      steps?: WorkflowStep[];
    },
    actorEmail: string,
  ): Promise<ServiceResult<WorkflowRow>> {
    if (!data.name?.trim()) return { success: false, error: 'Workflow name is required' };
    if (data.triggerType && !VALID_TRIGGER_TYPES.includes(data.triggerType)) {
      return {
        success: false,
        error: `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
      };
    }

    const workflow = await this.repo.createWorkflow({
      name: data.name.trim(),
      description: data.description,
      triggerType: data.triggerType,
      triggerConfigJson: data.triggerConfig ? JSON.stringify(data.triggerConfig) : '{}',
      stepsJson: data.steps ? JSON.stringify(data.steps) : '[]',
      createdBy: actorEmail,
    });

    this.logger.info(
      { workflowId: workflow.id, name: workflow.name, actor: actorEmail },
      'Workflow created',
    );
    this.logAudit('workflow', workflow.id, 'created', actorEmail, {
      name: workflow.name,
      triggerType: workflow.trigger_type,
    });

    // If event-triggered, register listener
    if (workflow.trigger_type === 'event' && this.eventBus) {
      this.registerEventTrigger(workflow);
    }

    return { success: true, data: workflow };
  }

  async updateWorkflow(
    id: string,
    fields: {
      name?: string;
      description?: string;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      steps?: WorkflowStep[];
      active?: boolean;
    },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getWorkflowById(id);
    if (!existing) return { success: false, error: 'Workflow not found' };

    const dbFields: Record<string, unknown> = {};
    if (fields.name !== undefined) dbFields.name = fields.name.trim();
    if (fields.description !== undefined) dbFields.description = fields.description;
    if (fields.triggerType !== undefined) dbFields.trigger_type = fields.triggerType;
    if (fields.triggerConfig !== undefined)
      dbFields.trigger_config_json = JSON.stringify(fields.triggerConfig);
    if (fields.steps !== undefined) dbFields.steps_json = JSON.stringify(fields.steps);
    if (fields.active !== undefined) dbFields.active = fields.active ? 1 : 0;

    await this.repo.updateWorkflow(id, dbFields as Parameters<typeof this.repo.updateWorkflow>[1]);
    this.logAudit('workflow', id, 'updated', actorEmail, dbFields);
    return { success: true };
  }

  async deleteWorkflow(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getWorkflowById(id);
    if (!existing) return { success: false, error: 'Workflow not found' };
    await this.repo.deleteWorkflow(id);
    this.logAudit('workflow', id, 'deleted', actorEmail, { name: existing.name });
    return { success: true };
  }

  async getWorkflowById(id: string): Promise<WorkflowRow | null> {
    return this.repo.getWorkflowById(id);
  }
  async listWorkflows(activeOnly?: boolean): Promise<WorkflowRow[]> {
    return this.repo.listWorkflows(activeOnly);
  }

  // ── Execution ──

  async triggerWorkflow(
    workflowId: string,
    triggerData: Record<string, unknown>,
    startedBy: string,
  ): Promise<ServiceResult<WorkflowInstanceRow>> {
    const workflow = await this.repo.getWorkflowById(workflowId);
    if (!workflow) return { success: false, error: 'Workflow not found' };
    if (!workflow.active) return { success: false, error: 'Workflow is not active' };

    const instance = await this.repo.createInstance({
      workflowId,
      triggerDataJson: JSON.stringify(triggerData),
      startedBy,
    });

    this.logger.info(
      { instanceId: instance.id, workflowId, startedBy },
      'Workflow instance started',
    );
    this.logAudit('workflow_instance', instance.id, 'started', startedBy, { workflowId });

    // Execute first step
    await this.advanceInstance(instance.id);

    return { success: true, data: instance };
  }

  async advanceInstance(instanceId: string): Promise<ServiceResult> {
    const instance = await this.repo.getInstanceById(instanceId);
    if (!instance) return { success: false, error: 'Instance not found' };
    if (instance.status !== 'running') return { success: false, error: 'Instance is not running' };

    let steps: WorkflowStep[] = [];
    try {
      steps = JSON.parse(
        instance.step_history_json === '[]'
          ? ((await this.repo.getWorkflowById(instance.workflow_id))?.steps_json ?? '[]')
          : '[]',
      ) as WorkflowStep[];
    } catch {
      /* empty */
    }

    // If we parsed from step_history that means we already have the steps from the workflow
    if (steps.length === 0) {
      const workflow = await this.repo.getWorkflowById(instance.workflow_id);
      if (!workflow) return { success: false, error: 'Workflow definition not found' };
      try {
        steps = JSON.parse(workflow.steps_json) as WorkflowStep[];
      } catch {
        steps = [];
      }
    }

    if (instance.current_step >= steps.length) {
      // All steps done
      await this.repo.updateInstance(instanceId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      this.logger.info({ instanceId }, 'Workflow instance completed');
      return { success: true };
    }

    const step = steps[instance.current_step];
    const history: Record<string, unknown>[] = JSON.parse(
      instance.step_history_json || '[]',
    ) as Record<string, unknown>[];
    history.push({
      step: instance.current_step,
      type: step.type,
      executedAt: new Date().toISOString(),
      config: step.config,
    });

    // Move to next step
    const nextStep = instance.current_step + 1;
    const isComplete = nextStep >= steps.length;
    await this.repo.updateInstance(instanceId, {
      current_step: nextStep,
      step_history_json: JSON.stringify(history),
      ...(isComplete
        ? { status: 'completed' as const, completed_at: new Date().toISOString() }
        : {}),
    });

    if (isComplete) {
      this.logger.info({ instanceId }, 'Workflow instance completed');
    } else {
      this.logger.info(
        { instanceId, step: instance.current_step, type: step.type },
        'Workflow step executed',
      );
    }
    return { success: true };
  }

  async cancelInstance(instanceId: string, actorEmail: string): Promise<ServiceResult> {
    const instance = await this.repo.getInstanceById(instanceId);
    if (!instance) return { success: false, error: 'Instance not found' };
    if (instance.status !== 'running') return { success: false, error: 'Instance is not running' };

    await this.repo.updateInstance(instanceId, {
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    });
    this.logAudit('workflow_instance', instanceId, 'cancelled', actorEmail, {});
    return { success: true };
  }

  async getInstanceById(id: string): Promise<WorkflowInstanceRow | null> {
    return this.repo.getInstanceById(id);
  }
  async listInstances(filters?: {
    workflowId?: string;
    status?: string;
  }): Promise<WorkflowInstanceRow[]> {
    return this.repo.listInstances(filters);
  }

  // ── Forms ──

  async createForm(
    data: { name: string; fieldsJson: string; workflowId?: string | null },
    actorEmail: string,
  ): Promise<ServiceResult<FormDefinitionRow>> {
    if (!data.name?.trim()) return { success: false, error: 'Form name is required' };
    const form = await this.repo.createForm({
      ...data,
      name: data.name.trim(),
      createdBy: actorEmail,
    });
    this.logAudit('form_definition', form.id, 'created', actorEmail, { name: form.name });
    return { success: true, data: form };
  }

  async getFormById(id: string): Promise<FormDefinitionRow | null> {
    return this.repo.getFormById(id);
  }
  async listForms(): Promise<FormDefinitionRow[]> {
    return this.repo.listForms();
  }

  async deleteForm(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getFormById(id);
    if (!existing) return { success: false, error: 'Form not found' };
    await this.repo.deleteForm(id);
    this.logAudit('form_definition', id, 'deleted', actorEmail, { name: existing.name });
    return { success: true };
  }

  async submitForm(
    formId: string,
    submittedBy: string,
    data: Record<string, unknown>,
    workflowInstanceId?: string,
  ): Promise<ServiceResult<FormSubmissionRow>> {
    const form = await this.repo.getFormById(formId);
    if (!form) return { success: false, error: 'Form not found' };

    const submission = await this.repo.submitForm({
      formId,
      submittedBy,
      dataJson: JSON.stringify(data),
      workflowInstanceId: workflowInstanceId ?? null,
    });
    this.logAudit('form_submission', submission.id, 'submitted', submittedBy, { formId });
    return { success: true, data: submission };
  }

  async getFormSubmissions(formId: string): Promise<FormSubmissionRow[]> {
    return this.repo.getFormSubmissions(formId);
  }

  // ── Event triggers ──

  private registerEventTrigger(workflow: WorkflowRow): void {
    if (!this.eventBus) return;
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(workflow.trigger_config_json) as Record<string, unknown>;
    } catch {
      /* empty */
    }
    const eventName = config.eventName as string | undefined;
    if (!eventName) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.eventBus.on(eventName as any, (payload: Record<string, unknown>) => {
      this.triggerWorkflow(workflow.id, payload, 'system:event-trigger').catch((err) => {
        this.logger.error(
          { err, workflowId: workflow.id, eventName },
          'Event-triggered workflow failed',
        );
      });
    });
    this.logger.info({ workflowId: workflow.id, eventName }, 'Registered event trigger');
  }

  /** Re-register all event-triggered workflows (called on startup). */
  async registerAllEventTriggers(): Promise<void> {
    if (!this.eventBus) return;
    const workflows = await this.repo.getWorkflowsByTrigger('event');
    for (const wf of workflows) {
      this.registerEventTrigger(wf);
    }
    this.logger.info({ count: workflows.length }, 'Registered event-triggered workflows');
  }

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}

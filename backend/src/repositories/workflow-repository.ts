import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface WorkflowRow {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config_json: string;
  steps_json: string;
  active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstanceRow {
  [key: string]: unknown;
  id: string;
  workflow_id: string;
  trigger_data_json: string;
  current_step: number;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  step_history_json: string;
  created_at: string;
  updated_at: string;
}

export interface FormDefinitionRow {
  [key: string]: unknown;
  id: string;
  name: string;
  fields_json: string;
  workflow_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormSubmissionRow {
  [key: string]: unknown;
  id: string;
  form_id: string;
  submitted_by: string;
  data_json: string;
  workflow_instance_id: string | null;
  created_at: string;
}

export class WorkflowRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Workflow definitions ──

  async createWorkflow(data: {
    name: string;
    description?: string;
    triggerType?: string;
    triggerConfigJson?: string;
    stepsJson?: string;
    createdBy: string;
  }): Promise<WorkflowRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO workflows (id, name, description, trigger_type, trigger_config_json, steps_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description ?? '',
        data.triggerType ?? 'manual',
        data.triggerConfigJson ?? '{}',
        data.stepsJson ?? '[]',
        data.createdBy,
      ],
    );
    const row = await this.db.get<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create workflow');
    return row;
  }

  async getWorkflowById(id: string): Promise<WorkflowRow | null> {
    return this.db.get<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
  }

  async listWorkflows(activeOnly?: boolean): Promise<WorkflowRow[]> {
    if (activeOnly)
      return this.db.all<WorkflowRow>('SELECT * FROM workflows WHERE active = 1 ORDER BY name ASC');
    return this.db.all<WorkflowRow>('SELECT * FROM workflows ORDER BY name ASC');
  }

  async updateWorkflow(
    id: string,
    fields: Partial<
      Pick<
        WorkflowRow,
        'name' | 'description' | 'trigger_type' | 'trigger_config_json' | 'steps_json' | 'active'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.db.run('DELETE FROM workflows WHERE id = ?', [id]);
  }

  async getWorkflowsByTrigger(triggerType: string, eventName?: string): Promise<WorkflowRow[]> {
    if (eventName) {
      return this.db.all<WorkflowRow>(
        'SELECT * FROM workflows WHERE trigger_type = ? AND active = 1 AND trigger_config_json LIKE ?',
        [triggerType, `%${eventName}%`],
      );
    }
    return this.db.all<WorkflowRow>(
      'SELECT * FROM workflows WHERE trigger_type = ? AND active = 1',
      [triggerType],
    );
  }

  // ── Instances ──

  async createInstance(data: {
    workflowId: string;
    triggerDataJson?: string;
    startedBy: string;
  }): Promise<WorkflowInstanceRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO workflow_instances (id, workflow_id, trigger_data_json, started_by)
       VALUES (?, ?, ?, ?)`,
      [id, data.workflowId, data.triggerDataJson ?? '{}', data.startedBy],
    );
    const row = await this.db.get<WorkflowInstanceRow>(
      'SELECT * FROM workflow_instances WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create workflow instance');
    return row;
  }

  async getInstanceById(id: string): Promise<WorkflowInstanceRow | null> {
    return this.db.get<WorkflowInstanceRow>('SELECT * FROM workflow_instances WHERE id = ?', [id]);
  }

  async listInstances(filters?: {
    workflowId?: string;
    status?: string;
  }): Promise<WorkflowInstanceRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters?.workflowId) {
      conditions.push('workflow_id = ?');
      params.push(filters.workflowId);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.all<WorkflowInstanceRow>(
      `SELECT * FROM workflow_instances ${where} ORDER BY started_at DESC`,
      params,
    );
  }

  async updateInstance(
    id: string,
    fields: Partial<
      Pick<WorkflowInstanceRow, 'current_step' | 'status' | 'completed_at' | 'step_history_json'>
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE workflow_instances SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  // ── Forms ──

  async createForm(data: {
    name: string;
    fieldsJson: string;
    workflowId?: string | null;
    createdBy: string;
  }): Promise<FormDefinitionRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO form_definitions (id, name, fields_json, workflow_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.fieldsJson, data.workflowId ?? null, data.createdBy],
    );
    const row = await this.db.get<FormDefinitionRow>(
      'SELECT * FROM form_definitions WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create form');
    return row;
  }

  async getFormById(id: string): Promise<FormDefinitionRow | null> {
    return this.db.get<FormDefinitionRow>('SELECT * FROM form_definitions WHERE id = ?', [id]);
  }

  async listForms(): Promise<FormDefinitionRow[]> {
    return this.db.all<FormDefinitionRow>('SELECT * FROM form_definitions ORDER BY name ASC');
  }

  async deleteForm(id: string): Promise<void> {
    await this.db.run('DELETE FROM form_definitions WHERE id = ?', [id]);
  }

  async submitForm(data: {
    formId: string;
    submittedBy: string;
    dataJson: string;
    workflowInstanceId?: string | null;
  }): Promise<FormSubmissionRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO form_submissions (id, form_id, submitted_by, data_json, workflow_instance_id) VALUES (?, ?, ?, ?, ?)',
      [id, data.formId, data.submittedBy, data.dataJson, data.workflowInstanceId ?? null],
    );
    const row = await this.db.get<FormSubmissionRow>(
      'SELECT * FROM form_submissions WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to submit form');
    return row;
  }

  async getFormSubmissions(formId: string): Promise<FormSubmissionRow[]> {
    return this.db.all<FormSubmissionRow>(
      'SELECT * FROM form_submissions WHERE form_id = ? ORDER BY created_at DESC',
      [formId],
    );
  }
}

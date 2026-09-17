import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';

export interface SurveyRow {
  [key: string]: unknown;
  id: string;
  title: string;
  description: string;
  questions_json: string;
  anonymous: number;
  recurrence: string;
  status: string;
  target_group_ids: string;
  created_by: string;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  audience: string;
  min_responses: number;
}

export interface SurveyResponseRow {
  [key: string]: unknown;
  id: string;
  survey_id: string;
  answers_json: string;
  submitted_at: string;
  subject_email: string;
}

export interface SurveyActionItemRow {
  [key: string]: unknown;
  id: string;
  survey_id: string;
  title: string;
  description: string;
  assigned_to: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyPeerAssignmentRow {
  [key: string]: unknown;
  survey_id: string;
  reviewer_email: string;
  subject_email: string;
  completed_at: string | null;
  created_at: string;
}

export class SurveyRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async createSurvey(data: {
    title: string;
    description?: string;
    questionsJson?: string;
    anonymous?: boolean;
    recurrence?: string;
    targetGroupIds?: string;
    audience?: string;
    minResponses?: number;
    createdBy: string;
  }): Promise<SurveyRow> {
    const id = uuidv4();
    const audience = data.audience === 'peer' ? 'peer' : 'employee';
    const minResponses =
      data.minResponses !== undefined
        ? data.minResponses
        : audience === 'peer'
          ? 3
          : 1;
    const tenantId = getTenantId();
    await this.db.run(
      `INSERT INTO surveys (tenant_id, id, title, description, questions_json, anonymous, recurrence, target_group_ids, created_by, audience, min_responses)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        id,
        data.title,
        data.description ?? '',
        data.questionsJson ?? '[]',
        data.anonymous !== false ? 1 : 0,
        data.recurrence ?? 'none',
        data.targetGroupIds ?? '',
        data.createdBy,
        audience,
        minResponses,
      ],
    );
    const row = await this.db.get<SurveyRow>(
      'SELECT * FROM surveys WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    if (!row) throw new Error('Failed to create survey');
    return row;
  }

  async getSurveyById(id: string): Promise<SurveyRow | null> {
    return this.db.get<SurveyRow>('SELECT * FROM surveys WHERE tenant_id = ? AND id = ?', [
      getTenantId(),
      id,
    ]);
  }

  async listSurveys(status?: string): Promise<SurveyRow[]> {
    const tenantId = getTenantId();
    if (status)
      return this.db.all<SurveyRow>(
        'SELECT * FROM surveys WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC',
        [tenantId, status],
      );
    return this.db.all<SurveyRow>(
      'SELECT * FROM surveys WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId],
    );
  }

  async updateSurvey(
    id: string,
    fields: Partial<
      Pick<
        SurveyRow,
        | 'title'
        | 'description'
        | 'questions_json'
        | 'anonymous'
        | 'recurrence'
        | 'status'
        | 'target_group_ids'
        | 'published_at'
        | 'closed_at'
        | 'audience'
        | 'min_responses'
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
    vals.push(getTenantId(), id);
    await this.db.run(`UPDATE surveys SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`, vals);
  }

  async deleteSurvey(id: string): Promise<void> {
    await this.db.run('DELETE FROM surveys WHERE tenant_id = ? AND id = ?', [getTenantId(), id]);
  }

  // ── Responses (anonymous) ──
  async submitResponse(
    surveyId: string,
    answersJson: string,
    subjectEmail = '',
  ): Promise<SurveyResponseRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO survey_responses_anonymous (id, survey_id, answers_json, subject_email) VALUES (?, ?, ?, ?)',
      [id, surveyId, answersJson, subjectEmail],
    );
    const row = await this.db.get<SurveyResponseRow>(
      'SELECT * FROM survey_responses_anonymous WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to submit response');
    return row;
  }

  async getResponses(surveyId: string, subjectEmail?: string): Promise<SurveyResponseRow[]> {
    if (subjectEmail) {
      return this.db.all<SurveyResponseRow>(
        `SELECT * FROM survey_responses_anonymous
         WHERE survey_id = ? AND subject_email = ?
         ORDER BY submitted_at DESC`,
        [surveyId, subjectEmail],
      );
    }
    return this.db.all<SurveyResponseRow>(
      'SELECT * FROM survey_responses_anonymous WHERE survey_id = ? ORDER BY submitted_at DESC',
      [surveyId],
    );
  }

  async getResponseCount(surveyId: string, subjectEmail?: string): Promise<number> {
    if (subjectEmail) {
      const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
        `SELECT COUNT(*) AS cnt FROM survey_responses_anonymous
         WHERE survey_id = ? AND subject_email = ?`,
        [surveyId, subjectEmail],
      );
      return row?.cnt ?? 0;
    }
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT COUNT(*) AS cnt FROM survey_responses_anonymous WHERE survey_id = ?',
      [surveyId],
    );
    return row?.cnt ?? 0;
  }

  async listSubjects(surveyId: string): Promise<string[]> {
    const rows = await this.db.all<{ subject_email: string; [key: string]: unknown }>(
      `SELECT DISTINCT subject_email FROM survey_responses_anonymous
       WHERE survey_id = ? AND subject_email != ''
       ORDER BY subject_email`,
      [surveyId],
    );
    return rows.map((r) => r.subject_email);
  }

  // ── Completions ──
  async markCompleted(surveyId: string, email: string): Promise<void> {
    await this.db.run('INSERT OR IGNORE INTO survey_completions (survey_id, email) VALUES (?, ?)', [
      surveyId,
      email,
    ]);
  }

  async hasCompleted(surveyId: string, email: string): Promise<boolean> {
    const row = await this.db.get<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM survey_completions WHERE survey_id = ? AND email = ?',
      [surveyId, email],
    );
    return !!row;
  }

  async getCompletionCount(surveyId: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT COUNT(*) AS cnt FROM survey_completions WHERE survey_id = ?',
      [surveyId],
    );
    return row?.cnt ?? 0;
  }

  async getPendingSurveys(email: string): Promise<SurveyRow[]> {
    const tenantId = getTenantId();
    const member = await this.db.get<{ group_id: string | null; [key: string]: unknown }>(
      'SELECT group_id FROM members WHERE tenant_id = ? AND email = ?',
      [tenantId, email],
    );
    const groupId = (member?.group_id ?? '').trim();

    // Empty target_group_ids = all employees. Otherwise require member group in the list.
    if (!groupId) {
      return this.db.all<SurveyRow>(
        `SELECT s.* FROM surveys s
         WHERE s.tenant_id = ?
           AND s.status = 'active'
           AND COALESCE(s.audience, 'employee') = 'employee'
           AND TRIM(COALESCE(s.target_group_ids, '')) = ''
           AND NOT EXISTS (
             SELECT 1 FROM survey_completions sc
             WHERE sc.survey_id = s.id AND sc.email = ?
           )
         ORDER BY s.published_at DESC`,
        [tenantId, email],
      );
    }

    return this.db.all<SurveyRow>(
      `SELECT s.* FROM surveys s
       WHERE s.tenant_id = ?
         AND s.status = 'active'
         AND COALESCE(s.audience, 'employee') = 'employee'
         AND NOT EXISTS (
           SELECT 1 FROM survey_completions sc
           WHERE sc.survey_id = s.id AND sc.email = ?
         )
         AND (
           TRIM(COALESCE(s.target_group_ids, '')) = ''
           OR (',' || REPLACE(REPLACE(s.target_group_ids, ' ', ''), ';', ',') || ',')
                LIKE '%,' || ? || ',%'
         )
       ORDER BY s.published_at DESC`,
      [tenantId, email, groupId],
    );
  }

  // ── Peer assignments ──
  async createPeerAssignments(
    surveyId: string,
    assignments: Array<{ reviewerEmail: string; subjectEmail: string }>,
  ): Promise<void> {
    for (const a of assignments) {
      await this.db.run(
        `INSERT OR IGNORE INTO survey_peer_assignments
         (survey_id, reviewer_email, subject_email) VALUES (?, ?, ?)`,
        [surveyId, a.reviewerEmail.toLowerCase(), a.subjectEmail.toLowerCase()],
      );
    }
  }

  async getPendingPeerAssignments(email: string): Promise<
    Array<SurveyRow & { subject_email: string }>
  > {
    return this.db.all<SurveyRow & { subject_email: string }>(
      `SELECT s.*, spa.subject_email AS subject_email
       FROM survey_peer_assignments spa
       INNER JOIN surveys s ON s.id = spa.survey_id AND s.tenant_id = ?
       WHERE spa.reviewer_email = ? AND spa.completed_at IS NULL AND s.status = 'active'
       ORDER BY s.published_at DESC`,
      [getTenantId(), email.toLowerCase()],
    );
  }

  async hasPeerAssignment(
    surveyId: string,
    reviewerEmail: string,
    subjectEmail: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ survey_id: string; [key: string]: unknown }>(
      `SELECT survey_id FROM survey_peer_assignments
       WHERE survey_id = ? AND reviewer_email = ? AND subject_email = ?`,
      [surveyId, reviewerEmail.toLowerCase(), subjectEmail.toLowerCase()],
    );
    return !!row;
  }

  async isPeerAssignmentComplete(
    surveyId: string,
    reviewerEmail: string,
    subjectEmail: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ completed_at: string | null; [key: string]: unknown }>(
      `SELECT completed_at FROM survey_peer_assignments
       WHERE survey_id = ? AND reviewer_email = ? AND subject_email = ?`,
      [surveyId, reviewerEmail.toLowerCase(), subjectEmail.toLowerCase()],
    );
    return !!(row && row.completed_at);
  }

  async markPeerAssignmentComplete(
    surveyId: string,
    reviewerEmail: string,
    subjectEmail: string,
  ): Promise<void> {
    await this.db.run(
      `UPDATE survey_peer_assignments
       SET completed_at = datetime('now')
       WHERE survey_id = ? AND reviewer_email = ? AND subject_email = ?`,
      [surveyId, reviewerEmail.toLowerCase(), subjectEmail.toLowerCase()],
    );
  }

  async listPeerAssignments(surveyId: string): Promise<SurveyPeerAssignmentRow[]> {
    return this.db.all<SurveyPeerAssignmentRow>(
      `SELECT * FROM survey_peer_assignments WHERE survey_id = ? ORDER BY reviewer_email, subject_email`,
      [surveyId],
    );
  }

  // ── Action items ──
  async createActionItem(data: {
    surveyId: string;
    title: string;
    description?: string;
    assignedTo?: string;
    createdBy: string;
  }): Promise<SurveyActionItemRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO survey_action_items (id, survey_id, title, description, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        data.surveyId,
        data.title,
        data.description ?? '',
        data.assignedTo ?? '',
        data.createdBy,
      ],
    );
    const row = await this.db.get<SurveyActionItemRow>(
      'SELECT * FROM survey_action_items WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create action item');
    return row;
  }

  async getActionItems(surveyId: string): Promise<SurveyActionItemRow[]> {
    return this.db.all<SurveyActionItemRow>(
      'SELECT * FROM survey_action_items WHERE survey_id = ? ORDER BY created_at DESC',
      [surveyId],
    );
  }

  async updateActionItem(
    id: string,
    fields: Partial<Pick<SurveyActionItemRow, 'title' | 'description' | 'assigned_to' | 'status'>>,
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
    await this.db.run(`UPDATE survey_action_items SET ${sets.join(', ')} WHERE id = ?`, vals);
  }
}

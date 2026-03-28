import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

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
}
export interface SurveyResponseRow {
  [key: string]: unknown;
  id: string;
  survey_id: string;
  answers_json: string;
  submitted_at: string;
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

export class SurveyRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async createSurvey(data: {
    title: string;
    description?: string;
    questionsJson?: string;
    anonymous?: boolean;
    recurrence?: string;
    targetGroupIds?: string;
    createdBy: string;
  }): Promise<SurveyRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO surveys (id, title, description, questions_json, anonymous, recurrence, target_group_ids, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description ?? '',
        data.questionsJson ?? '[]',
        data.anonymous !== false ? 1 : 0,
        data.recurrence ?? 'none',
        data.targetGroupIds ?? '',
        data.createdBy,
      ],
    );
    const row = await this.db.get<SurveyRow>('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create survey');
    return row;
  }

  async getSurveyById(id: string): Promise<SurveyRow | null> {
    return this.db.get<SurveyRow>('SELECT * FROM surveys WHERE id = ?', [id]);
  }

  async listSurveys(status?: string): Promise<SurveyRow[]> {
    if (status)
      return this.db.all<SurveyRow>(
        'SELECT * FROM surveys WHERE status = ? ORDER BY created_at DESC',
        [status],
      );
    return this.db.all<SurveyRow>('SELECT * FROM surveys ORDER BY created_at DESC');
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
    await this.db.run(`UPDATE surveys SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteSurvey(id: string): Promise<void> {
    await this.db.run('DELETE FROM surveys WHERE id = ?', [id]);
  }

  // ── Responses (anonymous) ──
  async submitResponse(surveyId: string, answersJson: string): Promise<SurveyResponseRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO survey_responses_anonymous (id, survey_id, answers_json) VALUES (?, ?, ?)',
      [id, surveyId, answersJson],
    );
    const row = await this.db.get<SurveyResponseRow>(
      'SELECT * FROM survey_responses_anonymous WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to submit response');
    return row;
  }

  async getResponses(surveyId: string): Promise<SurveyResponseRow[]> {
    return this.db.all<SurveyResponseRow>(
      'SELECT * FROM survey_responses_anonymous WHERE survey_id = ? ORDER BY submitted_at DESC',
      [surveyId],
    );
  }

  async getResponseCount(surveyId: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT COUNT(*) AS cnt FROM survey_responses_anonymous WHERE survey_id = ?',
      [surveyId],
    );
    return row?.cnt ?? 0;
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
    return this.db.all<SurveyRow>(
      `SELECT s.* FROM surveys s WHERE s.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM survey_completions sc WHERE sc.survey_id = s.id AND sc.email = ?)
       ORDER BY s.published_at DESC`,
      [email],
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

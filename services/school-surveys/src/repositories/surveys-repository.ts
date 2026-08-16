import { v4 as uuidv4 } from 'uuid';
import type { SchoolSurveysDb } from '../db';
import type { Survey, SurveyResponse } from '../types';

interface SurveyRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  questions_json: string;
  anonymous: number;
  audience: string;
  target_kind: string;
  status: string;
  created_by: string;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ResponseRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  survey_id: string;
  student_ref: string;
  answers_json: string;
  submitted_at: string;
}

function mapSurvey(row: SurveyRow): Survey {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    questionsJson: row.questions_json,
    anonymous: row.anonymous === 1,
    audience: (row.audience as Survey['audience']) || 'guardian',
    targetKind: (row.target_kind as Survey['targetKind']) || 'all',
    status: row.status as Survey['status'],
    createdBy: row.created_by,
    publishedAt: row.published_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResponse(row: ResponseRow): SurveyResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    surveyId: row.survey_id,
    studentRef: row.student_ref,
    answersJson: row.answers_json,
    submittedAt: row.submitted_at,
  };
}

export class SurveysRepository {
  constructor(private readonly db: SchoolSurveysDb) {}

  async createSurvey(data: {
    tenantId: string;
    title: string;
    description: string;
    questionsJson: string;
    anonymous: boolean;
    targetKind: string;
    createdBy: string;
  }): Promise<Survey> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO surveys
       (id, tenant_id, title, description, questions_json, anonymous, audience, target_kind, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'guardian', ?, ?)`,
      [
        id,
        data.tenantId,
        data.title,
        data.description,
        data.questionsJson,
        data.anonymous ? 1 : 0,
        data.targetKind,
        data.createdBy,
      ],
    );
    const row = await this.db.get<SurveyRow>(
      'SELECT * FROM surveys WHERE id = ? AND tenant_id = ?',
      [id, data.tenantId],
    );
    if (!row) throw new Error('Failed to create survey');
    return mapSurvey(row);
  }

  async getSurvey(tenantId: string, id: string): Promise<Survey | null> {
    const row = await this.db.get<SurveyRow>(
      'SELECT * FROM surveys WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return row ? mapSurvey(row) : null;
  }

  async listSurveys(tenantId: string, status?: string): Promise<Survey[]> {
    if (status) {
      const rows = await this.db.all<SurveyRow>(
        'SELECT * FROM surveys WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC',
        [tenantId, status],
      );
      return rows.map(mapSurvey);
    }
    const rows = await this.db.all<SurveyRow>(
      'SELECT * FROM surveys WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId],
    );
    return rows.map(mapSurvey);
  }

  async updateSurvey(
    tenantId: string,
    id: string,
    fields: Partial<{
      title: string;
      description: string;
      questions_json: string;
      anonymous: number;
      target_kind: string;
      status: string;
      published_at: string | null;
      closed_at: string | null;
    }>,
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
    vals.push(id, tenantId);
    await this.db.run(
      `UPDATE surveys SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      vals,
    );
  }

  async deleteSurvey(tenantId: string, id: string): Promise<void> {
    await this.db.run('DELETE FROM surveys WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  }

  async replaceTargets(
    tenantId: string,
    surveyId: string,
    studentRefs: string[],
  ): Promise<void> {
    await this.db.run(
      'DELETE FROM survey_targets WHERE survey_id = ? AND tenant_id = ?',
      [surveyId, tenantId],
    );
    for (const ref of studentRefs) {
      await this.db.run(
        'INSERT INTO survey_targets (survey_id, tenant_id, student_ref) VALUES (?, ?, ?)',
        [surveyId, tenantId, ref],
      );
    }
  }

  async listTargets(tenantId: string, surveyId: string): Promise<string[]> {
    const rows = await this.db.all<{ student_ref: string; [key: string]: unknown }>(
      'SELECT student_ref FROM survey_targets WHERE survey_id = ? AND tenant_id = ?',
      [surveyId, tenantId],
    );
    return rows.map((r) => r.student_ref);
  }

  async submitResponse(data: {
    tenantId: string;
    surveyId: string;
    studentRef: string;
    answersJson: string;
  }): Promise<SurveyResponse> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO survey_responses (id, tenant_id, survey_id, student_ref, answers_json)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.tenantId, data.surveyId, data.studentRef, data.answersJson],
    );
    const row = await this.db.get<ResponseRow>(
      'SELECT * FROM survey_responses WHERE id = ? AND tenant_id = ?',
      [id, data.tenantId],
    );
    if (!row) throw new Error('Failed to submit response');
    return mapResponse(row);
  }

  async listResponses(tenantId: string, surveyId: string): Promise<SurveyResponse[]> {
    const rows = await this.db.all<ResponseRow>(
      `SELECT * FROM survey_responses
       WHERE tenant_id = ? AND survey_id = ?
       ORDER BY submitted_at DESC`,
      [tenantId, surveyId],
    );
    return rows.map(mapResponse);
  }

  async markCompleted(data: {
    tenantId: string;
    surveyId: string;
    guardianRef: string;
    studentRef: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO survey_completions
       (survey_id, tenant_id, guardian_ref, student_ref)
       VALUES (?, ?, ?, ?)`,
      [data.surveyId, data.tenantId, data.guardianRef, data.studentRef],
    );
  }

  async hasCompleted(
    tenantId: string,
    surveyId: string,
    guardianRef: string,
    studentRef: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ survey_id: string; [key: string]: unknown }>(
      `SELECT survey_id FROM survey_completions
       WHERE tenant_id = ? AND survey_id = ? AND guardian_ref = ? AND student_ref = ?`,
      [tenantId, surveyId, guardianRef, studentRef],
    );
    return !!row;
  }

  async countCompletions(tenantId: string, surveyId: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      'SELECT COUNT(*) AS cnt FROM survey_completions WHERE tenant_id = ? AND survey_id = ?',
      [tenantId, surveyId],
    );
    return row?.cnt ?? 0;
  }

  async listPendingForGuardian(
    tenantId: string,
    guardianRef: string,
    studentIds: string[],
  ): Promise<Survey[]> {
    const active = await this.listSurveys(tenantId, 'active');
    const out: Survey[] = [];
    for (const s of active) {
      if (s.targetKind === 'all') {
        const done = await this.hasCompleted(tenantId, s.id, guardianRef, '');
        if (!done) out.push(s);
        continue;
      }
      const targets = await this.listTargets(tenantId, s.id);
      const hit = targets.some((t) => studentIds.includes(t));
      if (!hit) continue;
      // pending if any linked student not completed
      let anyPending = false;
      for (const sid of studentIds) {
        if (!targets.includes(sid)) continue;
        const done = await this.hasCompleted(tenantId, s.id, guardianRef, sid);
        if (!done) {
          anyPending = true;
          break;
        }
      }
      if (anyPending) out.push(s);
    }
    return out;
  }
}

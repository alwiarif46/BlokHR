import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import {
  SurveyRepository,
  type SurveyRow,
  type SurveyResponseRow,
  type SurveyActionItemRow,
  type SurveyPeerAssignmentRow,
} from '../repositories/survey-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export const SURVEY_QUESTION_TYPES = [
  'scale',
  'nps',
  'rating',
  'choice',
  'multi',
  'text',
  'yesno',
] as const;

export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export interface SurveyQuestion {
  key: string;
  label: string;
  type: SurveyQuestionType;
  options?: string[];
  required?: boolean;
}

export type PendingSurveyItem = SurveyRow & { subject_email?: string };

export interface ResultsSummary {
  responseCount: number;
  completionCount: number;
  averages: Record<string, number>;
  withheld?: boolean;
  minResponses?: number;
  subjects?: string[];
}

function isQuestionType(v: unknown): v is SurveyQuestionType {
  return typeof v === 'string' && (SURVEY_QUESTION_TYPES as readonly string[]).includes(v);
}

/** Validate questions JSON string or array; returns canonical JSON string or error. */
export function validateQuestionsJson(
  input: string | SurveyQuestion[] | undefined | null,
): { ok: true; json: string } | { ok: false; error: string } {
  let parsed: unknown;
  if (input === undefined || input === null || input === '') {
    return { ok: true, json: '[]' };
  }
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { ok: false, error: 'questions_json must be valid JSON' };
    }
  } else {
    parsed = input;
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'questions must be an array' };
  }
  const keys = new Set<string>();
  const normalized: SurveyQuestion[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i] as Record<string, unknown>;
    if (!q || typeof q !== 'object') {
      return { ok: false, error: `question[${i}] must be an object` };
    }
    const key = String(q.key ?? '').trim();
    const label = String(q.label ?? q.text ?? '').trim();
    const type = q.type;
    if (!key) return { ok: false, error: `question[${i}].key is required` };
    if (!label) return { ok: false, error: `question[${i}].label is required` };
    if (!isQuestionType(type)) {
      return {
        ok: false,
        error: `question[${i}].type must be one of ${SURVEY_QUESTION_TYPES.join(', ')}`,
      };
    }
    if (keys.has(key)) {
      return { ok: false, error: `duplicate question key: ${key}` };
    }
    keys.add(key);
    const options = Array.isArray(q.options)
      ? q.options.map((o) => String(o))
      : undefined;
    if ((type === 'choice' || type === 'multi') && (!options || options.length === 0)) {
      return { ok: false, error: `question[${i}] of type ${type} requires options` };
    }
    normalized.push({
      key,
      label,
      type,
      options,
      required: q.required === true,
    });
  }
  return { ok: true, json: JSON.stringify(normalized) };
}

/** Normalize target group ids to a comma-separated string (empty = all employees). */
export function normalizeTargetGroupIds(
  input: string | string[] | undefined | null,
): string {
  if (input == null || input === '') return '';
  const parts = Array.isArray(input)
    ? input.map((s) => String(s))
    : String(input).split(/[,;]/);
  const unique = [
    ...new Set(parts.map((s) => s.trim()).filter(Boolean)),
  ];
  return unique.join(',');
}

export class SurveyService {
  private readonly repo: SurveyRepository;

  constructor(
    db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
  ) {
    this.repo = new SurveyRepository(db);
  }

  async createSurvey(
    data: {
      title: string;
      description?: string;
      questionsJson?: string | SurveyQuestion[];
      anonymous?: boolean;
      recurrence?: string;
      targetGroupIds?: string | string[];
      audience?: string;
      minResponses?: number;
    },
    actorEmail: string,
  ): Promise<ServiceResult<SurveyRow>> {
    if (!data.title?.trim()) return { success: false, error: 'Survey title is required' };
    if (data.audience === 'peer') {
      return {
        success: false,
        error: 'peer surveys are not supported in HR surveys',
      };
    }
    const q = validateQuestionsJson(data.questionsJson);
    if (!q.ok) return { success: false, error: q.error };

    const targetGroupIds = normalizeTargetGroupIds(data.targetGroupIds);
    const minResponses =
      data.minResponses !== undefined ? Math.max(1, Number(data.minResponses) || 1) : 1;

    const survey = await this.repo.createSurvey({
      title: data.title.trim(),
      description: data.description,
      questionsJson: q.json,
      anonymous: data.anonymous,
      recurrence: data.recurrence,
      targetGroupIds,
      audience: 'employee',
      minResponses,
      createdBy: actorEmail,
    });

    this.logger.info({ surveyId: survey.id, title: survey.title }, 'Survey created');
    this.logAudit('survey', survey.id, 'created', actorEmail, {
      title: survey.title,
      targetGroupIds,
    });
    return { success: true, data: survey };
  }

  async updateSurvey(
    id: string,
    data: {
      title?: string;
      description?: string;
      questionsJson?: string | SurveyQuestion[];
      anonymous?: boolean;
      recurrence?: string;
      targetGroupIds?: string | string[];
      audience?: string;
      minResponses?: number;
    },
    actorEmail: string,
  ): Promise<ServiceResult<SurveyRow>> {
    const survey = await this.repo.getSurveyById(id);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'draft') {
      return { success: false, error: 'Only draft surveys can be edited' };
    }
    if (data.audience === 'peer') {
      return {
        success: false,
        error: 'peer surveys are not supported in HR surveys',
      };
    }

    const fields: Parameters<typeof this.repo.updateSurvey>[1] = {};
    if (data.title !== undefined) {
      if (!data.title.trim()) return { success: false, error: 'Survey title is required' };
      fields.title = data.title.trim();
    }
    if (data.description !== undefined) fields.description = data.description;
    if (data.questionsJson !== undefined) {
      const q = validateQuestionsJson(data.questionsJson);
      if (!q.ok) return { success: false, error: q.error };
      fields.questions_json = q.json;
    }
    if (data.anonymous !== undefined) fields.anonymous = data.anonymous !== false ? 1 : 0;
    if (data.recurrence !== undefined) fields.recurrence = data.recurrence;
    if (data.targetGroupIds !== undefined) {
      fields.target_group_ids = normalizeTargetGroupIds(data.targetGroupIds);
    }
    // HR surveys are always employee audience
    fields.audience = 'employee';
    if (data.minResponses !== undefined) {
      fields.min_responses = Math.max(1, Number(data.minResponses) || 1);
    }

    await this.repo.updateSurvey(id, fields);

    const updated = await this.repo.getSurveyById(id);
    this.logAudit('survey', id, 'updated', actorEmail, fields as Record<string, unknown>);
    return { success: true, data: updated ?? survey };
  }

  async publishSurvey(id: string, actorEmail: string): Promise<ServiceResult> {
    const survey = await this.repo.getSurveyById(id);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'draft')
      return { success: false, error: 'Only draft surveys can be published' };
    await this.repo.updateSurvey(id, { status: 'active', published_at: new Date().toISOString() });
    this.logAudit('survey', id, 'published', actorEmail, {});
    return { success: true };
  }

  async closeSurvey(id: string, actorEmail: string): Promise<ServiceResult> {
    const survey = await this.repo.getSurveyById(id);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'active')
      return { success: false, error: 'Only active surveys can be closed' };
    await this.repo.updateSurvey(id, { status: 'closed', closed_at: new Date().toISOString() });
    this.logAudit('survey', id, 'closed', actorEmail, {});
    return { success: true };
  }

  async deleteSurvey(id: string, actorEmail: string): Promise<ServiceResult> {
    const survey = await this.repo.getSurveyById(id);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'draft')
      return { success: false, error: 'Only draft surveys can be deleted' };
    await this.repo.deleteSurvey(id);
    this.logAudit('survey', id, 'deleted', actorEmail, {});
    return { success: true };
  }

  async getSurveyById(id: string): Promise<SurveyRow | null> {
    return this.repo.getSurveyById(id);
  }
  async listSurveys(status?: string): Promise<SurveyRow[]> {
    return this.repo.listSurveys(status);
  }

  async setPeerAssignments(
    surveyId: string,
    assignments: Array<{ reviewerEmail: string; subjectEmail: string }>,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const survey = await this.repo.getSurveyById(surveyId);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.audience !== 'peer') {
      return { success: false, error: 'Survey is not a peer survey' };
    }
    await this.repo.createPeerAssignments(surveyId, assignments);
    this.logAudit('survey', surveyId, 'peer_assignments_set', actorEmail, {
      count: assignments.length,
    });
    return { success: true };
  }

  async listPeerAssignments(surveyId: string): Promise<SurveyPeerAssignmentRow[]> {
    return this.repo.listPeerAssignments(surveyId);
  }

  // ── Responses ──

  async submitResponse(
    surveyId: string,
    email: string,
    answers: Record<string, unknown>,
    subjectEmail?: string,
  ): Promise<ServiceResult<SurveyResponseRow>> {
    const survey = await this.repo.getSurveyById(surveyId);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'active') return { success: false, error: 'Survey is not active' };

    if (survey.audience === 'peer') {
      const subject = (subjectEmail ?? '').trim().toLowerCase();
      if (!subject) return { success: false, error: 'subjectEmail is required for peer surveys' };
      const assigned = await this.repo.hasPeerAssignment(surveyId, email, subject);
      if (!assigned) {
        return { success: false, error: 'No peer assignment for this subject' };
      }
      const done = await this.repo.isPeerAssignmentComplete(surveyId, email, subject);
      if (done) return { success: false, error: 'Already responded for this subject' };

      const response = await this.repo.submitResponse(
        surveyId,
        JSON.stringify(answers),
        subject,
      );
      await this.repo.markPeerAssignmentComplete(surveyId, email, subject);
      this.logger.info({ surveyId, email, subject }, 'Peer survey response submitted');
      return { success: true, data: response };
    }

    const completed = await this.repo.hasCompleted(surveyId, email);
    if (completed) return { success: false, error: 'Already responded to this survey' };

    const response = await this.repo.submitResponse(surveyId, JSON.stringify(answers));
    await this.repo.markCompleted(surveyId, email);
    this.logger.info({ surveyId, email }, 'Survey response submitted');
    return { success: true, data: response };
  }

  async getResponses(surveyId: string, subjectEmail?: string): Promise<SurveyResponseRow[]> {
    return this.repo.getResponses(surveyId, subjectEmail);
  }

  async getPendingSurveys(email: string): Promise<PendingSurveyItem[]> {
    return this.repo.getPendingSurveys(email);
  }

  /** Calculate eNPS from NPS-type (0-10 scale) question responses. */
  async calculateENPS(
    surveyId: string,
    questionKey: string,
    subjectEmail?: string,
  ): Promise<{
    promoters: number;
    passives: number;
    detractors: number;
    enps: number;
    total: number;
    withheld?: boolean;
    minResponses?: number;
  }> {
    const survey = await this.repo.getSurveyById(surveyId);
    const minResponses = survey?.min_responses ?? 1;
    const responses = await this.repo.getResponses(surveyId, subjectEmail);

    if (survey?.audience === 'peer' && responses.length < minResponses) {
      return {
        promoters: 0,
        passives: 0,
        detractors: 0,
        enps: 0,
        total: 0,
        withheld: true,
        minResponses,
      };
    }

    let promoters = 0,
      passives = 0,
      detractors = 0;
    for (const r of responses) {
      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(r.answers_json) as Record<string, unknown>;
      } catch {
        /* empty */
      }
      const score = Number(answers[questionKey]);
      if (isNaN(score)) continue;
      if (score >= 9) promoters++;
      else if (score >= 7) passives++;
      else detractors++;
    }
    const total = promoters + passives + detractors;
    const enps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    return { promoters, passives, detractors, enps, total };
  }

  /** Get survey results summary — average per question. */
  async getResultsSummary(
    surveyId: string,
    subjectEmail?: string,
  ): Promise<ResultsSummary> {
    const survey = await this.repo.getSurveyById(surveyId);
    const minResponses = survey?.min_responses ?? 1;
    const responses = await this.repo.getResponses(surveyId, subjectEmail);
    const completionCount = await this.repo.getCompletionCount(surveyId);
    const subjects = survey?.audience === 'peer' ? await this.repo.listSubjects(surveyId) : undefined;

    if (survey?.audience === 'peer') {
      if (!subjectEmail) {
        return {
          responseCount: responses.length,
          completionCount,
          averages: {},
          subjects,
          minResponses,
        };
      }
      if (responses.length < minResponses) {
        return {
          responseCount: responses.length,
          completionCount,
          averages: {},
          withheld: true,
          minResponses,
          subjects,
        };
      }
    }

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const r of responses) {
      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(r.answers_json) as Record<string, unknown>;
      } catch {
        /* empty */
      }
      for (const [key, val] of Object.entries(answers)) {
        const num = Number(val);
        if (!isNaN(num)) {
          sums[key] = (sums[key] ?? 0) + num;
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
    const averages: Record<string, number> = {};
    for (const key of Object.keys(sums)) {
      averages[key] = Math.round((sums[key] / counts[key]) * 100) / 100;
    }
    return {
      responseCount: responses.length,
      completionCount,
      averages,
      subjects,
      minResponses,
    };
  }

  // ── Action items ──
  async createActionItem(
    data: { surveyId: string; title: string; description?: string; assignedTo?: string },
    actorEmail: string,
  ): Promise<ServiceResult<SurveyActionItemRow>> {
    if (!data.title?.trim()) return { success: false, error: 'Action item title is required' };
    const survey = await this.repo.getSurveyById(data.surveyId);
    if (!survey) return { success: false, error: 'Survey not found' };
    const item = await this.repo.createActionItem({
      ...data,
      title: data.title.trim(),
      createdBy: actorEmail,
    });
    this.logAudit('survey_action_item', item.id, 'created', actorEmail, {
      surveyId: data.surveyId,
      title: data.title,
    });
    return { success: true, data: item };
  }

  async getActionItems(surveyId: string): Promise<SurveyActionItemRow[]> {
    return this.repo.getActionItems(surveyId);
  }

  async updateActionItem(
    id: string,
    fields: { title?: string; description?: string; assignedTo?: string; status?: string },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const dbFields: Record<string, unknown> = {};
    if (fields.title !== undefined) dbFields.title = fields.title;
    if (fields.description !== undefined) dbFields.description = fields.description;
    if (fields.assignedTo !== undefined) dbFields.assigned_to = fields.assignedTo;
    if (fields.status !== undefined) dbFields.status = fields.status;
    await this.repo.updateActionItem(
      id,
      dbFields as Parameters<typeof this.repo.updateActionItem>[1],
    );
    this.logAudit('survey_action_item', id, 'updated', actorEmail, dbFields);
    return { success: true };
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

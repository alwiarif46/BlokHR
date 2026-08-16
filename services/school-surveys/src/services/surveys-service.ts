import type { EventPublisher } from '../events';
import type { SurveysRepository } from '../repositories/surveys-repository';
import type {
  ServiceError,
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyResponse,
} from '../types';

const QUESTION_TYPES: SurveyQuestionType[] = [
  'scale',
  'nps',
  'rating',
  'choice',
  'multi',
  'text',
  'yesno',
];

function validateQuestions(
  input: unknown,
): { ok: true; json: string } | { ok: false; error: string } {
  if (input === undefined || input === null || input === '') {
    return { ok: true, json: '[]' };
  }
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { ok: false, error: 'questions_json must be valid JSON' };
    }
  }
  if (!Array.isArray(parsed)) return { ok: false, error: 'questions must be an array' };
  const keys = new Set<string>();
  const normalized: SurveyQuestion[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i] as Record<string, unknown>;
    const key = String(q.key ?? '').trim();
    const label = String(q.label ?? q.text ?? '').trim();
    const type = String(q.type ?? '');
    if (!key) return { ok: false, error: `question[${i}].key is required` };
    if (!label) return { ok: false, error: `question[${i}].label is required` };
    if (!QUESTION_TYPES.includes(type as SurveyQuestionType)) {
      return { ok: false, error: `question[${i}].type is invalid` };
    }
    if (keys.has(key)) return { ok: false, error: `duplicate question key: ${key}` };
    keys.add(key);
    const options = Array.isArray(q.options) ? q.options.map(String) : undefined;
    if ((type === 'choice' || type === 'multi') && (!options || !options.length)) {
      return { ok: false, error: `question[${i}] requires options` };
    }
    normalized.push({
      key,
      label,
      type: type as SurveyQuestionType,
      options,
      required: q.required === true,
    });
  }
  return { ok: true, json: JSON.stringify(normalized) };
}

export class SurveysService {
  constructor(
    private readonly repo: SurveysRepository,
    private readonly events: EventPublisher,
  ) {}

  async create(
    tenantId: string,
    body: Record<string, unknown>,
  ): Promise<{ survey?: Survey; error?: ServiceError }> {
    const title = String(body.title ?? '').trim();
    if (!title) return { error: { status: 400, error: 'title is required' } };
    const q = validateQuestions(body.questions ?? body.questions_json ?? body.questionsJson);
    if (!q.ok) return { error: { status: 400, error: q.error } };
    const targetKind = body.target_kind === 'students' || body.targetKind === 'students'
      ? 'students'
      : 'all';
    const survey = await this.repo.createSurvey({
      tenantId,
      title,
      description: String(body.description ?? ''),
      questionsJson: q.json,
      anonymous: body.anonymous !== false,
      targetKind,
      createdBy: String(body.created_by ?? body.createdBy ?? ''),
    });
    const studentRefs = this.extractStudentRefs(body);
    if (targetKind === 'students' && studentRefs.length) {
      await this.repo.replaceTargets(tenantId, survey.id, studentRefs);
    }
    return { survey };
  }

  async update(
    tenantId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<{ survey?: Survey; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    if (survey.status !== 'draft') {
      return { error: { status: 400, error: 'only draft surveys can be edited' } };
    }
    const fields: Parameters<SurveysRepository['updateSurvey']>[2] = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return { error: { status: 400, error: 'title is required' } };
      fields.title = title;
    }
    if (body.description !== undefined) fields.description = String(body.description);
    if (body.questions !== undefined || body.questions_json !== undefined || body.questionsJson !== undefined) {
      const q = validateQuestions(body.questions ?? body.questions_json ?? body.questionsJson);
      if (!q.ok) return { error: { status: 400, error: q.error } };
      fields.questions_json = q.json;
    }
    if (body.anonymous !== undefined) fields.anonymous = body.anonymous !== false ? 1 : 0;
    if (body.target_kind !== undefined || body.targetKind !== undefined) {
      fields.target_kind =
        body.target_kind === 'students' || body.targetKind === 'students' ? 'students' : 'all';
    }
    await this.repo.updateSurvey(tenantId, id, fields);
    const studentRefs = this.extractStudentRefs(body);
    if (studentRefs.length || fields.target_kind === 'students') {
      await this.repo.replaceTargets(tenantId, id, studentRefs);
    }
    const updated = await this.repo.getSurvey(tenantId, id);
    return { survey: updated ?? survey };
  }

  async list(tenantId: string, status?: string): Promise<Survey[]> {
    return this.repo.listSurveys(tenantId, status);
  }

  async get(tenantId: string, id: string): Promise<{ survey?: Survey; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    return { survey };
  }

  async publish(
    tenantId: string,
    id: string,
  ): Promise<{ success?: true; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    if (survey.status !== 'draft') {
      return { error: { status: 400, error: 'only draft surveys can be published' } };
    }
    if (survey.targetKind === 'students') {
      const targets = await this.repo.listTargets(tenantId, id);
      if (!targets.length) {
        return { error: { status: 400, error: 'student targets required before publish' } };
      }
    }
    const publishedAt = new Date().toISOString();
    await this.repo.updateSurvey(tenantId, id, {
      status: 'active',
      published_at: publishedAt,
    });
    await this.events.publish({
      type: 'school.survey.published',
      tenantId,
      occurredAt: publishedAt,
      data: { surveyId: id, title: survey.title },
    });
    return { success: true };
  }

  async close(
    tenantId: string,
    id: string,
  ): Promise<{ success?: true; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    if (survey.status !== 'active') {
      return { error: { status: 400, error: 'only active surveys can be closed' } };
    }
    await this.repo.updateSurvey(tenantId, id, {
      status: 'closed',
      closed_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async delete(
    tenantId: string,
    id: string,
  ): Promise<{ success?: true; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    if (survey.status !== 'draft') {
      return { error: { status: 400, error: 'only draft surveys can be deleted' } };
    }
    await this.repo.deleteSurvey(tenantId, id);
    return { success: true };
  }

  async results(
    tenantId: string,
    id: string,
  ): Promise<{
    summary?: {
      responseCount: number;
      completionCount: number;
      averages: Record<string, number>;
    };
    error?: ServiceError;
  }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    const responses = await this.repo.listResponses(tenantId, id);
    const completionCount = await this.repo.countCompletions(tenantId, id);
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const r of responses) {
      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(r.answersJson) as Record<string, unknown>;
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
      summary: {
        responseCount: responses.length,
        completionCount,
        averages,
      },
    };
  }

  async responseRate(
    tenantId: string,
    id: string,
  ): Promise<{
    rate?: { completions: number; responses: number };
    error?: ServiceError;
  }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    const completions = await this.repo.countCompletions(tenantId, id);
    const responses = await this.repo.listResponses(tenantId, id);
    return { rate: { completions, responses: responses.length } };
  }

  async guardianPending(
    tenantId: string,
    guardianRef: string,
    studentIds: string[],
  ): Promise<Survey[]> {
    return this.repo.listPendingForGuardian(tenantId, guardianRef, studentIds);
  }

  async guardianGet(
    tenantId: string,
    id: string,
    guardianRef: string,
    studentIds: string[],
  ): Promise<{ survey?: Survey; error?: ServiceError }> {
    const pending = await this.repo.listPendingForGuardian(tenantId, guardianRef, studentIds);
    const hit = pending.find((s) => s.id === id);
    if (hit) return { survey: hit };
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey || survey.status !== 'active') {
      return { error: { status: 404, error: 'not_found' } };
    }
    // Allow viewing if already completed but still active (optional) — keep strict pending-only
    const all = await this.repo.listPendingForGuardian(tenantId, guardianRef, studentIds);
    if (!all.find((s) => s.id === id)) {
      // still return survey if targeted/all and active for answer form after refresh race
      if (survey.targetKind === 'all') return { survey };
      const targets = await this.repo.listTargets(tenantId, id);
      if (targets.some((t) => studentIds.includes(t))) return { survey };
      return { error: { status: 404, error: 'not_found' } };
    }
    return { survey };
  }

  async guardianRespond(
    tenantId: string,
    id: string,
    guardianRef: string,
    studentIds: string[],
    body: Record<string, unknown>,
  ): Promise<{ response?: SurveyResponse; error?: ServiceError }> {
    const survey = await this.repo.getSurvey(tenantId, id);
    if (!survey) return { error: { status: 404, error: 'not_found' } };
    if (survey.status !== 'active') {
      return { error: { status: 400, error: 'survey is not active' } };
    }

    const studentRef = String(body.student_ref ?? body.studentRef ?? '').trim();
    if (survey.targetKind === 'students') {
      if (!studentRef) return { error: { status: 400, error: 'student_ref is required' } };
      if (!studentIds.includes(studentRef)) {
        return { error: { status: 403, error: 'forbidden' } };
      }
      const targets = await this.repo.listTargets(tenantId, id);
      if (!targets.includes(studentRef)) {
        return { error: { status: 403, error: 'forbidden' } };
      }
    } else if (studentRef && !studentIds.includes(studentRef)) {
      return { error: { status: 403, error: 'forbidden' } };
    }

    const completionStudent = survey.targetKind === 'students' ? studentRef : '';
    const done = await this.repo.hasCompleted(
      tenantId,
      id,
      guardianRef,
      completionStudent,
    );
    if (done) return { error: { status: 400, error: 'already responded' } };

    const answers = (body.answers as Record<string, unknown>) ?? {};
    const response = await this.repo.submitResponse({
      tenantId,
      surveyId: id,
      studentRef: completionStudent || studentRef,
      answersJson: JSON.stringify(answers),
    });
    await this.repo.markCompleted({
      tenantId,
      surveyId: id,
      guardianRef,
      studentRef: completionStudent,
    });
    await this.events.publish({
      type: 'school.survey.submitted',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: { surveyId: id, studentRef: completionStudent || studentRef },
    });
    return { response };
  }

  private extractStudentRefs(body: Record<string, unknown>): string[] {
    const raw = body.student_refs ?? body.studentRefs ?? body.targets;
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
}

import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import {
  SurveyRepository,
  type SurveyRow,
  type SurveyResponseRow,
  type SurveyActionItemRow,
} from '../repositories/survey-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
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
      questionsJson?: string;
      anonymous?: boolean;
      recurrence?: string;
      targetGroupIds?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult<SurveyRow>> {
    if (!data.title?.trim()) return { success: false, error: 'Survey title is required' };
    const survey = await this.repo.createSurvey({
      ...data,
      title: data.title.trim(),
      createdBy: actorEmail,
    });
    this.logger.info({ surveyId: survey.id, title: survey.title }, 'Survey created');
    this.logAudit('survey', survey.id, 'created', actorEmail, { title: survey.title });
    return { success: true, data: survey };
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

  // ── Responses ──

  async submitResponse(
    surveyId: string,
    email: string,
    answers: Record<string, unknown>,
  ): Promise<ServiceResult<SurveyResponseRow>> {
    const survey = await this.repo.getSurveyById(surveyId);
    if (!survey) return { success: false, error: 'Survey not found' };
    if (survey.status !== 'active') return { success: false, error: 'Survey is not active' };

    const completed = await this.repo.hasCompleted(surveyId, email);
    if (completed) return { success: false, error: 'Already responded to this survey' };

    const response = await this.repo.submitResponse(surveyId, JSON.stringify(answers));
    await this.repo.markCompleted(surveyId, email);
    this.logger.info({ surveyId, email }, 'Survey response submitted');
    return { success: true, data: response };
  }

  async getResponses(surveyId: string): Promise<SurveyResponseRow[]> {
    return this.repo.getResponses(surveyId);
  }
  async getPendingSurveys(email: string): Promise<SurveyRow[]> {
    return this.repo.getPendingSurveys(email);
  }

  /** Calculate eNPS from NPS-type (0-10 scale) question responses. */
  async calculateENPS(
    surveyId: string,
    questionKey: string,
  ): Promise<{
    promoters: number;
    passives: number;
    detractors: number;
    enps: number;
    total: number;
  }> {
    const responses = await this.repo.getResponses(surveyId);
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
  ): Promise<{ responseCount: number; completionCount: number; averages: Record<string, number> }> {
    const responses = await this.repo.getResponses(surveyId);
    const completionCount = await this.repo.getCompletionCount(surveyId);
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
    return { responseCount: responses.length, completionCount, averages };
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

import type { Logger } from 'pino';

export interface InferAssessmentDeliveryInput {
  tenantId: string;
  topicId: string;
  sectionRef: string;
  date: string;
  ref: string;
  teacherMemberId?: string;
}

export interface AcademicsClient {
  inferAssessmentDelivery(input: InferAssessmentDeliveryInput): Promise<void>;
}

/**
 * HTTP client for school-academics delivery inference.
 * Base URL from ACADEMICS_URL (optional). Failures are logged, never thrown.
 */
export class HttpAcademicsClient implements AcademicsClient {
  constructor(
    private readonly logger: Logger,
    private readonly baseUrl: string | undefined = process.env.ACADEMICS_URL,
  ) {}

  async inferAssessmentDelivery(input: InferAssessmentDeliveryInput): Promise<void> {
    if (!this.baseUrl) {
      this.logger.debug(
        { topicId: input.topicId },
        'academics_infer_skipped_no_url',
      );
      return;
    }
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/academics/${encodeURIComponent(input.tenantId)}/delivery/infer`;
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      // delivery/infer is internal-only (P12-04) — bare posts 401.
      const secret = (process.env.INTERNAL_SECRET ?? '').trim();
      if (secret) headers['X-Blok-Internal'] = secret;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kind: 'assessment',
          topic_id: input.topicId,
          section_ref: input.sectionRef,
          date: input.date,
          ref: input.ref,
          teacher_member_id: input.teacherMemberId ?? 'system:assessment-feedback',
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          { status: res.status, topicId: input.topicId, url },
          'academics_infer_failed',
        );
      }
    } catch (err) {
      this.logger.warn({ err, topicId: input.topicId, url }, 'academics_infer_failed');
    }
  }
}

/** No-op client for tests / when academics is unavailable. */
export class NoopAcademicsClient implements AcademicsClient {
  async inferAssessmentDelivery(_input: InferAssessmentDeliveryInput): Promise<void> {
    // intentionally empty
  }
}

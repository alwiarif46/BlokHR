/**
 * Timetable L5 scope client (P12-05).
 * Fail-closed on errors. Contrast with notification clients which fail-open —
 * scope checks are security.
 */
export interface VerifyTeacherInput {
  tenantId: string;
  teacherMemberId: string;
  periodInstanceId?: string;
  sectionRef?: string;
}

export type VerifyTeacherResult =
  | { allowed: true }
  | { allowed: false }
  | { unverifiable: true };

export interface TimetableClient {
  verifyTeacher(input: VerifyTeacherInput): Promise<VerifyTeacherResult>;
}

export class HttpTimetableClient implements TimetableClient {
  constructor(
    private readonly baseUrl: string | undefined = process.env.TIMETABLE_URL,
    private readonly internalSecret: string = (process.env.INTERNAL_SECRET ?? '').trim(),
  ) {}

  async verifyTeacher(input: VerifyTeacherInput): Promise<VerifyTeacherResult> {
    if (!this.baseUrl || !this.internalSecret) {
      return { unverifiable: true };
    }
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/timetable/${encodeURIComponent(input.tenantId)}/internal/verify-teacher`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Blok-Internal': this.internalSecret,
        },
        body: JSON.stringify({
          teacher_member_id: input.teacherMemberId,
          period_instance_id: input.periodInstanceId,
          section_ref: input.sectionRef,
        }),
      });
      if (!res.ok) return { unverifiable: true };
      const body = (await res.json()) as { allowed?: boolean };
      return body.allowed === true ? { allowed: true } : { allowed: false };
    } catch {
      return { unverifiable: true };
    }
  }
}

/** In-memory stub for tests. */
export class StubTimetableClient implements TimetableClient {
  calls: VerifyTeacherInput[] = [];
  allowed = true;
  unverifiable = false;

  async verifyTeacher(input: VerifyTeacherInput): Promise<VerifyTeacherResult> {
    this.calls.push(input);
    if (this.unverifiable) return { unverifiable: true };
    return this.allowed ? { allowed: true } : { allowed: false };
  }
}

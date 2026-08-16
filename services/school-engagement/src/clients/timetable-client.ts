/**
 * Timetable verify client (P12-05 pattern).
 * Fail-closed: client error ⇒ { allowed: false } — scope checks are security
 * (contrast with fail-open notification sinks).
 */
export interface TimetableClient {
  verifyTeacher(
    tenantId: string,
    teacherMemberId: string,
    sectionRef: string,
  ): Promise<{ allowed: boolean }>;
}

export function createHttpTimetableClient(
  baseUrl: string | undefined = process.env.TIMETABLE_URL,
  internalSecret: string | undefined = process.env.INTERNAL_SECRET,
): TimetableClient {
  return {
    async verifyTeacher(tenantId, teacherMemberId, sectionRef) {
      if (!baseUrl) return { allowed: false };
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/api/timetable/${encodeURIComponent(tenantId)}/internal/verify-teacher`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
            },
            body: JSON.stringify({
              teacher_member_id: teacherMemberId,
              section_ref: sectionRef,
            }),
          },
        );
        if (!res.ok) return { allowed: false };
        const body = (await res.json()) as { allowed?: boolean };
        return { allowed: body.allowed === true };
      } catch {
        return { allowed: false };
      }
    },
  };
}

export function createStubTimetableClient(
  allowedSections: Set<string> | ((sectionRef: string) => boolean),
): TimetableClient {
  return {
    async verifyTeacher(_tenantId, _teacherMemberId, sectionRef) {
      if (typeof allowedSections === 'function') {
        return { allowed: allowedSections(sectionRef) };
      }
      return { allowed: allowedSections.has(sectionRef) };
    },
  };
}

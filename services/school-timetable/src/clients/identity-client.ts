/**
 * Identity client for guardian timetable section resolution (Family Hub).
 */
export interface StudentSection {
  sectionRef: string;
  academicSessionId: string;
}

export interface IdentityClient {
  getStudentSection(
    tenantId: string,
    studentId: string,
  ): Promise<StudentSection | { error: string; status: number }>;
}

export function createHttpIdentityClient(
  baseUrl: string | undefined = process.env.IDENTITY_URL,
  internalSecret: string | undefined = process.env.INTERNAL_SECRET,
): IdentityClient {
  return {
    async getStudentSection(tenantId, studentId) {
      if (!baseUrl) {
        return { error: 'section_unresolvable', status: 503 };
      }
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/api/identity/${encodeURIComponent(tenantId)}/internal/students/${encodeURIComponent(studentId)}/section`,
          {
            headers: {
              ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
            },
          },
        );
        if (res.status === 404) {
          return { error: 'not_found', status: 404 };
        }
        if (!res.ok) {
          return { error: 'section_unresolvable', status: 503 };
        }
        const body = (await res.json()) as {
          section_ref?: string;
          academic_session_id?: string;
        };
        if (!body.section_ref || !body.academic_session_id) {
          return { error: 'section_unresolvable', status: 503 };
        }
        return {
          sectionRef: body.section_ref,
          academicSessionId: body.academic_session_id,
        };
      } catch {
        return { error: 'section_unresolvable', status: 503 };
      }
    },
  };
}

export function createStubIdentityClient(
  map: Record<string, StudentSection | { error: string; status: number }>,
): IdentityClient {
  return {
    async getStudentSection(_tenantId, studentId) {
      const hit = map[studentId];
      if (!hit) return { error: 'section_unresolvable', status: 503 };
      return hit;
    },
  };
}

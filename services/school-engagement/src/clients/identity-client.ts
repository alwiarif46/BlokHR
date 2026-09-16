/**
 * Identity client for guardian diary / class-wide digest (Family Hub).
 * Fail soft when IDENTITY_URL unset — callers decide.
 */
export interface StudentSection {
  sectionRef: string;
  academicSessionId: string;
}

export interface SectionGuardian {
  guardianId: string;
  studentId: string;
}

export interface IdentityClient {
  getStudentSection(
    tenantId: string,
    studentId: string,
  ): Promise<StudentSection | { error: string; status: number }>;
  listGuardiansForSection(
    tenantId: string,
    sectionRef: string,
  ): Promise<{ guardians: SectionGuardian[] } | { error: string; status: number }>;
  listGuardiansForStudent(
    tenantId: string,
    studentId: string,
  ): Promise<{ guardians: SectionGuardian[] } | { error: string; status: number }>;
}

function mapGuardianRows(
  list: Array<{
    guardianId?: string;
    studentId?: string;
    guardian_id?: string;
    student_id?: string;
    id?: string;
  }>,
  fallbackStudentId = '',
): SectionGuardian[] {
  return list
    .map((g) => ({
      guardianId: String(g.guardianId ?? g.guardian_id ?? g.id ?? '').trim(),
      studentId: String(g.studentId ?? g.student_id ?? fallbackStudentId).trim(),
    }))
    .filter((g) => g.guardianId);
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

    async listGuardiansForSection(tenantId, sectionRef) {
      if (!baseUrl) {
        return { error: 'section_guardians_unresolvable', status: 503 };
      }
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/api/identity/${encodeURIComponent(tenantId)}/internal/sections/${encodeURIComponent(sectionRef)}/guardians`,
          {
            headers: {
              ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
            },
          },
        );
        if (!res.ok) {
          return { error: 'section_guardians_unresolvable', status: 503 };
        }
        const body = (await res.json()) as {
          guardians?: Array<{
            guardianId?: string;
            studentId?: string;
            guardian_id?: string;
            student_id?: string;
          }>;
        };
        const list = Array.isArray(body.guardians) ? body.guardians : [];
        return { guardians: mapGuardianRows(list) };
      } catch {
        return { error: 'section_guardians_unresolvable', status: 503 };
      }
    },

    async listGuardiansForStudent(tenantId, studentId) {
      if (!baseUrl) {
        return { error: 'student_guardians_unresolvable', status: 503 };
      }
      try {
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/api/identity/${encodeURIComponent(tenantId)}/internal/students/${encodeURIComponent(studentId)}/guardians`,
          {
            headers: {
              ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
            },
          },
        );
        if (res.status === 404) {
          return { guardians: [] };
        }
        if (!res.ok) {
          return { error: 'student_guardians_unresolvable', status: 503 };
        }
        const body = (await res.json()) as {
          guardians?: Array<{
            guardianId?: string;
            studentId?: string;
            guardian_id?: string;
            student_id?: string;
            id?: string;
          }>;
        };
        const list = Array.isArray(body.guardians) ? body.guardians : [];
        return { guardians: mapGuardianRows(list, studentId) };
      } catch {
        return { error: 'student_guardians_unresolvable', status: 503 };
      }
    },
  };
}

export function createStubIdentityClient(
  map: Record<string, StudentSection | { error: string; status: number }>,
  sectionGuardians: Record<string, SectionGuardian[]> = {},
  studentGuardians: Record<string, SectionGuardian[]> = {},
): IdentityClient {
  return {
    async getStudentSection(_tenantId, studentId) {
      const hit = map[studentId];
      if (!hit) return { error: 'section_unresolvable', status: 503 };
      return hit;
    },
    async listGuardiansForSection(_tenantId, sectionRef) {
      const hit = sectionGuardians[sectionRef];
      if (!hit) return { error: 'section_guardians_unresolvable', status: 503 };
      return { guardians: hit };
    },
    async listGuardiansForStudent(_tenantId, studentId) {
      if (!(studentId in studentGuardians)) {
        return { error: 'student_guardians_unresolvable', status: 503 };
      }
      return { guardians: studentGuardians[studentId] ?? [] };
    },
  };
}

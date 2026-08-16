import type { IdentityClient, ApaarStudentBundle } from '../clients/identity-client';
import {
  classifyApaarStudent,
  type ApaarClassification,
  type ApaarIssue,
} from './apaar-readiness';

type ServiceError = { error: string; status: number };

export interface ApaarReadinessRow {
  studentId: string;
  admissionNumber: string;
  classLabel: string;
  section: string;
  classification: ApaarClassification;
}

export interface ClassCounts {
  classLabel: string;
  ready: number;
  blocked_refused: number;
  needs_consent: number;
  needs_fix: number;
  total: number;
}

export class ApaarService {
  constructor(
    private readonly identity: IdentityClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async load(
    tenantId: string,
    session: string,
  ): Promise<{ rows: ApaarReadinessRow[]; error?: ServiceError }> {
    const sessionRef = (session || '').trim();
    if (!sessionRef) {
      return { rows: [], error: { error: 'session is required', status: 400 } };
    }
    const bundles = await this.identity.listStudentsWithApaarConsent(
      tenantId,
      sessionRef,
    );
    const today = this.clock();
    const rows = bundles.map((b: ApaarStudentBundle) => {
      const classification = classifyApaarStudent(
        {
          id: b.student.id,
          admissionNumber: b.student.admissionNumber,
          firstName: b.student.firstName,
          lastName: b.student.lastName,
          dob: b.student.dob,
          gender: b.student.gender,
          classLabel: b.student.classLabel,
          section: b.student.section,
          guardianContact: b.student.guardianContact,
          apaarConsent: b.apaarConsent,
        },
        today,
      );
      return {
        studentId: b.student.id,
        admissionNumber: b.student.admissionNumber,
        classLabel: b.student.classLabel,
        section: b.student.section,
        classification,
      };
    });
    return { rows };
  }

  async readiness(
    tenantId: string,
    session: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{
    countsByClass?: ClassCounts[];
    totals?: Record<string, number>;
    students?: ApaarReadinessRow[];
    total?: number;
    limit?: number;
    offset?: number;
    error?: ServiceError;
  }> {
    const loaded = await this.load(tenantId, session);
    if (loaded.error) return { error: loaded.error };

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const rows = loaded.rows;

    const byClass = new Map<string, ClassCounts>();
    const totals = {
      ready: 0,
      blocked_refused: 0,
      needs_consent: 0,
      needs_fix: 0,
      total: rows.length,
    };
    for (const row of rows) {
      const key = row.classLabel || 'unknown';
      const c = byClass.get(key) ?? {
        classLabel: key,
        ready: 0,
        blocked_refused: 0,
        needs_consent: 0,
        needs_fix: 0,
        total: 0,
      };
      const status = row.classification.status;
      c[status] += 1;
      c.total += 1;
      totals[status] += 1;
      byClass.set(key, c);
    }

    return {
      countsByClass: [...byClass.values()].sort((a, b) =>
        a.classLabel.localeCompare(b.classLabel),
      ),
      totals,
      students: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
    };
  }

  async fixList(
    tenantId: string,
    session: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{
    students?: Array<{
      studentId: string;
      admissionNumber: string;
      classLabel: string;
      section: string;
      issues: ApaarIssue[];
    }>;
    total?: number;
    limit?: number;
    offset?: number;
    error?: ServiceError;
  }> {
    const loaded = await this.load(tenantId, session);
    if (loaded.error) return { error: loaded.error };

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const needsFix = loaded.rows
      .filter((r) => r.classification.status === 'needs_fix')
      .map((r) => ({
        studentId: r.studentId,
        admissionNumber: r.admissionNumber,
        classLabel: r.classLabel,
        section: r.section,
        issues:
          r.classification.status === 'needs_fix'
            ? r.classification.issues
            : [],
      }));

    return {
      students: needsFix.slice(offset, offset + limit),
      total: needsFix.length,
      limit,
      offset,
    };
  }
}

import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type {
  IdentityClient,
  IdentityStudentRow,
  StorageClient,
  UdisePreflightRow,
} from '../clients/identity-client';
import type { ComplianceRepository } from '../repositories/compliance-repository';
import { buildCsv } from '../exports/csv';
import { UDISE_COLUMNS } from '../exports/udise-columns';
import type { ExportErrorGroup, ExportRun } from '../types';

type ServiceError = { error: string; status: number };

export function groupPreflightErrors(
  results: UdisePreflightRow[],
): ExportErrorGroup[] {
  const map = new Map<string, { count: number; studentRefs: string[] }>();
  for (const row of results) {
    if (row.ok) continue;
    const ref = row.admissionNumber || row.studentId;
    for (const err of row.errors) {
      const g = map.get(err.code) ?? { count: 0, studentRefs: [] };
      g.count += 1;
      if (g.studentRefs.length < 20 && !g.studentRefs.includes(ref)) {
        g.studentRefs.push(ref);
      }
      map.set(err.code, g);
    }
  }
  return [...map.entries()]
    .map(([code, v]) => ({ code, count: v.count, studentRefs: v.studentRefs }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export function studentToUdiseRow(s: IdentityStudentRow): unknown[] {
  const name = `${s.firstName} ${s.lastName}`.trim();
  return [
    name,
    s.dob,
    s.gender,
    s.admissionNumber,
    s.admissionDate,
    s.classLabel,
    s.section,
    s.category,
    s.motherName,
    s.guardianContact,
    s.apaarId ?? '',
    s.isCwsn ? '1' : '0',
    s.cwsnCategory ?? '',
    s.cwsnDisability ?? '',
    s.cwsnCertificate ? '1' : '0',
    s.isRte ? '1' : '0',
  ];
}

export class ExportService {
  constructor(
    private readonly repo: ComplianceRepository,
    private readonly identity: IdentityClient,
    private readonly storage: StorageClient,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async runUdiseExport(
    tenantId: string,
    input: { sessionRef: string; createdBy: string },
  ): Promise<{ run?: ExportRun; error?: ServiceError }> {
    const sessionRef = (input.sessionRef || '').trim();
    const createdBy = (input.createdBy || '').trim();
    if (!sessionRef) {
      return { error: { error: 'session_ref is required', status: 400 } };
    }
    if (!createdBy) {
      return { error: { error: 'created_by is required', status: 400 } };
    }

    let run = await this.repo.insertExportRun({
      id: uuidv4(),
      tenantId,
      kind: 'udise_sdms',
      academicSessionRef: sessionRef,
      state: 'running',
      total: 0,
      passing: 0,
      failing: 0,
      fileRef: null,
      errors: null,
      createdBy,
      createdAt: this.clock().toISOString(),
    });

    try {
      const preflight = await this.identity.udisePreflight(tenantId, sessionRef);
      run = (await this.repo.updateExportRun({
        ...run,
        total: preflight.total,
        passing: preflight.passing,
        failing: preflight.failing,
      }))!;

      if (preflight.failing > 0 || preflight.results.some((r) => !r.ok)) {
        const errors = groupPreflightErrors(preflight.results);
        run = (await this.repo.updateExportRun({
          ...run,
          state: 'failed',
          failing: preflight.failing || preflight.results.filter((r) => !r.ok).length,
          fileRef: null,
          errors,
        }))!;
        return { run };
      }

      const students = await this.identity.listStudentsForUdise(
        tenantId,
        sessionRef,
      );
      const rows = students.map(studentToUdiseRow);
      const csv = buildCsv(UDISE_COLUMNS, rows);
      const stored = await this.storage.store({
        tenantId,
        filename: `udise_${sessionRef}_${run.id}.csv`,
        contentType: 'text/csv',
        body: csv,
      });

      run = (await this.repo.updateExportRun({
        ...run,
        state: 'passed',
        fileRef: stored.fileRef,
        errors: null,
      }))!;

      await this.events.publish({
        type: 'school.compliance.export_ready',
        tenantId,
        occurredAt: this.clock().toISOString(),
        data: {
          export_id: run.id,
          kind: 'udise_sdms',
          session_ref: sessionRef,
          file_ref: stored.fileRef,
          total: run.total,
        },
      });

      return { run };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'export failed';
      run = (await this.repo.updateExportRun({
        ...run,
        state: 'failed',
        fileRef: null,
        errors: [
          {
            code: 'client_error',
            count: 1,
            studentRefs: [],
          },
        ],
      }))!;
      // Attach message in a way tests can assert via errors — store as synthetic group code detail
      run = (await this.repo.updateExportRun({
        ...run,
        errors: [
          {
            code: 'client_error',
            count: 1,
            studentRefs: [message.slice(0, 200)],
          },
        ],
      }))!;
      return { run };
    }
  }

  async listExports(
    tenantId: string,
    kind?: string,
  ): Promise<{ runs: ExportRun[]; error?: ServiceError }> {
    if (kind && kind !== 'udise_sdms' && kind !== 'cbse_loc' && kind !== 'state') {
      return { error: { error: 'invalid kind', status: 400 }, runs: [] };
    }
    return {
      runs: await this.repo.listExportRuns(
        tenantId,
        kind as 'udise_sdms' | 'cbse_loc' | 'state' | undefined,
      ),
    };
  }

  async getExport(
    tenantId: string,
    id: string,
  ): Promise<{ run?: ExportRun; error?: ServiceError }> {
    const run = await this.repo.getExportRun(tenantId, id);
    if (!run) return { error: { error: 'export run not found', status: 404 } };
    return { run };
  }
}

export interface UdiseIssueDto {
  field: string;
  code: string;
  message: string;
}

export interface UdisePreflightRow {
  studentId: string;
  admissionNumber: string;
  ok: boolean;
  errors: UdiseIssueDto[];
  infos: UdiseIssueDto[];
  warnings: UdiseIssueDto[];
}

export interface UdisePreflightResult {
  total: number;
  passing: number;
  failing: number;
  results: UdisePreflightRow[];
}

export interface IdentityStudentRow {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  admissionDate: string;
  category: string;
  motherName: string;
  guardianContact: string;
  apaarId: string | null;
  isCwsn: boolean;
  cwsnCategory: string | null;
  cwsnDisability: string | null;
  cwsnCertificate: boolean;
  isRte: boolean;
  classLabel: string;
  section: string;
}

export type ApaarConsentState = 'granted' | 'refused' | 'withdrawn' | 'not_sought';

export interface ApaarStudentBundle {
  student: IdentityStudentRow;
  apaarConsent: ApaarConsentState;
}

export interface IdentityClient {
  udisePreflight(
    tenantId: string,
    sessionRef: string,
  ): Promise<UdisePreflightResult>;
  listStudentsForUdise(
    tenantId: string,
    sessionRef: string,
  ): Promise<IdentityStudentRow[]>;
  listStudentsWithApaarConsent(
    tenantId: string,
    sessionRef: string,
  ): Promise<ApaarStudentBundle[]>;
}

export class HttpIdentityClient implements IdentityClient {
  constructor(
    private readonly baseUrl: string | undefined = process.env.IDENTITY_URL,
  ) {}

  async udisePreflight(
    tenantId: string,
    sessionRef: string,
  ): Promise<UdisePreflightResult> {
    if (!this.baseUrl) {
      throw new Error('IDENTITY_URL is not configured');
    }
    const all: UdisePreflightRow[] = [];
    let total = 0;
    let passing = 0;
    let failing = 0;
    let offset = 0;
    const limit = 200;
    for (;;) {
      const url = new URL(
        `/api/identity/${encodeURIComponent(tenantId)}/udise/preflight`,
        this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      );
      url.searchParams.set('session_id', sessionRef);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`identity preflight failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as UdisePreflightResult;
      total = body.total;
      passing = body.passing;
      failing = body.failing;
      all.push(...body.results);
      offset += body.results.length;
      if (offset >= total || body.results.length === 0) break;
    }
    return { total, passing, failing, results: all };
  }

  async listStudentsForUdise(
    tenantId: string,
    sessionRef: string,
  ): Promise<IdentityStudentRow[]> {
    if (!this.baseUrl) {
      throw new Error('IDENTITY_URL is not configured');
    }
    const url = new URL(
      `/api/identity/${encodeURIComponent(tenantId)}/students`,
      this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
    );
    url.searchParams.set('session_id', sessionRef);
    url.searchParams.set('limit', '10000');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`identity list students failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      students?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    };
    const raw = body.students ?? body.items ?? [];
    return raw.map((s) => ({
      id: String(s.id ?? ''),
      admissionNumber: String(s.admissionNumber ?? s.admission_number ?? ''),
      firstName: String(s.firstName ?? s.first_name ?? ''),
      lastName: String(s.lastName ?? s.last_name ?? ''),
      dob: String(s.dob ?? ''),
      gender: String(s.gender ?? ''),
      admissionDate: String(s.admissionDate ?? s.admission_date ?? ''),
      category: String(s.category ?? ''),
      motherName: String(s.motherName ?? s.mother_name ?? ''),
      guardianContact: String(s.guardianContact ?? s.guardian_contact ?? ''),
      apaarId:
        s.apaarId == null && s.apaar_id == null
          ? null
          : String(s.apaarId ?? s.apaar_id),
      isCwsn: Boolean(s.isCwsn ?? s.is_cwsn),
      cwsnCategory:
        s.cwsnCategory == null && s.cwsn_category == null
          ? null
          : String(s.cwsnCategory ?? s.cwsn_category),
      cwsnDisability:
        s.cwsnDisability == null && s.cwsn_disability == null
          ? null
          : String(s.cwsnDisability ?? s.cwsn_disability),
      cwsnCertificate: Boolean(s.cwsnCertificate ?? s.cwsn_certificate),
      isRte: Boolean(s.isRte ?? s.is_rte),
      classLabel: String(s.classLabel ?? s.class_label ?? ''),
      section: String(s.section ?? ''),
    }));
  }

  async listStudentsWithApaarConsent(
    tenantId: string,
    sessionRef: string,
  ): Promise<ApaarStudentBundle[]> {
    const students = await this.listStudentsForUdise(tenantId, sessionRef);
    const out: ApaarStudentBundle[] = [];
    for (const student of students) {
      if (!this.baseUrl) {
        throw new Error('IDENTITY_URL is not configured');
      }
      const url = new URL(
        `/api/identity/${encodeURIComponent(tenantId)}/students/${encodeURIComponent(student.id)}/consents`,
        this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      );
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`identity consents failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        consents?: Array<{ kind?: string; state?: string }>;
      };
      const apaar = (body.consents ?? []).find((c) => c.kind === 'apaar');
      const state = (apaar?.state ?? 'not_sought') as ApaarConsentState;
      out.push({ student, apaarConsent: state });
    }
    return out;
  }
}

export interface StorageClient {
  store(input: {
    tenantId: string;
    filename: string;
    contentType: string;
    body: string;
  }): Promise<{ fileRef: string }>;
}

export class HttpStorageClient implements StorageClient {
  constructor(
    private readonly baseUrl: string | undefined = process.env.STORAGE_URL,
  ) {}

  async store(input: {
    tenantId: string;
    filename: string;
    contentType: string;
    body: string;
  }): Promise<{ fileRef: string }> {
    if (!this.baseUrl) {
      throw new Error('STORAGE_URL is not configured');
    }
    const url = new URL(
      '/api/storage/objects',
      this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
    );
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenant_id: input.tenantId,
        filename: input.filename,
        content_type: input.contentType,
        body: input.body,
      }),
    });
    if (!res.ok) {
      throw new Error(`storage upload failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { file_ref?: string; fileRef?: string; ref?: string };
    const fileRef = json.file_ref ?? json.fileRef ?? json.ref;
    if (!fileRef) throw new Error('storage upload missing file_ref');
    return { fileRef };
  }
}

/**
 * Members client — resolves per-employee compensation + shift.
 *
 * Preferred path: local member_compensation_cache (populated by internal sync).
 * Fallback: fetch upstream MONOLITH_URL/MEMBERS_URL. Fail soft (return null) on
 * any failure — the OT service will skip employees it cannot price.
 */

export interface MemberCompensation {
  email: string;
  name: string;
  basicSalary: number;
  da: number;
  shiftStart: string;
  shiftEnd: string;
}

export interface MembersClient {
  getCompensation(
    tenantId: string,
    email: string,
  ): Promise<MemberCompensation | null>;
  listAllForTenant(tenantId: string): Promise<MemberCompensation[]>;
}

interface UpstreamMember {
  email?: string;
  name?: string;
  basic_salary?: number;
  basicSalary?: number;
  da?: number;
  individual_shift_start?: string;
  group_shift_start?: string;
  shiftStart?: string;
  individual_shift_end?: string;
  group_shift_end?: string;
  shiftEnd?: string;
}

function normalize(row: UpstreamMember): MemberCompensation | null {
  if (!row || typeof row.email !== 'string' || !row.email) return null;
  const basicSalary =
    typeof row.basicSalary === 'number'
      ? row.basicSalary
      : typeof row.basic_salary === 'number'
        ? row.basic_salary
        : 0;
  const da = typeof row.da === 'number' ? row.da : 0;
  const shiftStart =
    row.shiftStart ??
    row.individual_shift_start ??
    row.group_shift_start ??
    '09:00';
  const shiftEnd =
    row.shiftEnd ??
    row.individual_shift_end ??
    row.group_shift_end ??
    '18:00';
  return {
    email: row.email,
    name: row.name ?? '',
    basicSalary,
    da,
    shiftStart,
    shiftEnd,
  };
}

export function createHttpMembersClient(
  baseUrl: string | undefined = process.env.MEMBERS_URL ??
    process.env.MONOLITH_URL,
  internalSecret: string | undefined = process.env.INTERNAL_SECRET,
): MembersClient {
  return {
    async getCompensation(tenantId, email) {
      if (!baseUrl) return null;
      try {
        const url =
          `${baseUrl.replace(/\/$/, '')}/api/members/${encodeURIComponent(tenantId)}/` +
          encodeURIComponent(email);
        const res = await fetch(url, {
          headers: {
            ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
          },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as UpstreamMember | null;
        if (!body) return null;
        return normalize(body);
      } catch {
        return null;
      }
    },

    async listAllForTenant(tenantId) {
      if (!baseUrl) return [];
      try {
        const url =
          `${baseUrl.replace(/\/$/, '')}/api/members/${encodeURIComponent(tenantId)}`;
        const res = await fetch(url, {
          headers: {
            ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
          },
        });
        if (!res.ok) return [];
        const body = (await res.json()) as
          | { items?: UpstreamMember[] }
          | UpstreamMember[]
          | null;
        const rows: UpstreamMember[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body!.items
            : [];
        const out: MemberCompensation[] = [];
        for (const r of rows) {
          const n = normalize(r);
          if (n) out.push(n);
        }
        return out;
      } catch {
        return [];
      }
    },
  };
}

export class StubMembersClient implements MembersClient {
  private readonly byKey = new Map<string, MemberCompensation>();

  constructor(rows: Array<{ tenantId: string } & MemberCompensation> = []) {
    for (const r of rows) {
      this.byKey.set(`${r.tenantId}:${r.email.toLowerCase()}`, {
        email: r.email,
        name: r.name,
        basicSalary: r.basicSalary,
        da: r.da,
        shiftStart: r.shiftStart,
        shiftEnd: r.shiftEnd,
      });
    }
  }

  async getCompensation(tenantId: string, email: string): Promise<MemberCompensation | null> {
    return this.byKey.get(`${tenantId}:${email.toLowerCase()}`) ?? null;
  }

  async listAllForTenant(tenantId: string): Promise<MemberCompensation[]> {
    const prefix = `${tenantId}:`;
    const out: MemberCompensation[] = [];
    for (const [key, value] of this.byKey) {
      if (key.startsWith(prefix)) out.push(value);
    }
    return out;
  }

  set(tenantId: string, m: MemberCompensation): void {
    this.byKey.set(`${tenantId}:${m.email.toLowerCase()}`, m);
  }
}

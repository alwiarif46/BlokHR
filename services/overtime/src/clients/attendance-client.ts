/**
 * Attendance client — fetches per-day attendance rollups for OT detection.
 *
 * Contract: for each employee that clocked out on `date` in `tenantId`, return
 * `{ email, totalWorkedMinutes }`. Fail soft (return []) when the upstream URL
 * is not configured or the request fails, so a missing dependency does not
 * block the caller — the OT detector will simply have nothing to detect.
 */

export interface AttendanceDayRecord {
  email: string;
  totalWorkedMinutes: number;
}

export interface AttendanceClient {
  getDailyForDate(tenantId: string, date: string): Promise<AttendanceDayRecord[]>;
}

interface UpstreamRow {
  email?: string;
  total_worked_minutes?: number;
  totalWorkedMinutes?: number;
  status?: string;
}

export function createHttpAttendanceClient(
  baseUrl: string | undefined = process.env.ATTENDANCE_URL ??
    process.env.MONOLITH_URL,
  internalSecret: string | undefined = process.env.INTERNAL_SECRET,
): AttendanceClient {
  return {
    async getDailyForDate(tenantId, date) {
      if (!baseUrl) return [];
      try {
        const url =
          `${baseUrl.replace(/\/$/, '')}/api/attendance/${encodeURIComponent(tenantId)}/daily` +
          `?date=${encodeURIComponent(date)}`;
        const res = await fetch(url, {
          headers: {
            ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
          },
        });
        if (!res.ok) return [];
        const body = (await res.json()) as
          | { items?: UpstreamRow[] }
          | UpstreamRow[]
          | null;
        const rows: UpstreamRow[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body!.items
            : [];
        const out: AttendanceDayRecord[] = [];
        for (const r of rows) {
          if (!r || typeof r.email !== 'string' || !r.email) continue;
          if (r.status && r.status !== 'out') continue;
          const minutes =
            typeof r.totalWorkedMinutes === 'number'
              ? r.totalWorkedMinutes
              : typeof r.total_worked_minutes === 'number'
                ? r.total_worked_minutes
                : 0;
          out.push({ email: r.email, totalWorkedMinutes: minutes });
        }
        return out;
      } catch {
        return [];
      }
    },
  };
}

export class StubAttendanceClient implements AttendanceClient {
  constructor(
    private readonly data: Record<string, AttendanceDayRecord[]> = {},
  ) {}

  async getDailyForDate(tenantId: string, date: string): Promise<AttendanceDayRecord[]> {
    return this.data[`${tenantId}:${date}`] ?? [];
  }

  set(tenantId: string, date: string, rows: AttendanceDayRecord[]): void {
    this.data[`${tenantId}:${date}`] = rows;
  }
}

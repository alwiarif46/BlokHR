/**
 * Holidays client — determines if a date is a mandatory holiday for a tenant.
 * Fail soft (return `false`) when the upstream URL is not configured or the
 * request fails: a missing holiday feed just means OT is computed as weekday.
 */

export interface HolidaysClient {
  isMandatoryHoliday(tenantId: string, date: string): Promise<boolean>;
}

interface UpstreamHoliday {
  date?: string;
  type?: string;
  active?: number | boolean;
}

export function createHttpHolidaysClient(
  baseUrl: string | undefined = process.env.HOLIDAYS_URL ??
    process.env.MONOLITH_URL,
  internalSecret: string | undefined = process.env.INTERNAL_SECRET,
): HolidaysClient {
  return {
    async isMandatoryHoliday(tenantId, date) {
      if (!baseUrl) return false;
      try {
        const url =
          `${baseUrl.replace(/\/$/, '')}/api/holidays/${encodeURIComponent(tenantId)}` +
          `?date=${encodeURIComponent(date)}`;
        const res = await fetch(url, {
          headers: {
            ...(internalSecret ? { 'X-Blok-Internal': internalSecret } : {}),
          },
        });
        if (!res.ok) return false;
        const body = (await res.json()) as
          | { items?: UpstreamHoliday[]; isHoliday?: boolean }
          | UpstreamHoliday[]
          | null;
        if (body && !Array.isArray(body) && typeof body.isHoliday === 'boolean') {
          return body.isHoliday;
        }
        const rows: UpstreamHoliday[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body!.items
            : [];
        return rows.some(
          (r) =>
            r &&
            r.date === date &&
            (r.type === 'mandatory' || r.type === undefined) &&
            (r.active === undefined || r.active === 1 || r.active === true),
        );
      } catch {
        return false;
      }
    },
  };
}

export class StubHolidaysClient implements HolidaysClient {
  private readonly set = new Set<string>();

  constructor(dates: Array<{ tenantId: string; date: string }> = []) {
    for (const d of dates) this.set.add(`${d.tenantId}:${d.date}`);
  }

  async isMandatoryHoliday(tenantId: string, date: string): Promise<boolean> {
    return this.set.has(`${tenantId}:${date}`);
  }

  add(tenantId: string, date: string): void {
    this.set.add(`${tenantId}:${date}`);
  }
}

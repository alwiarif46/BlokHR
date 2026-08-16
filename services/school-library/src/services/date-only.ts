/** Date-only helpers for circulation (YYYY-MM-DD). */

export function toDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function addDays(dateOnly: string, days: number): string {
  const dt = parseDateOnly(dateOnly);
  if (!dt) throw new Error('invalid_date');
  dt.setUTCDate(dt.getUTCDate() + days);
  return toDateOnly(dt);
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

/** Signed calendar-day difference from `from` to `to` (UTC date-only). */
export function calendarDaysBetween(from: string, to: string): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) throw new Error('invalid_date');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

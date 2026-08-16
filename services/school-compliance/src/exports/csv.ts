/** Copied from backend/src/routes/export.ts — do not import across packages. */
export function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

export function buildCsv(headers: readonly string[], rows: unknown[][]): string {
  return [csvRow([...headers]), ...rows.map((r) => csvRow(r))].join('\n');
}

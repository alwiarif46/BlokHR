import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';

export interface HolidayRow {
  [key: string]: unknown;
  id: number;
  date: string;
  name: string;
  type: string;
  year: number;
  active: number;
}

export interface HolidaySelectionRow {
  [key: string]: unknown;
  id: number;
  email: string;
  holiday_id: number;
  year: number;
}

export class HolidayRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Get all active holidays for a year. */
  async getByYear(year: number): Promise<HolidayRow[]> {
    return this.db.all<HolidayRow>(
      'SELECT * FROM holidays WHERE tenant_id = ? AND year = ? AND active = 1 ORDER BY date',
      [getTenantId(), year],
    );
  }

  /** Get all holidays (including inactive) for admin. */
  async getAllByYear(year: number): Promise<HolidayRow[]> {
    return this.db.all<HolidayRow>(
      'SELECT * FROM holidays WHERE tenant_id = ? AND year = ? ORDER BY date',
      [getTenantId(), year],
    );
  }

  /** Get a holiday by ID. */
  async getById(id: number): Promise<HolidayRow | null> {
    return this.db.get<HolidayRow>(
      'SELECT * FROM holidays WHERE tenant_id = ? AND id = ?',
      [getTenantId(), id],
    );
  }

  /** Check if a date is a mandatory holiday. */
  async isMandatoryHoliday(date: string): Promise<boolean> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM holidays WHERE tenant_id = ? AND date = ? AND type = 'mandatory' AND active = 1",
      [getTenantId(), date],
    );
    return (row?.cnt ?? 0) > 0;
  }

  /** Get all mandatory holiday dates for a year (for scheduler/leave calc). */
  async getMandatoryDates(year: number): Promise<string[]> {
    const rows = await this.db.all<{ date: string }>(
      "SELECT date FROM holidays WHERE tenant_id = ? AND year = ? AND type = 'mandatory' AND active = 1 ORDER BY date",
      [getTenantId(), year],
    );
    return rows.map((r) => r.date);
  }

  /** Check if a date is a holiday for a specific employee (mandatory OR selected optional). */
  async isHolidayForEmployee(date: string, email: string): Promise<boolean> {
    const tenantId = getTenantId();
    const row = await this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM holidays h
       LEFT JOIN employee_holiday_selections s
         ON h.id = s.holiday_id AND s.tenant_id = h.tenant_id AND s.email = ?
       WHERE h.tenant_id = ? AND h.date = ? AND h.active = 1
         AND (h.type = 'mandatory' OR s.id IS NOT NULL)`,
      [email, tenantId, date],
    );
    return (row?.cnt ?? 0) > 0;
  }

  /** Create a holiday. */
  async create(data: {
    date: string;
    name: string;
    type: string;
    year: number;
  }): Promise<HolidayRow> {
    const tenantId = getTenantId();
    await this.db.run(
      'INSERT INTO holidays (tenant_id, date, name, type, year) VALUES (?, ?, ?, ?, ?)',
      [tenantId, data.date, data.name, data.type, data.year],
    );
    const row = await this.db.get<HolidayRow>(
      'SELECT * FROM holidays WHERE tenant_id = ? AND date = ? AND name = ?',
      [tenantId, data.date, data.name],
    );
    if (!row) throw new Error('Failed to create holiday');
    return row;
  }

  /** Update a holiday. */
  async update(
    id: number,
    fields: Partial<{ date: string; name: string; type: string; active: boolean }>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (fields.date !== undefined) {
      sets.push('date = ?');
      vals.push(fields.date);
    }
    if (fields.name !== undefined) {
      sets.push('name = ?');
      vals.push(fields.name);
    }
    if (fields.type !== undefined) {
      sets.push('type = ?');
      vals.push(fields.type);
    }
    if (fields.active !== undefined) {
      sets.push('active = ?');
      vals.push(fields.active ? 1 : 0);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(getTenantId(), id);
    await this.db.run(
      `UPDATE holidays SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      vals,
    );
  }

  /** Delete a holiday. */
  async remove(id: number): Promise<void> {
    const tenantId = getTenantId();
    await this.db.run(
      'DELETE FROM employee_holiday_selections WHERE tenant_id = ? AND holiday_id = ?',
      [tenantId, id],
    );
    await this.db.run('DELETE FROM holidays WHERE tenant_id = ? AND id = ?', [tenantId, id]);
  }

  // ── Employee selections ──

  /** Get an employee's selected optional holidays for a year. */
  async getSelections(email: string, year: number): Promise<HolidayRow[]> {
    const tenantId = getTenantId();
    return this.db.all<HolidayRow>(
      `SELECT h.* FROM holidays h
       INNER JOIN employee_holiday_selections s ON h.id = s.holiday_id AND s.tenant_id = h.tenant_id
       WHERE h.tenant_id = ? AND s.email = ? AND s.year = ? AND h.active = 1
       ORDER BY h.date`,
      [tenantId, email, year],
    );
  }

  /** Count an employee's selections for a year. */
  async countSelections(email: string, year: number): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM employee_holiday_selections WHERE tenant_id = ? AND email = ? AND year = ?',
      [getTenantId(), email, year],
    );
    return row?.cnt ?? 0;
  }

  /** Add a selection. */
  async addSelection(email: string, holidayId: number, year: number): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO employee_holiday_selections (tenant_id, email, holiday_id, year) VALUES (?, ?, ?, ?)',
      [getTenantId(), email, holidayId, year],
    );
  }

  /** Remove a selection. */
  async removeSelection(email: string, holidayId: number): Promise<void> {
    await this.db.run(
      'DELETE FROM employee_holiday_selections WHERE tenant_id = ? AND email = ? AND holiday_id = ?',
      [getTenantId(), email, holidayId],
    );
  }

  /** Get the optional holiday limit from system settings. */
  async getOptionalLimit(): Promise<number> {
    const row = await this.db.get<{ optional_holidays_per_year: number; [key: string]: unknown }>(
      'SELECT optional_holidays_per_year FROM system_settings WHERE id = 1',
    );
    return row?.optional_holidays_per_year ?? 2;
  }
}

import type { DatabaseEngine } from '../db/engine';

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
      'SELECT * FROM holidays WHERE year = ? AND active = 1 ORDER BY date',
      [year],
    );
  }

  /** Get all holidays (including inactive) for admin. */
  async getAllByYear(year: number): Promise<HolidayRow[]> {
    return this.db.all<HolidayRow>('SELECT * FROM holidays WHERE year = ? ORDER BY date', [year]);
  }

  /** Get a holiday by ID. */
  async getById(id: number): Promise<HolidayRow | null> {
    return this.db.get<HolidayRow>('SELECT * FROM holidays WHERE id = ?', [id]);
  }

  /** Check if a date is a mandatory holiday. */
  async isMandatoryHoliday(date: string): Promise<boolean> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM holidays WHERE date = ? AND type = 'mandatory' AND active = 1",
      [date],
    );
    return (row?.cnt ?? 0) > 0;
  }

  /** Get all mandatory holiday dates for a year (for scheduler/leave calc). */
  async getMandatoryDates(year: number): Promise<string[]> {
    const rows = await this.db.all<{ date: string }>(
      "SELECT date FROM holidays WHERE year = ? AND type = 'mandatory' AND active = 1 ORDER BY date",
      [year],
    );
    return rows.map((r) => r.date);
  }

  /** Check if a date is a holiday for a specific employee (mandatory OR selected optional). */
  async isHolidayForEmployee(date: string, email: string): Promise<boolean> {
    const row = await this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM holidays h
       LEFT JOIN employee_holiday_selections s ON h.id = s.holiday_id AND s.email = ?
       WHERE h.date = ? AND h.active = 1
         AND (h.type = 'mandatory' OR s.id IS NOT NULL)`,
      [email, date],
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
    await this.db.run('INSERT INTO holidays (date, name, type, year) VALUES (?, ?, ?, ?)', [
      data.date,
      data.name,
      data.type,
      data.year,
    ]);
    const row = await this.db.get<HolidayRow>(
      'SELECT * FROM holidays WHERE date = ? AND name = ?',
      [data.date, data.name],
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
    vals.push(id);
    await this.db.run(`UPDATE holidays SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Delete a holiday. */
  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM employee_holiday_selections WHERE holiday_id = ?', [id]);
    await this.db.run('DELETE FROM holidays WHERE id = ?', [id]);
  }

  // ── Employee selections ──

  /** Get an employee's selected optional holidays for a year. */
  async getSelections(email: string, year: number): Promise<HolidayRow[]> {
    return this.db.all<HolidayRow>(
      `SELECT h.* FROM holidays h
       INNER JOIN employee_holiday_selections s ON h.id = s.holiday_id
       WHERE s.email = ? AND s.year = ? AND h.active = 1
       ORDER BY h.date`,
      [email, year],
    );
  }

  /** Count an employee's selections for a year. */
  async countSelections(email: string, year: number): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM employee_holiday_selections WHERE email = ? AND year = ?',
      [email, year],
    );
    return row?.cnt ?? 0;
  }

  /** Add a selection. */
  async addSelection(email: string, holidayId: number, year: number): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO employee_holiday_selections (email, holiday_id, year) VALUES (?, ?, ?)',
      [email, holidayId, year],
    );
  }

  /** Remove a selection. */
  async removeSelection(email: string, holidayId: number): Promise<void> {
    await this.db.run(
      'DELETE FROM employee_holiday_selections WHERE email = ? AND holiday_id = ?',
      [email, holidayId],
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

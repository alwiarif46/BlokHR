import type { Logger } from 'pino';
import type { HolidayRepository, HolidayRow } from '../repositories/holiday-repository';

export interface HolidayView {
  id: number;
  date: string;
  name: string;
  type: string;
  year: number;
  active: boolean;
}

/**
 * Holiday Calendar service.
 *
 * - Admin: CRUD holidays (mandatory/optional/restricted)
 * - Employee: select optional holidays up to configured limit
 * - Integration: scheduler + leave calculator call isHoliday/getMandatoryDates
 */
export class HolidayService {
  constructor(
    private readonly repo: HolidayRepository,
    private readonly logger: Logger,
  ) {}

  async getByYear(year: number): Promise<HolidayView[]> {
    const rows = await this.repo.getByYear(year);
    return rows.map((r) => this.toView(r));
  }

  async getAllByYear(year: number): Promise<HolidayView[]> {
    const rows = await this.repo.getAllByYear(year);
    return rows.map((r) => this.toView(r));
  }

  async create(data: {
    date: string;
    name: string;
    type?: string;
    year?: number;
  }): Promise<{ success: boolean; holiday?: HolidayView; error?: string }> {
    if (!data.date) return { success: false, error: 'Date is required' };
    if (!data.name?.trim()) return { success: false, error: 'Holiday name is required' };

    const type = data.type ?? 'mandatory';
    if (!['mandatory', 'optional', 'restricted'].includes(type)) {
      return { success: false, error: 'Type must be mandatory, optional, or restricted' };
    }

    const year = data.year ?? parseInt(data.date.substring(0, 4), 10);

    try {
      const row = await this.repo.create({ date: data.date, name: data.name.trim(), type, year });
      this.logger.info({ id: row.id, date: data.date, name: data.name }, 'Holiday created');
      return { success: true, holiday: this.toView(row) };
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return { success: false, error: 'A holiday already exists on this date with this name' };
      }
      throw err;
    }
  }

  async update(
    id: number,
    fields: Partial<{ date: string; name: string; type: string; active: boolean }>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'Holiday not found' };

    if (
      fields.type !== undefined &&
      !['mandatory', 'optional', 'restricted'].includes(fields.type)
    ) {
      return { success: false, error: 'Type must be mandatory, optional, or restricted' };
    }

    await this.repo.update(id, fields);
    this.logger.info({ id, fields: Object.keys(fields) }, 'Holiday updated');
    return { success: true };
  }

  async remove(id: number): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'Holiday not found' };
    await this.repo.remove(id);
    this.logger.info({ id, name: existing.name }, 'Holiday deleted');
    return { success: true };
  }

  // ── Employee selections ──

  async getSelections(email: string, year: number): Promise<HolidayView[]> {
    const rows = await this.repo.getSelections(email, year);
    return rows.map((r) => this.toView(r));
  }

  async selectHoliday(
    email: string,
    holidayId: number,
  ): Promise<{ success: boolean; error?: string }> {
    const holiday = await this.repo.getById(holidayId);
    if (!holiday || holiday.active !== 1) return { success: false, error: 'Holiday not found' };
    if (holiday.type === 'mandatory')
      return {
        success: false,
        error: 'Mandatory holidays cannot be selected — they apply to everyone',
      };

    const limit = await this.repo.getOptionalLimit();
    const currentCount = await this.repo.countSelections(email, holiday.year);
    if (currentCount >= limit) {
      return { success: false, error: `You can only select ${limit} optional holidays per year` };
    }

    await this.repo.addSelection(email, holidayId, holiday.year);
    this.logger.info({ email, holidayId, name: holiday.name }, 'Optional holiday selected');
    return { success: true };
  }

  async deselectHoliday(
    email: string,
    holidayId: number,
  ): Promise<{ success: boolean; error?: string }> {
    const holiday = await this.repo.getById(holidayId);
    if (!holiday) return { success: false, error: 'Holiday not found' };

    await this.repo.removeSelection(email, holidayId);
    this.logger.info({ email, holidayId }, 'Optional holiday deselected');
    return { success: true };
  }

  // ── Integration helpers ──

  /** Check if a date is a holiday for a specific employee. Used by leave calculator. */
  async isHolidayForEmployee(date: string, email: string): Promise<boolean> {
    return this.repo.isHolidayForEmployee(date, email);
  }

  /** Check if a date is a mandatory holiday. Used by scheduler for absence marking. */
  async isMandatoryHoliday(date: string): Promise<boolean> {
    return this.repo.isMandatoryHoliday(date);
  }

  /** Get all mandatory dates for a year. Used by leave day counter to exclude holidays. */
  async getMandatoryDates(year: number): Promise<string[]> {
    return this.repo.getMandatoryDates(year);
  }

  /**
   * Count business days between two dates, excluding weekends + holidays.
   * Used by leave submission to calculate days_requested.
   */
  async countBusinessDays(
    startDate: string,
    endDate: string,
    email: string,
    excludeWeekends: boolean = true,
  ): Promise<number> {
    let count = 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0];
      const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat

      if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const isHoliday = await this.repo.isHolidayForEmployee(dateStr, email);
      if (!isHoliday) {
        count++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  private toView(r: HolidayRow): HolidayView {
    return {
      id: r.id,
      date: r.date,
      name: r.name,
      type: r.type,
      year: r.year,
      active: r.active === 1,
    };
  }
}

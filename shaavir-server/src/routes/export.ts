import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';

/**
 * CSV Export routes:
 *   GET /api/export/attendance?startDate=&endDate=&groupId=&email=
 *   GET /api/export/leaves?startDate=&endDate=&groupId=&email=&status=
 *   GET /api/export/lates?startDate=&endDate=&groupId=&email=
 */
export function createExportRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();

  function validateDates(startDate: string | undefined, endDate: string | undefined): { start: string; end: string } {
    if (!startDate || !endDate) throw new AppError('startDate and endDate are required (YYYY-MM-DD)', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new AppError('startDate must be YYYY-MM-DD', 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new AppError('endDate must be YYYY-MM-DD', 400);
    if (startDate > endDate) throw new AppError('startDate must be <= endDate', 400);
    return { start: startDate, end: endDate };
  }

  function escapeCsv(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function csvRow(fields: unknown[]): string {
    return fields.map(escapeCsv).join(',');
  }

  function sendCsv(res: Response, filename: string, headers: string[], rows: unknown[][]): void {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const lines = [csvRow(headers), ...rows.map(r => csvRow(r))];
    res.send(lines.join('\n'));
  }

  /** GET /api/export/attendance */
  router.get(
    '/export/attendance',
    asyncHandler(async (req: Request, res: Response) => {
      const { start, end } = validateDates(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined,
      );
      const groupId = req.query.groupId as string | undefined;
      const email = req.query.email as string | undefined;

      let sql = `
        SELECT ad.email, ad.name, ad.group_id, ad.date, ad.first_in, ad.last_out,
               ad.total_worked_minutes, ad.is_late, ad.status_source
        FROM attendance_daily ad
        WHERE ad.date >= ? AND ad.date <= ?
      `;
      const params: unknown[] = [start, end];
      if (groupId) { sql += ' AND ad.group_id = ?'; params.push(groupId); }
      if (email) { sql += ' AND ad.email = ?'; params.push(email); }
      sql += ' ORDER BY ad.date, ad.name';

      const rows = await db.all<Record<string, unknown>>(sql, params);
      logger.info({ count: rows.length, start, end }, 'Attendance export');

      sendCsv(res, `attendance_${start}_${end}.csv`,
        ['Email', 'Name', 'Group', 'Date', 'First In', 'Last Out', 'Worked Minutes', 'Late', 'Source'],
        rows.map(r => [r.email, r.name, r.group_id, r.date, r.first_in, r.last_out, r.total_worked_minutes, r.is_late, r.status_source]),
      );
    }),
  );

  /** GET /api/export/leaves */
  router.get(
    '/export/leaves',
    asyncHandler(async (req: Request, res: Response) => {
      const { start, end } = validateDates(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined,
      );
      const groupId = req.query.groupId as string | undefined;
      const email = req.query.email as string | undefined;
      const status = req.query.status as string | undefined;

      let sql = `
        SELECT lr.person_email, lr.person_name, lr.leave_type, lr.kind, lr.start_date, lr.end_date,
               lr.days_requested, lr.status, lr.reason, lr.manager_approver_email, lr.hr_approver_email
        FROM leave_requests lr
        LEFT JOIN members m ON m.email = lr.person_email
        WHERE lr.start_date >= ? AND lr.start_date <= ?
      `;
      const params: unknown[] = [start, end];
      if (groupId) { sql += ' AND m.group_id = ?'; params.push(groupId); }
      if (email) { sql += ' AND lr.person_email = ?'; params.push(email); }
      if (status) { sql += ' AND lr.status = ?'; params.push(status); }
      sql += ' ORDER BY lr.start_date, lr.person_name';

      const rows = await db.all<Record<string, unknown>>(sql, params);
      logger.info({ count: rows.length, start, end }, 'Leaves export');

      sendCsv(res, `leaves_${start}_${end}.csv`,
        ['Email', 'Name', 'Type', 'Kind', 'Start', 'End', 'Days', 'Status', 'Reason', 'Manager', 'HR'],
        rows.map(r => [r.person_email, r.person_name, r.leave_type, r.kind, r.start_date, r.end_date, r.days_requested, r.status, r.reason, r.manager_approver_email, r.hr_approver_email]),
      );
    }),
  );

  /** GET /api/export/lates */
  router.get(
    '/export/lates',
    asyncHandler(async (req: Request, res: Response) => {
      const { start, end } = validateDates(
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined,
      );
      const groupId = req.query.groupId as string | undefined;
      const email = req.query.email as string | undefined;

      let sql = `
        SELECT ad.email, ad.name, ad.group_id, ad.date, ad.first_in, ad.total_worked_minutes
        FROM attendance_daily ad
        WHERE ad.date >= ? AND ad.date <= ? AND ad.is_late = 1
      `;
      const params: unknown[] = [start, end];
      if (groupId) { sql += ' AND ad.group_id = ?'; params.push(groupId); }
      if (email) { sql += ' AND ad.email = ?'; params.push(email); }
      sql += ' ORDER BY ad.date, ad.name';

      const rows = await db.all<Record<string, unknown>>(sql, params);
      logger.info({ count: rows.length, start, end }, 'Lates export');

      sendCsv(res, `lates_${start}_${end}.csv`,
        ['Email', 'Name', 'Group', 'Date', 'First In', 'Worked Minutes'],
        rows.map(r => [r.email, r.name, r.group_id, r.date, r.first_in, r.total_worked_minutes]),
      );
    }),
  );

  return router;
}

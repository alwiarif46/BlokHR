import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { HolidayRepository } from '../repositories/holiday-repository';
import { HolidayService } from '../services/holiday-service';
import {
  decodeImportBase64,
  importHolidayRows,
  parseHolidayWorkbook,
  type HolidayImportRow,
} from '../services/holiday-import';

/**
 * Holiday Calendar routes:
 *   GET    /api/holidays?year=          — list active holidays for a year
 *   GET    /api/holidays/all?year=      — admin: list all including inactive
 *   POST   /api/holidays                — admin: create a holiday
 *   POST   /api/holidays/import         — admin: import from Excel/CSV (base64 or rows)
 *   PUT    /api/holidays/:id            — admin: update a holiday
 *   DELETE /api/holidays/:id            — admin: delete a holiday
 *   GET    /api/holidays/my-selections?year=  — employee's selected optional holidays
 *   POST   /api/holidays/select         — employee selects an optional holiday
 *   POST   /api/holidays/deselect       — employee deselects an optional holiday
 *   GET    /api/holidays/is-holiday?date=&email= — check if date is holiday for employee
 *   GET    /api/holidays/business-days?start=&end=&email= — count business days excluding holidays
 */
export function createHolidayRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new HolidayRepository(db);
  const service = new HolidayService(repo, logger);

  async function requireAdmin(req: Request): Promise<string> {
    const callerEmail = req.identity?.email ?? '';
    if (!callerEmail) throw new AppError('Authentication required', 401);
    const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
    if (!isAdmin) throw new AppError('Admin access required', 403);
    return callerEmail;
  }

  router.get(
    '/holidays',
    asyncHandler(async (req: Request, res: Response) => {
      const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
      const holidays = await service.getByYear(year);
      res.json({ holidays });
    }),
  );

  router.get(
    '/holidays/all',
    asyncHandler(async (req: Request, res: Response) => {
      const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
      const holidays = await service.getAllByYear(year);
      res.json({ holidays });
    }),
  );

  router.post(
    '/holidays',
    asyncHandler(async (req: Request, res: Response) => {
      const { date, name, type, year } = req.body as {
        date?: string;
        name?: string;
        type?: string;
        year?: number;
      };
      if (!date || !name) throw new AppError('date and name are required', 400);
      const result = await service.create({ date, name, type, year });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  /**
   * POST /api/holidays/import — admin only.
   * Body: { contentBase64, filename? } OR { rows: [{ date, name, type? }] }
   */
  router.post(
    '/holidays/import',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireAdmin(req);
      const body = (req.body ?? {}) as {
        contentBase64?: string;
        filename?: string;
        rows?: HolidayImportRow[];
      };

      let rows: HolidayImportRow[] = [];
      let parseErrors: { row: number; message: string }[] = [];

      if (Array.isArray(body.rows) && body.rows.length > 0) {
        rows = body.rows;
      } else if (typeof body.contentBase64 === 'string' && body.contentBase64.length > 0) {
        let buffer: Buffer;
        try {
          buffer = decodeImportBase64(body.contentBase64);
        } catch (err) {
          throw new AppError(err instanceof Error ? err.message : 'Invalid file', 400);
        }
        const parsed = parseHolidayWorkbook(buffer);
        rows = parsed.rows;
        parseErrors = parsed.parseErrors;
      } else {
        throw new AppError('Provide contentBase64 (Excel/CSV) or rows[]', 400);
      }

      if (rows.length === 0 && parseErrors.length > 0) {
        throw new AppError(parseErrors[0]?.message ?? 'Nothing to import', 400);
      }

      const result = await importHolidayRows(service, rows, logger, parseErrors);
      logger.info(
        { callerEmail, filename: body.filename, created: result.created, skipped: result.skipped },
        'Admin imported holidays',
      );
      res.json({ success: true, ...result });
    }),
  );

  router.put(
    '/holidays/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid holiday ID', 400);
      const result = await service.update(id, req.body as Record<string, unknown>);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.delete(
    '/holidays/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid holiday ID', 400);
      const result = await service.remove(id);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  // ── Employee selections ──

  router.get(
    '/holidays/my-selections',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? '';
      if (!email) throw new AppError('Authentication required', 401);
      const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
      const selections = await service.getSelections(email, year);
      res.json({ selections });
    }),
  );

  router.post(
    '/holidays/select',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? '';
      if (!email) throw new AppError('Authentication required', 401);
      const { holidayId } = req.body as { holidayId?: number };
      if (!holidayId) throw new AppError('holidayId is required', 400);
      const result = await service.selectHoliday(email, holidayId);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.post(
    '/holidays/deselect',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? '';
      if (!email) throw new AppError('Authentication required', 401);
      const { holidayId } = req.body as { holidayId?: number };
      if (!holidayId) throw new AppError('holidayId is required', 400);
      const result = await service.deselectHoliday(email, holidayId);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  // ── Integration endpoints ──

  router.get(
    '/holidays/is-holiday',
    asyncHandler(async (req: Request, res: Response) => {
      const { date, email } = req.query as { date?: string; email?: string };
      if (!date) throw new AppError('date query param is required', 400);
      const targetEmail = email ?? req.identity?.email ?? '';
      const isHoliday = await service.isHolidayForEmployee(date, targetEmail);
      res.json({ date, isHoliday });
    }),
  );

  router.get(
    '/holidays/business-days',
    asyncHandler(async (req: Request, res: Response) => {
      const { start, end, email } = req.query as { start?: string; end?: string; email?: string };
      if (!start || !end) throw new AppError('start and end query params are required', 400);
      const targetEmail = email ?? req.identity?.email ?? '';
      const days = await service.countBusinessDays(start, end, targetEmail);
      res.json({ start, end, businessDays: days });
    }),
  );

  return router;
}

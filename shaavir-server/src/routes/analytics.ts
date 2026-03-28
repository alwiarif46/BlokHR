import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AnalyticsRepository } from '../repositories/analytics-repository';
import { AnalyticsService } from '../services/analytics-service';

/**
 * Analytics & Reports routes (all read-only):
 *   GET /api/analytics/attendance     — attendance overview per employee
 *   GET /api/analytics/leaves         — leave usage report
 *   GET /api/analytics/overtime       — overtime report
 *   GET /api/analytics/departments    — per-department dashboard
 *   GET /api/analytics/utilization    — billable vs non-billable hours
 *   GET /api/analytics/trends         — attendance trend over time
 */
export function createAnalyticsRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new AnalyticsRepository(db);
  const service = new AnalyticsService(repo, logger);

  /** Require startDate and endDate query params. Returns [startDate, endDate]. */
  function requireDateRange(req: Request): [string, string] {
    const startDate = (req.query.startDate as string) ?? '';
    const endDate = (req.query.endDate as string) ?? '';
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate query params are required', 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new AppError('startDate and endDate must be YYYY-MM-DD', 400);
    }
    if (startDate > endDate) {
      throw new AppError('startDate must not be after endDate', 400);
    }
    return [startDate, endDate];
  }

  router.get(
    '/analytics/attendance',
    asyncHandler(async (req: Request, res: Response) => {
      const [startDate, endDate] = requireDateRange(req);
      const report = await service.getAttendanceOverview({
        startDate,
        endDate,
        groupId: (req.query.groupId as string) || undefined,
        email: (req.query.email as string) || undefined,
      });
      res.json(report);
    }),
  );

  router.get(
    '/analytics/leaves',
    asyncHandler(async (req: Request, res: Response) => {
      const [startDate, endDate] = requireDateRange(req);
      const report = await service.getLeaveReport({
        startDate,
        endDate,
        groupId: (req.query.groupId as string) || undefined,
        email: (req.query.email as string) || undefined,
      });
      res.json(report);
    }),
  );

  router.get(
    '/analytics/overtime',
    asyncHandler(async (req: Request, res: Response) => {
      const [startDate, endDate] = requireDateRange(req);
      const report = await service.getOvertimeReport({
        startDate,
        endDate,
        groupId: (req.query.groupId as string) || undefined,
        email: (req.query.email as string) || undefined,
      });
      res.json(report);
    }),
  );

  router.get(
    '/analytics/departments',
    asyncHandler(async (req: Request, res: Response) => {
      const today = (req.query.today as string) || new Date().toISOString().slice(0, 10);
      const periodStart = (req.query.startDate as string) || undefined;
      const periodEnd = (req.query.endDate as string) || undefined;
      const report = await service.getDepartmentDashboard(today, periodStart, periodEnd);
      res.json(report);
    }),
  );

  router.get(
    '/analytics/utilization',
    asyncHandler(async (req: Request, res: Response) => {
      const [startDate, endDate] = requireDateRange(req);
      const report = await service.getUtilization({
        startDate,
        endDate,
        email: (req.query.email as string) || undefined,
        projectId: (req.query.projectId as string) || undefined,
        clientId: (req.query.clientId as string) || undefined,
      });
      res.json(report);
    }),
  );

  router.get(
    '/analytics/trends',
    asyncHandler(async (req: Request, res: Response) => {
      const [startDate, endDate] = requireDateRange(req);
      const groupBy = (req.query.groupBy as string) || 'day';
      if (groupBy !== 'day' && groupBy !== 'week' && groupBy !== 'month') {
        throw new AppError('groupBy must be day, week, or month', 400);
      }
      const report = await service.getAttendanceTrend({
        startDate,
        endDate,
        groupId: (req.query.groupId as string) || undefined,
        groupBy: groupBy as 'day' | 'week' | 'month',
      });
      res.json(report);
    }),
  );

  return router;
}

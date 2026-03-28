import type { Logger } from 'pino';
import type { SchedulerService } from './scheduler-service';

/**
 * Scheduler Runner — executes jobs on configurable intervals.
 *
 * Jobs:
 *   - Auto-cutoff: every 10 minutes
 *   - Absence marking: once daily at logical day change
 *   - PTO accrual: once monthly on configured day
 *   - Pending reminders: every N hours (configurable)
 *
 * Handles graceful shutdown via stop() — clears all intervals.
 */
export class SchedulerRunner {
  private intervals: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly service: SchedulerService,
    private readonly logger: Logger,
  ) {}

  /** Start all scheduled jobs. */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Auto-cutoff: every 10 minutes
    this.intervals.push(
      setInterval(
        () => {
          void this.runJob('auto-cutoff', () => this.service.autoCutoff());
        },
        10 * 60 * 1000,
      ),
    );

    // Absence marking: every 30 minutes (the service checks if it's the right time)
    this.intervals.push(
      setInterval(
        () => {
          void this.runJob('absence-marking', () => this.service.markAbsences());
        },
        30 * 60 * 1000,
      ),
    );

    // PTO accrual: every 6 hours (the service checks day-of-month)
    this.intervals.push(
      setInterval(
        () => {
          const now = new Date();
          // Only run on the configured accrual day (default: 1st)
          if (now.getDate() <= 1 && now.getHours() < 6) {
            void this.runJob('pto-accrual', () => this.service.accruePto());
          }
        },
        6 * 60 * 60 * 1000,
      ),
    );

    // Pending reminders: every 3 hours
    this.intervals.push(
      setInterval(
        () => {
          void this.runJob('pending-reminders', () => this.service.getPendingReminders());
        },
        3 * 60 * 60 * 1000,
      ),
    );

    this.logger.info('Scheduler started — 4 jobs registered');
  }

  /** Stop all scheduled jobs. */
  stop(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    this.running = false;
    this.logger.info('Scheduler stopped');
  }

  /** Whether the scheduler is currently running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Run a job with error isolation. */
  private async runJob(name: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      const result = await fn();
      this.logger.debug({ job: name, result }, `Scheduler job completed: ${name}`);
    } catch (err) {
      this.logger.error({ err, job: name }, `Scheduler job failed: ${name}`);
    }
  }
}

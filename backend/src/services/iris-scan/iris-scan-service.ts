import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';
import type { ClockService, ClockActionResult } from '../clock-service';
import { findBestMatch } from './iris-api-client';

// ── Row types ──

export interface IrisEnrollmentRow {
  [key: string]: unknown;
  id: number;
  email: string;
  iris_template: string;
  status: string;
  error_message: string;
  enrolled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

interface SettingsRow {
  [key: string]: unknown;
  iris_match_threshold: number;
}

// ── Result types ──

export interface IrisEnrollResult {
  success: boolean;
  error?: string;
  enrollment?: IrisEnrollmentRow;
}

export interface IrisIdentifyResult {
  success: boolean;
  error?: string;
  email?: string;
  name?: string;
  distance?: number;
  clockResult?: ClockActionResult;
}

export interface IrisStatusResult {
  enrolled: boolean;
  status: string;
  errorMessage?: string;
  enrolledAt?: string | null;
}

/**
 * Iris Scan service — enrollment, server-side template matching, clock integration.
 *
 * Template matching uses Hamming distance on IrisCodes.
 * Standard threshold: 0.32 (configurable via system_settings.iris_match_threshold).
 * No cloud API needed — all matching is done in-process, sub-millisecond per comparison.
 */
export class IrisScanService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly clockService: ClockService,
    private readonly logger: Logger,
  ) {}

  /**
   * Enroll an iris template for an employee.
   * Template is base64-encoded IrisCode extracted by the device SDK.
   */
  async enroll(email: string, irisTemplate: string): Promise<IrisEnrollResult> {
    // Validate member
    const member = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Validate template is non-empty
    if (!irisTemplate || !irisTemplate.trim()) {
      return { success: false, error: 'Iris template is required' };
    }

    // Check for existing enrollment
    const existing = await this.db.get<IrisEnrollmentRow>(
      'SELECT * FROM iris_enrollments WHERE email = ?',
      [email],
    );

    if (existing) {
      // Update existing enrollment
      await this.db.run(
        `UPDATE iris_enrollments SET iris_template = ?, status = 'enrolled',
         error_message = '', enrolled_at = datetime('now'), updated_at = datetime('now')
         WHERE email = ?`,
        [irisTemplate, email],
      );
    } else {
      // Create new enrollment
      await this.db.run(
        `INSERT INTO iris_enrollments (email, iris_template, status, enrolled_at)
         VALUES (?, ?, 'enrolled', datetime('now'))`,
        [email, irisTemplate],
      );
    }

    const enrollment = await this.db.get<IrisEnrollmentRow>(
      'SELECT * FROM iris_enrollments WHERE email = ?',
      [email],
    );

    this.logger.info({ email }, 'Iris template enrolled');
    return { success: true, enrollment: enrollment ?? undefined };
  }

  /**
   * Identify an iris template against all enrolled templates, then clock.
   * Loads all enrolled templates into memory and runs Hamming distance comparison.
   */
  async identify(probeTemplate: string, action: string): Promise<IrisIdentifyResult> {
    if (!probeTemplate || !probeTemplate.trim()) {
      return { success: false, error: 'Iris template is required' };
    }

    // Load threshold
    const settings = await this.db.get<SettingsRow>(
      'SELECT iris_match_threshold FROM system_settings WHERE id = 1',
    );
    const threshold = settings?.iris_match_threshold ?? 0.32;

    // Load all enrolled templates
    const enrollments = await this.db.all<IrisEnrollmentRow>(
      "SELECT email, iris_template FROM iris_enrollments WHERE status = 'enrolled'",
    );

    if (enrollments.length === 0) {
      return { success: false, error: 'No iris templates enrolled' };
    }

    // Find best match using Hamming distance
    const match = findBestMatch(
      probeTemplate,
      enrollments.map((e) => ({ email: e.email, template: e.iris_template })),
      threshold,
    );

    if (!match) {
      return { success: false, error: 'No matching iris found' };
    }

    // Resolve member name for clock
    const member = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [match.email],
    );
    if (!member) {
      return { success: false, error: 'Matched employee is no longer active' };
    }

    // Clock the action
    const clockResult = await this.clockService.clock(action, member.email, member.name, 'iris');

    this.logger.info(
      { email: member.email, distance: match.distance, action },
      'Iris identification and clock',
    );

    return {
      success: clockResult.success,
      error: clockResult.error,
      email: member.email,
      name: member.name,
      distance: match.distance,
      clockResult,
    };
  }

  /** Get enrollment status for an employee. */
  async getStatus(email: string): Promise<IrisStatusResult> {
    const enrollment = await this.db.get<IrisEnrollmentRow>(
      'SELECT * FROM iris_enrollments WHERE email = ?',
      [email],
    );

    if (!enrollment) {
      return { enrolled: false, status: 'not_enrolled' };
    }

    return {
      enrolled: enrollment.status === 'enrolled',
      status: enrollment.status,
      errorMessage: enrollment.error_message || undefined,
      enrolledAt: enrollment.enrolled_at,
    };
  }

  /** Remove an iris enrollment. */
  async removeEnrollment(email: string): Promise<{ success: boolean; error?: string }> {
    const enrollment = await this.db.get<IrisEnrollmentRow>(
      'SELECT * FROM iris_enrollments WHERE email = ?',
      [email],
    );

    if (!enrollment) {
      return { success: false, error: 'No enrollment found for this employee' };
    }

    await this.db.run('DELETE FROM iris_enrollments WHERE email = ?', [email]);
    this.logger.info({ email }, 'Iris enrollment removed');
    return { success: true };
  }
}

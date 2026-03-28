import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';
import type { FaceApiClient } from './face-api-client';
import type { ClockService, ClockActionResult } from '../clock-service';

// ── Row types ──

export interface FaceEnrollmentRow {
  [key: string]: unknown;
  id: number;
  email: string;
  person_group_id: string;
  azure_person_id: string;
  status: string;
  error_message: string;
  enrolled_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Result types ──

export interface EnrollResult {
  success: boolean;
  error?: string;
  enrollment?: FaceEnrollmentRow;
}

export interface IdentifyResult {
  success: boolean;
  error?: string;
  email?: string;
  name?: string;
  confidence?: number;
  clockResult?: ClockActionResult;
}

export interface EnrollmentStatus {
  enrolled: boolean;
  status: string;
  errorMessage?: string;
  enrolledAt?: string | null;
}

export class FaceRecognitionService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly faceApi: FaceApiClient,
    private readonly clockService: ClockService,
    private readonly logger: Logger,
  ) {}

  /**
   * Enroll an employee's face for recognition.
   * Creates a person in the Azure person group, adds the face, triggers training.
   */
  async enrollFace(email: string, imageBuffer: Buffer): Promise<EnrollResult> {
    // Verify employee exists
    const member = await this.db.get<{ email: string; name: string; [key: string]: unknown }>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Check for existing enrollment
    const existing = await this.getEnrollmentRow(email);
    if (existing && existing.status === 'enrolled') {
      return { success: false, error: 'Face already enrolled. Remove existing enrollment first.' };
    }

    // Get person group ID from settings
    const groupId = await this.getPersonGroupId();

    // If there was a failed enrollment, remove the old row
    if (existing) {
      await this.db.run('DELETE FROM face_enrollments WHERE email = ?', [email]);
    }

    // Insert pending enrollment
    await this.db.run(
      `INSERT INTO face_enrollments (email, person_group_id, status)
       VALUES (?, ?, 'pending')`,
      [email, groupId],
    );

    try {
      // Ensure person group exists (idempotent — Azure returns 409 if already exists, which is fine)
      try {
        await this.faceApi.createPersonGroup(groupId, 'Shaavir Employees');
      } catch (err) {
        // 409 = group already exists, that's expected
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('409') && !msg.includes('already exists') && !msg.includes('Conflict')) {
          throw err;
        }
      }

      // Create person in the group
      const personId = await this.faceApi.createPerson(groupId, member.name);

      // Add face image
      await this.faceApi.addPersonFace(groupId, personId, imageBuffer);

      // Train the group (async on Azure side — we fire and don't wait for completion)
      await this.faceApi.trainPersonGroup(groupId);

      // Mark enrolled
      const now = new Date().toISOString();
      await this.db.run(
        `UPDATE face_enrollments
         SET azure_person_id = ?, status = 'enrolled', enrolled_at = ?, error_message = '', updated_at = datetime('now')
         WHERE email = ?`,
        [personId, now, email],
      );

      const enrollment = await this.getEnrollmentRow(email);
      this.logger.info({ email, personId }, 'Face enrolled successfully');
      return { success: true, enrollment: enrollment ?? undefined };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.db.run(
        `UPDATE face_enrollments
         SET status = 'failed', error_message = ?, updated_at = datetime('now')
         WHERE email = ?`,
        [errorMsg, email],
      );
      this.logger.error({ email, err: errorMsg }, 'Face enrollment failed');
      return { success: false, error: `Enrollment failed: ${errorMsg}` };
    }
  }

  /**
   * Identify a face from an image and clock in/out the matched employee.
   */
  async identifyAndClock(
    imageBuffer: Buffer,
    action: string,
  ): Promise<IdentifyResult> {
    const validActions = new Set(['in', 'out', 'break', 'back']);
    if (!validActions.has(action)) {
      return { success: false, error: `Invalid action: ${action}` };
    }

    // Detect faces
    let detectedFaces;
    try {
      detectedFaces = await this.faceApi.detectFaces(imageBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ err: msg }, 'Face detection failed');
      return { success: false, error: 'Face detection failed. Please try again.' };
    }

    if (detectedFaces.length === 0) {
      return { success: false, error: 'No face detected in the image' };
    }
    if (detectedFaces.length > 1) {
      return { success: false, error: 'Multiple faces detected. Please submit a photo with exactly one face.' };
    }

    // Identify against person group
    const groupId = await this.getPersonGroupId();
    const threshold = await this.getConfidenceThreshold();

    let identifyResults;
    try {
      identifyResults = await this.faceApi.identifyFaces(groupId, [detectedFaces[0].faceId]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ err: msg }, 'Face identification failed');
      return { success: false, error: 'Face identification failed. Please try again.' };
    }

    if (
      !identifyResults ||
      identifyResults.length === 0 ||
      identifyResults[0].candidates.length === 0
    ) {
      return { success: false, error: 'Face not recognized. Please ensure you are enrolled.' };
    }

    const topCandidate = identifyResults[0].candidates[0];
    if (topCandidate.confidence < threshold) {
      this.logger.warn(
        { confidence: topCandidate.confidence, threshold, personId: topCandidate.personId },
        'Face match below confidence threshold',
      );
      return {
        success: false,
        error: 'Face match confidence too low. Please try again with better lighting.',
        confidence: topCandidate.confidence,
      };
    }

    // Resolve person ID → employee email
    const enrollment = await this.db.get<FaceEnrollmentRow>(
      "SELECT * FROM face_enrollments WHERE azure_person_id = ? AND status = 'enrolled'",
      [topCandidate.personId],
    );
    if (!enrollment) {
      return { success: false, error: 'Matched face not found in enrollment records' };
    }

    // Get employee name
    const member = await this.db.get<{ name: string; [key: string]: unknown }>(
      'SELECT name FROM members WHERE email = ?',
      [enrollment.email],
    );
    const employeeName = member?.name ?? enrollment.email;

    // Clock the action
    const clockResult = await this.clockService.clock(
      action,
      enrollment.email,
      employeeName,
      'face',
    );

    this.logger.info(
      { email: enrollment.email, action, confidence: topCandidate.confidence },
      'Face clock action',
    );

    return {
      success: clockResult.success,
      email: enrollment.email,
      name: employeeName,
      confidence: topCandidate.confidence,
      clockResult,
      error: clockResult.error,
    };
  }

  /** Get enrollment status for an employee. */
  async getStatus(email: string): Promise<EnrollmentStatus> {
    const row = await this.getEnrollmentRow(email);
    if (!row) {
      return { enrolled: false, status: 'not_enrolled' };
    }
    return {
      enrolled: row.status === 'enrolled',
      status: row.status,
      errorMessage: row.error_message || undefined,
      enrolledAt: row.enrolled_at,
    };
  }

  /** Remove face enrollment for an employee. */
  async removeEnrollment(email: string): Promise<{ success: boolean; error?: string }> {
    const row = await this.getEnrollmentRow(email);
    if (!row) {
      return { success: false, error: 'No enrollment found for this employee' };
    }

    // If enrolled in Azure, try to delete the person (best-effort)
    if (row.azure_person_id && row.status === 'enrolled') {
      try {
        // Azure doesn't have a deletePerson in our interface, but we delete the local record.
        // In production, you'd also call Azure to delete the person from the group.
        this.logger.info({ email, personId: row.azure_person_id }, 'Removing face enrollment');
      } catch (err) {
        this.logger.warn({ email, err }, 'Failed to remove person from Azure — continuing with local removal');
      }
    }

    await this.db.run('DELETE FROM face_enrollments WHERE email = ?', [email]);
    this.logger.info({ email }, 'Face enrollment removed');
    return { success: true };
  }

  // ── Private helpers ──

  private async getEnrollmentRow(email: string): Promise<FaceEnrollmentRow | null> {
    return this.db.get<FaceEnrollmentRow>(
      'SELECT * FROM face_enrollments WHERE email = ?',
      [email],
    );
  }

  private async getPersonGroupId(): Promise<string> {
    const row = await this.db.get<{ face_person_group_id: string; [key: string]: unknown }>(
      'SELECT face_person_group_id FROM system_settings WHERE id = 1',
      [],
    );
    return row?.face_person_group_id ?? 'shaavir-default';
  }

  private async getConfidenceThreshold(): Promise<number> {
    const row = await this.db.get<{ face_match_confidence_threshold: number; [key: string]: unknown }>(
      'SELECT face_match_confidence_threshold FROM system_settings WHERE id = 1',
      [],
    );
    return row?.face_match_confidence_threshold ?? 0.6;
  }
}

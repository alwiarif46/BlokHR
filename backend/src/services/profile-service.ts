import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { NotificationDispatcher } from './notification/dispatcher';
import { validateProfileFields } from './profile-validators';
import type { EventBus } from '../events';

interface MemberRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  group_id: string;
  certified_at: string;
  certified_by: string;
  profile_unlocked: number;
  active: number;
}

interface MemberNotifInfo {
  [key: string]: unknown;
  email: string;
  name: string;
  teams_user_id: string;
}

/** Fields that employees can edit (before certification or when unlocked). */
const EMPLOYEE_EDITABLE_FIELDS = new Set([
  'name',
  'phone',
  'emergencyContact',
  'location',
  'photo',
  'googleEmail',
  'panNumber',
  'aadhaarNumber',
  'uanNumber',
  'acParentage',
  'bankAccountNumber',
  'bankIfsc',
  'bankName',
]);

/** Fields that ONLY admins can edit. */
const ADMIN_ONLY_FIELDS = new Set([
  'designation',
  'group',
  'individualShiftStart',
  'individualShiftEnd',
  'joiningDate',
  'role',
  'memberType',
  'active',
  'profileUnlocked',
  'personalWebhookUrl',
  'notificationConfig',
]);

/** Map frontend camelCase field names to DB column names. */
const FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  emergencyContact: 'emergency_contact',
  location: 'location',
  photo: 'photo',
  googleEmail: 'google_email',
  panNumber: 'pan_number',
  aadhaarNumber: 'aadhaar_number',
  uanNumber: 'uan_number',
  acParentage: 'ac_parentage',
  bankAccountNumber: 'bank_account_number',
  bankIfsc: 'bank_ifsc',
  bankName: 'bank_name',
  designation: 'designation',
  group: 'group_id',
  individualShiftStart: 'individual_shift_start',
  individualShiftEnd: 'individual_shift_end',
  joiningDate: 'joining_date',
  role: 'role',
  memberType: 'member_type_id',
  active: 'active',
  profileUnlocked: 'profile_unlocked',
  personalWebhookUrl: 'personal_webhook_url',
  notificationConfig: 'notification_config_json',
  certifiedAt: 'certified_at',
  certifiedBy: 'certified_by',
};

/**
 * Profile service — employee self-service with field-level access control.
 *
 * Rules:
 *   - Employees can edit EMPLOYEE_EDITABLE_FIELDS before certification.
 *   - After certification, profile is LOCKED — no edits until admin sets profile_unlocked = 1.
 *   - Admin unlock → employee re-edits → re-certifies → locks again.
 *   - ADMIN_ONLY_FIELDS can only be set by admins, regardless of lock state.
 *   - Certification triggers notification to all admins (8 channels).
 */
export class ProfileService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly dispatcher: NotificationDispatcher | null,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Update a member's profile with field-level access control.
   *
   * @param memberId  — member ID or email
   * @param fields    — fields to update (camelCase keys)
   * @param callerEmail — the email of the person making the request
   * @param isAdmin   — whether the caller is an admin
   */
  async updateProfile(
    memberId: string,
    fields: Record<string, unknown>,
    callerEmail: string,
    isAdmin: boolean,
  ): Promise<{
    success: boolean;
    errors?: Record<string, string>;
    autoFilledBankName?: string;
    error?: string;
  }> {
    // Find the member
    let member = await this.db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) {
      member = await this.db.get<MemberRow>('SELECT * FROM members WHERE email = ?', [memberId]);
    }
    if (!member) {
      return { success: false, error: 'Member not found' };
    }

    const isSelf = callerEmail.toLowerCase() === member.email.toLowerCase();
    const isLocked = !!(member.certified_at && member.profile_unlocked !== 1);

    // ── Field-level access control ──

    const filteredFields: Record<string, unknown> = {};
    const rejectedFields: string[] = [];

    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (!FIELD_TO_COLUMN[key]) continue; // Unknown field — skip silently

      if (ADMIN_ONLY_FIELDS.has(key)) {
        if (!isAdmin) {
          rejectedFields.push(key);
          continue;
        }
      } else if (EMPLOYEE_EDITABLE_FIELDS.has(key)) {
        if (isSelf && isLocked && !isAdmin) {
          rejectedFields.push(key);
          continue;
        }
      }

      filteredFields[key] = val;
    }

    if (rejectedFields.length > 0 && Object.keys(filteredFields).length === 0) {
      const lockedMsg = isLocked
        ? 'Profile is locked after certification — contact admin to unlock'
        : 'You do not have permission to edit these fields';
      return { success: false, error: `${lockedMsg}: ${rejectedFields.join(', ')}` };
    }

    // ── Validation ──

    const validationResult = await validateProfileFields({
      name: filteredFields.name as string | undefined,
      phone: filteredFields.phone as string | undefined,
      pan: filteredFields.panNumber as string | undefined,
      aadhaar: filteredFields.aadhaarNumber as string | undefined,
      uan: filteredFields.uanNumber as string | undefined,
      ifsc: filteredFields.bankIfsc as string | undefined,
      bankAccount: filteredFields.bankAccountNumber as string | undefined,
      email: filteredFields.googleEmail as string | undefined,
    });

    if (Object.keys(validationResult.errors).length > 0) {
      return { success: false, errors: validationResult.errors };
    }

    // ── IFSC auto-fill bank name ──

    let autoFilledBankName: string | undefined;
    if (
      validationResult.ifscData &&
      !validationResult.ifscData.lookupFailed &&
      validationResult.ifscData.autoFilledBankName
    ) {
      autoFilledBankName = validationResult.ifscData.autoFilledBankName as string;
      // Auto-fill bank name if not explicitly provided
      if (!filteredFields.bankName && autoFilledBankName) {
        filteredFields.bankName = autoFilledBankName;
      }
    }

    // ── Build DB update ──

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(filteredFields)) {
      const col = FIELD_TO_COLUMN[key];
      if (col) {
        sets.push(`${col} = ?`);
        vals.push(val);
      }
    }

    if (sets.length === 0) {
      return { success: true };
    }

    sets.push("updated_at = datetime('now')");
    vals.push(member.id);
    await this.db.run(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`, vals);

    this.logger.info(
      { memberId: member.id, email: member.email, fields: Object.keys(filteredFields) },
      'Profile updated',
    );

    this.eventBus?.emit('profile.updated', { email: member.email, field: Object.keys(filteredFields).join(',') });

    return { success: true, autoFilledBankName };
  }

  /**
   * Certify a member's profile — locks the profile until admin unlocks.
   * Triggers notification to all admins.
   */
  async certifyProfile(
    memberId: string,
    callerEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    let member = await this.db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) {
      member = await this.db.get<MemberRow>('SELECT * FROM members WHERE email = ?', [memberId]);
    }
    if (!member) return { success: false, error: 'Member not found' };

    if (member.certified_at && member.profile_unlocked !== 1) {
      return { success: false, error: 'Profile is already certified and locked' };
    }

    await this.db.run(
      `UPDATE members SET
         certified_at = datetime('now'),
         certified_by = ?,
         profile_unlocked = 0,
         updated_at = datetime('now')
       WHERE id = ?`,
      [callerEmail, member.id],
    );

    this.logger.info(
      { memberId: member.id, email: member.email, certifiedBy: callerEmail },
      'Profile certified',
    );

    // Notify admins
    if (this.dispatcher) {
      this.notifyAdminsOfCertification(member).catch((err) => {
        this.logger.error(
          { err, memberId: member.id },
          'Profile certification notification failed',
        );
      });
    }

    this.eventBus?.emit('profile.certified', { email: member.email });

    return { success: true };
  }

  /**
   * Admin unlocks a certified profile so the employee can re-edit.
   */
  async unlockProfile(memberId: string): Promise<{ success: boolean; error?: string }> {
    let member = await this.db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) {
      member = await this.db.get<MemberRow>('SELECT * FROM members WHERE email = ?', [memberId]);
    }
    if (!member) return { success: false, error: 'Member not found' };

    await this.db.run(
      "UPDATE members SET profile_unlocked = 1, updated_at = datetime('now') WHERE id = ?",
      [member.id],
    );

    this.logger.info({ memberId: member.id, email: member.email }, 'Profile unlocked by admin');
    this.eventBus?.emit('profile.unlocked', { email: member.email, unlockedBy: memberId });
    return { success: true };
  }

  /** Get the profile lock status for a member. */
  async getProfileStatus(memberId: string): Promise<{
    found: boolean;
    isLocked: boolean;
    certifiedAt: string | null;
    profileUnlocked: boolean;
  }> {
    let member = await this.db.get<MemberRow>(
      'SELECT id, certified_at, profile_unlocked FROM members WHERE id = ?',
      [memberId],
    );
    if (!member) {
      member = await this.db.get<MemberRow>(
        'SELECT id, certified_at, profile_unlocked FROM members WHERE email = ?',
        [memberId],
      );
    }
    if (!member)
      return { found: false, isLocked: false, certifiedAt: null, profileUnlocked: false };

    return {
      found: true,
      isLocked: !!(member.certified_at && member.profile_unlocked !== 1),
      certifiedAt: member.certified_at || null,
      profileUnlocked: member.profile_unlocked === 1,
    };
  }

  // ── Notification ──

  private async notifyAdminsOfCertification(member: MemberRow): Promise<void> {
    if (!this.dispatcher) return;

    const admins = await this.db.all<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM admins',
    );
    if (admins.length === 0) return;

    const recipients: Array<{ email: string; name: string; role: string }> = [];
    for (const admin of admins) {
      const info = await this.db.get<MemberNotifInfo>(
        'SELECT email, name, teams_user_id FROM members WHERE email = ? AND active = 1',
        [admin.email],
      );
      if (info) {
        recipients.push({ email: info.email, name: info.name, role: 'admin' });
      }
    }

    if (recipients.length === 0) return;

    await this.dispatcher.notify({
      eventType: 'profile:certified',
      entityType: 'profile',
      entityId: `profile_${member.id}`,
      recipients,
      data: {
        employeeName: member.name,
        employeeEmail: member.email,
        certifiedAt: new Date().toISOString(),
      },
    });
  }
}

import type { DatabaseEngine } from '../db/engine';

export interface MemberPrefsRow {
  [key: string]: unknown;
  member_id: string;
  tenant_id: string;
  theme: string;
  dark_mode: string;
  color_accent: string | null;
  color_status_in: string | null;
  color_status_break: string | null;
  color_status_absent: string | null;
  color_bg0: string | null;
  color_tx: string | null;
  bg_image_url: string | null;
  bg_opacity: number;
  bg_blur: number;
  bg_darken: number;
  timezone_slot_1: string | null;
  timezone_slot_2: string | null;
  timezone_slot_3: string | null;
  timezone_slot_4: string | null;
  notification_prefs: string | null;
  updated_at: string;
}

const DEFAULTS: Omit<MemberPrefsRow, 'member_id' | 'updated_at'> = {
  tenant_id: 'default',
  theme: 'chromium',
  dark_mode: 'system',
  color_accent: null,
  color_status_in: null,
  color_status_break: null,
  color_status_absent: null,
  color_bg0: null,
  color_tx: null,
  bg_image_url: null,
  bg_opacity: 30,
  bg_blur: 0,
  bg_darken: 70,
  timezone_slot_1: null,
  timezone_slot_2: null,
  timezone_slot_3: null,
  timezone_slot_4: null,
  notification_prefs: null,
};

export class MemberPreferencesRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async getByMemberId(memberId: string): Promise<MemberPrefsRow | null> {
    return this.db.get<MemberPrefsRow>(
      'SELECT * FROM member_preferences WHERE member_id = ?',
      [memberId],
    );
  }

  async upsert(memberId: string, tenantId: string, fields: Partial<MemberPrefsRow>): Promise<MemberPrefsRow> {
    const existing = await this.getByMemberId(memberId);
    if (existing) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const allowed = [
        'theme', 'dark_mode', 'color_accent', 'color_status_in', 'color_status_break',
        'color_status_absent', 'color_bg0', 'color_tx', 'bg_image_url',
        'bg_opacity', 'bg_blur', 'bg_darken',
        'timezone_slot_1', 'timezone_slot_2', 'timezone_slot_3', 'timezone_slot_4',
        'notification_prefs',
      ];
      for (const key of allowed) {
        if (key in fields) {
          sets.push(`${key} = ?`);
          params.push(fields[key as keyof MemberPrefsRow]);
        }
      }
      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        params.push(memberId);
        await this.db.run(
          `UPDATE member_preferences SET ${sets.join(', ')} WHERE member_id = ?`,
          params,
        );
      }
    } else {
      const merged = { ...DEFAULTS, ...fields };
      await this.db.run(
        `INSERT INTO member_preferences
         (member_id, tenant_id, theme, dark_mode, color_accent, color_status_in,
          color_status_break, color_status_absent, color_bg0, color_tx,
          bg_image_url, bg_opacity, bg_blur, bg_darken,
          timezone_slot_1, timezone_slot_2, timezone_slot_3, timezone_slot_4,
          notification_prefs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memberId, tenantId, merged.theme, merged.dark_mode,
          merged.color_accent, merged.color_status_in, merged.color_status_break,
          merged.color_status_absent, merged.color_bg0, merged.color_tx,
          merged.bg_image_url, merged.bg_opacity, merged.bg_blur, merged.bg_darken,
          merged.timezone_slot_1, merged.timezone_slot_2, merged.timezone_slot_3,
          merged.timezone_slot_4, merged.notification_prefs,
        ],
      );
    }
    return (await this.getByMemberId(memberId))!;
  }
}

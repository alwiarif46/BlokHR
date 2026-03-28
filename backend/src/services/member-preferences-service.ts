import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { MemberPreferencesRepository, MemberPrefsRow } from '../repositories/member-preferences-repository';

const VALID_THEMES = new Set(['chromium', 'neural', 'holodeck', 'clean']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class MemberPreferencesService {
  private readonly repo: MemberPreferencesRepository;

  constructor(
    db: DatabaseEngine,
    private readonly logger: Logger,
  ) {
    this.repo = new MemberPreferencesRepository(db);
  }

  async getPrefs(email: string): Promise<MemberPrefsRow> {
    const row = await this.repo.getByMemberId(email);
    if (row) return row;
    // Return defaults
    return {
      member_id: email,
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
      updated_at: new Date().toISOString(),
    };
  }

  async updatePrefs(
    email: string,
    partial: Partial<MemberPrefsRow>,
  ): Promise<{ success: boolean; prefs?: MemberPrefsRow; error?: string }> {
    // Validate theme
    if (partial.theme !== undefined && !VALID_THEMES.has(partial.theme as string)) {
      return { success: false, error: `Invalid theme. Must be one of: ${[...VALID_THEMES].join(', ')}` };
    }

    // Validate hex colors
    const colorFields = [
      'color_accent', 'color_status_in', 'color_status_break',
      'color_status_absent', 'color_bg0', 'color_tx',
    ] as const;
    for (const field of colorFields) {
      const val = partial[field];
      if (val !== undefined && val !== null && !HEX_COLOR_RE.test(val as string)) {
        return { success: false, error: `${field} must be a valid hex color (#RRGGBB)` };
      }
    }

    // Validate ranges
    if (partial.bg_opacity !== undefined) {
      const v = partial.bg_opacity as number;
      if (v < 0 || v > 100) return { success: false, error: 'bg_opacity must be 0-100' };
    }
    if (partial.bg_blur !== undefined) {
      const v = partial.bg_blur as number;
      if (v < 0 || v > 30) return { success: false, error: 'bg_blur must be 0-30' };
    }
    if (partial.bg_darken !== undefined) {
      const v = partial.bg_darken as number;
      if (v < 0 || v > 95) return { success: false, error: 'bg_darken must be 0-95' };
    }

    const prefs = await this.repo.upsert(email, 'default', partial);
    this.logger.info({ email, fields: Object.keys(partial) }, 'Member preferences updated');
    return { success: true, prefs };
  }
}

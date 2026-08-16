import type { DatabaseEngine } from '../db/engine';
import type { CalendarProvider } from '../services/calendar-token-crypto';

export interface UserCalendarConnectionRow {
  [key: string]: unknown;
  id: string;
  email: string;
  provider: CalendarProvider;
  refresh_token_enc: string;
  access_token_enc: string;
  expires_at: string | null;
  account_email: string;
  external_user_id: string;
  scopes: string;
  status: 'active' | 'revoked' | 'error';
  connected_at: string;
  updated_at: string;
}

export class UserCalendarRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async getByEmailAndProvider(
    email: string,
    provider: CalendarProvider,
  ): Promise<UserCalendarConnectionRow | null> {
    return this.db.get<UserCalendarConnectionRow>(
      'SELECT * FROM user_calendar_connections WHERE email = ? AND provider = ?',
      [email.toLowerCase().trim(), provider],
    );
  }

  async listByEmail(email: string): Promise<UserCalendarConnectionRow[]> {
    return this.db.all<UserCalendarConnectionRow>(
      'SELECT * FROM user_calendar_connections WHERE email = ? ORDER BY provider',
      [email.toLowerCase().trim()],
    );
  }

  async listActive(provider?: CalendarProvider): Promise<UserCalendarConnectionRow[]> {
    if (provider) {
      return this.db.all<UserCalendarConnectionRow>(
        `SELECT * FROM user_calendar_connections WHERE status = 'active' AND provider = ? ORDER BY email`,
        [provider],
      );
    }
    return this.db.all<UserCalendarConnectionRow>(
      `SELECT * FROM user_calendar_connections WHERE status = 'active' ORDER BY email, provider`,
    );
  }

  async listActiveByEmail(email: string): Promise<UserCalendarConnectionRow[]> {
    return this.db.all<UserCalendarConnectionRow>(
      `SELECT * FROM user_calendar_connections WHERE email = ? AND status = 'active' ORDER BY provider`,
      [email.toLowerCase().trim()],
    );
  }

  async upsert(row: {
    id: string;
    email: string;
    provider: CalendarProvider;
    refreshTokenEnc: string;
    accessTokenEnc: string;
    expiresAt: string | null;
    accountEmail: string;
    externalUserId?: string;
    scopes: string;
    status?: 'active' | 'revoked' | 'error';
  }): Promise<void> {
    const email = row.email.toLowerCase().trim();
    const externalUserId = row.externalUserId ?? '';
    const existing = await this.getByEmailAndProvider(email, row.provider);
    if (existing) {
      await this.db.run(
        `UPDATE user_calendar_connections SET
           refresh_token_enc = ?, access_token_enc = ?, expires_at = ?,
           account_email = ?, external_user_id = ?, scopes = ?, status = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [
          row.refreshTokenEnc,
          row.accessTokenEnc,
          row.expiresAt,
          row.accountEmail,
          externalUserId,
          row.scopes,
          row.status ?? 'active',
          existing.id,
        ],
      );
      return;
    }
    await this.db.run(
      `INSERT INTO user_calendar_connections
        (id, email, provider, refresh_token_enc, access_token_enc, expires_at,
         account_email, external_user_id, scopes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        email,
        row.provider,
        row.refreshTokenEnc,
        row.accessTokenEnc,
        row.expiresAt,
        row.accountEmail,
        externalUserId,
        row.scopes,
        row.status ?? 'active',
      ],
    );
  }

  async updateTokens(
    id: string,
    fields: {
      refreshTokenEnc?: string;
      accessTokenEnc?: string;
      expiresAt?: string | null;
      status?: 'active' | 'revoked' | 'error';
    },
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.refreshTokenEnc !== undefined) {
      sets.push('refresh_token_enc = ?');
      params.push(fields.refreshTokenEnc);
    }
    if (fields.accessTokenEnc !== undefined) {
      sets.push('access_token_enc = ?');
      params.push(fields.accessTokenEnc);
    }
    if (fields.expiresAt !== undefined) {
      sets.push('expires_at = ?');
      params.push(fields.expiresAt);
    }
    if (fields.status !== undefined) {
      sets.push('status = ?');
      params.push(fields.status);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await this.db.run(
      `UPDATE user_calendar_connections SET ${sets.join(', ')} WHERE id = ?`,
      params,
    );
  }

  async delete(email: string, provider: CalendarProvider): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM user_calendar_connections WHERE email = ? AND provider = ?',
      [email.toLowerCase().trim(), provider],
    );
    return (result.changes ?? 0) > 0;
  }
}

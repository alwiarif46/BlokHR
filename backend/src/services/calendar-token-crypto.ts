import crypto from 'crypto';

/**
 * AES-256-GCM token encryption for calendar OAuth refresh/access tokens.
 * Key material is SHA-256(secret) so any length secret is accepted.
 */

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/** Encrypt plaintext → base64url(iv || tag || ciphertext). */
export function encryptToken(plaintext: string, secret: string): string {
  if (!secret) throw new Error('Encryption secret is required');
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** Decrypt base64url(iv || tag || ciphertext) → plaintext. */
export function decryptToken(payload: string, secret: string): string {
  if (!secret) throw new Error('Encryption secret is required');
  const buf = Buffer.from(payload, 'base64url');
  if (buf.length < 12 + 16 + 1) throw new Error('Invalid encrypted token');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export type OAuthCalendarProvider = 'microsoft' | 'google';
export type PlatformCalendarProvider = 'zoom' | 'webex' | 'gotomeeting' | 'bluejeans';
export type CalendarProvider = OAuthCalendarProvider | PlatformCalendarProvider;

export const OAUTH_CALENDAR_PROVIDERS: OAuthCalendarProvider[] = ['microsoft', 'google'];
export const PLATFORM_CALENDAR_PROVIDERS: PlatformCalendarProvider[] = [
  'zoom',
  'webex',
  'gotomeeting',
  'bluejeans',
];
export const ALL_CALENDAR_PROVIDERS: CalendarProvider[] = [
  ...OAUTH_CALENDAR_PROVIDERS,
  ...PLATFORM_CALENDAR_PROVIDERS,
];

export function isOAuthCalendarProvider(p: string): p is OAuthCalendarProvider {
  return p === 'microsoft' || p === 'google';
}

export function isPlatformCalendarProvider(p: string): p is PlatformCalendarProvider {
  return (
    p === 'zoom' || p === 'webex' || p === 'gotomeeting' || p === 'bluejeans'
  );
}

export function isCalendarProvider(p: string): p is CalendarProvider {
  return isOAuthCalendarProvider(p) || isPlatformCalendarProvider(p);
}

export interface CalendarOAuthState {
  email: string;
  provider: OAuthCalendarProvider;
  exp: number;
  nonce: string;
}

/** Sign OAuth state (HMAC-SHA256). */
export function signOAuthState(payload: CalendarOAuthState, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verify and parse OAuth state. Throws on invalid/expired. */
export function verifyOAuthState(state: string, secret: string): CalendarOAuthState {
  const parts = state.split('.');
  if (parts.length !== 2) throw new Error('Invalid OAuth state');
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid OAuth state signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CalendarOAuthState;
  if (!payload.email || !payload.provider || !payload.exp) {
    throw new Error('Malformed OAuth state');
  }
  if (payload.provider !== 'microsoft' && payload.provider !== 'google') {
    throw new Error('Invalid OAuth provider in state');
  }
  if (Date.now() > payload.exp) throw new Error('OAuth state expired');
  return payload;
}

export interface CalendarEventView {
  id: string;
  provider: CalendarProvider;
  subject: string;
  start: string;
  end: string;
  location: string;
  joinUrl: string;
  organizer: string;
  accountEmail: string;
  ownerEmail: string;
}

/** Merge and sort calendar events by start ascending. */
export function mergeCalendarEvents(lists: CalendarEventView[][]): CalendarEventView[] {
  return lists.flat().sort((a, b) => a.start.localeCompare(b.start));
}

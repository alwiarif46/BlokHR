import { describe, it, expect } from 'vitest';
import {
  encryptToken,
  decryptToken,
  signOAuthState,
  verifyOAuthState,
  mergeCalendarEvents,
  type CalendarEventView,
} from '../../src/services/calendar-token-crypto';

const SECRET = 'unit-test-calendar-secret-key!!';

describe('calendar-token-crypto', () => {
  it('encrypts and decrypts tokens round-trip', () => {
    const plain = 'refresh-token-xyz-123';
    const enc = encryptToken(plain, SECRET);
    expect(enc).not.toContain(plain);
    expect(decryptToken(enc, SECRET)).toBe(plain);
  });

  it('fails decrypt with wrong secret', () => {
    const enc = encryptToken('abc', SECRET);
    expect(() => decryptToken(enc, 'wrong-secret- altogether')).toThrow();
  });

  it('signs and verifies OAuth state', () => {
    const state = signOAuthState(
      {
        email: 'alice@example.com',
        provider: 'microsoft',
        exp: Date.now() + 60_000,
        nonce: 'abc123',
      },
      SECRET,
    );
    const parsed = verifyOAuthState(state, SECRET);
    expect(parsed.email).toBe('alice@example.com');
    expect(parsed.provider).toBe('microsoft');
  });

  it('rejects expired OAuth state', () => {
    const state = signOAuthState(
      {
        email: 'alice@example.com',
        provider: 'google',
        exp: Date.now() - 1000,
        nonce: 'x',
      },
      SECRET,
    );
    expect(() => verifyOAuthState(state, SECRET)).toThrow(/expired/i);
  });

  it('rejects tampered OAuth state', () => {
    const state = signOAuthState(
      {
        email: 'alice@example.com',
        provider: 'google',
        exp: Date.now() + 60_000,
        nonce: 'x',
      },
      SECRET,
    );
    const [body] = state.split('.');
    expect(() => verifyOAuthState(`${body}.tamperedsig`, SECRET)).toThrow();
  });

  it('merges and sorts calendar events by start', () => {
    const a: CalendarEventView[] = [
      {
        id: '1',
        provider: 'microsoft',
        subject: 'Later',
        start: '2026-08-20T10:00:00.000Z',
        end: '',
        location: '',
        joinUrl: '',
        organizer: '',
        accountEmail: '',
        ownerEmail: 'a@x.com',
      },
    ];
    const b: CalendarEventView[] = [
      {
        id: '2',
        provider: 'google',
        subject: 'Earlier',
        start: '2026-08-18T10:00:00.000Z',
        end: '',
        location: '',
        joinUrl: '',
        organizer: '',
        accountEmail: '',
        ownerEmail: 'b@x.com',
      },
    ];
    const merged = mergeCalendarEvents([a, b]);
    expect(merged.map((e) => e.subject)).toEqual(['Earlier', 'Later']);
  });
});

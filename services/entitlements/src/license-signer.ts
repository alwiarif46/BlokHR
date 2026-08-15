import crypto from 'crypto';
import type { SignedLicenseClaims } from './types';

/**
 * Signed license tokens for self-hosted enterprise.
 * Format: base64url(payload).base64url(hmac_sha256)
 */
export class LicenseSigner {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) {
      throw new Error('LICENSE_SIGNING_SECRET must be at least 16 characters');
    }
  }

  sign(claims: SignedLicenseClaims): string {
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  verify(token: string): { valid: boolean; claims?: SignedLicenseClaims; error?: string } {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid license format' };
    }
    const [payload, sig] = parts;
    const expected = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid license signature' };
    }

    let claims: SignedLicenseClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedLicenseClaims;
    } catch {
      return { valid: false, error: 'Invalid license payload' };
    }

    if (!claims.tenantId || !claims.plan || !claims.validFrom || !claims.validTo) {
      return { valid: false, error: 'License missing required claims' };
    }

    const now = Date.now();
    const from = Date.parse(claims.validFrom);
    const to = Date.parse(claims.validTo);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      return { valid: false, error: 'License has invalid dates' };
    }
    if (now < from) {
      return { valid: false, error: 'License not yet valid' };
    }
    if (now > to) {
      return { valid: false, error: 'License expired' };
    }

    return { valid: true, claims };
  }
}

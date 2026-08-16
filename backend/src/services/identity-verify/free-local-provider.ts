import {
  validateAadhaar,
  validateBankAccount,
  validateIfsc,
  validatePan,
  validateUan,
} from '../profile-validators';
import type {
  IdentityVerifyProvider,
  IfscLookupResult,
  VerifyRequest,
  VerifyResult,
} from './types';

/** In-memory IFSC cache (24h TTL). */
const IFSC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ifscCache = new Map<string, { expires: number; result: IfscLookupResult }>();

export function clearIfscCache(): void {
  ifscCache.clear();
}

/**
 * Free forever provider: Razorpay IFSC lookup + local format validators.
 * No paid KYC (PAN name match, Aadhaar eKYC, UAN EPFO, penny-drop).
 */
export class FreeLocalProvider implements IdentityVerifyProvider {
  readonly name = 'free';

  async lookupIfsc(code: string): Promise<IfscLookupResult> {
    const upper = (code || '').toUpperCase().trim();
    if (!upper) {
      return { valid: false, error: 'IFSC is required' };
    }

    const cached = ifscCache.get(upper);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    const r = await validateIfsc(upper);
    if (!r.valid) {
      const result: IfscLookupResult = { valid: false, error: r.error };
      ifscCache.set(upper, { expires: Date.now() + IFSC_CACHE_TTL_MS, result });
      return result;
    }

    if (r.data?.lookupFailed) {
      const result: IfscLookupResult = {
        valid: true,
        lookupFailed: true,
      };
      return result;
    }

    const bankName = String(r.data?.bankName ?? '');
    const branch = String(r.data?.branch ?? '');
    const displayName =
      (r.data?.autoFilledBankName as string | undefined) ||
      [bankName, branch].filter(Boolean).join(' - ');

    const result: IfscLookupResult = {
      valid: true,
      bankName,
      branch,
      city: String(r.data?.city ?? ''),
      state: String(r.data?.state ?? ''),
      address: String(r.data?.address ?? ''),
      displayName,
    };
    ifscCache.set(upper, { expires: Date.now() + IFSC_CACHE_TTL_MS, result });
    return result;
  }

  async verify(req: VerifyRequest): Promise<VerifyResult> {
    const value = (req.value ?? '').trim();
    const field = req.field;

    switch (field) {
      case 'pan': {
        const r = validatePan(value);
        if (!r.valid) return { ok: false, level: 'format', message: r.error ?? 'Invalid PAN' };
        if (!value) return { ok: true, level: 'format', message: 'Empty' };
        return { ok: true, level: 'format', message: 'Format OK' };
      }
      case 'aadhaar': {
        const r = validateAadhaar(value);
        if (!r.valid) return { ok: false, level: 'format', message: r.error ?? 'Invalid Aadhaar' };
        if (!value) return { ok: true, level: 'format', message: 'Empty' };
        return { ok: true, level: 'format', message: 'Format OK' };
      }
      case 'uan': {
        const r = validateUan(value);
        if (!r.valid) return { ok: false, level: 'format', message: r.error ?? 'Invalid UAN' };
        if (!value) return { ok: true, level: 'format', message: 'Empty' };
        return { ok: true, level: 'format', message: 'Format OK' };
      }
      case 'bankAcc': {
        const r = validateBankAccount(value);
        if (!r.valid) {
          return { ok: false, level: 'format', message: r.error ?? 'Invalid bank account' };
        }
        if (!value) return { ok: true, level: 'format', message: 'Empty' };
        return { ok: true, level: 'format', message: 'Format OK' };
      }
      case 'bankName': {
        if (!value) return { ok: false, level: 'format', message: 'Bank name is required' };
        return { ok: true, level: 'format', message: 'Format OK' };
      }
      case 'ifsc': {
        const lookup = await this.lookupIfsc(value);
        if (!lookup.valid) {
          return { ok: false, level: 'lookup', message: lookup.error ?? 'Invalid IFSC' };
        }
        if (lookup.lookupFailed) {
          return {
            ok: true,
            level: 'format',
            message: 'Format OK (lookup unavailable)',
          };
        }
        return {
          ok: true,
          level: 'lookup',
          message: 'IFSC verified',
          autofill: {
            bankName: lookup.bankName,
            branch: lookup.branch,
            city: lookup.city,
            state: lookup.state,
            address: lookup.address,
            displayName: lookup.displayName,
          },
        };
      }
      default: {
        const _exhaustive: never = field;
        return { ok: false, level: 'format', message: `Unknown field: ${_exhaustive}` };
      }
    }
  }
}

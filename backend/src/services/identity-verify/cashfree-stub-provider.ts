import type {
  IdentityVerifyProvider,
  IfscLookupResult,
  VerifyRequest,
  VerifyResult,
} from './types';
import { FreeLocalProvider } from './free-local-provider';

/**
 * Stub for future Cashfree Secure ID integration.
 * Falls back to FreeLocalProvider for IFSC; paid fields return not-configured.
 */
export class CashfreeStubProvider implements IdentityVerifyProvider {
  readonly name = 'cashfree';
  private readonly free = new FreeLocalProvider();

  async lookupIfsc(code: string): Promise<IfscLookupResult> {
    return this.free.lookupIfsc(code);
  }

  async verify(req: VerifyRequest): Promise<VerifyResult> {
    if (req.field === 'ifsc' || req.field === 'bankName') {
      return this.free.verify(req);
    }

    const hasKeys = !!(
      process.env.CASHFREE_CLIENT_ID?.trim() && process.env.CASHFREE_CLIENT_SECRET?.trim()
    );
    if (!hasKeys) {
      return {
        ok: false,
        level: 'format',
        message:
          'Cashfree identity verify is not configured — set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET, or use IDENTITY_VERIFY_PROVIDER=free',
      };
    }

    // Paid Cashfree calls are intentionally not wired in this pass.
    return {
      ok: false,
      level: 'format',
      message: 'Cashfree live KYC is not enabled in this build — use IDENTITY_VERIFY_PROVIDER=free',
    };
  }
}

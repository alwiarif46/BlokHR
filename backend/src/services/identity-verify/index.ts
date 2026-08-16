import { CashfreeStubProvider } from './cashfree-stub-provider';
import { FreeLocalProvider } from './free-local-provider';
import type { IdentityVerifyProvider } from './types';

export type { IdentityVerifyProvider, VerifyField, VerifyResult, IfscLookupResult } from './types';
export { FreeLocalProvider } from './free-local-provider';
export { clearIfscCache } from './free-local-provider';
export { CashfreeStubProvider } from './cashfree-stub-provider';

let _provider: IdentityVerifyProvider | null = null;

/** Resolve provider from IDENTITY_VERIFY_PROVIDER (default: free). */
export function createIdentityVerifyProvider(
  name = process.env.IDENTITY_VERIFY_PROVIDER?.trim().toLowerCase() || 'free',
): IdentityVerifyProvider {
  switch (name) {
    case 'cashfree':
      return new CashfreeStubProvider();
    case 'free':
      return new FreeLocalProvider();
    default:
      return new FreeLocalProvider();
  }
}

/** Singleton used by routes (tests may call resetIdentityVerifyProvider). */
export function getIdentityVerifyProvider(): IdentityVerifyProvider {
  if (!_provider) {
    _provider = createIdentityVerifyProvider();
  }
  return _provider;
}

export function resetIdentityVerifyProvider(provider?: IdentityVerifyProvider): void {
  _provider = provider ?? null;
}

/**
 * Pluggable identity verification for employee Financial & Identity fields.
 * FreeLocalProvider is the default; Cashfree is a stub until keys are configured.
 */

export type VerifyField = 'pan' | 'aadhaar' | 'uan' | 'bankAcc' | 'ifsc' | 'bankName';

export type VerifyLevel = 'format' | 'lookup';

export interface VerifyRequest {
  field: VerifyField;
  value: string;
  /** Optional companion IFSC when verifying bank account (future penny-drop). */
  ifsc?: string;
}

export interface VerifyAutofill {
  bankName?: string;
  branch?: string;
  city?: string;
  state?: string;
  address?: string;
  displayName?: string;
}

export interface VerifyResult {
  ok: boolean;
  level: VerifyLevel;
  message: string;
  autofill?: VerifyAutofill;
}

export interface IfscLookupResult {
  valid: boolean;
  error?: string;
  bankName?: string;
  branch?: string;
  city?: string;
  state?: string;
  address?: string;
  displayName?: string;
  lookupFailed?: boolean;
}

export interface IdentityVerifyProvider {
  readonly name: string;
  lookupIfsc(code: string): Promise<IfscLookupResult>;
  verify(req: VerifyRequest): Promise<VerifyResult>;
}

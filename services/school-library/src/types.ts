export type CopyCondition = 'new' | 'good' | 'fair' | 'poor' | 'lost';
export type CopyStatus = 'available' | 'on_loan' | 'reserved' | 'withdrawn';
export type LoanStatus = 'open' | 'returned' | 'overdue_closed';
export type HoldStatus =
  | 'queued'
  | 'ready'
  | 'cancelled'
  | 'fulfilled'
  | 'expired';

export interface LibraryTitle {
  id: string;
  tenantId: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  subjects: string[];
  language: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CopyCounts {
  available: number;
  on_loan: number;
  reserved: number;
  withdrawn: number;
  total: number;
}

export interface LibraryTitleDetail extends LibraryTitle {
  copyCounts: CopyCounts;
}

export interface LibraryCopy {
  id: string;
  tenantId: string;
  titleId: string;
  barcode: string;
  accessionNo: string | null;
  condition: CopyCondition;
  status: CopyStatus;
  locationLabel: string | null;
  acquiredOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySettings {
  tenantId: string;
  loanDays: number;
  renewLimit: number;
  maxOpenLoans: number;
  holdDays: number;
  finePaisePerDay: number;
  fineCapPaise: number;
  graceDays: number;
  updatedAt: string;
}

export type FineStatus = 'open' | 'paid' | 'waived';

export interface Fine {
  id: string;
  tenantId: string;
  loanId: string;
  studentRef: string;
  daysOverdue: number;
  amountPaise: number;
  status: FineStatus;
  waivedReason: string | null;
  paidOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySummary {
  open_loans: number;
  overdue_loans: number;
  open_fines_paise: number;
  holds: number;
}

export interface Loan {
  id: string;
  tenantId: string;
  copyId: string;
  studentRef: string;
  issuedOn: string;
  dueOn: string;
  returnedOn: string | null;
  renewals: number;
  status: LoanStatus;
  issuedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Hold {
  id: string;
  tenantId: string;
  titleId: string;
  studentRef: string;
  position: number;
  status: HoldStatus;
  readyCopyId: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceError {
  error: string;
  status: number;
}

export const COPY_CONDITIONS: readonly CopyCondition[] = [
  'new',
  'good',
  'fair',
  'poor',
  'lost',
] as const;

export const COPY_STATUSES: readonly CopyStatus[] = [
  'available',
  'on_loan',
  'reserved',
  'withdrawn',
] as const;

export const LOAN_STATUSES: readonly LoanStatus[] = [
  'open',
  'returned',
  'overdue_closed',
] as const;

export const HOLD_STATUSES: readonly HoldStatus[] = [
  'queued',
  'ready',
  'cancelled',
  'fulfilled',
  'expired',
] as const;

export const FINE_STATUSES: readonly FineStatus[] = [
  'open',
  'paid',
  'waived',
] as const;

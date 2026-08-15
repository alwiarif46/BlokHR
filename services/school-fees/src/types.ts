export type FeeHeadKind =
  | 'tuition'
  | 'transport'
  | 'lab'
  | 'library'
  | 'exam'
  | 'admission'
  | 'other';

export type FeeSchedule = 'annual' | 'term' | 'monthly';

export type ConcessionKind = 'pct' | 'flat';

export interface FeeHead {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  kind: FeeHeadKind;
  taxable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureLine {
  feeHeadId: string;
  amountPaise: number;
  schedule: FeeSchedule;
}

export interface FeeStructure {
  id: string;
  tenantId: string;
  academicSessionRef: string;
  classLabel: string;
  label: string;
  lines: FeeStructureLine[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Concession {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  kind: ConcessionKind;
  value: number;
  /** NULL = all heads */
  appliesToHeads: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export type FeePayer = 'guardian' | 'government_rte';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'part_paid'
  | 'paid'
  | 'cancelled';

export type RteClaimStatus = 'draft' | 'submitted' | 'received' | 'rejected';

export interface InvoiceLine {
  feeHeadId: string;
  headCode: string;
  headLabel: string;
  grossPaise: number;
  concessionPaise: number;
  netPaise: number;
}

export interface StudentFeeAssignment {
  id: string;
  tenantId: string;
  studentRef: string;
  feeStructureId: string;
  payer: FeePayer;
  concessionIds: string[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  studentRef: string;
  payer: FeePayer;
  periodLabel: string;
  lines: InvoiceLine[];
  totalPaise: number;
  status: InvoiceStatus;
  dueOn: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface RteClaim {
  id: string;
  tenantId: string;
  stateCode: string;
  periodLabel: string;
  invoiceIds: string[];
  totalPaise: number;
  status: RteClaimStatus;
  submittedAt: string | null;
  reference: string | null;
  createdAt: string;
}

export type PaymentMethod =
  | 'upi_direct'
  | 'gateway'
  | 'cash'
  | 'cheque'
  | 'bank_transfer';

export type PaymentStatus = 'recorded' | 'verified' | 'bounced';

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  amountPaise: number;
  method: PaymentMethod;
  utr: string | null;
  gatewayRef: string | null;
  receivedOn: string;
  recordedBy: string;
  status: PaymentStatus;
  createdAt: string;
}

export type AgeingBucket = '0-30' | '31-60' | '61+';

export interface OutstandingRow {
  invoiceId: string;
  studentRef: string;
  classLabel: string | null;
  periodLabel: string;
  dueOn: string;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  daysOverdue: number;
  ageingBucket: AgeingBucket;
}

export type LedgerEntry =
  | {
      kind: 'invoice';
      at: string;
      invoiceId: string;
      periodLabel: string;
      amountPaise: number;
      status: InvoiceStatus;
    }
  | {
      kind: 'payment';
      at: string;
      paymentId: string;
      invoiceId: string;
      amountPaise: number;
      status: PaymentStatus;
      method: PaymentMethod;
      utr: string | null;
    };

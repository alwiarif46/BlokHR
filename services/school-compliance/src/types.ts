export type ComplianceItemKey =
  | 'udise_freeze'
  | 'cbse_loc'
  | 'cbse_oasis'
  | 'cbse_9_11_reg'
  | 'cisce_entry'
  | 'rte_reporting'
  | 'state_return';

export type ComplianceAuthority = 'udise' | 'cbse' | 'cisce' | 'state' | 'other';

export type DueRule =
  | { month: number; day: number }
  | {
      window_start: { m: number; d: number };
      window_end: { m: number; d: number };
    };

export type ComplianceStatusState =
  | 'not_started'
  | 'in_progress'
  | 'ready'
  | 'submitted'
  | 'closed';

export interface ComplianceItem {
  id: string;
  tenantId: string | null;
  key: ComplianceItemKey;
  label: string;
  authority: ComplianceAuthority;
  dueRule: DueRule;
  guidance: string;
  createdAt: string;
}

export interface TenantComplianceStatus {
  id: string;
  tenantId: string;
  itemKey: ComplianceItemKey;
  academicSessionRef: string;
  state: ComplianceStatusState;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface CalendarEntry {
  item: ComplianceItem;
  status: TenantComplianceStatus | null;
  daysUntilDue: number | null;
  dueDate: string | null;
  overdue: boolean;
}

export type ExportKind = 'udise_sdms' | 'cbse_loc' | 'state';

export type ExportRunState = 'running' | 'passed' | 'failed';

export interface ExportErrorGroup {
  code: string;
  count: number;
  studentRefs: string[];
}

export interface ExportRun {
  id: string;
  tenantId: string;
  kind: ExportKind;
  academicSessionRef: string;
  state: ExportRunState;
  total: number;
  passing: number;
  failing: number;
  fileRef: string | null;
  errors: ExportErrorGroup[] | null;
  createdBy: string;
  createdAt: string;
}

export type DataRequestKind = 'access' | 'correction' | 'erasure';

export type DataRequestState =
  | 'received'
  | 'verifying'
  | 'in_progress'
  | 'completed'
  | 'rejected';

export interface DataRequest {
  id: string;
  tenantId: string;
  studentRef: string;
  guardianRef: string;
  kind: DataRequestKind;
  state: DataRequestState;
  details: Record<string, unknown>;
  slaDueOn: string;
  resolutionNote: string | null;
  handledBy: string | null;
  overdueEmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRequestAudit {
  id: string;
  tenantId: string;
  requestId: string;
  fromState: DataRequestState;
  toState: DataRequestState;
  actor: string;
  at: string;
}

export const ERASURE_REQUIRED_SERVICES = [
  'identity',
  'attendance',
  'assessment',
  'engagement',
] as const;

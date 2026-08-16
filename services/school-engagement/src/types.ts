export type ChannelKind = 'push' | 'whatsapp' | 'sms' | 'ivr';
export type DigestFrequency = 'daily' | 'weekly';

export type TemplateKey =
  | 'absence_alert'
  | 'attendance_nudge'
  | 'fee_reminder'
  | 'digest'
  | 'general';

export type TemplateKind = 'transactional' | 'informational';

export type MessageUrgency = 'interrupt' | 'digest';

export type DiaryKind = 'homework' | 'note' | 'remark' | 'reminder';

export interface DiaryEntry {
  id: string;
  tenantId: string;
  sectionRef: string;
  studentRef: string | null;
  entryDate: string;
  kind: DiaryKind;
  body: string;
  attachmentRefs: string[] | null;
  authorMemberId: string;
  createdAt: string;
  updatedAt: string;
  /** guardians_total is null — engagement does not know guardian counts; BFF/frontend composes */
  acks?: number;
  guardiansTotal?: null;
}

export interface DiaryAck {
  id: string;
  tenantId: string;
  entryId: string;
  guardianRef: string;
  studentRef: string;
  at: string;
}

export type OutboundStatus =
  | 'queued'
  | 'sent'
  | 'suppressed_cap'
  | 'suppressed_quiet'
  | 'failed';

export interface GuardianChannel {
  id: string;
  tenantId: string;
  guardianRef: string;
  channel: ChannelKind;
  address: string;
  verified: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementSettings {
  tenantId: string;
  dailyCapPerStudent: number;
  digestHour: number;
  digestFrequency: DigestFrequency;
  quietStart: number;
  quietEnd: number;
  updatedAt: string;
}

export interface ChannelInput {
  channel: ChannelKind;
  address: string;
  verified?: boolean;
  priority: number;
  isActive?: boolean;
}

export interface PutChannelsInput {
  channels: ChannelInput[];
}

export interface PutSettingsInput {
  dailyCapPerStudent?: number;
  digestHour?: number;
  digestFrequency?: DigestFrequency;
  quietStart?: number;
  quietEnd?: number;
}

export interface MessageTemplate {
  id: string;
  tenantId: string | null;
  key: TemplateKey;
  lang: string;
  body: string;
  kind: TemplateKind;
  reviewed: boolean;
  createdAt: string;
}

export interface OutboundMessage {
  id: string;
  tenantId: string;
  studentRef: string | null;
  guardianRef: string;
  templateKey: TemplateKey;
  lang: string;
  channel: string;
  renderedBody: string;
  status: OutboundStatus;
  suppressReason: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface QueueMessageInput {
  tenantId: string;
  studentRef?: string | null;
  guardianRef: string;
  templateKey: TemplateKey;
  lang?: string;
  vars?: Record<string, string>;
  urgency: MessageUrgency;
  /** Cap exemption (P5-03 nudges); optional for P5-02. */
  capExempt?: boolean;
}

export interface ListMessagesFilters {
  studentRef?: string;
  status?: OutboundStatus;
  date?: string;
}

export type ThreadState = 'open' | 'waiting_school' | 'waiting_guardian' | 'closed';

export type ThreadDirection = 'guardian' | 'school';

export interface Thread {
  id: string;
  tenantId: string;
  guardianRef: string;
  studentRef: string;
  subject: string;
  state: ThreadState;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadMessage {
  id: string;
  tenantId: string;
  threadId: string;
  direction: ThreadDirection;
  body: string;
  langOriginal: string | null;
  bodyTranslated: string | null;
  translatedFlag: boolean;
  author: string;
  at: string;
}

export interface ListThreadsFilters {
  state?: ThreadState;
  guardianRef?: string;
  studentRef?: string;
  assignedTo?: string;
  /** Sort by unanswered age (oldest waiting first). Default true when listing. */
  sortUnansweredAge?: boolean;
}

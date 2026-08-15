/** Ports and shared types for the kiosk service. */

export interface KioskMemberSummary {
  email: string;
  name: string;
  designation?: string;
  groupId?: string | null;
}

export interface ClockResult {
  success: boolean;
  blocked?: boolean;
  duplicate?: boolean;
  error?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ClockPort {
  clock(action: string, email: string, name: string, source?: string): Promise<ClockResult>;
}

export interface AttendanceSettings {
  kioskEnabled: boolean;
  ipRestrictionEnabled: boolean;
  allowedIPs: string[];
}

export interface SettingsPort {
  getAttendanceSettings(): Promise<AttendanceSettings>;
}

export interface RosterPort {
  searchActiveMembers(query: string, limit?: number): Promise<KioskMemberSummary[]>;
  getMemberByEmail(email: string): Promise<KioskMemberSummary | null>;
}

export interface KioskVerifyResult {
  success: boolean;
  token?: string;
  email?: string;
  name?: string;
  error?: string;
}

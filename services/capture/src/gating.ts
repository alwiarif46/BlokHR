import type {
  DeviceCapability,
  EntitlementsPort,
  Modality,
  SubjectType,
  TenantJurisdiction,
  Vertical,
} from './types';
import { MODULE_IDS } from './types';

/** Hard geo-blocks for face/iris (not warning banners). */
const FACE_BLOCKED_COUNTRIES = new Set(['EU', 'GB', 'UK', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
const FACE_BLOCKED_STATES = new Set(['NY', 'NEW YORK', 'IL', 'ILLINOIS', 'TX', 'TEXAS']); // BIPA/CUBI exposure examples

export function isFaceJurisdictionBlocked(j: TenantJurisdiction): boolean {
  const country = (j.country || '').toUpperCase();
  const state = (j.state || '').toUpperCase();
  if (FACE_BLOCKED_COUNTRIES.has(country)) return true;
  if (country === 'US' && FACE_BLOCKED_STATES.has(state)) return true;
  return false;
}

/**
 * Resolve modalities available to an operator session.
 * available = entitled ∩ jurisdiction ∩ subject_type_rules ∩ device.capabilities
 */
export async function resolveAvailableModalities(input: {
  tenantId: string;
  entitlements: EntitlementsPort;
  jurisdiction: TenantJurisdiction;
  subjectType: SubjectType;
  deviceCapabilities: DeviceCapability[];
  hasStudentFaceDpia: boolean;
}): Promise<Modality[]> {
  const entitled = new Set<string>();
  const checks: Array<[string, string]> = [
    [MODULE_IDS.capture_qr, 'qr'],
    [MODULE_IDS.capture_nfc, 'nfc'],
    [MODULE_IDS.capture_fingerprint_staff, 'fingerprint'],
    [MODULE_IDS.capture_fingerprint_students, 'fingerprint'],
    [MODULE_IDS.capture_face_adults, 'face'],
    [MODULE_IDS.capture_face_students, 'face'],
    [MODULE_IDS.capture_iris_students, 'iris'],
    [MODULE_IDS.transport_bus_rfid, 'bus_rfid'],
  ];

  for (const [modId] of checks) {
    if (await input.entitlements.hasModule(input.tenantId, modId)) {
      entitled.add(modId);
    }
  }

  // Always allow QR when capture_qr entitled; school roll call is separate module
  const out = new Set<Modality>();

  if (entitled.has(MODULE_IDS.capture_qr)) out.add('qr');
  if (entitled.has(MODULE_IDS.capture_nfc)) out.add('nfc');

  // Fingerprint: staff and students use separate module IDs
  if (
    input.subjectType === 'staff' &&
    entitled.has(MODULE_IDS.capture_fingerprint_staff)
  ) {
    out.add('fingerprint');
  }
  if (
    input.subjectType === 'student' &&
    entitled.has(MODULE_IDS.capture_fingerprint_students) &&
    input.hasStudentFaceDpia
  ) {
    out.add('fingerprint');
  }

  const faceBlocked = isFaceJurisdictionBlocked(input.jurisdiction);
  if (!faceBlocked) {
    if (input.subjectType === 'staff' && entitled.has(MODULE_IDS.capture_face_adults) && input.jurisdiction.faceAdultsEnabled) {
      out.add('face');
    }
    if (
      input.subjectType === 'student' &&
      entitled.has(MODULE_IDS.capture_face_students) &&
      input.hasStudentFaceDpia
    ) {
      out.add('face');
    }
    if (
      input.subjectType === 'student' &&
      entitled.has(MODULE_IDS.capture_iris_students) &&
      input.hasStudentFaceDpia
    ) {
      out.add('iris');
    }
  }

  if (entitled.has(MODULE_IDS.transport_bus_rfid)) out.add('bus_rfid');

  // Device capability intersection
  const caps = new Set(input.deviceCapabilities);
  const filtered: Modality[] = [];
  for (const m of out) {
    if (m === 'qr' && !caps.has('camera_qr') && caps.size > 0) {
      // Web clients may have empty caps → allow qr
      if (caps.size === 0) filtered.push(m);
      else if (caps.has('camera_qr')) filtered.push(m);
      else filtered.push(m); // QR also works without native camera capability flag for web
      continue;
    }
    if (m === 'nfc' && caps.size > 0 && !caps.has('nfc')) continue;
    if (m === 'fingerprint' && caps.size > 0 && !caps.has('otg_fingerprint')) continue;
    if ((m === 'face' || m === 'iris') && caps.size > 0 && !caps.has('camera_face')) continue;
    if (m === 'bus_rfid' && caps.size > 0 && !caps.has('bus_rfid')) continue;
    filtered.push(m);
  }

  // Empty device capabilities = web / iOS thin client → qr only (plus roll_call elsewhere)
  if (caps.size === 0) {
    return filtered.filter((m) => m === 'qr');
  }

  return filtered;
}

export function defaultJurisdiction(vertical: Vertical = 'hr'): TenantJurisdiction {
  return {
    country: 'IN',
    state: '',
    vertical,
    faceAdultsEnabled: false,
    faceStudentsDpiaRef: '',
    retentionDays: 365,
  };
}

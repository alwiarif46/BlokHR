export interface Vehicle {
  id: string;
  tenantId: string;
  registration: string;
  capacity: number;
  ais140DeviceId: string | null;
  gpsProvider: string | null;
  insuranceExpiry: string;
  fitnessExpiry: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  tenantId: string;
  label: string;
  vehicleId: string;
  attendantName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stop {
  id: string;
  tenantId: string;
  routeId: string;
  sequence: number;
  label: string;
  lat: number;
  lng: number;
  pickupTime: string;
  dropTime: string;
  createdAt: string;
}

export interface RouteStudent {
  routeId: string;
  stopId: string;
  studentRef: string;
  tenantId: string;
  createdAt: string;
}

export type ExpiryKind = 'insurance' | 'fitness';

export interface ExpiryRow {
  vehicleId: string;
  registration: string;
  kind: ExpiryKind;
  expiryDate: string;
  daysUntil: number;
}

export type BoardingDirection = 'board' | 'alight';
export type BoardingLeg = 'pickup' | 'drop';
export type BoardingSource = 'rfid' | 'manual';

export interface TransportBinding {
  id: string;
  tenantId: string;
  studentRef: string;
  payloadHash: string;
  isActive: boolean;
  createdAt: string;
}

export interface BoardingEvent {
  id: string;
  tenantId: string;
  routeId: string;
  vehicleId: string;
  studentRef: string | null;
  direction: BoardingDirection;
  leg: BoardingLeg;
  at: string;
  lat: number | null;
  lng: number | null;
  source: BoardingSource;
  deviceId: string | null;
  idempotencyKey: string | null;
  unmatched: boolean;
  createdAt: string;
}

export interface ManifestStudent {
  studentRef: string;
  stopId: string;
  stopLabel: string | null;
  pickup: { boarded: boolean; alighted: boolean; missed: boolean };
  drop: { boarded: boolean; alighted: boolean; missed: boolean };
}

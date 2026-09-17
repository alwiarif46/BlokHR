import type { SchoolTransportDb } from '../db';
import { currentTransportDb } from '../db-context';
import type {
  BoardingDirection,
  BoardingEvent,
  BoardingLeg,
  BoardingSource,
  Route,
  RouteStudent,
  Stop,
  TransportBinding,
  Vehicle,
  VehiclePing,
} from '../types';

interface VehicleRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  registration: string;
  capacity: number;
  ais140_device_id: string | null;
  gps_provider: string | null;
  insurance_expiry: string;
  fitness_expiry: string;
  active: number;
  created_at: string;
  updated_at: string;
}

interface RouteRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  label: string;
  vehicle_id: string;
  attendant_name: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

interface StopRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  route_id: string;
  sequence: number;
  label: string;
  lat: number;
  lng: number;
  pickup_time: string;
  drop_time: string;
  created_at: string;
}

interface RouteStudentRow extends Record<string, unknown> {
  route_id: string;
  stop_id: string;
  student_ref: string;
  tenant_id: string;
  created_at: string;
}

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    registration: row.registration,
    capacity: row.capacity,
    ais140DeviceId: row.ais140_device_id,
    gpsProvider: row.gps_provider,
    insuranceExpiry: row.insurance_expiry,
    fitnessExpiry: row.fitness_expiry,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoute(row: RouteRow): Route {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    vehicleId: row.vehicle_id,
    attendantName: row.attendant_name,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStop(row: StopRow): Stop {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    routeId: row.route_id,
    sequence: row.sequence,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    pickupTime: row.pickup_time,
    dropTime: row.drop_time,
    createdAt: row.created_at,
  };
}

function mapRouteStudent(row: RouteStudentRow): RouteStudent {
  return {
    routeId: row.route_id,
    stopId: row.stop_id,
    studentRef: row.student_ref,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  };
}

export class TransportRepository {
  constructor(private readonly fallbackDb: SchoolTransportDb) {}

  private get db(): SchoolTransportDb {
    return currentTransportDb(this.fallbackDb);
  }

  async insertVehicle(v: Vehicle): Promise<Vehicle> {
    await this.db.run(
      `INSERT INTO vehicles (
         id, tenant_id, registration, capacity, ais140_device_id, gps_provider,
         insurance_expiry, fitness_expiry, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id,
        v.tenantId,
        v.registration,
        v.capacity,
        v.ais140DeviceId,
        v.gpsProvider,
        v.insuranceExpiry,
        v.fitnessExpiry,
        v.active ? 1 : 0,
        v.createdAt,
        v.updatedAt,
      ],
    );
    const created = await this.getVehicle(v.tenantId, v.id);
    if (!created) throw new Error('Failed to read inserted vehicle');
    return created;
  }

  async getVehicle(tenantId: string, id: string): Promise<Vehicle | null> {
    const row = await this.db.get<VehicleRow>(
      'SELECT * FROM vehicles WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapVehicle(row) : null;
  }

  async getVehicleByRegistration(
    tenantId: string,
    registration: string,
  ): Promise<Vehicle | null> {
    const row = await this.db.get<VehicleRow>(
      'SELECT * FROM vehicles WHERE tenant_id = ? AND registration = ?',
      [tenantId, registration],
    );
    return row ? mapVehicle(row) : null;
  }

  async listVehicles(tenantId: string): Promise<Vehicle[]> {
    const rows = await this.db.all<VehicleRow>(
      'SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY registration ASC',
      [tenantId],
    );
    return rows.map(mapVehicle);
  }

  async updateVehicle(v: Vehicle): Promise<Vehicle | null> {
    await this.db.run(
      `UPDATE vehicles SET
         registration = ?, capacity = ?, ais140_device_id = ?, gps_provider = ?,
         insurance_expiry = ?, fitness_expiry = ?, active = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        v.registration,
        v.capacity,
        v.ais140DeviceId,
        v.gpsProvider,
        v.insuranceExpiry,
        v.fitnessExpiry,
        v.active ? 1 : 0,
        v.updatedAt,
        v.tenantId,
        v.id,
      ],
    );
    return this.getVehicle(v.tenantId, v.id);
  }

  async deleteVehicle(tenantId: string, id: string): Promise<boolean> {
    if (!(await this.getVehicle(tenantId, id))) return false;
    await this.db.run('DELETE FROM vehicles WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async insertRoute(r: Route): Promise<Route> {
    await this.db.run(
      `INSERT INTO routes (
         id, tenant_id, label, vehicle_id, attendant_name, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.label,
        r.vehicleId,
        r.attendantName,
        r.active ? 1 : 0,
        r.createdAt,
        r.updatedAt,
      ],
    );
    const created = await this.getRoute(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted route');
    return created;
  }

  async getRoute(tenantId: string, id: string): Promise<Route | null> {
    const row = await this.db.get<RouteRow>(
      'SELECT * FROM routes WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapRoute(row) : null;
  }

  async listRoutes(tenantId: string): Promise<Route[]> {
    const rows = await this.db.all<RouteRow>(
      'SELECT * FROM routes WHERE tenant_id = ? ORDER BY label ASC',
      [tenantId],
    );
    return rows.map(mapRoute);
  }

  async updateRoute(r: Route): Promise<Route | null> {
    await this.db.run(
      `UPDATE routes SET
         label = ?, vehicle_id = ?, attendant_name = ?, active = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        r.label,
        r.vehicleId,
        r.attendantName,
        r.active ? 1 : 0,
        r.updatedAt,
        r.tenantId,
        r.id,
      ],
    );
    return this.getRoute(r.tenantId, r.id);
  }

  async deleteRoute(tenantId: string, id: string): Promise<boolean> {
    if (!(await this.getRoute(tenantId, id))) return false;
    await this.db.run(
      'DELETE FROM route_students WHERE tenant_id = ? AND route_id = ?',
      [tenantId, id],
    );
    await this.db.run('DELETE FROM stops WHERE tenant_id = ? AND route_id = ?', [
      tenantId,
      id,
    ]);
    await this.db.run('DELETE FROM routes WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async insertStop(s: Stop): Promise<Stop> {
    await this.db.run(
      `INSERT INTO stops (
         id, tenant_id, route_id, sequence, label, lat, lng, pickup_time, drop_time, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.tenantId,
        s.routeId,
        s.sequence,
        s.label,
        s.lat,
        s.lng,
        s.pickupTime,
        s.dropTime,
        s.createdAt,
      ],
    );
    const created = await this.getStop(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted stop');
    return created;
  }

  async getStop(tenantId: string, id: string): Promise<Stop | null> {
    const row = await this.db.get<StopRow>(
      'SELECT * FROM stops WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapStop(row) : null;
  }

  async listStops(tenantId: string, routeId: string): Promise<Stop[]> {
    const rows = await this.db.all<StopRow>(
      `SELECT * FROM stops
       WHERE tenant_id = ? AND route_id = ?
       ORDER BY sequence ASC`,
      [tenantId, routeId],
    );
    return rows.map(mapStop);
  }

  async updateStop(s: Stop): Promise<Stop | null> {
    await this.db.run(
      `UPDATE stops SET
         sequence = ?, label = ?, lat = ?, lng = ?, pickup_time = ?, drop_time = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        s.sequence,
        s.label,
        s.lat,
        s.lng,
        s.pickupTime,
        s.dropTime,
        s.tenantId,
        s.id,
      ],
    );
    return this.getStop(s.tenantId, s.id);
  }

  async deleteStop(tenantId: string, id: string): Promise<boolean> {
    if (!(await this.getStop(tenantId, id))) return false;
    await this.db.run('DELETE FROM stops WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async setStopSequences(
    tenantId: string,
    updates: Array<{ id: string; sequence: number }>,
  ): Promise<void> {
    for (const u of updates) {
      await this.db.run(
        'UPDATE stops SET sequence = ? WHERE tenant_id = ? AND id = ?',
        [u.sequence, tenantId, u.id],
      );
    }
  }

  async insertRouteStudent(rs: RouteStudent): Promise<RouteStudent> {
    await this.db.run(
      `INSERT INTO route_students (route_id, stop_id, student_ref, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [rs.routeId, rs.stopId, rs.studentRef, rs.tenantId, rs.createdAt],
    );
    const created = await this.getRouteStudent(rs.tenantId, rs.routeId, rs.studentRef);
    if (!created) throw new Error('Failed to read inserted route student');
    return created;
  }

  async getRouteStudent(
    tenantId: string,
    routeId: string,
    studentRef: string,
  ): Promise<RouteStudent | null> {
    const row = await this.db.get<RouteStudentRow>(
      `SELECT * FROM route_students
       WHERE tenant_id = ? AND route_id = ? AND student_ref = ?`,
      [tenantId, routeId, studentRef],
    );
    return row ? mapRouteStudent(row) : null;
  }

  async listRouteStudents(tenantId: string, routeId: string): Promise<RouteStudent[]> {
    const rows = await this.db.all<RouteStudentRow>(
      `SELECT * FROM route_students
       WHERE tenant_id = ? AND route_id = ?
       ORDER BY student_ref ASC`,
      [tenantId, routeId],
    );
    return rows.map(mapRouteStudent);
  }

  async findRouteStudentByStudentRef(
    tenantId: string,
    studentRef: string,
  ): Promise<RouteStudent | null> {
    const row = await this.db.get<RouteStudentRow>(
      `SELECT * FROM route_students
       WHERE tenant_id = ? AND student_ref = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [tenantId, studentRef],
    );
    return row ? mapRouteStudent(row) : null;
  }

  async listBoardingForStudent(
    tenantId: string,
    studentRef: string,
    limit = 50,
  ): Promise<BoardingEvent[]> {
    const rows = await this.db.all<BoardingEventRow>(
      `SELECT * FROM boarding_events
       WHERE tenant_id = ? AND student_ref = ? AND unmatched = 0
       ORDER BY at DESC
       LIMIT ?`,
      [tenantId, studentRef, limit],
    );
    return rows.map(mapBoardingEvent);
  }

  async countRouteStudents(tenantId: string, routeId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM route_students
       WHERE tenant_id = ? AND route_id = ?`,
      [tenantId, routeId],
    );
    return Number(row?.c ?? 0);
  }

  async deleteRouteStudent(
    tenantId: string,
    routeId: string,
    studentRef: string,
  ): Promise<boolean> {
    if (!(await this.getRouteStudent(tenantId, routeId, studentRef))) return false;
    await this.db.run(
      `DELETE FROM route_students
       WHERE tenant_id = ? AND route_id = ? AND student_ref = ?`,
      [tenantId, routeId, studentRef],
    );
    return true;
  }

  async insertBinding(b: TransportBinding): Promise<TransportBinding> {
    await this.db.run(
      `INSERT INTO transport_bindings (
         id, tenant_id, student_ref, payload_hash, is_active, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        b.id,
        b.tenantId,
        b.studentRef,
        b.payloadHash,
        b.isActive ? 1 : 0,
        b.createdAt,
      ],
    );
    const created = await this.getBinding(b.tenantId, b.id);
    if (!created) throw new Error('Failed to read inserted binding');
    return created;
  }

  async getBinding(tenantId: string, id: string): Promise<TransportBinding | null> {
    const row = await this.db.get<BindingRow>(
      'SELECT * FROM transport_bindings WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapBinding(row) : null;
  }

  async findActiveBindingByHash(
    tenantId: string,
    payloadHash: string,
  ): Promise<TransportBinding | null> {
    const row = await this.db.get<BindingRow>(
      `SELECT * FROM transport_bindings
       WHERE tenant_id = ? AND payload_hash = ? AND is_active = 1`,
      [tenantId, payloadHash],
    );
    return row ? mapBinding(row) : null;
  }

  async deactivateBinding(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getBinding(tenantId, id);
    if (!existing) return false;
    await this.db.run(
      'UPDATE transport_bindings SET is_active = 0 WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return true;
  }

  async insertBoardingEvent(e: BoardingEvent): Promise<BoardingEvent> {
    await this.db.run(
      `INSERT INTO boarding_events (
         id, tenant_id, route_id, vehicle_id, student_ref, direction, leg, at,
         lat, lng, source, device_id, idempotency_key, unmatched, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.tenantId,
        e.routeId,
        e.vehicleId,
        e.studentRef,
        e.direction,
        e.leg,
        e.at,
        e.lat,
        e.lng,
        e.source,
        e.deviceId,
        e.idempotencyKey,
        e.unmatched ? 1 : 0,
        e.createdAt,
      ],
    );
    const created = await this.getBoardingEvent(e.tenantId, e.id);
    if (!created) throw new Error('Failed to read inserted boarding event');
    return created;
  }

  async getBoardingEvent(tenantId: string, id: string): Promise<BoardingEvent | null> {
    const row = await this.db.get<BoardingEventRow>(
      'SELECT * FROM boarding_events WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapBoardingEvent(row) : null;
  }

  async getBoardingByIdempotency(
    tenantId: string,
    key: string,
  ): Promise<BoardingEvent | null> {
    const row = await this.db.get<BoardingEventRow>(
      `SELECT * FROM boarding_events
       WHERE tenant_id = ? AND idempotency_key = ?`,
      [tenantId, key],
    );
    return row ? mapBoardingEvent(row) : null;
  }

  async listBoardingForRouteDay(
    tenantId: string,
    routeId: string,
    day: string,
  ): Promise<BoardingEvent[]> {
    const rows = await this.db.all<BoardingEventRow>(
      `SELECT * FROM boarding_events
       WHERE tenant_id = ? AND route_id = ?
         AND substr(at, 1, 10) = ?
       ORDER BY at ASC`,
      [tenantId, routeId, day],
    );
    return rows.map(mapBoardingEvent);
  }

  async hasBoardEvent(
    tenantId: string,
    routeId: string,
    studentRef: string,
    leg: BoardingLeg,
    day: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ id: string }>(
      `SELECT id FROM boarding_events
       WHERE tenant_id = ? AND route_id = ? AND student_ref = ?
         AND direction = 'board' AND leg = ?
         AND substr(at, 1, 10) = ?
         AND unmatched = 0
       LIMIT 1`,
      [tenantId, routeId, studentRef, leg, day],
    );
    return !!row;
  }

  async getSweepLog(
    tenantId: string,
    routeId: string,
    leg: BoardingLeg,
    sweepDate: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ route_id: string }>(
      `SELECT route_id FROM sweep_log
       WHERE tenant_id = ? AND route_id = ? AND leg = ? AND sweep_date = ?`,
      [tenantId, routeId, leg, sweepDate],
    );
    return !!row;
  }

  async insertSweepLog(
    tenantId: string,
    routeId: string,
    leg: BoardingLeg,
    sweepDate: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO sweep_log (tenant_id, route_id, leg, sweep_date)
       VALUES (?, ?, ?, ?)`,
      [tenantId, routeId, leg, sweepDate],
    );
  }

  async insertPing(p: VehiclePing): Promise<VehiclePing> {
    await this.db.run(
      `INSERT INTO vehicle_pings (id, tenant_id, vehicle_id, lat, lng, speed_kmh, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.tenantId, p.vehicleId, p.lat, p.lng, p.speedKmh, p.at],
    );
    const created = await this.getPing(p.tenantId, p.id);
    if (!created) throw new Error('Failed to read inserted ping');
    return created;
  }

  async getPing(tenantId: string, id: string): Promise<VehiclePing | null> {
    const row = await this.db.get<PingRow>(
      'SELECT * FROM vehicle_pings WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapPing(row) : null;
  }

  async getLatestPing(
    tenantId: string,
    vehicleId: string,
  ): Promise<VehiclePing | null> {
    const row = await this.db.get<PingRow>(
      `SELECT * FROM vehicle_pings
       WHERE tenant_id = ? AND vehicle_id = ?
       ORDER BY at DESC
       LIMIT 1`,
      [tenantId, vehicleId],
    );
    return row ? mapPing(row) : null;
  }

  async listRecentPings(
    tenantId: string,
    vehicleId: string,
    limit: number,
  ): Promise<VehiclePing[]> {
    const rows = await this.db.all<PingRow>(
      `SELECT * FROM vehicle_pings
       WHERE tenant_id = ? AND vehicle_id = ?
       ORDER BY at DESC
       LIMIT ?`,
      [tenantId, vehicleId, limit],
    );
    return rows.map(mapPing);
  }

  async prunePingsOlderThan(tenantId: string, cutoffIso: string): Promise<number> {
    const before = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM vehicle_pings
       WHERE tenant_id = ? AND at < ?`,
      [tenantId, cutoffIso],
    );
    await this.db.run(
      'DELETE FROM vehicle_pings WHERE tenant_id = ? AND at < ?',
      [tenantId, cutoffIso],
    );
    return Number(before?.c ?? 0);
  }

  async hasDelayLog(
    tenantId: string,
    routeId: string,
    leg: BoardingLeg,
    delayDate: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ route_id: string }>(
      `SELECT route_id FROM delay_log
       WHERE tenant_id = ? AND route_id = ? AND leg = ? AND delay_date = ?`,
      [tenantId, routeId, leg, delayDate],
    );
    return !!row;
  }

  async insertDelayLog(
    tenantId: string,
    routeId: string,
    leg: BoardingLeg,
    delayDate: string,
    minutesLate: number,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO delay_log (tenant_id, route_id, leg, delay_date, minutes_late)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, routeId, leg, delayDate, minutesLate],
    );
  }
}

interface BindingRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_ref: string;
  payload_hash: string;
  is_active: number;
  created_at: string;
}

function mapBinding(row: BindingRow): TransportBinding {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentRef: row.student_ref,
    payloadHash: row.payload_hash,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

interface BoardingEventRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  route_id: string;
  vehicle_id: string;
  student_ref: string | null;
  direction: string;
  leg: string;
  at: string;
  lat: number | null;
  lng: number | null;
  source: string;
  device_id: string | null;
  idempotency_key: string | null;
  unmatched: number;
  created_at: string;
}

function mapBoardingEvent(row: BoardingEventRow): BoardingEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    routeId: row.route_id,
    vehicleId: row.vehicle_id,
    studentRef: row.student_ref,
    direction: row.direction as BoardingDirection,
    leg: row.leg as BoardingLeg,
    at: row.at,
    lat: row.lat,
    lng: row.lng,
    source: row.source as BoardingSource,
    deviceId: row.device_id,
    idempotencyKey: row.idempotency_key,
    unmatched: row.unmatched === 1,
    createdAt: row.created_at,
  };
}

interface PingRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  at: string;
}

function mapPing(row: PingRow): VehiclePing {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    vehicleId: row.vehicle_id,
    lat: row.lat,
    lng: row.lng,
    speedKmh: row.speed_kmh,
    at: row.at,
  };
}

import type { Logger } from 'pino';
import type {
  GeoFencingRepository,
  GeoZoneRow,
  GeoClockLogRow,
  GeoSettings,
} from '../repositories/geo-fencing-repository';
import type { ClockService, ClockActionResult } from './clock-service';

// ── Result types ──

export interface GeoClockResult {
  success: boolean;
  error?: string;
  insideZone: boolean;
  matchedZone?: { id: number; name: string; distanceMeters: number };
  nearestZone?: { id: number; name: string; distanceMeters: number };
  clockResult?: ClockActionResult;
}

export interface ZoneCheckResult {
  insideAny: boolean;
  nearestZone: {
    id: number;
    name: string;
    distanceMeters: number;
    radiusMeters: number;
  } | null;
  matchedZone: {
    id: number;
    name: string;
    distanceMeters: number;
  } | null;
}

// ── Haversine ──

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Haversine distance between two lat/lng points in meters.
 * Standard formula — no approximations.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export class GeoFencingService {
  constructor(
    private readonly repo: GeoFencingRepository,
    private readonly clockService: ClockService,
    private readonly logger: Logger,
  ) {}

  /**
   * Check if coordinates fall within any active geo-zone.
   * Returns the matched zone (if inside) and the nearest zone (always).
   */
  async checkLocation(lat: number, lng: number): Promise<ZoneCheckResult> {
    const zones = await this.repo.getActiveZones();
    if (zones.length === 0) {
      return { insideAny: false, nearestZone: null, matchedZone: null };
    }

    let nearestZone: { id: number; name: string; distanceMeters: number; radiusMeters: number } | null = null;
    let matchedZone: { id: number; name: string; distanceMeters: number } | null = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const distance = haversineDistance(lat, lng, zone.latitude, zone.longitude);
      const rounded = Math.round(distance * 10) / 10;

      if (rounded < minDistance) {
        minDistance = rounded;
        nearestZone = {
          id: zone.id,
          name: zone.name,
          distanceMeters: rounded,
          radiusMeters: zone.radius_meters,
        };
      }

      if (distance <= zone.radius_meters && !matchedZone) {
        matchedZone = { id: zone.id, name: zone.name, distanceMeters: rounded };
      }
    }

    return {
      insideAny: matchedZone !== null,
      nearestZone,
      matchedZone,
    };
  }

  /**
   * Clock in/out via geo-location.
   * Validates location against zones, logs the attempt, then calls clock service.
   *
   * Behavior depends on settings:
   * - geo_fencing_enabled=0 → 400 (feature disabled)
   * - geo_fencing_strict=1 + outside all zones → rejected
   * - geo_fencing_strict=0 + outside all zones → allowed with warning logged
   */
  async geoClock(params: {
    email: string;
    name: string;
    action: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  }): Promise<GeoClockResult> {
    const settings = await this.repo.getSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Geo-fencing is not enabled', insideZone: false };
    }

    const { email, name, action, latitude, longitude, accuracyMeters } = params;

    // Check location against zones
    const check = await this.checkLocation(latitude, longitude);

    if (check.matchedZone) {
      // Inside a zone — always allowed
      await this.repo.insertLog({
        email,
        action,
        latitude,
        longitude,
        accuracyMeters,
        matchedZoneId: check.matchedZone.id,
        matchedZoneName: check.matchedZone.name,
        distanceMeters: check.matchedZone.distanceMeters,
        insideZone: true,
        allowed: true,
      });

      const clockResult = await this.clockService.clock(action, email, name, 'geo');

      this.logger.info(
        { email, action, zone: check.matchedZone.name, distance: check.matchedZone.distanceMeters },
        'Geo clock — inside zone',
      );

      return {
        success: clockResult.success,
        insideZone: true,
        matchedZone: check.matchedZone,
        clockResult,
        error: clockResult.error,
      };
    }

    // Outside all zones
    const nearestDistance = check.nearestZone?.distanceMeters ?? 0;

    if (settings.strict) {
      // Strict mode — reject
      const denialReason = check.nearestZone
        ? `Outside all zones. Nearest: ${check.nearestZone.name} (${nearestDistance}m away, radius ${check.nearestZone.radiusMeters}m)`
        : 'No geo-fence zones configured';

      await this.repo.insertLog({
        email,
        action,
        latitude,
        longitude,
        accuracyMeters,
        matchedZoneId: check.nearestZone?.id,
        matchedZoneName: check.nearestZone?.name ?? '',
        distanceMeters: nearestDistance,
        insideZone: false,
        allowed: false,
        denialReason,
      });

      this.logger.warn(
        { email, action, nearestZone: check.nearestZone?.name, distance: nearestDistance },
        'Geo clock rejected — outside all zones (strict mode)',
      );

      return {
        success: false,
        insideZone: false,
        error: denialReason,
        nearestZone: check.nearestZone
          ? { id: check.nearestZone.id, name: check.nearestZone.name, distanceMeters: nearestDistance }
          : undefined,
      };
    }

    // Non-strict mode — allow but log warning
    await this.repo.insertLog({
      email,
      action,
      latitude,
      longitude,
      accuracyMeters,
      matchedZoneId: check.nearestZone?.id,
      matchedZoneName: check.nearestZone?.name ?? '',
      distanceMeters: nearestDistance,
      insideZone: false,
      allowed: true,
    });

    const clockResult = await this.clockService.clock(action, email, name, 'geo');

    this.logger.info(
      { email, action, nearestZone: check.nearestZone?.name, distance: nearestDistance },
      'Geo clock — outside zone (non-strict, allowed)',
    );

    return {
      success: clockResult.success,
      insideZone: false,
      nearestZone: check.nearestZone
        ? { id: check.nearestZone.id, name: check.nearestZone.name, distanceMeters: nearestDistance }
        : undefined,
      clockResult,
      error: clockResult.error,
    };
  }

  // ── Zone CRUD pass-through ──

  async getZones(includeInactive = false): Promise<GeoZoneRow[]> {
    return includeInactive ? this.repo.getAllZones() : this.repo.getActiveZones();
  }

  async createZone(data: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    address?: string;
  }): Promise<GeoZoneRow> {
    const zone = await this.repo.createZone(data);
    this.logger.info({ zoneId: zone.id, name: zone.name }, 'Geo zone created');
    return zone;
  }

  async updateZone(id: number, fields: Record<string, unknown>): Promise<void> {
    await this.repo.updateZone(id, fields);
  }

  async deleteZone(id: number): Promise<void> {
    await this.repo.deleteZone(id);
    this.logger.info({ zoneId: id }, 'Geo zone deleted');
  }

  async getSettings(): Promise<GeoSettings> {
    return this.repo.getSettings();
  }

  async updateSettings(enabled: boolean, strict: boolean): Promise<void> {
    await this.repo.updateSettings(enabled, strict);
    this.logger.info({ enabled, strict }, 'Geo-fencing settings updated');
  }

  async getLogs(filters: {
    email?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<GeoClockLogRow[]> {
    return this.repo.getLogs(filters);
  }
}

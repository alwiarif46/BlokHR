import type { Logger } from 'pino';
import type { GeoRepository, GeoZoneRow } from '../repositories/geo-repository';
import type { ClockService, ClockActionResult } from './clock-service';

export interface GeoClockResult {
  success: boolean;
  error?: string;
  allowed?: boolean;
  matchedZone?: string;
  distanceMeters?: number;
  clockResult?: ClockActionResult;
}

export interface ZoneCheckResult {
  inside: boolean;
  matchedZone: GeoZoneRow | null;
  distanceMeters: number;
}

/** Earth's radius in meters. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine formula: distance between two lat/lng points in meters.
 * Accurate for short distances (city-scale). No external dependencies.
 */
export function haversineDistance(
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
  return EARTH_RADIUS_M * c;
}

export class GeoService {
  constructor(
    private readonly repo: GeoRepository,
    private readonly clockService: ClockService,
    private readonly logger: Logger,
  ) {}

  /**
   * Validate location against active geo-fences and clock the action.
   * If geo-fencing is disabled globally, the clock proceeds without location check.
   */
  async validateAndClock(
    email: string,
    latitude: number,
    longitude: number,
    action: string,
    accuracyMeters?: number,
  ): Promise<GeoClockResult> {
    const validActions = new Set(['in', 'out', 'break', 'back']);
    if (!validActions.has(action)) {
      return { success: false, error: `Invalid action: ${action}` };
    }

    // Check if geo-fencing is enabled
    const settings = await this.repo.getSettings();
    if (!settings.geoFencingEnabled) {
      // Geo-fencing disabled — clock directly with 'geo' source
      const name = await this.repo.getMemberName(email);
      if (!name) {
        return { success: false, error: 'Employee not found or inactive' };
      }
      const clockResult = await this.clockService.clock(action, email, name, 'geo');
      return { success: clockResult.success, allowed: true, clockResult, error: clockResult.error };
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return { success: false, error: 'Invalid coordinates' };
    }

    // Resolve employee name
    const name = await this.repo.getMemberName(email);
    if (!name) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Get active zones
    const zones = await this.repo.getZones(false);
    if (zones.length === 0) {
      // No zones defined but geo-fencing is enabled — allow (nothing to check against)
      this.logger.warn('Geo-fencing enabled but no zones defined — allowing clock action');
      const clockResult = await this.clockService.clock(action, email, name, 'geo');
      await this.repo.logAttempt({
        email,
        action,
        latitude,
        longitude,
        accuracyMeters,
        distanceMeters: 0,
        insideZone: false,
        allowed: true,
        denialReason: '',
      });
      return { success: clockResult.success, allowed: true, clockResult, error: clockResult.error };
    }

    // Check if inside any zone
    const check = this.checkZones(latitude, longitude, zones);

    if (check.inside) {
      // Inside a zone — allow and log
      await this.repo.logAttempt({
        email,
        action,
        latitude,
        longitude,
        accuracyMeters,
        matchedZoneId: check.matchedZone?.id,
        matchedZoneName: check.matchedZone?.name ?? '',
        distanceMeters: check.distanceMeters,
        insideZone: true,
        allowed: true,
      });

      const clockResult = await this.clockService.clock(action, email, name, 'geo');
      return {
        success: clockResult.success,
        allowed: true,
        matchedZone: check.matchedZone?.name,
        distanceMeters: Math.round(check.distanceMeters),
        clockResult,
        error: clockResult.error,
      };
    }

    // Outside all zones — denied
    const denialReason = `Outside all geo-fences. Nearest zone: ${check.matchedZone?.name ?? 'unknown'} (${Math.round(check.distanceMeters)}m away)`;
    await this.repo.logAttempt({
      email,
      action,
      latitude,
      longitude,
      accuracyMeters,
      matchedZoneId: check.matchedZone?.id,
      matchedZoneName: check.matchedZone?.name ?? '',
      distanceMeters: check.distanceMeters,
      insideZone: false,
      allowed: false,
      denialReason,
    });

    this.logger.info(
      { email, action, distance: check.distanceMeters, zone: check.matchedZone?.name },
      'Geo clock denied — outside fence',
    );

    return {
      success: false,
      allowed: false,
      error: denialReason,
      matchedZone: check.matchedZone?.name,
      distanceMeters: Math.round(check.distanceMeters),
    };
  }

  /**
   * Check coordinates against all zones. Returns the closest zone
   * and whether the point is inside any of them.
   */
  checkZones(
    latitude: number,
    longitude: number,
    zones: GeoZoneRow[],
  ): ZoneCheckResult {
    let closestZone: GeoZoneRow | null = null;
    let closestDistance = Infinity;

    for (const zone of zones) {
      const distance = haversineDistance(latitude, longitude, zone.latitude, zone.longitude);
      if (distance <= zone.radius_meters) {
        // Inside this zone — return immediately (any match is sufficient)
        return { inside: true, matchedZone: zone, distanceMeters: distance };
      }
      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = zone;
      }
    }

    return { inside: false, matchedZone: closestZone, distanceMeters: closestDistance };
  }
}

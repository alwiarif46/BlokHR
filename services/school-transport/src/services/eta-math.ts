/** Pure geo / ETA helpers for AIS-140 style vehicle telemetry. */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres (WGS84 sphere). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const MIN_SPEED_KMH = 15;
const STALE_SECONDS = 10 * 60;

export type EtaResult =
  | { etaMinutes: number; stale: false; distanceKm: number; speedKmh: number }
  | { etaMinutes: null; stale: true; distanceKm?: number; speedKmh?: number };

/**
 * ETA minutes = haversineKm ÷ max(avgSpeedKmh, 15) × 60.
 * Stale when ping age > 10 minutes.
 */
export function computeEta(input: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  avgSpeedKmh: number;
  pingAgeSeconds: number;
}): EtaResult {
  if (input.pingAgeSeconds > STALE_SECONDS) {
    return { etaMinutes: null, stale: true };
  }
  const distanceKm = haversineKm(
    input.fromLat,
    input.fromLng,
    input.toLat,
    input.toLng,
  );
  const speedKmh = Math.max(input.avgSpeedKmh, MIN_SPEED_KMH);
  const etaMinutes = (distanceKm / speedKmh) * 60;
  return {
    etaMinutes,
    stale: false,
    distanceKm,
    speedKmh,
  };
}

export { MIN_SPEED_KMH, STALE_SECONDS };

/**
 * Device-facing paths on /svc/* that cannot authenticate yet (P12-02).
 * device auth pending — tracked in prompts/school/README.md standing gaps
 */
import type { ServiceName } from '../config';

export interface PublicPathRule {
  service: ServiceName;
  method: string;
  /** Match upstream path after /svc/:service strip. */
  pattern: RegExp;
  /** device auth pending — tracked in prompts/school/README.md standing gaps */
  comment: string;
}

/**
 * Guarded set: all SERVICE_NAMES require bearer + staff introspect except these.
 *
 * In SERVICE_MAP and exempt:
 * - school-transport POST .../boarding, POST .../pings
 * - school-attendance POST .../capture
 *
 * Expected by prompt but NOT in SERVICE_MAP (monolith /api only — outside /svc guard):
 * - kiosk check-in, capture/capture-rollcall device posts
 * Those remain on /api/* until device auth lands; listed in standing gaps.
 */
export const PUBLIC_PATHS: PublicPathRule[] = [
  {
    service: 'school-transport',
    method: 'POST',
    pattern: /^\/api\/transport\/[^/]+\/boarding\/?$/,
    comment: 'device auth pending — tracked in prompts/school/README.md standing gaps',
  },
  {
    service: 'school-transport',
    method: 'POST',
    // Exact /pings — not /pings/prune
    pattern: /^\/api\/transport\/[^/]+\/pings\/?$/,
    comment: 'device auth pending — tracked in prompts/school/README.md standing gaps',
  },
  {
    service: 'school-attendance',
    method: 'POST',
    pattern: /^\/api\/attendance\/[^/]+\/capture\/?$/,
    comment: 'device auth pending — tracked in prompts/school/README.md standing gaps',
  },
];

export function isPublicSvcPath(
  service: ServiceName,
  method: string,
  upstreamPath: string,
): boolean {
  const pathOnly = upstreamPath.split('?')[0] || '/';
  const m = method.toUpperCase();
  return PUBLIC_PATHS.some(
    (rule) =>
      rule.service === service &&
      rule.method === m &&
      rule.pattern.test(pathOnly),
  );
}

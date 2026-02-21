const METERS_PER_KM = 1000;
const FEET_PER_METER = 3.28084;

/**
 * Format distance for display:
 * - < 100 m → feet (e.g. "150 ft")
 * - 100 m to < 1 km → meters (e.g. "500 m")
 * - ≥ 1 km → km (e.g. "1.2 km")
 */
export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "";
  const meters = distanceKm * METERS_PER_KM;
  if (meters < 100) {
    const ft = Math.round(meters * FEET_PER_METER);
    return `${ft} ft`;
  }
  if (distanceKm < 1) {
    return `${Math.round(meters)} m`;
  }
  const km =
    distanceKm >= 10
      ? Math.round(distanceKm)
      : Math.round(distanceKm * 10) / 10;
  return `${km} km`;
}

/** Case type with optional distance (API may send distanceKm or distance_km). */
type CaseWithDistance = {
  distanceKm?: number | string;
  distance_km?: number | string;
};

/** Parse distance in km from a case (supports camelCase and snake_case, number or string). */
export function getCaseDistanceKm(c: CaseWithDistance): number | undefined {
  const raw = c.distance_km ?? c.distanceKm;
  if (raw == null) return undefined;
  const km = typeof raw === "string" ? parseFloat(raw) : raw;
  return Number.isFinite(km) && km >= 0 ? km : undefined;
}

/** Format case distance for badge: "< 1 m", "350 m", "1.2 km", or fallback when no distance. */
export function formatCaseDistanceLabel(
  distanceKm: number | undefined,
  fallback = "",
): string {
  if (distanceKm == null) return fallback;
  if (distanceKm < 0.001) return "< 1 m";
  if (distanceKm < 1) return `${Math.round(distanceKm * METERS_PER_KM)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

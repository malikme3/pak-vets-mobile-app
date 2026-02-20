const METERS_PER_KM = 1000;
const FEET_PER_METER = 3.28084;

/**
 * Format distance for display:
 * - &lt; 100 m → feet (e.g. "150 ft")
 * - 100 m to &lt; 1 km → meters (e.g. "500 m")
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
  const km = distanceKm >= 10 ? Math.round(distanceKm) : Math.round(distanceKm * 10) / 10;
  return `${km} km`;
}

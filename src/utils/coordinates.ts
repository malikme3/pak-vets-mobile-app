export type Coordinates = { latitude: number; longitude: number };

function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function readCoordinates(
  value: unknown,
  depth = 0,
): Coordinates | undefined {
  if (
    depth > 6 ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  )
    return undefined;
  const object = value as Record<string, unknown>;
  const latitude = coordinate(object.latitude, 90);
  const longitude = coordinate(object.longitude, 180);
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  for (const child of Object.values(object)) {
    const found = readCoordinates(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = Math.PI / 180;
  const latitude = (to.latitude - from.latitude) * radians;
  const longitude = (to.longitude - from.longitude) * radians;
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(from.latitude * radians) *
      Math.cos(to.latitude * radians) *
      Math.sin(longitude / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
  );
}

/**
 * Estimated weight from heart girth (G) and body length (L) in cm.
 * Formulas (metric):
 * - Cattle (Cow, Buffalo, Calf): Shaeffer — (G² × L) / 10800
 * - Goat / Sheep: (G² × L) / 11360
 * - Horse: Carroll & Huntington — (G² × L) / 11877
 */

const CATTLE_DIVISOR = 10800;
const GOAT_SHEEP_DIVISOR = 11360;
const HORSE_DIVISOR = 11877;

const CATTLE_SPECIES = ["cattle", "cow", "cows", "buffalo", "calf", "calves"];

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase();
}

function isCattle(species: string): boolean {
  const s = normalizeSpecies(species);
  return CATTLE_SPECIES.some((c) => s.includes(c) || c.includes(s));
}

function isGoatOrSheep(species: string): boolean {
  const s = normalizeSpecies(species);
  return (
    s.includes("goat") || s.includes("sheep") || s === "goat" || s === "sheep"
  );
}

function isHorse(species: string): boolean {
  const s = normalizeSpecies(species);
  return s.includes("horse") || s === "horse";
}

/**
 * Returns estimated weight in kg from heart girth (cm) and body length (cm).
 * Returns null if species is not supported or inputs are invalid.
 */
export function estimateWeightKg(
  species: string,
  heartGirthCm: number,
  bodyLengthCm: number,
): number | null {
  if (
    !species?.trim() ||
    typeof heartGirthCm !== "number" ||
    typeof bodyLengthCm !== "number" ||
    heartGirthCm <= 0 ||
    bodyLengthCm <= 0 ||
    !Number.isFinite(heartGirthCm) ||
    !Number.isFinite(bodyLengthCm)
  ) {
    return null;
  }

  const G = heartGirthCm;
  const L = bodyLengthCm;
  let divisor: number | null = null;

  if (isCattle(species)) {
    divisor = CATTLE_DIVISOR;
  } else if (isGoatOrSheep(species)) {
    divisor = GOAT_SHEEP_DIVISOR;
  } else if (isHorse(species)) {
    divisor = HORSE_DIVISOR;
  }

  if (divisor == null) return null;

  const weightKg = (G * G * L) / divisor;
  return Number.isFinite(weightKg) && weightKg > 0
    ? Math.round(weightKg * 10) / 10
    : null;
}

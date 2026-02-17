/**
 * Pakistani mobile phone: 0 + 10 digits (e.g. 0300 7087927).
 * - Always start with 0; strip 92/0092 country code; strip extra leading zeros.
 * - Valid: exactly 11 digits (0 + 10). Less or more than 10 digits after 0 = invalid.
 */

const DIGITS_ONLY = /^\d+$/;

/**
 * Normalize raw input to 11-digit string "0XXXXXXXXXX" or null if invalid.
 * - Strips non-digits, removes 92/0092 prefix, ensures leading 0, strips extra leading zeros.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return null;

  let rest = digits;
  if (rest.startsWith("92") && rest.length > 10) {
    rest = rest.slice(2);
  }
  if (!rest.startsWith("0")) {
    rest = "0" + rest;
  }
  while (rest.length > 1 && rest.startsWith("00")) {
    rest = rest.slice(1);
  }
  if (rest.length !== 11 || rest[0] !== "0") return null;
  if (!DIGITS_ONLY.test(rest)) return null;
  return rest;
}

/**
 * Validate: must be exactly 11 digits (0 + 10). Returns true if valid.
 */
export function isValidPhone(normalized: string | null): boolean {
  return (
    normalized !== null &&
    normalized.length === 11 &&
    DIGITS_ONLY.test(normalized)
  );
}

/**
 * Display format: 0XXX XXXXXXX (e.g. 0300 7087927 – 4 digits, space, 7 digits)
 */
export function formatPhoneDisplay(normalized: string): string {
  const d = normalized.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

/**
 * Format as user types: digits only, max 11; ensure leading 0; display with space.
 * Use for controlled input value.
 */
export function formatPhoneInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  let rest = digits;
  if (rest.startsWith("92") && rest.length > 10) {
    rest = rest.slice(2);
  }
  if (!rest.startsWith("0") && rest.length > 0) {
    rest = "0" + rest;
  }
  while (rest.length > 1 && rest.startsWith("00")) {
    rest = rest.slice(1);
  }
  return formatPhoneDisplay(rest.slice(0, 11));
}

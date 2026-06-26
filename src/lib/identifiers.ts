/**
 * REGON / PESEL helpers. The imported Excel stored REGON as a number, so some
 * 9-digit values lost leading zeros — normalization left-pads to 9 digits so an
 * exact, indexed match still works regardless of how the user types it.
 */

export function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Normalized REGON used for indexed matching (digits; <=9 padded to 9). */
export function normalizeRegon(s: string): string {
  const d = digitsOnly(s);
  return d.length > 0 && d.length <= 9 ? d.padStart(9, "0") : d;
}

export type IdentifierKind = "REGON" | "PESEL" | "UNKNOWN";

/** Classify a typed identifier. PESEL = 11 digits; REGON = 9 or 14 (8 tolerated). */
export function classifyIdentifier(raw: string): IdentifierKind {
  const d = digitsOnly(raw);
  if (d.length === 11) return "PESEL";
  if (d.length === 8 || d.length === 9 || d.length === 14) return "REGON";
  return "UNKNOWN";
}

export function isPlausibleRegon(raw: string): boolean {
  const k = classifyIdentifier(raw);
  return k === "REGON";
}

export function isPlausiblePesel(raw: string): boolean {
  return digitsOnly(raw).length === 11;
}

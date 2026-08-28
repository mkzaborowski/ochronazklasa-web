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

/**
 * Który zapis identyfikatora zostawić w formularzu po dopasowaniu szkoły.
 *
 * REGON-y trafiły do bazy z Excela zapisane jako LICZBY, więc część straciła
 * zera wiodące: „000891298" leży w bazie jako „891298". Podpowiedź nadpisywała
 * tym poprawnie wpisaną wartość i zera znikały — czasem widać to było dopiero
 * na końcu kreatora, po sześciu krokach, i trzeba było wracać na start.
 *
 * Gdy oba zapisy oznaczają ten sam numer, wygrywa postać pełna: REGON ma
 * dziewięć cyfr i to jest jego prawdziwa długość, a nie zapis po drodze przez
 * arkusz. PESEL (11 cyfr) i REGON czternastocyfrowy zostają nietknięte, bo
 * normalizacja dopełnia wyłącznie wartości krótsze niż dziewięć cyfr.
 */
export function scalIdentyfikator(wpisany: string, zBazy: string | null | undefined): string {
  if (!zBazy) return wpisany;
  if (!wpisany) return normalizeRegon(zBazy);
  return normalizeRegon(wpisany) === normalizeRegon(zBazy) ? normalizeRegon(wpisany) : zBazy;
}

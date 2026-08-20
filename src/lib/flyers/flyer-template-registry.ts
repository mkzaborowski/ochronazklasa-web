import type { VariantCode } from "@/lib/interrisk/variants";
import type { FlyerPeriod, FlyerTemplate, PaymentType, PeriodKey } from "./flyer-types";

/**
 * Spis DOSTĘPNYCH ulotek — działają wyłącznie te przygotowane wcześniej
 * kombinacje. Ulotka = forma płatności (gotówka/przelew) × okres × dokładny
 * zestaw wariantów. Pliki i mapy pól leżą w templates/flyers/ i powstają
 * przez `npm run build-flyer-fields`.
 *
 * Nową ulotkę dodaje się w trzech krokach: plik do
 * templates/flyers/<klucz>.pdf, wpis w MAP w scripts/extract-flyer-fields.mjs,
 * wpis tutaj.
 *
 * O OKRESIE decyduje druga strona ulotki (tabela zakresu), a nie wpisana w
 * dostarczonym pliku data — to pole i tak nadpisujemy przy generowaniu.
 * Ulotka z dwoma wierszami świadczenia za 1% (osobno „umowa na 1 rok" i
 * „umowa na 2 lata") obsługuje oba okresy i ma tu okres "ANY".
 */
function tpl(
  key: string,
  label: string,
  payment: PaymentType,
  period: FlyerPeriod,
  variants: VariantCode[],
  fileKey = key,
): FlyerTemplate {
  return {
    key,
    label,
    payment,
    period,
    variants,
    templatePath: `templates/flyers/${fileKey}.pdf`,
    fieldsPath: `templates/flyers/${fileKey}.fields.json`,
  };
}

const V50_FULL: VariantCode[] = ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"];

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  tpl("v50-full-cash-2y", "OCHRONA 50/65/90/140/195 — gotówka, 2 lata", "cash", "2Y", V50_FULL),
  tpl("v50-full-wire-2y", "OCHRONA 50/65/90/140/195 — przelew, 2 lata", "wire", "2Y", V50_FULL),
  tpl("v50-65-90-140-195-wire-2y", "OCHRONA 65/90/140/195 — przelew, 2 lata", "wire", "2Y",
    ["65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"]),
  tpl("v50-50-90-140-195-wire-2y", "OCHRONA 50/90/140/195 — przelew, 2 lata", "wire", "2Y",
    ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"]),
  tpl("v50-50-cash-1y", "OCHRONA 50 — gotówka, 1 rok", "cash", "1Y", ["50PLNV50"]),
  tpl("v50-50-cash-2y", "OCHRONA 50 — gotówka, 2 lata", "cash", "2Y", ["50PLNV50"]),
  // The standalone "65" flyer's scope page is a graphic — registered for both
  // 65 variants (V40/V50) until confirmed otherwise.
  tpl("v65-single-cash-2y", "OCHRONA 65 — gotówka, 2 lata", "cash", "2Y", ["65PLNV50"]),
  tpl("v65v40-single-cash-2y", "OCHRONA 65 (V40) — gotówka, 2 lata", "cash", "2Y",
    ["65PLNV40"], "v65-single-cash-2y"),
  tpl("v40-50-80-120-165-cash-2y", "OCHRONA 50/80/120/165 — gotówka, 2 lata", "cash", "2Y",
    ["50PLNV40", "80PLNV40", "120PLNV40", "165PLN"]),
  tpl("v50-50-90-140-195-cash-2y", "OCHRONA 50/90/140/195 — gotówka, 2 lata", "cash", "2Y",
    ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"]),
  tpl("v50-65-85-125-cash-2y", "OCHRONA 65/85/125 — gotówka, 2 lata", "cash", "2Y",
    ["65PLNV50", "85PLNV50", "125PLNV50"]),
  tpl("v50-65-90-140-cash-2y", "OCHRONA 65/90/140 — gotówka, 2 lata", "cash", "2Y",
    ["65PLNV50", "90PLNV50", "140PLNV50"]),

  // --- dostarczone 20.08.2026 ---
  tpl("v50-50-wire-2y", "OCHRONA 50 — przelew, 2 lata", "wire", "2Y", ["50PLNV50"]),
  tpl("v50-50-65-cash-2y", "OCHRONA 50/65 — gotówka, 2 lata", "cash", "2Y",
    ["50PLNV50", "65PLNV50"]),
  tpl("v50-50-65-85-125-170-wire-2y", "OCHRONA 50/65/85/125/170 — przelew, 2 lata", "wire", "2Y",
    ["50PLNV50", "65PLNV50", "85PLNV50", "125PLNV50", "170PLNV50"]),
  tpl("v50-50-90-cash-any", "OCHRONA 50/90 — gotówka, 1 rok i 2 lata", "cash", "ANY",
    ["50PLNV50", "90PLNV50"]),
  tpl("v50-50-85-wire-any", "OCHRONA 50/85 — przelew, 1 rok i 2 lata", "wire", "ANY",
    ["50PLNV50", "85PLNV50"]),
  tpl("v50-50-65-85-125-cash-any", "OCHRONA 50/65/85/125 — gotówka, 1 rok i 2 lata", "cash", "ANY",
    ["50PLNV50", "65PLNV50", "85PLNV50", "125PLNV50"]),
  tpl("v50-50-65-85-wire-any", "OCHRONA 50/65/85 — przelew, 1 rok i 2 lata", "wire", "ANY",
    ["50PLNV50", "65PLNV50", "85PLNV50"]),
  tpl("v50-65-85-125-170-wire-any", "OCHRONA 65/85/125/170 — przelew, 1 rok i 2 lata", "wire", "ANY",
    ["65PLNV50", "85PLNV50", "125PLNV50", "170PLNV50"]),
];

/** Canonical order-independent key for a set of variants. */
export function combinationKey(variants: VariantCode[]): string {
  return [...new Set(variants)].sort().join("+");
}

/** Czy ulotka nadaje się na polisę o tym okresie. */
function pasujeOkresem(t: FlyerTemplate, period: PeriodKey): boolean {
  return t.period === period || t.period === "ANY";
}

/**
 * Ulotka na dokładnie ten zestaw wariantów + formę płatności + okres.
 *
 * Ulotka przypisana wprost do okresu wygrywa z uniwersalną: drukuje tylko ten
 * wiersz świadczeń, który dotyczy tej szkoły, więc rodzic nie musi zgadywać,
 * którą liczbę czytać.
 */
export function selectFlyerTemplate(
  variants: VariantCode[],
  payment: PaymentType,
  period: PeriodKey,
): FlyerTemplate | null {
  const key = combinationKey(variants);
  const kandydaci = FLYER_TEMPLATES.filter(
    (t) => t.payment === payment && combinationKey(t.variants) === key && pasujeOkresem(t, period),
  );
  return kandydaci.find((t) => t.period === period) ?? kandydaci[0] ?? null;
}

/** Które ulotki (formy płatności) istnieją dla tego zestawu i okresu. */
export function availableFlyersForCombination(
  variants: VariantCode[],
  period: PeriodKey,
): FlyerTemplate[] {
  const key = combinationKey(variants);
  return FLYER_TEMPLATES.filter(
    (t) => pasujeOkresem(t, period) && combinationKey(t.variants) === key,
  );
}

/** "01-09-2026 - 31-08-2028" (policy storage) -> "1Y" | "2Y". */
export function periodKeyFromInsurancePeriod(p: string): PeriodKey {
  const years = [...p.matchAll(/20(\d{2})/g)].map((m) => Number(m[1]));
  return years.length >= 2 && years[years.length - 1] - years[0] >= 2 ? "2Y" : "1Y";
}

/** "01-09-2026 - 31-08-2028" -> flyer display "1.09.2026 - 31.08.2028". */
export function displayPeriod(p: string): string {
  return p.replace(/\b(\d{1,2})-(\d{2})-(\d{4})\b/g, (_, d, m, y) => `${Number(d)}.${m}.${y}`);
}

import type { VariantCode } from "@/lib/interrisk/variants";
import type { FlyerTemplate, PaymentType, PeriodKey } from "./flyer-types";

/**
 * Registry of the AVAILABLE ulotka templates — only these premade combinations
 * work. A flyer = payment type (cash/wire) × period (1 rok / 2 lata) × an exact
 * variant combination. Files + field maps live in templates/flyers/ and are
 * produced by `npm run build-flyer-fields`.
 *
 * TODO: add new entries here (and in scripts/extract-flyer-fields.mjs MAP) as
 * more flyer PDFs are delivered.
 */
function tpl(
  key: string,
  label: string,
  payment: PaymentType,
  period: PeriodKey,
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
];

/** Canonical order-independent key for a set of variants. */
export function combinationKey(variants: VariantCode[]): string {
  return [...new Set(variants)].sort().join("+");
}

/** The flyer for an exact combination + payment + period, or null. */
export function selectFlyerTemplate(
  variants: VariantCode[],
  payment: PaymentType,
  period: PeriodKey,
): FlyerTemplate | null {
  const key = combinationKey(variants);
  return (
    FLYER_TEMPLATES.find(
      (t) => t.payment === payment && t.period === period && combinationKey(t.variants) === key,
    ) ?? null
  );
}

/** Which flyers (payment options) exist for this combination + period. */
export function availableFlyersForCombination(
  variants: VariantCode[],
  period: PeriodKey,
): FlyerTemplate[] {
  const key = combinationKey(variants);
  return FLYER_TEMPLATES.filter(
    (t) => t.period === period && combinationKey(t.variants) === key,
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

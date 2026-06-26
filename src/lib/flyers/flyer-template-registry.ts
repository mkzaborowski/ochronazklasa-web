import type { VariantCode } from "@/lib/interrisk/variants";
import type { FlyerTemplate, PaymentType } from "./flyer-types";

/**
 * Registry of the AVAILABLE ulotka templates. Only these premade combinations
 * work — the system tells the user whether their policy combination matches one.
 *
 * Derived from the delivered sample PDFs (see scripts/extract-flyer-fields.mjs).
 * Each flyer = a payment type (cash/wire) × an exact variant combination.
 *
 * TODO: add more combinations here as new flyer PDFs are delivered. Each needs
 * `<key>.pdf` + `<key>.fields.json` in templates/flyers/.
 */
function tpl(
  key: string,
  label: string,
  payment: PaymentType,
  variants: VariantCode[],
): FlyerTemplate {
  return {
    key,
    label,
    payment,
    variants,
    templatePath: `templates/flyers/${key}.pdf`,
    fieldsPath: `templates/flyers/${key}.fields.json`,
  };
}

const V50_FULL: VariantCode[] = ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"];
const V50_65_195: VariantCode[] = ["65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"];

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  tpl("v50-full-cash", "OCHRONA 50/65/90/140/195 — gotówka", "cash", V50_FULL),
  tpl("v50-full-wire", "OCHRONA 50/65/90/140/195 — przelew", "wire", V50_FULL),
  tpl("v50-65to195-wire", "OCHRONA 65/90/140/195 — przelew", "wire", V50_65_195),
  tpl("v50-50-cash", "OCHRONA 50 — gotówka", "cash", ["50PLNV50"]),
];

/** Canonical order-independent key for a set of variants. */
export function combinationKey(variants: VariantCode[]): string {
  return [...new Set(variants)].sort().join("+");
}

/** The flyer for an exact variant combination + payment type, or null. */
export function selectFlyerTemplate(
  variants: VariantCode[],
  payment: PaymentType,
): FlyerTemplate | null {
  const key = combinationKey(variants);
  return (
    FLYER_TEMPLATES.find((t) => t.payment === payment && combinationKey(t.variants) === key) ?? null
  );
}

/** Which payment variants have a matching flyer for this combination. */
export function availableFlyersForCombination(variants: VariantCode[]): FlyerTemplate[] {
  const key = combinationKey(variants);
  return FLYER_TEMPLATES.filter((t) => combinationKey(t.variants) === key);
}

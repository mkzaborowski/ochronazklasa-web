/**
 * InterRisk policy variants. Each variant maps to its own DOCX template that
 * already contains the correct pricing, sums insured, benefits and terms — the
 * app only injects the dynamic fields and never recalculates those values.
 *
 * Template files live under `templates/policies/<CODE>.docx` (repo root).
 */

export type VariantCode =
  | "120PLNV40"
  | "50PLNV40"
  | "80PLNV40"
  | "165PLN"
  | "65PLNV40"
  | "90PLNV50"
  | "85PLNV50"
  | "50PLNV50"
  | "65PLNV50"
  | "125PLNV50"
  | "140PLNV50"
  | "170PLNV50"
  | "195PLNV50";

export type PolicyVariant = {
  code: VariantCode;
  label: string;
  templatePath: string; // relative to repo root
  /**
   * Roczna składka w złotych. Trzymana jawnie, a nie wyciągana z kodu wariantu
   * wyrażeniem regularnym: kod jest identyfikatorem pliku i może kiedyś
   * przestać zaczynać się od liczby, a od tej wartości zależy KOLEJNOŚĆ
   * numerów polis — czyli coś, czego nie wolno oprzeć na zgadywaniu.
   */
  skladka: number;
};

function v(code: VariantCode, label: string, skladka: number): PolicyVariant {
  return { code, label, skladka, templatePath: `templates/policies/${code}.docx` };
}

/**
 * Warianty uporządkowane od najniższej składki do najwyższej.
 *
 * To jest kolejność, w jakiej wystawiają się polisy i w jakiej idą kolejne
 * numery kont i polis. Wymóg InterRisk: numery mają rosnąć razem ze składką,
 * bo tak są potem czytane i uzgadniane. Przy remisie decyduje kod wariantu,
 * żeby przy dwóch polisach po 50 zł kolejność była zawsze ta sama, a nie
 * zależna od tego, w którą kratkę operator kliknął pierwszy.
 */
export function wgSkladki(kody: VariantCode[]): VariantCode[] {
  return [...kody].sort((a, b) => {
    const roznica = POLICY_VARIANTS[a].skladka - POLICY_VARIANTS[b].skladka;
    return roznica !== 0 ? roznica : a.localeCompare(b, "pl");
  });
}

export const POLICY_VARIANTS: Record<VariantCode, PolicyVariant> = {
  "120PLNV40": v("120PLNV40", "120 PLN V40", 120),
  "50PLNV40": v("50PLNV40", "50 PLN V40", 50),
  "80PLNV40": v("80PLNV40", "80 PLN V40", 80),
  "165PLN": v("165PLN", "165 PLN", 165),
  "65PLNV40": v("65PLNV40", "65 PLN V40", 65),
  "90PLNV50": v("90PLNV50", "90 PLN V50", 90),
  "85PLNV50": v("85PLNV50", "85 PLN V50", 85),
  "50PLNV50": v("50PLNV50", "50 PLN V50", 50),
  "65PLNV50": v("65PLNV50", "65 PLN V50", 65),
  "125PLNV50": v("125PLNV50", "125 PLN V50", 125),
  "140PLNV50": v("140PLNV50", "140 PLN V50", 140),
  "170PLNV50": v("170PLNV50", "170 PLN V50", 170),
  "195PLNV50": v("195PLNV50", "195 PLN V50", 195),
};

export const VARIANT_LIST: PolicyVariant[] = Object.values(POLICY_VARIANTS);

export const VARIANT_CODES = Object.keys(POLICY_VARIANTS) as VariantCode[];

export function isVariantCode(value: string): value is VariantCode {
  return value in POLICY_VARIANTS;
}

/** Selectable insurance periods (the period text is inserted verbatim). */
export const INSURANCE_PERIODS = [
  { id: "1Y", label: "Polisa roczna", value: "01-09-2026 - 31-08-2027" },
  { id: "2Y", label: "Polisa dwuletnia", value: "01-09-2026 - 31-08-2028" },
] as const;

export const INSURANCE_PERIOD_VALUES = INSURANCE_PERIODS.map((p) => p.value);

/** Policy number = last 6 digits of the assigned bank account number. */
export function policyNumberFromAccount(accountNumber: string): string {
  return accountNumber.replace(/\D/g, "").slice(-6);
}

import type { VariantCode } from "@/lib/interrisk/variants";

export type PaymentType = "cash" | "wire";

/** Okres polisy szkoły — zawsze konkretny. */
export type PeriodKey = "1Y" | "2Y";

/**
 * Okres, który obsługuje ULOTKA. Poza "1Y" i "2Y" jest "ANY": część ulotek
 * drukuje świadczenie za 1% w dwóch wierszach — osobno dla umowy rocznej
 * i dwuletniej — więc jedna sztuka obsługuje oba okresy. Rozdzielone od
 * PeriodKey celowo: pytanie „na ile lat jest polisa" ma zawsze odpowiedź
 * 1 albo 2, a „ANY" jest cechą wydruku, nie umowy.
 */
export type FlyerPeriod = PeriodKey | "ANY";
export type FlyerTemplateKey = string;

export type FlyerFieldRole =
  | "policy"
  | "account"
  | "school"
  | "period"
  | "deadline"
  | "opiekunName"
  | "opiekunPhone"
  | "opiekunEmail";

/** One entry of the offline-computed AcroForm field→role map. */
export type FlyerFieldDef = {
  name: string;
  role: FlyerFieldRole;
  idx?: number; // row index for policy/account (top→bottom = variants order)
  prefixAA?: boolean; // policy: whether to write the "A-A " prefix
};

/** Parsed `<key>.fields.json` (v2) produced by scripts/extract-flyer-fields. */
export type FlyerFields = {
  payment: PaymentType;
  period: FlyerPeriod;
  variants: VariantCode[];
  fields: FlyerFieldDef[];
};

export type FlyerTemplate = {
  key: FlyerTemplateKey;
  label: string;
  payment: PaymentType;
  period: FlyerPeriod;
  variants: VariantCode[]; // the exact combination this flyer covers
  templatePath: string;
  fieldsPath: string;
};

export type FlyerRow = {
  variantCode: VariantCode;
  policyNumber: string;
  accountNumber?: string;
};

export type FlyerOpiekun = { name: string; phone: string; email: string };

export type FlyerContext = {
  templateKey: FlyerTemplateKey;
  payment: PaymentType;
  rows: FlyerRow[];
  opiekun: FlyerOpiekun;
  schoolName?: string;
  /** Display form printed on the flyer, e.g. "1.09.2026 - 31.08.2028". */
  insurancePeriod?: string;
};

export type GeneratedDocument = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

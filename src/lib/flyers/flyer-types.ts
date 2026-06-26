import type { VariantCode } from "@/lib/interrisk/variants";

export type PaymentType = "cash" | "wire";
export type FlyerTemplateKey = string;

/** A field's box on the template page (pdf-lib coords, origin bottom-left). */
export type FieldBox = { x: number; y: number; w: number; h: number; size: number };

/** Parsed `<key>.fields.json` produced by scripts/extract-flyer-fields. */
export type FlyerFields = {
  payment: PaymentType;
  variants: VariantCode[]; // row order on the flyer (top → bottom)
  pageW: number;
  pageH: number;
  policyNumbers: FieldBox[];
  accounts: FieldBox[]; // wire only
  opiekunName: FieldBox | null;
  opiekunPhone: FieldBox | null;
  opiekunEmail: FieldBox | null;
};

export type FlyerTemplate = {
  key: FlyerTemplateKey;
  label: string;
  payment: PaymentType;
  variants: VariantCode[]; // the exact combination this flyer covers
  templatePath: string; // templates/flyers/<key>.pdf
  fieldsPath: string; // templates/flyers/<key>.fields.json
};

/** One printed row on the flyer: a variant + its (editable) policy number + account. */
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
};

export type GeneratedDocument = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

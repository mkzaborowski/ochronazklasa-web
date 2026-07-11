import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, type PDFTextField } from "pdf-lib";
import type { FlyerContext, GeneratedDocument, FlyerFields } from "./flyer-types";
import { FLYER_TEMPLATES } from "./flyer-template-registry";

/** The agency's general service line (first number on every flyer). */
export const SERVICE_LINE = "533 533 931";

/**
 * The flyer forms use standard PDF fonts (WinAnsi); Polish letters are folded
 * to ASCII on written values. The template's own Polish fields are untouched
 * (no flatten; appearances regenerated only for fields we set).
 * TODO: embed a Unicode font (fontkit) to preserve diacritics in names.
 */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : p;
}

/**
 * Generate a flyer ("ulotka") by filling the template's AcroForm fields using
 * the offline field→role map from `<key>.fields.json` (see
 * scripts/extract-flyer-fields.mjs). Opiekun = the assigned agent; the general
 * service line stays first in the phone field.
 */
export async function generateFlyerPdf(ctx: FlyerContext): Promise<GeneratedDocument> {
  const tplDef = FLYER_TEMPLATES.find((t) => t.key === ctx.templateKey);
  if (!tplDef) throw new Error("Nieznany szablon ulotki.");

  const [pdfBytes, fieldsRaw] = await Promise.all([
    readFile(path.join(process.cwd(), tplDef.templatePath)),
    readFile(path.join(process.cwd(), tplDef.fieldsPath), "utf8"),
  ]);
  const spec: FlyerFields = JSON.parse(fieldsRaw);

  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);

  const setText = (name: string, text: string) => {
    let f: PDFTextField;
    try {
      f = form.getTextField(name);
    } catch {
      return; // field vanished from the template — skip rather than fail
    }
    f.setText(fold(text));
    try {
      f.updateAppearances(helv);
    } catch {
      /* keep default appearance */
    }
  };

  for (const def of spec.fields) {
    switch (def.role) {
      case "policy": {
        const variant = spec.variants[def.idx ?? 0];
        const row = ctx.rows.find((r) => r.variantCode === variant);
        if (row) setText(def.name, `${def.prefixAA === false ? "" : "A-A "}${row.policyNumber}`);
        break;
      }
      case "account": {
        const variant = spec.variants[def.idx ?? 0];
        const row = ctx.rows.find((r) => r.variantCode === variant);
        if (row?.accountNumber) setText(def.name, row.accountNumber);
        break;
      }
      case "school":
        if (ctx.schoolName) setText(def.name, ctx.schoolName.toUpperCase());
        break;
      case "period":
        if (ctx.insurancePeriod) setText(def.name, ctx.insurancePeriod);
        break;
      case "opiekunName":
        setText(def.name, ctx.opiekun.name.toUpperCase());
        break;
      case "opiekunPhone":
        setText(def.name, `${SERVICE_LINE} | ${formatPhone(ctx.opiekun.phone)}`);
        break;
      case "opiekunEmail":
        setText(def.name, ctx.opiekun.email);
        break;
      case "deadline":
        break; // left as authored in the template
    }
  }

  const out = await pdf.save({ updateFieldAppearances: false });
  return {
    fileName: `ulotka_${ctx.templateKey}.pdf`,
    mimeType: "application/pdf",
    bytes: Buffer.from(out),
  };
}

export {
  selectFlyerTemplate,
  availableFlyersForCombination,
  periodKeyFromInsurancePeriod,
  displayPeriod,
} from "./flyer-template-registry";

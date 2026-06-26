import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, type PDFTextField } from "pdf-lib";
import type { FlyerContext, GeneratedDocument, FlyerFields } from "./flyer-types";
import { FLYER_TEMPLATES } from "./flyer-template-registry";

/** The agency's general service line (first number on every flyer). */
export const SERVICE_LINE = "533 533 931";

const SCHOOL_KW = /SZKO|PODSTAWOW|LICEUM|PRZEDSZKOL|ZESP|TECHNIKUM|BRAN|GIMN|OSRODEK|OŚRODEK|\bNR\b/i;

function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : p;
}

/**
 * The flyer form uses standard PDF fonts (WinAnsi). To avoid encode crashes we
 * fold Polish letters to ASCII on the values we write. We never flatten and we
 * save with updateFieldAppearances:false, so the template's own Polish fields
 * (e.g. "zł" labels) keep their original appearance untouched.
 * TODO: embed a Unicode font (fontkit) to preserve diacritics in names.
 */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

type Item = { f: PDFTextField; y: number; v: string };

/**
 * Generate a flyer by FILLING the template's AcroForm fields (the dynamic data
 * lives in text fields) and flattening. Fields are classified by their example
 * value and ordered by Y, so the generic field names (Text1…) don't matter.
 *
 *  - "A-A NNNNNN"  -> policy number (one per variant, top→bottom)
 *  - "NN NNNN …"   -> bank account (wire only)
 *  - "… | …"       -> phones: keep the service line, replace the agent's number
 *  - "…@…"         -> opiekun email
 *  - school keyword-> school name; remaining ALL-CAPS name -> opiekun name
 */
export async function generateFlyerPdf(ctx: FlyerContext): Promise<GeneratedDocument> {
  const tplDef = FLYER_TEMPLATES.find((t) => t.key === ctx.templateKey);
  if (!tplDef) throw new Error("Nieznany szablon ulotki.");

  const [pdfBytes, fieldsRaw] = await Promise.all([
    readFile(path.join(process.cwd(), tplDef.templatePath)),
    readFile(path.join(process.cwd(), tplDef.fieldsPath), "utf8"),
  ]);
  const fields: FlyerFields = JSON.parse(fieldsRaw);

  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  // Set a field's value AND regenerate just its appearance (ASCII-safe), so we
  // never touch the template's own Polish fields.
  const setText = (f: PDFTextField, text: string) => {
    f.setText(fold(text));
    try {
      f.updateAppearances(helv);
    } catch {
      /* leave default */
    }
  };

  const items: Item[] = [];
  for (const f of form.getFields()) {
    if (f.constructor.name !== "PDFTextField") continue;
    const tf = f as PDFTextField;
    let y = 0;
    try {
      y = tf.acroField.getWidgets()[0].getRectangle().y;
    } catch {
      /* no widget */
    }
    items.push({ f: tf, y, v: (tf.getText() ?? "").trim() });
  }

  const policy: Item[] = [];
  const account: Item[] = [];
  const names: Item[] = [];
  let email: Item | undefined;
  let phone: Item | undefined;
  let school: Item | undefined;

  for (const it of items) {
    const v = it.v;
    if (/^A-?A[\s ]*\d{3,}/.test(v)) policy.push(it);
    else if (/^\d{2}[\s ]\d{4}[\s ]\d{4}/.test(v)) account.push(it);
    else if (v.includes("@")) email = it;
    else if (v.includes("|") || /\d{3}\s+\d{3}\s+\d{3}/.test(v)) phone = it;
    else if (SCHOOL_KW.test(v)) school = it;
    else if (/^\s*\d+\s*(z[łl]|PLN)/i.test(v)) continue; // price label (static)
    else if (/\d{1,2}[.\-]\d{1,2}[.\-]\d{4}/.test(v)) continue; // date/period
    else if (/[A-ZŁ]/.test(v) && !/\d/.test(v)) names.push(it); // candidate opiekun name
  }

  policy.sort((a, b) => b.y - a.y); // top → bottom
  account.sort((a, b) => b.y - a.y);

  fields.variants.forEach((variant, i) => {
    const row = ctx.rows.find((r) => r.variantCode === variant);
    if (!row) return;
    if (policy[i]) setText(policy[i].f, `A-A ${row.policyNumber}`);
    if (ctx.payment === "wire" && account[i] && row.accountNumber) {
      setText(account[i].f, row.accountNumber);
    }
  });

  if (school && ctx.schoolName) setText(school.f, ctx.schoolName.toUpperCase());
  const nameField = names.sort((a, b) => a.y - b.y)[0]; // bottom-most = opiekun
  if (nameField) setText(nameField.f, ctx.opiekun.name.toUpperCase());
  if (phone) setText(phone.f, `${SERVICE_LINE} | ${formatPhone(ctx.opiekun.phone)}`);
  if (email) setText(email.f, ctx.opiekun.email);

  // Do NOT flatten / regenerate all appearances — that would choke on the
  // template's own Polish fields. Keep only the fields we set.
  const out = await pdf.save({ updateFieldAppearances: false });
  return {
    fileName: `ulotka_${ctx.templateKey}.pdf`,
    mimeType: "application/pdf",
    bytes: Buffer.from(out),
  };
}

export { selectFlyerTemplate, availableFlyersForCombination } from "./flyer-template-registry";

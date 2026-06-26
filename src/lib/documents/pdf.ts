import { PDFDocument } from "pdf-lib";

/**
 * PDF editing for the policy-issuance flow.
 *
 * Two common shapes for insurer documents:
 *  - AcroForm PDFs with named fields  -> fillPdfForm()
 *  - Flat PDFs we overlay text onto    -> (add an overlay helper when needed)
 *
 * pdf-lib runs in pure JS (no native deps), so it works on the server and in
 * serverless without a headless browser.
 */

export type PdfFieldValues = Record<string, string | boolean>;

/** Fill a fillable (AcroForm) PDF template and return the new PDF bytes. */
export async function fillPdfForm(
  templateBytes: Buffer | Uint8Array,
  values: PdfFieldValues,
  options: { flatten?: boolean } = {},
): Promise<Buffer> {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe?.(name) ?? tryGetField(form, name);
    if (!field) continue;

    if (typeof value === "boolean") {
      const checkbox = form.getCheckBox(name);
      value ? checkbox.check() : checkbox.uncheck();
    } else {
      form.getTextField(name).setText(value);
    }
  }

  // Flatten so the values are baked in and no longer editable.
  if (options.flatten ?? true) form.flatten();

  const out = await pdf.save();
  return Buffer.from(out);
}

/** List a template's form field names — useful when mapping a new insurer PDF. */
export async function listPdfFields(templateBytes: Buffer | Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(templateBytes);
  return pdf.getForm().getFields().map((f) => f.getName());
}

function tryGetField(form: ReturnType<PDFDocument["getForm"]>, name: string) {
  try {
    return form.getField(name);
  } catch {
    return undefined;
  }
}

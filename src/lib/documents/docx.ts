import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX templating for the policy-issuance flow.
 *
 * Author a .docx template with `{{placeholder}}` tags (double braces, matching
 * the InterRisk templates); this fills them and returns the new file, leaving
 * all other content, tables and formatting untouched. Missing values render as
 * an empty string rather than throwing.
 */

export type DocxData = Record<string, unknown>;

export function renderDocx(templateBytes: Buffer | Uint8Array, data: DocxData): Buffer {
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(data);

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

// Generates minimal PLACEHOLDER .docx templates (one per variant) so the
// issuance flow is testable end-to-end. REPLACE these with the real InterRisk
// templates — keep the same {{...}} placeholders so generation keeps working.
//
// Usage: node scripts/generate-sample-templates.mjs

import PizZip from "pizzip";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const VARIANTS = {
  "120PLNV40": "120 PLN V40",
  "50PLNV40": "50 PLN V40",
  "80PLNV40": "80 PLN V40",
  "165PLN": "165 PLN",
  "65PLNV40": "65 PLN V40",
  "90PLNV50": "90 PLN V50",
  "85PLNV50": "85 PLN V50",
  "50PLNV50": "50 PLN V50",
  "65PLNV50": "65 PLN V50",
  "125PLNV50": "125 PLN V50",
  "140PLNV50": "140 PLN V50",
  "170PLNV50": "170 PLN V50",
  "195PLNV50": "195 PLN V50",
};

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (text, bold = false) =>
  `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

function documentXml(label) {
  const body = [
    para(`POLISA INTERRISK — ${label}`, true),
    para("Wniosek/Polisa A-A {{numer_polisy}}", true),
    para(""),
    para("UBEZPIECZAJĄCY", true),
    para("Nazwa: {{ubezpieczajacy_nazwa}}"),
    para("Adres: {{ubezpieczajacy_adres}}"),
    para("REGON/PESEL: {{ubezpieczajacy_regon_pesel}}"),
    para("Telefon: {{ubezpieczajacy_telefon}}"),
    para("Mail: {{ubezpieczajacy_email}}"),
    para(""),
    para("UBEZPIECZAJĄCY - KONTAKT", true),
    para("Nazwa: {{kontakt_nazwa}}"),
    para("Telefon: {{kontakt_telefon}}"),
    para("Mail: {{kontakt_email}}"),
    para(""),
    para("OKRES UBEZPIECZENIA", true),
    para("{{okres_ubezpieczenia}}"),
    para(""),
    para("Numer konta bankowego: {{numer_konta_bankowego}}"),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body>
</w:document>`;
}

const outDir = path.join(process.cwd(), "templates", "policies");
await mkdir(outDir, { recursive: true });

for (const [code, label] of Object.entries(VARIANTS)) {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("word/document.xml", documentXml(label));
  const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  await writeFile(path.join(outDir, `${code}.docx`), buf);
  console.log(`✓ ${code}.docx`);
}
console.log(`\nWrote ${Object.keys(VARIANTS).length} sample templates to ${outDir}`);

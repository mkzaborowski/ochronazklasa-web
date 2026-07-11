// Convert the real InterRisk DOCX templates into placeholder templates.
// Handles three template styles seen in the real files:
//   - filled (example data)  -> replace the value
//   - blank (empty fields)   -> insert the placeholder after the label
//   - hybrid (filled person, blank policy/account)
// Only the dynamic fields are touched; all other content is preserved.
//
// Usage: node scripts/build-real-templates.mjs [sourceDir]

import PizZip from "pizzip";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SRC = process.argv[2] || path.join(os.homedir(), "Downloads", "files");
const OUT = path.join(process.cwd(), "templates", "policies");

const MAP = {
  "120PLNV40": "40_OCHRONA_120_ZŁ_SZABLON_POLISY.docx",
  "50PLNV40": "40_OCHRONA_50_ZŁ_SZABLON_POLISY.docx",
  "80PLNV40": "40_OCHRONA_80_ZŁ_SZABLON_POLISY.docx",
  "165PLN": "40_OCHRONA_165_ZŁ_SZABLON_POLISY.docx",
  "65PLNV40": "40_OCHRONA_65_ZŁ_SZABLON_POLISY.docx",
  "90PLNV50": "90_ZŁ_50_EXOCHRONA_SZABLON_POLISY.docx",
  "85PLNV50": "85_ZŁ_50_OCHRONA_SZABLON_POLISY.docx",
  "50PLNV50": "50_ZŁ_50_OCHRONA_SZABLON_POLISY.docx",
  "65PLNV50": "65_ZŁ_50_OCHRONA_SZABLON_POLISY.docx",
  "125PLNV50": "125_ZŁ_50_OCHRONA_SZABLON_POLISY.docx",
  "140PLNV50": "140_ZŁ_50_EXOCHRONA_SZABLON_POLISY.docx",
  "170PLNV50": "170_ZŁ_50_OCHRONA_SZABLON_POLISY.docx",
  "195PLNV50": "195_ZŁ_50_EXOCHRONA_SZABLON_POLISY.docx",
};

const FIELD = {
  insured: {
    NAZWA: "ubezpieczajacy_nazwa",
    ADRES: "ubezpieczajacy_adres",
    REGON: "ubezpieczajacy_regon_pesel",
    TELEFON: "ubezpieczajacy_telefon",
    MAIL: "ubezpieczajacy_email",
  },
  kontakt: {
    NAZWA: "kontakt_nazwa",
    KNAME: "kontakt_nazwa",
    TELEFON: "kontakt_telefon",
    MAIL: "kontakt_email",
  },
};

const LABEL_RE =
  /^(REGON\s*\/?\s*PESEL|REGON|Nazwa|Adres|Telefon|E-?mail|Mail|Imię i nazwisko|Imię)\b\s*:?\s*([\s\S]*)$/u;

function labelKey(lbl) {
  if (/^REGON/.test(lbl)) return "REGON";
  if (/mail/i.test(lbl)) return "MAIL";
  if (/^Imię/.test(lbl)) return "KNAME";
  if (/^Nazwa/.test(lbl)) return "NAZWA";
  if (/^Adres/.test(lbl)) return "ADRES";
  if (/^Telefon/.test(lbl)) return "TELEFON";
  return null;
}

const PLACEHOLDERS = [
  "ubezpieczajacy_nazwa", "ubezpieczajacy_adres", "ubezpieczajacy_regon_pesel",
  "ubezpieczajacy_telefon", "ubezpieczajacy_email", "kontakt_nazwa",
  "kontakt_telefon", "kontakt_email", "okres_ubezpieczenia", "numer_polisy",
  "numer_konta_bankowego", "data_wystawienia",
];

function convert(xml) {
  const notes = [];

  // Period (global; the date-range is a single text node)
  const periodRe = /01-09-20\d{2}\s*[-–—]\s*31-08-20\d{2}/g;
  if (periodRe.test(xml)) xml = xml.replace(periodRe, "{{okres_ubezpieczenia}}");
  else notes.push("brak okresu");

  // Tokenize <w:t> nodes (not <w:tab> etc.)
  const tokenRe = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const T = [];
  let m;
  while ((m = tokenRe.exec(xml))) {
    T.push({ attrs: m[1] || "", inner: m[2], start: m.index, end: m.index + m[0].length });
  }
  const txt = (i) => T[i].inner.replace(/ /g, " ").trim();
  const edits = new Map();

  const isHeader = (s) => /UBEZPIECZAJ|KONTAKT|OKRES|ZAKRES|OSOBA DO/.test(s);
  const isLabel = (s) => LABEL_RE.test(s);
  const isDots = (s) => /^[.…·…\s]{3,}$/.test(s);
  const nextMeaningful = (i) => {
    for (let j = i + 1; j < T.length; j++) {
      const s = txt(j);
      if (s === "" || s === ":") continue;
      return j;
    }
    return -1;
  };
  const colonTarget = (i) => {
    if (/:\s*$/.test(T[i].inner)) return i;
    for (let j = i + 1; j < T.length; j++) {
      const s = txt(j);
      if (s === "") continue;
      if (s === ":") return j;
      break;
    }
    return i;
  };
  const setEnd = (i, suffix) => edits.set(i, T[i].inner.replace(/\s*$/, "") + suffix);

  let section = null;
  let policyDone = false;
  let accountDone = false;

  for (let i = 0; i < T.length; i++) {
    const s = txt(i);

    if (/KONTAKT/.test(s)) { section = "kontakt"; continue; }
    if (/UBEZPIECZAJĄCY/.test(s)) { section = "insured"; continue; }
    if (/OKRES|ZAKRES/.test(s)) { section = null; }

    // Issue date (signature block, e.g. "16.06.2026") -> placeholder
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      edits.set(i, "{{data_wystawienia}}");
      continue;
    }

    // Policy number
    if (!policyDone) {
      const inline = s.match(/A-?A\s+(\d{4,})/);
      if (inline) { edits.set(i, T[i].inner.replace(inline[1], "{{numer_polisy}}")); policyDone = true; continue; }
      if (/A-?A\s*$/.test(s)) {
        const nj = nextMeaningful(i);
        if (nj >= 0 && /^\d{4,}$/.test(txt(nj))) { edits.set(nj, "{{numer_polisy}}"); policyDone = true; continue; }
        // static "A-A" with an EMPTY slot after it (blank forms): put the
        // number inside the A-A token itself — never duplicate the "A-A".
        edits.set(i, T[i].inner.replace(/A-?A\s*$/, "A-A {{numer_polisy}}"));
        policyDone = true;
        continue;
      }
      if (/Wniosek\/Polisa|Polisa\b/.test(s) && !/A-?A/.test(s)) {
        const nj = nextMeaningful(i);
        if (nj >= 0 && isDots(txt(nj))) { edits.set(nj, "A-A {{numer_polisy}}"); policyDone = true; continue; }
      }
    }

    // Bank account: after the "Vienna Insurance Group" line
    if (!accountDone && /Vienna Insurance Group/.test(s)) {
      const nj = nextMeaningful(i);
      if (nj >= 0) {
        const ns = txt(nj);
        if (/^[\d ]+$/.test(ns) && (ns.replace(/\D/g, "").length >= 16)) {
          edits.set(nj, "{{numer_konta_bankowego}}"); accountDone = true; continue;
        }
        if (isDots(ns)) { edits.set(nj, "{{numer_konta_bankowego}}"); accountDone = true; continue; }
      }
    }

    // Labelled person fields
    if (section === "insured" || section === "kontakt") {
      const lm = s.match(LABEL_RE);
      if (lm) {
        const key = labelKey(lm[1]);
        const field = key && FIELD[section][key];
        if (field) {
          const rest = (lm[2] || "").replace(/ /g, " ").trim();
          if (rest && rest !== ":") {
            edits.set(i, `${lm[1]}: {{${field}}}`);
          } else {
            const nj = nextMeaningful(i);
            if (nj >= 0 && !isLabel(txt(nj)) && !isHeader(txt(nj)) && !isDots(txt(nj))) {
              edits.set(nj, `{{${field}}}`);
            } else {
              setEnd(colonTarget(i), ` {{${field}}}`);
            }
          }
        }
      }
    }
  }

  // Which placeholders did we already place?
  const present = new Set();
  for (const v of edits.values()) for (const mm of v.matchAll(/\{\{(\w+)\}\}/g)) present.add(mm[1]);

  // Contact "OSOBA DO KONTAKTU" style: split "Imię i nazwisko" / "E-mail" labels.
  if (!present.has("kontakt_nazwa")) {
    const i = T.findIndex((_, k) => /nazwisko/i.test(txt(k)));
    if (i >= 0) { setEnd(colonTarget(i), " {{kontakt_nazwa}}"); present.add("kontakt_nazwa"); }
  }
  if (!present.has("kontakt_email")) {
    const h = T.findIndex((_, k) => /OSOBA DO|KONTAKTU/.test(txt(k)));
    let i = -1;
    for (let k = h >= 0 ? h : 0; k < T.length; k++) { if (/mail/i.test(txt(k))) { i = k; break; } }
    if (i >= 0) { setEnd(colonTarget(i), " {{kontakt_email}}"); present.add("kontakt_email"); }
  }

  // Issue-date fallback (blank forms): no example date — append after "OLSZTYN,"
  // in the signature line ("Miejscowość, data").
  const dateDone = [...edits.values()].some((v) => v.includes("{{data_wystawienia}}"));
  if (!dateDone) {
    const oj = T.findIndex((_, i) => /^OLSZTYN,?$/.test(txt(i)));
    if (oj >= 0) setEnd(oj, " {{data_wystawienia}}");
    else notes.push("brak daty wystawienia");
  }

  // Fallback: guarantee the policy-number placeholder exists somewhere sensible
  if (!policyDone) {
    const pj = T.findIndex((_, i) => /Polisa\b/.test(txt(i)));
    if (pj >= 0) { setEnd(pj, " A-A {{numer_polisy}}"); policyDone = true; }
  }
  if (!policyDone) notes.push("brak nr polisy");

  // Apply edits back-to-front
  const idxs = [...edits.keys()].sort((a, b) => b - a);
  for (const k of idxs) {
    xml = xml.slice(0, T[k].start) + `<w:t${T[k].attrs}>${edits.get(k)}</w:t>` + xml.slice(T[k].end);
  }

  // Account fallback (blank forms): the account belongs in the EMPTY table cell
  // right after the "Nr konta bankowego …" label cell — never glued to the label.
  if (!accountDone) {
    const li = xml.indexOf("Nr konta bankowego");
    if (li >= 0) {
      const labelCellEnd = xml.indexOf("</w:tc>", li);
      const m = labelCellEnd >= 0 ? /<w:tc[ >]/.exec(xml.slice(labelCellEnd)) : null;
      if (m) {
        const tcStart = labelCellEnd + m.index;
        const cellEnd = xml.indexOf("</w:tc>", tcStart);
        let cell = xml.slice(tcStart, cellEnd);
        const run =
          `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>` +
          `<w:t>{{numer_konta_bankowego}}</w:t></w:r>`;
        const pEnd = cell.lastIndexOf("</w:p>");
        if (pEnd >= 0) cell = cell.slice(0, pEnd) + run + cell.slice(pEnd);
        else cell = cell.replace(/<w:p([^>]*)\/>/, `<w:p$1>${run}</w:p>`);
        if (cell.includes("{{numer_konta_bankowego}}")) {
          xml = xml.slice(0, tcStart) + cell + xml.slice(cellEnd);
          accountDone = true;
        }
      }
    }
  }
  if (!accountDone) notes.push("brak nr konta");

  return { xml, notes };
}

await mkdir(OUT, { recursive: true });
for (const [code, fname] of Object.entries(MAP)) {
  const zip = new PizZip(await readFile(path.join(SRC, fname)));
  const { xml, notes } = convert(zip.file("word/document.xml").asText());
  zip.file("word/document.xml", xml);
  await writeFile(path.join(OUT, `${code}.docx`), zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

  const missing = PLACEHOLDERS.filter((p) => !xml.includes(`{{${p}}}`));
  const flag = missing.length ? `  ⚠ missing: ${missing.join(", ")}` : "  ✓ all 11";
  console.log(`${code.padEnd(11)} ${notes.length ? "(" + notes.join("; ") + ")" : ""}${flag}`);
}

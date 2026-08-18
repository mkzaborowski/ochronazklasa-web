#!/usr/bin/env node
/**
 * Pilnuje, żeby stopki polis liczyły strony polem NUMPAGES, a nie liczbą
 * wpisaną na sztywno.
 *
 * DLACZEGO TO ISTNIEJE. Szablony przychodzą od InterRisk i będą wymieniane.
 * W tych, które dostaliśmy, stopka miała prawdziwe pole PAGE (numer bieżącej
 * strony) i zaraz za nim ZWYKŁY TEKST z liczbą stron, wpisany, gdy dokument
 * miał ich cztery. Dokument urósł do ośmiu i szkoły dostawały polisy ze
 * stopką „5/4". Błąd przeżył kilka miesięcy i zgłoszenie od agentki, bo nic
 * go nie wyłapywało — plik wygląda poprawnie, dopóki ktoś nie policzy stron.
 *
 * Przy każdej podmianie szablonu ten sam błąd wróci, jeśli nikt nie sprawdzi.
 * Dlatego sprawdza to budowanie, a nie człowiek.
 *
 * Naprawa istniejących plików:  python3 scripts/napraw-numeracje-stron.py
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const KATALOG = path.join(process.cwd(), "templates", "policies");
const CZESC_STOPKI = /^word\/(footer|header)\d*\.xml$/;
// „/4" w jednym przebiegu tekstu albo „/" i „4" w osobnych - oba kształty
// występowały w plikach od InterRisk.
const LITERAL_W_JEDNYM = /<w:t[^>]*>\s*\/\s*\d+\s*<\/w:t>/g;
const POLE = (nazwa) => new RegExp(`<w:instrText[^>]*>\\s*${nazwa}\\s*</w:instrText>`, "g");

const ile = (tekst, wzor) => (tekst.match(wzor) || []).length;

/** Tekst wszystkich przebiegów po zakończeniu pola PAGE - tam siedział literał. */
function literalPoPolu(xml) {
  let znalezione = 0;
  const czesci = xml.split(/<w:fldChar w:fldCharType="end"\/>/);
  for (let i = 1; i < czesci.length; i++) {
    // pierwsze 400 znaków po końcu pola: interesuje nas najbliższe sąsiedztwo
    const okolica = czesci[i].slice(0, 400);
    const przedNastepnymPolem = okolica.split("<w:fldChar")[0];
    const teksty = [...przedNastepnymPolem.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1]).join("");
    if (/^\s*\/\s*\d+\s*$/.test(teksty)) znalezione++;
  }
  return znalezione;
}

const pliki = readdirSync(KATALOG).filter((f) => f.endsWith(".docx") && !f.startsWith("~"));
if (pliki.length === 0) {
  console.error(`Brak szablonów w ${KATALOG}`);
  process.exit(1);
}

let zle = 0;
for (const plik of pliki.sort()) {
  const zip = new PizZip(readFileSync(path.join(KATALOG, plik)));
  let page = 0, numpages = 0, literaly = 0;
  for (const nazwa of Object.keys(zip.files)) {
    if (!CZESC_STOPKI.test(nazwa)) continue;
    const xml = zip.file(nazwa).asText();
    page += ile(xml, POLE("PAGE"));
    numpages += ile(xml, POLE("NUMPAGES"));
    literaly += ile(xml, LITERAL_W_JEDNYM) + literalPoPolu(xml);
  }
  const ok = literaly === 0 && (page === 0 || numpages >= page);
  if (!ok) zle++;
  const opis = literaly
    ? `liczba stron wpisana na sztywno w ${literaly} miejscach`
    : page > numpages
      ? `${page - numpages} numerów strony bez pola NUMPAGES`
      : "ok";
  console.log(`${ok ? "  " : "✗ "}${plik.padEnd(20)} PAGE:${String(page).padStart(2)} `
    + `NUMPAGES:${String(numpages).padStart(2)}  ${opis}`);
}

if (zle) {
  console.error(`\n${zle} z ${pliki.length} szablonów ma liczbę stron wpisaną na sztywno.`);
  console.error("Szkoły dostaną polisy ze stopką typu „5/4”.");
  console.error("Napraw:  python3 scripts/napraw-numeracje-stron.py");
  process.exit(1);
}
console.log(`\n${pliki.length} szablonów - numeracja stron liczona polem NUMPAGES.`);

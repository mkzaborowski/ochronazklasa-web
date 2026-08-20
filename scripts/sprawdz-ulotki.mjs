// Sprawdza KAŻDĄ zarejestrowaną ulotkę: generuje ją prawdziwym generatorem na
// danych testowych i czyta z powrotem wszystkie pola formularza.
//
// Po co, skoro mapy pól buduje osobny skrypt: ulotki przychodzą od dostawcy
// WYPEŁNIONE przykładem - nazwa cudzej szkoły, nazwisko cudzego opiekuna,
// cudze numery polis. Generator nadpisuje wyłącznie pola, którym nadano rolę,
// więc pole przeoczone przy budowie mapy wydrukuje cudze dane na ulotce każdej
// szkoły. Tak było na ulotce OCHRONA 65: dwa pola nazywały się "Text1",
// generator trafiał w to niewłaściwe i w nagłówku zostawała szkoła dostawcy.
//
// Uruchomienie: npm run check:ulotki

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const KATALOG = path.join(process.cwd(), "templates", "flyers");

/**
 * Kompiluje moduły ulotek do JS, żeby dało się je wywołać z node.
 *
 * Wynik ląduje POD node_modules, a nie w /tmp: skompilowany generator importuje
 * pdf-lib, a node szuka pakietów w katalogach nadrzędnych względem pliku.
 * Poza projektem nie ma ich gdzie znaleźć.
 */
function zbudujModuly() {
  const out = path.join(process.cwd(), "node_modules", ".cache", "ulotki");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  try {
    execFileSync(
      "npx",
      ["tsc", "src/lib/flyers/generate-flyer.ts", "src/lib/flyers/flyer-template-registry.ts",
        "src/lib/flyers/flyer-types.ts", "--outDir", out, "--module", "es2022", "--target", "es2022",
        "--moduleResolution", "node", "--skipLibCheck"],
      { stdio: "ignore" },
    );
  } catch {
    // tsc kończy się niezerowo, bo nie zna aliasu "@/..." - ale to import
    // WYŁĄCZNIE typów, który przy kompilacji znika, więc pliki i tak powstają.
    // Zamiast ufać kodowi wyjścia, sprawdzamy niżej, czy jest co uruchomić.
    // Prawdziwe błędy typów łapie `npm run build`.
  }
  const pliki = readdirSync(out).filter((x) => x.endsWith(".js"));
  if (pliki.length < 3) {
    throw new Error("Nie udało się skompilować modułów ulotek - uruchom `npx tsc --noEmit`, żeby zobaczyć błąd.");
  }
  for (const f of pliki) {
    const p = path.join(out, f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/from "(\.\/[a-z-]+)"/g, 'from "$1.js"'));
  }
  return out;
}

const modu = zbudujModuly();
const { generateFlyerPdf } = await import(path.join(modu, "generate-flyer.js"));
const { FLYER_TEMPLATES, selectFlyerTemplate, availableFlyersForCombination } =
  await import(path.join(modu, "flyer-template-registry.js"));

/** Wartości, z którymi ulotki przyszły od dostawcy. Etykiety składek i termin
 *  płatności zostają na wydruku celowo, więc ich nie liczymy. */
const SLADY = new Set();
for (const f of readdirSync(KATALOG).filter((x) => x.endsWith(".pdf"))) {
  const pdf = await PDFDocument.load(readFileSync(path.join(KATALOG, f)));
  for (const pole of pdf.getForm().getFields()) {
    const v = (pole.getText?.() ?? "").trim();
    if (v.length > 6 && !/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v) && !/^\d{2,3}\s*(zł|PLN)$/i.test(v)) {
      SLADY.add(v);
    }
  }
}

const SZKOLA = "SZKOLA PODSTAWOWA W TESTOWIE";
// okres celowo inny niż w dostarczonych plikach - inaczej nie da się odróżnić
// „podmieniono" od „zostało jak było"
const OKRES = "1.09.2030 - 31.08.2031";
const OPIEKUN = { name: "Testowy Opiekun", phone: "600100200", email: "test@ochronazklasa.pl" };

let bledy = 0;
const zle = (klucz, opis) => { console.log(`  BLAD  ${klucz}: ${opis}`); bledy++; };

for (const tpl of FLYER_TEMPLATES) {
  const spec = JSON.parse(readFileSync(path.join(process.cwd(), tpl.fieldsPath), "utf8"));
  if (spec.payment !== tpl.payment) zle(tpl.key, `mapa mówi ${spec.payment}, rejestr ${tpl.payment}`);
  if (spec.variants.length !== tpl.variants.length) {
    zle(tpl.key, `mapa ma ${spec.variants.length} wariantów, rejestr ${tpl.variants.length}`);
  }

  // numery różne dla każdego wariantu - po nich widać, czy wiersz nie pojechał
  const rows = spec.variants.map((v, i) => ({
    variantCode: v,
    policyNumber: `90000${i}`,
    accountNumber: `11 2222 3333 4444 5555 6666 ${String(i).padStart(4, "0")}`,
  }));

  const doc = await generateFlyerPdf({
    templateKey: tpl.key, payment: tpl.payment, rows,
    schoolName: SZKOLA, insurancePeriod: OKRES, opiekun: OPIEKUN,
  });
  const wynik = await PDFDocument.load(doc.bytes);
  const wart = new Map(
    wynik.getForm().getFields().map((f) => [f.getName(), (f.getText?.() ?? "").trim()]),
  );

  for (const def of spec.fields) {
    const v = wart.get(def.name) ?? "";
    if (def.role === "policy") {
      const ocz = `${def.prefixAA === false ? "" : "A-A "}90000${def.idx}`;
      if (v !== ocz) zle(tpl.key, `${def.name} (polisa #${def.idx}) = ${JSON.stringify(v)}, oczekiwano ${JSON.stringify(ocz)}`);
    } else if (def.role === "account") {
      if (!v.endsWith(String(def.idx).padStart(4, "0"))) zle(tpl.key, `${def.name} (konto #${def.idx}) = ${JSON.stringify(v)}`);
    } else if (def.role === "school" && !v.includes("TESTOWIE")) {
      zle(tpl.key, `nazwa szkoły nie podmieniona: ${JSON.stringify(v)}`);
    } else if (def.role === "period" && v !== OKRES) {
      zle(tpl.key, `okres nie podmieniony: ${JSON.stringify(v)}`);
    } else if (def.role === "opiekunName" && !v.toUpperCase().includes("TESTOWY")) {
      zle(tpl.key, `opiekun nie podmieniony: ${JSON.stringify(v)}`);
    } else if (def.role === "opiekunEmail" && v !== OPIEKUN.email) {
      zle(tpl.key, `e-mail opiekuna = ${JSON.stringify(v)}`);
    } else if (def.role === "opiekunPhone" && !v.includes("600 100 200")) {
      zle(tpl.key, `telefon opiekuna = ${JSON.stringify(v)}`);
    }
  }

  for (const [nazwa, v] of wart) {
    if (v && SLADY.has(v)) zle(tpl.key, `została wartość od dostawcy: ${nazwa}=${JSON.stringify(v)}`);
  }

  const pol = spec.fields.filter((f) => f.role === "policy").length;
  const acc = spec.fields.filter((f) => f.role === "account").length;
  console.log(`  ok    ${tpl.key.padEnd(30)} ${tpl.payment}/${tpl.period}  polis=${pol} kont=${acc}`);
}

// --- dobór ulotki -----------------------------------------------------------
console.log("\n  dobór ulotki do zestawu wariantów");
const dobor = [
  // [warianty, płatność, okres polisy, oczekiwany klucz]
  [["50PLNV50", "85PLNV50"], "wire", "1Y", "v50-50-85-wire-any"],
  [["85PLNV50", "50PLNV50"], "wire", "2Y", "v50-50-85-wire-any"],   // kolejność bez znaczenia
  // ulotka przypisana wprost do okresu wygrywa z uniwersalną
  [["50PLNV50"], "cash", "1Y", "v50-50-cash-1y"],
  [["50PLNV50"], "cash", "2Y", "v50-50-cash-2y"],
  // ulotka 50/65 jest tylko dwuletnia - dla polisy rocznej nie ma czego dać
  [["50PLNV50", "65PLNV50"], "cash", "2Y", "v50-50-65-cash-2y"],
  [["50PLNV50", "65PLNV50"], "cash", "1Y", null],
  // niepełny zestaw to nie „prawie pasuje" - ulotka drukuje konkretne składki
  [["50PLNV50", "65PLNV50", "85PLNV50"], "cash", "2Y", null],
  [["50PLNV50", "65PLNV50", "85PLNV50"], "wire", "1Y", "v50-50-65-85-wire-any"],
  // seria V40 nie może dostać ulotki z zakresem serii V50
  [["50PLNV40", "65PLNV40"], "cash", "2Y", null],
];
for (const [warianty, platnosc, okres, oczekiwany] of dobor) {
  const wynik = selectFlyerTemplate(warianty, platnosc, okres)?.key ?? null;
  if (wynik !== oczekiwany) {
    zle("dobór", `${warianty.join("+")} ${platnosc} ${okres} -> ${wynik}, oczekiwano ${oczekiwany}`);
  } else {
    console.log(`  ok    ${warianty.join("+").padEnd(34)} ${platnosc}/${okres} -> ${wynik ?? "brak ulotki"}`);
  }
}
const platnosciDla5085 = [
  ...new Set(availableFlyersForCombination(["50PLNV50", "85PLNV50"], "1Y").map((t) => t.payment)),
];
if (platnosciDla5085.join() !== "wire") {
  zle("dobór", `formy płatności dla 50+85 (1 rok): ${platnosciDla5085.join()}`);
}

rmSync(modu, { recursive: true, force: true });
console.log(bledy === 0 ? `\nWSZYSTKIE ${FLYER_TEMPLATES.length} ULOTEK OK\n` : `\n${bledy} BŁĘDÓW\n`);
process.exit(bledy ? 1 : 0);

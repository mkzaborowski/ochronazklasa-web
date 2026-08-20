// Usuwa z szablonów ulotek pola formularza o ZDUBLOWANEJ nazwie.
//
// Po co: generator ustawia wartość przez form.getTextField(nazwa). Gdy dwa
// różne pola mają tę samą nazwę, dostaje PIERWSZE z brzegu - i wpisuje nazwę
// szkoły w przypadkowe pole, a właściwy nagłówek zostaje z nazwą szkoły
// dostawcy. Tak było na ulotce OCHRONA 65: każda wygenerowana ulotka nosiła
// w nagłówku "NIEPUBLICZNEGO PRZEDSZKOLA ZACZAROWANY OŁÓWEK".
//
// Zostawiamy pole WIĘKSZE i WYŻEJ na stronie (nagłówek), usuwamy resztę -
// duplikaty to pozostałości po edycji, niewidoczne na wydruku.
//
// Uruchomienie: node scripts/napraw-zdublowane-pola.mjs [--zapisz]

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

const DIR = path.join(process.cwd(), "templates", "flyers");
const zapisz = process.argv.includes("--zapisz");
let znalezione = 0;

for (const plik of readdirSync(DIR).filter((f) => f.endsWith(".pdf")).sort()) {
  const sciezka = path.join(DIR, plik);
  const pdf = await PDFDocument.load(readFileSync(sciezka));
  const form = pdf.getForm();
  const wysokosc = pdf.getPage(0).getHeight();

  const wgNazwy = new Map();
  for (const f of form.getFields()) {
    (wgNazwy.get(f.getName()) ?? wgNazwy.set(f.getName(), []).get(f.getName())).push(f);
  }

  const doUsuniecia = [];
  for (const [nazwa, pola] of wgNazwy) {
    if (pola.length < 2) continue;
    const opis = pola.map((f) => {
      const r = f.acroField.getWidgets()[0].getRectangle();
      return { f, pole: r.width * r.height, top: wysokosc - (r.y + r.height) };
    });
    // nagłówek = największa powierzchnia; przy remisie ten wyżej na stronie
    opis.sort((a, b) => b.pole - a.pole || a.top - b.top);
    console.log(`${plik}: pole "${nazwa}" wystepuje ${pola.length}x - zostawiam to o powierzchni ` +
      `${Math.round(opis[0].pole)} (top ${Math.round(opis[0].top)})`);
    for (const x of opis.slice(1)) {
      console.log(`    usuwam duplikat top=${Math.round(x.top)} wartosc=${JSON.stringify(x.f.getText?.() ?? "")}`);
      doUsuniecia.push(x.f);
    }
  }
  if (!doUsuniecia.length) continue;
  znalezione += doUsuniecia.length;
  if (!zapisz) continue;
  for (const f of doUsuniecia) {
    try {
      form.removeField(f);
    } catch {
      // Duplikat bywa "sierotą": jego widget nie należy do żadnej strony,
      // więc się nie drukuje, a form.removeField() nie umie go posprzątać.
      // Wypisanie z listy pól formularza wystarcza - i tylko o to chodzi,
      // bo to ta lista decyduje, które pole dostaje getTextField(nazwa).
      form.acroForm.removeField(f.acroField);
    }
  }
  writeFileSync(sciezka, await pdf.save({ updateFieldAppearances: false }));
  console.log(`    zapisano ${plik}`);
}

console.log(
  znalezione === 0
    ? "\nBrak zdublowanych pol."
    : zapisz
      ? `\nUsunieto ${znalezione} zdublowanych pol. Przebuduj mapy: npm run build-flyer-fields`
      : `\n${znalezione} zdublowanych pol. Uruchom ponownie z --zapisz.`,
);

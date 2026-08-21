import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FlyerContext, GeneratedDocument, FlyerFields, FlyerFieldDef } from "./flyer-types";
import { FLYER_TEMPLATES } from "./flyer-template-registry";

/** The agency's general service line (first number on every flyer). */
export const SERVICE_LINE = "533 533 931";

/**
 * Krój, którym wpisujemy dane na ulotkę.
 *
 * Wcześniej szedł tu standardowy Helvetica z kodowaniem WinAnsi - bez polskich
 * znaków poza „ó". Nazwy trzeba było spłaszczać do ASCII, więc „Szkoła
 * Podstawowa" drukowało się jako „SZKOLA PODSTAWOWA" na dokumencie, który
 * dostaje rodzic. Ulotki robione ręcznie w Acrobacie miały ogonki, przez co
 * nasze wyglądały przy nich na zrobione byle jak.
 *
 * PP Mori ma komplet polskich znaków i jest tym samym krojem, którym składamy
 * stronę i certyfikaty. Plik musi leżeć w templates/, bo tylko ten katalog
 * trafia do obrazu produkcyjnego.
 *
 * TEKST RYSUJEMY, zamiast wypełniać pola formularza: pdf-lib z krojem OTF psuje
 * przy wypełnianiu odstępy - gubi kropki w datach („1.09.2026" -> „109.2026")
 * i skleja litery w nazwiskach. Rysowanie tego samego kroju wychodzi poprawnie.
 */
const FONT_ZWYKLY = "templates/fonts/PPMori-Regular.otf";
const FONT_POGRUBIONY = "templates/fonts/PPMori-SemiBold.otf";

/** Poniżej tego rozmiaru tekst przestaje być czytelny - lepiej przyciąć. */
const MIN_ROZMIAR = 6;

/**
 * Wpisuje tekst w prostokąt pola: wyśrodkowany w pionie, zmniejszany, gdy się
 * nie mieści w szerokości. Rozmiar i kolor pochodzą z definicji pola
 * w szablonie, więc wydruk wygląda jak wzór od dostawcy.
 */
function rysujWPolu(strona: PDFPage, font: PDFFont, tekst: string, def: FlyerFieldDef): void {
  if (!def.rect || !tekst) return;
  const { x, y, w, h } = def.rect;
  const kolor = def.kolor ?? [0, 0, 0];
  let rozmiar = def.rozmiar ?? 10;
  const dostepna = w - 4;
  while (rozmiar > MIN_ROZMIAR && font.widthOfTextAtSize(tekst, rozmiar) > dostepna) {
    rozmiar -= 0.25;
  }
  strona.drawText(tekst, {
    x: x + 2,
    // wysokość wielkich liter to ok. 0,7 rozmiaru — stąd wyśrodkowanie
    y: y + (h - rozmiar * 0.7) / 2,
    size: rozmiar,
    font,
    color: rgb(kolor[0], kolor[1], kolor[2]),
  });
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
  pdf.registerFontkit(fontkit);
  const [zwykly, pogrubiony] = await Promise.all([
    pdf.embedFont(await readFile(path.join(process.cwd(), FONT_ZWYKLY))),
    pdf.embedFont(await readFile(path.join(process.cwd(), FONT_POGRUBIONY))),
  ]);

  // NAJPIERW czyścimy pola, które sami wypełniamy, POTEM utrwalamy formularz,
  // a rysujemy na końcu.
  //
  // Kolejność nie jest dowolna. Ulotki przychodzą wypełnione przykładem, więc
  // spłaszczenie bez czyszczenia wtapia w stronę cudzą szkołę i cudzego
  // opiekuna, a nasze wartości lądują na nich - dosłownie jedna litera na
  // drugiej. Z drugiej strony samo usunięcie formularza zabrałoby też treści,
  // których NIE nadpisujemy: etykiety składek („50 zł") i termin płatności.
  const form = pdf.getForm();
  for (const def of spec.fields) {
    if (def.role === "deadline") continue; // termin zostaje taki, jak w szablonie
    try {
      form.getTextField(def.name).setText("");
    } catch {
      /* pole zniknęło z szablonu — nie ma czego czyścić */
    }
  }
  try {
    form.flatten();
  } catch {
    /* brak strumieni wyglądu — szablon i tak nie miał czego pokazać */
  }

  const strona = pdf.getPage(0);
  const setText = (def: FlyerFieldDef, text: string, font: PDFFont = zwykly) =>
    rysujWPolu(strona, font, text, def);

  for (const def of spec.fields) {
    switch (def.role) {
      case "policy": {
        const variant = spec.variants[def.idx ?? 0];
        const row = ctx.rows.find((r) => r.variantCode === variant);
        if (row) setText(def, `${def.prefixAA === false ? "" : "A-A "}${row.policyNumber}`);
        break;
      }
      case "account": {
        const variant = spec.variants[def.idx ?? 0];
        const row = ctx.rows.find((r) => r.variantCode === variant);
        if (row?.accountNumber) setText(def, row.accountNumber);
        break;
      }
      case "school":
        if (ctx.schoolName) setText(def, ctx.schoolName.toUpperCase(), pogrubiony);
        break;
      case "period":
        if (ctx.insurancePeriod) setText(def, ctx.insurancePeriod);
        break;
      case "opiekunName":
        setText(def, ctx.opiekun.name.toUpperCase(), pogrubiony);
        break;
      case "opiekunPhone":
        setText(def, `${SERVICE_LINE} | ${formatPhone(ctx.opiekun.phone)}`);
        break;
      case "opiekunEmail":
        setText(def, ctx.opiekun.email);
        break;
      case "deadline":
        break; // left as authored in the template
    }
  }

  const out = await pdf.save();
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

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFForm, type PDFTextField } from "pdf-lib";
import type { FlyerContext, GeneratedDocument, FlyerFields, FlyerFieldDef } from "./flyer-types";
import { FLYER_TEMPLATES } from "./flyer-template-registry";

/** The agency's general service line (first number on every flyer). */
export const SERVICE_LINE = "533 533 931";

/**
 * Krój, którym wpisujemy dane na ulotkę.
 *
 * Standardowa Helvetica z kodowaniem WinAnsi nie ma polskich znaków poza „ó",
 * więc nazwy trzeba było spłaszczać do ASCII i „Szkoła Podstawowa" drukowało
 * się jako „SZKOLA PODSTAWOWA" na dokumencie, który dostaje rodzic.
 *
 * PP Mori ma komplet polskich znaków i jest tym samym krojem, którym składamy
 * stronę i certyfikaty. Plik musi leżeć w templates/, bo tylko ten katalog
 * trafia do obrazu produkcyjnego.
 */
const FONT_ZWYKLY = "templates/fonts/PPMori-Regular.otf";
const FONT_POGRUBIONY = "templates/fonts/PPMori-SemiBold.otf";

/** Poniżej tego rozmiaru tekst przestaje być czytelny - lepiej przyciąć. */
const MIN_ROZMIAR = 6;

/**
 * Rozmiar, przy którym tekst mieści się w polu. Zaczynamy od rozmiaru z szablonu
 * i schodzimy w dół tylko wtedy, gdy trzeba - dzięki temu typowa ulotka wygląda
 * dokładnie jak wzór od dostawcy, a nazwa zespołu szkolno-przedszkolnego
 * z pełnym patronem nie zostaje ucięta w połowie.
 */
function dopasujRozmiar(font: PDFFont, tekst: string, def: FlyerFieldDef): number {
  let rozmiar = def.rozmiar ?? 10;
  const dostepna = (def.rect?.w ?? 0) - 4;
  if (dostepna <= 0) return rozmiar;
  while (rozmiar > MIN_ROZMIAR && font.widthOfTextAtSize(tekst, rozmiar) > dostepna) {
    rozmiar -= 0.25;
  }
  return rozmiar;
}

function pole(form: PDFForm, nazwa: string): PDFTextField | null {
  try {
    return form.getTextField(nazwa);
  } catch {
    return null; // pole zniknęło z szablonu — nie ma czego wypełniać
  }
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
 *
 * WYPEŁNIAMY POLA I NIE UTRWALAMY FORMULARZA. Przez chwilę było odwrotnie -
 * tekst rysowaliśmy na stronie i wołaliśmy form.flatten(), przez co pobrana
 * ulotka była gotowcem bez jednego pola do poprawienia. A agent regularnie musi
 * zmienić datę ochrony, nazwę szkoły albo numer konta już po wygenerowaniu
 * i drukuje z Acrobata, nie z panelu.
 *
 * Polskie znaki nie wymagają rysowania - wystarczy wygenerować wygląd pola
 * naszym krojem (updateAppearances) i NIE pozwolić pdf-lib zrobić tego jeszcze
 * raz przy zapisie. Domyślne `save()` przelicza wygląd wszystkich pól, a jeśli
 * trafi na krój bez ogonków, psuje to, co przed chwilą wyszło dobrze - stąd
 * `updateFieldAppearances: false`.
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

  const form = pdf.getForm();

  // Ulotki przychodzą od dostawcy WYPEŁNIONE przykładem: cudza szkoła, cudzy
  // opiekun, cudze numery. Czyścimy więc każde pole, za które odpowiadamy,
  // zanim cokolwiek wpiszemy - inaczej pole bez wartości w tym zamówieniu
  // (np. numer konta przy składce gotówkowej) wydrukowałoby dane dostawcy.
  // Termin płatności zostaje taki, jak w szablonie.
  for (const def of spec.fields) {
    if (def.role === "deadline") continue;
    const p = pole(form, def.name);
    if (!p) continue;
    p.setText("");
    try {
      p.updateAppearances(zwykly);
    } catch {
      /* brak strumienia wyglądu — pole i tak nie miało czego pokazać */
    }
  }

  const setText = (def: FlyerFieldDef, tekst: string, font: PDFFont = zwykly) => {
    if (!tekst) return;
    const p = pole(form, def.name);
    if (!p) return;
    p.setText(tekst);
    p.setFontSize(dopasujRozmiar(font, tekst, def));
    try {
      p.updateAppearances(font);
    } catch {
      /* zostaje wygląd domyślny — lepsze to niż brak ulotki */
    }
  };

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

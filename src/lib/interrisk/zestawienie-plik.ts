import ExcelJS from "exceljs";
import { PODRYZYKA_WARIANTU, PROWIZJA_PROCENT, UPRAWNIONY } from "@/lib/interrisk/rozliczenie-kody";
import type { Zestawienie } from "@/lib/interrisk/zestawienie";
import type { ZestawRozliczenia } from "@/lib/interrisk/paczka";

/**
 * Stawka i liczba podryzyk podawane do liczenia zestawienia.
 *
 * Stoi tu, a nie w `zestawienie.ts`, bo tamten moduł ma zostać bez importów —
 * ale i tak jest JEDNO miejsce, z którego biorą to wszyscy wołający.
 */
export const KONFIGURACJA = {
  prowizjaProcent: PROWIZJA_PROCENT,
  podryzykNaOsobe: Object.fromEntries(
    Object.entries(PODRYZYKA_WARIANTU).map(([id, lista]) => [id, lista.length]),
  ) as Record<string, number>,
};

const ZL = '#,##0.00 "zł"';
const CZCIONKA = { name: "Calibri", size: 11 };
const GRANAT = "FF1A2A4A";

/**
 * Arkusz z zestawieniem.
 *
 * SUMY SĄ FORMUŁAMI, nie wpisanymi liczbami — tak samo jak w pliku prowizji.
 * Gdyby ktoś po stronie centrali albo biura poprawił jedną pozycję, suma ma się
 * przeliczyć, a nie zostać starą kwotą, która przestała zgadzać się z tym, co
 * nad nią stoi. Wynik zapisujemy obok formuły, żeby podgląd bez przeliczania
 * też pokazywał liczby.
 */
export async function plikZestawienia(
  z: Zestawienie,
  zestaw: ZestawRozliczenia,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Zestawienie");

  const naglowek = (tekst: string, rozmiar = 11, pogrubiony = false) => {
    const r = ws.addRow([tekst]);
    r.font = { ...CZCIONKA, size: rozmiar, bold: pogrubiony, color: { argb: GRANAT } };
    return r;
  };

  naglowek("Zestawienie finansowe — sprzedaż online", 14, true);
  naglowek(`Okres sprzedaży: ${z.okres.od} – ${z.okres.do}`);
  naglowek(`Zestaw: ${zestaw.nazwaKorekty}`);
  naglowek(
    `Pośrednik: ${UPRAWNIONY} · prowizja ${PROWIZJA_PROCENT}% · ` +
      `płatność do ${zestaw.dataPlatnosci.toISOString().slice(0, 10)}`,
  );
  // Kierunek pieniędzy napisany wprost, bo z samych kolumn nie wynika i łatwo
  // przeczytać je odwrotnie: przelewamy całość, prowizja wraca osobno.
  naglowek(
    "Przelewamy pełną składkę; prowizja wraca osobnym przelewem od InterRisk.",
  );
  ws.addRow([]);

  const kolumny = ws.addRow([
    "Numer polisy", "Wariant", "Ubezpieczonych", "Wierszy w pliku",
    "Składka — do przelewu", `Prowizja ${PROWIZJA_PROCENT}% — do zwrotu`,
    "Zostaje w InterRisk",
  ]);
  kolumny.font = { ...CZCIONKA, bold: true };
  const pierwszy = kolumny.number + 1;

  for (const w of z.wiersze) {
    const r = ws.addRow([
      w.numerPolisy,
      `${w.skladkaJednostkowaZl} zł`,
      w.osob,
      w.wierszyWPliku,
      w.skladkaLacznieZl,
      w.prowizjaZl,
      w.zostajeWInterriskZl,
    ]);
    for (const k of [5, 6, 7]) r.getCell(k).numFmt = ZL;
  }

  const ostatni = ws.lastRow!.number;
  const suma = ws.addRow(["RAZEM", "", null, null, null, null, null]);
  suma.font = { ...CZCIONKA, bold: true };
  for (const [kol, wynik] of [
    ["C", z.sumy.osob],
    ["D", z.sumy.wierszyWPliku],
    ["E", z.sumy.skladkaZl],
    ["F", z.sumy.prowizjaZl],
    ["G", z.sumy.zostajeWInterriskZl],
  ] as const) {
    suma.getCell(kol).value = { formula: `SUM(${kol}${pierwszy}:${kol}${ostatni})`, result: wynik };
  }
  for (const k of [5, 6, 7]) suma.getCell(k).numFmt = ZL;

  // Dwie kwoty, po które sięga się najpierw: ile wysłać i ile ma wrócić.
  // W tabeli są, ale rozsypane po kolumnach — tu stoją jako zdania.
  ws.addRow([]);
  for (const [etykieta, kwota] of [
    ["DO PRZELEWU NA KONTO INTERRISK (pełna składka)", z.sumy.skladkaZl],
    [`PROWIZJA DO ZWROTU PRZEZ INTERRISK (${PROWIZJA_PROCENT}%)`, z.sumy.prowizjaZl],
  ] as const) {
    const r = ws.addRow([etykieta, "", "", "", "", "", kwota]);
    r.font = { ...CZCIONKA, bold: true, color: { argb: GRANAT } };
    r.getCell(7).numFmt = ZL;
  }

  // Rozbieżności NIE wchodzą do kwot wyżej — to osobna informacja dla człowieka,
  // a nie korekta rozliczenia. Milczenie o nich byłoby gorsze: kwota w arkuszu
  // zgadzałaby się z polisą, a nie z naszym kontem, i nikt by nie wiedział, czemu.
  if (z.rozbieznosci.length > 0) {
    ws.addRow([]);
    const t = ws.addRow([
      `UWAGA: ${z.rozbieznosci.length} ${z.rozbieznosci.length === 1 ? "wniosek" : "wniosków"}` +
        " z inną kwotą wpłaty niż składka polisy — do przelewu liczy się wartość polisy",
    ]);
    t.font = { ...CZCIONKA, bold: true, color: { argb: "FFB45309" } };
    const n = ws.addRow(["Wniosek", "Wariant", "Wg polisy", "Wpłynęło", "", "", ""]);
    n.font = { ...CZCIONKA, bold: true };
    for (const r of z.rozbieznosci) {
      const w = ws.addRow([r.wniosekId, r.wariantId, r.wgPolisyZl, r.pobranoZl, "", "", ""]);
      w.getCell(3).numFmt = ZL;
      w.getCell(4).numFmt = ZL;
    }
  }

  [16, 10, 15, 15, 16, 14, 16].forEach((sz, i) => (ws.getColumn(i + 1).width = sz));
  ws.eachRow((r) => r.eachCell((c) => (c.font = { ...CZCIONKA, ...(c.font ?? {}) })));

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

/** „Zestawienie finansowe ZESTAW 05.10.2026.xlsx" */
export function nazwaPlikuZestawienia(nazwaKorekty: string): string {
  const czysty = nazwaKorekty
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `Zestawienie finansowe ${czysty}.xlsx`.replace(/ +/g, " ");
}

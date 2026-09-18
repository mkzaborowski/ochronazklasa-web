import ExcelJS from "exceljs";
import { PROWIZJA_FIRMY_PROC, STAWKI } from "@/lib/prowizje/zasady";
import type { RaportProwizji } from "@/lib/prowizje/raport";

/**
 * Plik z wypłatami prowizji — do przelewów i do archiwum.
 *
 * DWA ARKUSZE, bo służą dwóm różnym pytaniom. „Wypłaty" odpowiada na „komu ile
 * przelać" i ma się dać przeczytać w pół minuty. „Sprzedaże" odpowiada na
 * „skąd ta kwota", kiedy agent zapyta, dlaczego dostał tyle, a nie więcej —
 * każda złotówka z pierwszego arkusza da się tam odnaleźć w konkretnym zakupie.
 *
 * SUMY SĄ FORMUŁAMI, nie wpisanymi liczbami. Gdyby ktoś w biurze poprawił
 * ręcznie jedną pozycję, suma ma się przeliczyć, a nie zostać starą kwotą,
 * która przestała się zgadzać z tym, co nad nią stoi. Wynik zapisujemy obok
 * formuły, żeby podgląd pliku bez przeliczania też pokazywał liczby.
 */

const ZL = '#,##0.00 "zł"';
const CZCIONKA = { name: "Calibri", size: 11 };

const zl = (gr: number) => Math.round(gr) / 100;

const ETYKIETY_RODZAJU = {
  agent: "agent",
  bez_agenta: "bez kodu",
  kod_nierozstrzygniety: "kod do przypisania",
} as const;

export async function plikProwizji(raport: RaportProwizji): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const { zestawienie: z } = raport;

  // --- Wypłaty -------------------------------------------------------------
  const w = wb.addWorksheet("Wypłaty");
  w.addRow([`Prowizje za okres ${raport.od} – ${raport.do}`]).font = { ...CZCIONKA, bold: true, size: 13 };
  w.addRow([
    `Prowizja od InterRisk ${PROWIZJA_FIRMY_PROC}% składki. Z kodem agenta: agent ` +
      `${STAWKI.zAgentem.agent}%, administrator ${STAWKI.zAgentem.administrator}%, szef reszta. ` +
      `Bez kodu: administrator ${STAWKI.bezAgenta.administrator}%, szef reszta.`,
  ]).font = { ...CZCIONKA, italic: true, color: { argb: "FF5B6D8C" } };
  w.addRow([]);

  const naglowek = w.addRow([
    "Osoba", "Role", "Sprzedaży z własnego kodu",
    "Z własnej sprzedaży", "Jako administrator", "Jako szef", "Do wypłaty",
  ]);
  naglowek.font = { ...CZCIONKA, bold: true };
  const pierwszy = naglowek.number + 1;

  for (const o of z.osoby) {
    const r = w.addRow([
      o.nazwa,
      o.role.join(", "),
      o.sprzedazy,
      zl(o.zeSprzedazyGr),
      zl(o.zAdministratoraGr),
      zl(o.zSzefaGr),
      null,
    ]);
    r.getCell(7).value = { formula: `D${r.number}+E${r.number}+F${r.number}`, result: zl(o.razemGr) };
  }

  if (z.sumy.czekaGr > 0) {
    const r = w.addRow([
      "Czeka na przypisanie kodu",
      z.nierozstrzygniete.map((n) => n.kod).join(", "),
      z.nierozstrzygniete.reduce((s, n) => s + n.sprzedazy, 0),
      zl(z.sumy.czekaGr), 0, 0, null,
    ]);
    r.getCell(7).value = { formula: `D${r.number}+E${r.number}+F${r.number}`, result: zl(z.sumy.czekaGr) };
    r.font = { ...CZCIONKA, italic: true, color: { argb: "FFB45309" } };
  }

  const ostatni = w.lastRow!.number;
  const suma = w.addRow(["Razem", "", null, null, null, null, null]);
  suma.font = { ...CZCIONKA, bold: true };
  for (const [kol, wynik] of [
    ["C", z.osoby.reduce((s, o) => s + o.sprzedazy, 0) + z.nierozstrzygniete.reduce((s, n) => s + n.sprzedazy, 0)],
    ["D", zl(z.osoby.reduce((s, o) => s + o.zeSprzedazyGr, 0) + z.sumy.czekaGr)],
    ["E", zl(z.osoby.reduce((s, o) => s + o.zAdministratoraGr, 0))],
    ["F", zl(z.osoby.reduce((s, o) => s + o.zSzefaGr, 0))],
    ["G", zl(z.sumy.wyplatyGr + z.sumy.czekaGr)],
  ] as const) {
    suma.getCell(kol).value = { formula: `SUM(${kol}${pierwszy}:${kol}${ostatni})`, result: wynik };
  }

  w.addRow([]);
  const kontrola = [
    ["Składka łącznie", zl(z.sumy.skladkaGr)],
    [`Prowizja od InterRisk (${PROWIZJA_FIRMY_PROC}%)`, zl(z.sumy.pulaGr)],
  ] as const;
  for (const [etykieta, wartosc] of kontrola) {
    const r = w.addRow([etykieta, "", "", "", "", "", wartosc]);
    r.getCell(7).numFmt = ZL;
  }
  // Wiersz kontrolny: różnica między wypłatami a pulą musi być zero. Formuła,
  // żeby po ręcznej poprawce w biurze od razu było widać, że coś się rozjechało.
  const kontrolny = w.addRow(["Różnica (powinna być 0)", "", "", "", "", "", null]);
  kontrolny.getCell(7).value = {
    formula: `G${suma.number}-G${kontrolny.number - 1}`,
    result: zl(z.sumy.wyplatyGr + z.sumy.czekaGr - z.sumy.pulaGr),
  };

  for (let i = pierwszy; i <= kontrolny.number; i++) {
    for (const k of [4, 5, 6, 7]) w.getRow(i).getCell(k).numFmt = ZL;
  }
  [30, 26, 14, 18, 18, 14, 16].forEach((szer, i) => (w.getColumn(i + 1).width = szer));

  // --- Sprzedaże -----------------------------------------------------------
  const s = wb.addWorksheet("Sprzedaże");
  const n = s.addRow([
    "Data", "Wniosek", "Certyfikaty", "Osób", "Kod", "Agent", "Rodzaj",
    "Składka", `Prowizja ${PROWIZJA_FIRMY_PROC}%`, "Agent", "Administrator", "Szef",
  ]);
  n.font = { ...CZCIONKA, bold: true };
  for (const x of raport.sprzedaze) {
    const r = s.addRow([
      x.dzien,
      x.wniosekId,
      x.certyfikaty.join(", "),
      x.osob,
      x.kod ?? "",
      x.agentNazwa ?? (x.rodzaj === "kod_nierozstrzygniety" ? "— do przypisania —" : ""),
      ETYKIETY_RODZAJU[x.rodzaj],
      zl(x.skladkaGr),
      zl(x.podzial.pula),
      zl(x.podzial.agent),
      zl(x.podzial.administrator),
      zl(x.podzial.szef),
    ]);
    for (let k = 8; k <= 12; k++) r.getCell(k).numFmt = ZL;
  }
  [11, 38, 30, 6, 16, 24, 18, 12, 14, 12, 14, 12].forEach((szer, i) => (s.getColumn(i + 1).width = szer));

  for (const ark of [w, s]) {
    ark.eachRow((r) => {
      r.eachCell((c) => {
        c.font = { ...CZCIONKA, ...(c.font ?? {}) };
      });
    });
  }

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

export const nazwaPlikuProwizji = (od: string, do_: string) => `Prowizje ${od} - ${do_}.xlsx`;

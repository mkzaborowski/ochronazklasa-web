/**
 * Sprawdzenie pliku rozliczeniowego dla InterRisk: `npm run check:rozliczenie`.
 *
 * To jest plik DO ZACZYTANIA po ich stronie, nie raport do oglądania. Liczy się
 * zgodność co do kolumny i co do TYPU KOMÓRKI — a typu nie widać gołym okiem.
 * Data wpisana tam, gdzie szablon ma tekst, wygląda w Excelu identycznie
 * i wywraca się dopiero przy imporcie, czyli u ubezpieczyciela.
 *
 * Oczekiwania niżej są przepisane wprost z pliku przysłanego przez centralę
 * („Przykład pliku do zaczytania.xlsx"). Samego szablonu nie trzymamy w repo —
 * to cudzy plik z 5833 wierszami; trzymamy jego SPECYFIKACJĘ.
 */
import ExcelJS from "exceljs";
import { plikRozliczenia, nazwaPlikuRozliczenia, NAGLOWKI } from "../src/lib/interrisk/rozliczenie.ts";

/** Kolumna → czego wymaga szablon. `pusty` = w szablonie nic tam nie stoi. */
const OCZEKIWANE: { naglowek: string; typ: "tekst" | "liczba" | "data" | "pusty"; format?: string }[] = [
  { naglowek: "numer polisy", typ: "tekst" },
  { naglowek: "Nazwa korekty", typ: "tekst" },
  { naglowek: "data aneksu", typ: "data", format: "mm-dd-yy" },
  { naglowek: "Imię Ubezpieczonego", typ: "tekst" },
  { naglowek: "Nazwisko Ubezpieczonego", typ: "tekst" },
  { naglowek: "PESEL Ubezpieczonego", typ: "pusty" },
  { naglowek: "okres od", typ: "tekst" },
  { naglowek: "okres do", typ: "tekst" },
  { naglowek: "Suma Ubezpieczenia (PLN)", typ: "liczba" },
  { naglowek: "Suma Ubezpieczenia max (PLN)", typ: "liczba" },
  { naglowek: "Liczba podryzyk", typ: "liczba" },
  { naglowek: "kod taryfowy", typ: "tekst", format: "@" },
  { naglowek: "klucz statystyczny", typ: "tekst" },
  { naglowek: "kwota PLN", typ: "liczba" },
  { naglowek: "data płatności", typ: "data", format: "mm-dd-yy" },
  { naglowek: "Uprawniony 1", typ: "tekst", format: "@" },
  { naglowek: "Wysokość prowizji 1 (%)", typ: "liczba" },
  { naglowek: "Uprawniony 2", typ: "pusty" },
  { naglowek: "Wysokość prowizji 2 (%)", typ: "pusty" },
];

const ZESTAW = {
  nazwaKorekty: "ZESTAW 01.09.2026",
  dataAneksu: new Date("2026-08-31T12:00:00"),
  dataPlatnosci: new Date("2026-10-10T12:00:00"),
  uprawniony: "02/3008",
  prowizjaProcent: 40,
  kodTaryfowy: "016818BK",
  kluczStatystyczny: "00711111101111070X",
  zPeselem: false,
};

const WIERSZE = [
  {
    numerPolisy: "A-A 678916",
    imie: "Marcel",
    nazwisko: "Kowalski",
    pesel: "12232210571",
    okresOd: "2026-09-13",
    okresDo: "2027-09-12",
    sumaUbezpieczenia: 75000,
    skladkaZl: 135,
  },
];

let bledy = 0;
const sprawdz = (opis: string, warunek: boolean, szczegol = "") => {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"} ${opis}${szczegol ? "  (" + szczegol + ")" : ""}`);
  if (!warunek) bledy++;
};

const typKomorki = (v: unknown): string => {
  if (v === null || v === undefined) return "pusty";
  if (v instanceof Date) return "data";
  if (typeof v === "number") return "liczba";
  return "tekst";
};

const wczytaj = async (bytes: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb.worksheets[0];
};

console.log("\n[1] nagłówki w kolejności z szablonu");
{
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  sprawdz("19 kolumn", NAGLOWKI.length === 19, String(NAGLOWKI.length));
  OCZEKIWANE.forEach((o, i) => {
    const w = ws.getRow(1).getCell(i + 1).value;
    sprawdz(`${i + 1}. ${o.naglowek}`, w === o.naglowek, w === o.naglowek ? "" : `u nas: ${w}`);
  });
}

console.log("\n[2] typy komórek — to na tym wywraca się import");
{
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  OCZEKIWANE.forEach((o, i) => {
    const k = ws.getRow(2).getCell(i + 1);
    sprawdz(`${o.naglowek}: ${o.typ}`, typKomorki(k.value) === o.typ, `u nas: ${typKomorki(k.value)}`);
    if (o.format) {
      sprawdz(`${o.naglowek}: format ${o.format}`, k.numFmt === o.format, `u nas: ${k.numFmt}`);
    }
  });
}

console.log("\n[3] wiodące zera przeżywają zapis");
{
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  const r = ws.getRow(2);
  sprawdz("kod taryfowy zachowuje zero", r.getCell(12).value === "016818BK", String(r.getCell(12).value));
  sprawdz("Uprawniony zachowuje zero", r.getCell(16).value === "02/3008", String(r.getCell(16).value));
}

console.log("\n[4] numer polisy bez spacji, jak w szablonie");
{
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  sprawdz("A-A 678916 → A-A678916", ws.getRow(2).getCell(1).value === "A-A678916",
    String(ws.getRow(2).getCell(1).value));
}

console.log("\n[5] PESEL tylko na wyraźne życzenie");
{
  const bez = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  sprawdz("domyślnie pusty, jak w szablonie", bez.getRow(2).getCell(6).value == null);
  const z = await wczytaj(await plikRozliczenia(WIERSZE, { ...ZESTAW, zPeselem: true }));
  sprawdz("po włączeniu wpisany", z.getRow(2).getCell(6).value === "12232210571",
    String(z.getRow(2).getCell(6).value));
}

console.log("\n[6] nazwa pliku");
{
  const n = nazwaPlikuRozliczenia("A-A 678916", "ZESTAW 01.09.2026");
  // Myślnik MUSI zostać - „A A678916" przestaje być numerem polisy.
  sprawdz("zachowuje myślnik w numerze", n.includes("A-A"), n);
  sprawdz("bez znaków zakazanych w Windows", !/[<>:"/\\|?*]/.test(n), n);
  sprawdz("rozszerzenie xlsx", n.endsWith(".xlsx"), n);
}

console.log(bledy === 0 ? "\nPlik zgodny z szablonem." : `\n${bledy} niezgodności.`);
process.exit(bledy === 0 ? 0 : 1);

import ExcelJS from "exceljs";

/**
 * Plik rozliczeniowy dla InterRisk — odwzorowanie przysłanego szablonu.
 *
 * To jest plik DO ZACZYTANIA po ich stronie, nie raport do czytania przez
 * człowieka. Liczy się więc nie wygląd, tylko zgodność co do kolumny i co do
 * TYPU KOMÓRKI. Trzy rzeczy z szablonu, które łatwo zepsuć i których nie widać
 * gołym okiem:
 *
 *   · „okres od" i „okres do" to TEKST („2026-09-13"), podczas gdy „data
 *     aneksu" i „data płatności" są prawdziwymi datami. Wpisanie tam daty
 *     zmieniłoby to, co zobaczy importer.
 *   · „PESEL Ubezpieczonego" w szablonie z centrali jest PUSTY, u nas jest
 *     zawsze wypełniony — to nasza decyzja, nie przeoczenie. PESEL wskazuje
 *     osobę jednoznacznie; gdy go nie podano, w tej kolumnie staje data
 *     urodzenia (patrz `identyfikacjaOsoby`).
 *   · „kod taryfowy" i „Uprawniony 1" mają format tekstowy (@), bo zaczynają
 *     się od zera — 016818BK, 02/3008. Zapisane jako liczba tracą to zero;
 *     ten sam błąd goniliśmy wcześniej przy REGON-ach.
 *
 * Reszta jest bez formatowania: Calibri 11, bez pogrubienia nagłówka, bez
 * filtrów i bez zamrożonego wiersza. Szablon też taki jest i nie ma powodu
 * dokładać ozdób do pliku, który czyta maszyna.
 */

/** Nagłówki w kolejności z szablonu. Kolejność JEST częścią formatu. */
export const NAGLOWKI = [
  "numer polisy",
  "Nazwa korekty",
  "data aneksu",
  "Imię Ubezpieczonego",
  "Nazwisko Ubezpieczonego",
  "PESEL Ubezpieczonego",
  "okres od",
  "okres do",
  "Suma Ubezpieczenia (PLN)",
  "Suma Ubezpieczenia max (PLN)",
  "Liczba podryzyk",
  "kod taryfowy",
  "klucz statystyczny",
  "kwota PLN",
  "data płatności",
  "Uprawniony 1",
  "Wysokość prowizji 1 (%)",
  "Uprawniony 2",
  "Wysokość prowizji 2 (%)",
] as const;

/** Szerokości kolumn odczytane z szablonu — dla wygody biura, nie dla importu. */
const SZEROKOSCI = [12.5, 23.9, 12.5, 18, 24.5, 21.1, 12, 12, 22, 26, 14, 14, 20, 11, 14, 13, 21, 13, 21];

/**
 * Jedna OSOBA. W pliku rozwinie się na tyle wierszy, ile ma podryzyk —
 * tak jak w szablonie z centrali, gdzie 918 osób daje 5833 wiersze.
 */
export interface OsobaDoRozliczenia {
  numerPolisy: string;
  imie: string;
  nazwisko: string;
  /** PESEL, jeśli podany przy zakupie; inaczej pusty */
  pesel: string;
  /** „2019-10-10" — wpisywana zamiast PESEL-u, gdy go nie podano */
  dataUrodzenia: string;
  okresOd: string;
  okresDo: string;
  /** suma ubezpieczenia wariantu — ta sama, którą drukuje certyfikat */
  sumaUbezpieczenia: number;
}

/**
 * Co wpisać w kolumnę „PESEL Ubezpieczonego".
 *
 * PESEL JEST ZAWSZE, bo jednoznacznie wskazuje osobę i bez niego
 * ubezpieczyciel nie ma jak dopasować zgłoszenia szkody do naszego wiersza.
 * Co piąty ubezpieczony nie podaje jednak PESEL-u, tylko datę urodzenia —
 * wtedy w tej kolumnie staje data. Pusto nie zostaje nigdy: wiersz bez żadnej
 * identyfikacji to pozycja, której po stronie centrali nie da się przypisać
 * do człowieka.
 */
export const identyfikacjaOsoby = (o: OsobaDoRozliczenia): string =>
  o.pesel.trim() || o.dataUrodzenia.trim();

/** Składnik pakietu: własny kod, klucz, suma ubezpieczenia i składka. */
export interface PodryzykoDoRozliczenia {
  kodTaryfowy: string;
  kluczStatystyczny: string;
  /**
   * Suma TEGO składnika, jeśli centrala ją podała. `null` = bierzemy sumę
   * ubezpieczenia wariantu, czyli tę z certyfikatu.
   */
  sumaUbezpieczenia: number | null;
  skladkaZl: number;
}

export interface NaglowekZestawu {
  /** np. „ZESTAW 01.09.2026" */
  nazwaKorekty: string;
  dataAneksu: Date;
  dataPlatnosci: Date;
  /** kod pośrednika w InterRisk, np. „02/3008" */
  uprawniony: string;
  prowizjaProcent: number;
  /** rozbicie wariantu na podryzyka — każde daje osobny wiersz dla każdej osoby */
  podryzyka: PodryzykoDoRozliczenia[];
}

/**
 * Buduje arkusz w układzie szablonu.
 *
 * Numer polisy zapisujemy BEZ SPACJI („A-A678916"), tak jak w szablonie —
 * u nas warianty trzymają go w postaci „A-A 678916", czytelnej dla człowieka.
 */
export async function plikRozliczenia(
  osoby: OsobaDoRozliczenia[],
  naglowek: NaglowekZestawu,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Arkusz1");

  ws.addRow([...NAGLOWKI]);
  SZEROKOSCI.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Każda osoba rozwija się na tyle wierszy, ile ma podryzyk. Kolejność jest
  // „osoba po osobie", a nie „podryzyko po podryzyku" — tak samo jak
  // w szablonie, gdzie składniki jednej osoby stoją obok siebie.
  for (const o of osoby) {
    for (const pr of naglowek.podryzyka) {
      const r = ws.addRow([
        o.numerPolisy.replace(/\s+/g, ""),
        naglowek.nazwaKorekty,
        naglowek.dataAneksu,
        o.imie,
        o.nazwisko,
        identyfikacjaOsoby(o),
        o.okresOd,
        o.okresDo,
        // Suma składnika, a gdy centrala jej nie podała — suma ubezpieczenia
        // wariantu, ta sama, którą ubezpieczony ma wydrukowaną na certyfikacie.
        pr.sumaUbezpieczenia ?? o.sumaUbezpieczenia,
        pr.sumaUbezpieczenia ?? o.sumaUbezpieczenia,
        1,
        pr.kodTaryfowy,
        pr.kluczStatystyczny,
        pr.skladkaZl,
        naglowek.dataPlatnosci,
        naglowek.uprawniony,
        naglowek.prowizjaProcent,
        null,
        null,
      ]);

      // Daty: format taki, jak w szablonie.
      r.getCell(3).numFmt = "mm-dd-yy";
      r.getCell(15).numFmt = "mm-dd-yy";
      // Tekst, nie liczba — inaczej zniknie wiodące zero. Dotyczy też
      // PESEL-u: na produkcji 113 z nich zaczyna się od zera, a zapisany
      // jako liczba przestaje być PESEL-em i nie dopasuje się do osoby.
      r.getCell(6).numFmt = "@";
      r.getCell(12).numFmt = "@";
      r.getCell(16).numFmt = "@";
      // Okresy ochrony zostają napisami; ExcelJS sam by ich nie zamienił, ale
      // zapisujemy to wprost, bo to jest decyzja, nie przypadek.
      r.getCell(7).value = o.okresOd;
      r.getCell(8).value = o.okresDo;
    }
  }

  ws.eachRow((r) => {
    r.font = { name: "Calibri", size: 11 };
  });

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

/** „Rozliczenie A-A678916 ZESTAW 01.09.2026.xlsx" */
export function nazwaPlikuRozliczenia(numerPolisy: string, nazwaKorekty: string): string {
  // Myślnik i spacja ZOSTAJĄ — „A A678916" przestaje być numerem polisy.
  // Wypadają tylko znaki zakazane w nazwach plików Windows i sterujące,
  // bo nazwę zestawu wpisuje człowiek i może tam wkleić cokolwiek.
  const czysty = (t: string) =>
    t.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return `Rozliczenie ${czysty(numerPolisy)} ${czysty(nazwaKorekty)}.xlsx`.replace(/ +/g, " ");
}

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
import { problemyKonfiguracji, PODRYZYKA_WARIANTU, SKLADKI_WARIANTOW } from "../src/lib/interrisk/rozliczenie-kody.ts";

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

/**
 * Rozbicie na podryzyka przepisane z szablonu — pakiet o składce 79 zł.
 * Jedna osoba daje tyle wierszy, ile ma tu pozycji.
 */
const PODRYZYKA = [
  { kodTaryfowy: "016818BK", kluczStatystyczny: "00711111101111070X", sumaUbezpieczenia: 20000, skladkaZl: 51.0 },
  { kodTaryfowy: "028018BK", kluczStatystyczny: "00711070X", sumaUbezpieczenia: 20000, skladkaZl: 12.0 },
  { kodTaryfowy: "02153018BK", kluczStatystyczny: "11070X", sumaUbezpieczenia: 4000, skladkaZl: 4.1 },
  { kodTaryfowy: "02156018BK", kluczStatystyczny: "11070X", sumaUbezpieczenia: 15000, skladkaZl: 9.5 },
  { kodTaryfowy: "184118BK", kluczStatystyczny: "1070X", sumaUbezpieczenia: 5000, skladkaZl: 1.2 },
  { kodTaryfowy: "18080018BK", kluczStatystyczny: "100", sumaUbezpieczenia: 5000, skladkaZl: 1.2 },
];

const ZESTAW = {
  nazwaKorekty: "ZESTAW 01.09.2026",
  dataAneksu: new Date("2026-08-31T12:00:00"),
  dataPlatnosci: new Date("2026-10-10T12:00:00"),
  uprawniony: "02/3008",
  prowizjaProcent: 40,
  zPeselem: false,
  podryzyka: PODRYZYKA,
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

console.log("\n[7] jedna osoba rozwija się na tyle wierszy, ile ma podryzyk");
{
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  // 1 osoba × 6 podryzyk + nagłówek = 7 wierszy.
  sprawdz(`1 osoba × ${PODRYZYKA.length} podryzyk`, ws.rowCount === PODRYZYKA.length + 1,
    `wierszy: ${ws.rowCount}`);
  const dwie = await wczytaj(
    await plikRozliczenia([WIERSZE[0], { ...WIERSZE[0], imie: "Zofia" }], ZESTAW),
  );
  sprawdz("2 osoby dają dwa razy tyle", dwie.rowCount === PODRYZYKA.length * 2 + 1,
    `wierszy: ${dwie.rowCount}`);
  // Wiersze jednej osoby stoją obok siebie, jak w szablonie.
  sprawdz("wiersze osoby trzymają się razem",
    dwie.getRow(2).getCell(4).value === "Marcel" &&
      dwie.getRow(1 + PODRYZYKA.length).getCell(4).value === "Marcel" &&
      dwie.getRow(2 + PODRYZYKA.length).getCell(4).value === "Zofia");

  const sumaWierszy = Array.from({ length: PODRYZYKA.length }, (_, i) =>
    Number(ws.getRow(2 + i).getCell(14).value),
  ).reduce((a, b) => a + b, 0);
  sprawdz("składki podryzyk sumują się do składki osoby",
    Math.round(sumaWierszy * 100) === 7900, `${sumaWierszy.toFixed(2)} zł`);
}

console.log("\n[8] konfiguracja wariantów — czy da się już rozliczać");
{
  const warianty = Object.keys(SKLADKI_WARIANTOW);
  for (const w of warianty) {
    sprawdz(`${w}: 6 podryzyk`, (PODRYZYKA_WARIANTU[w] ?? []).length === 6,
      `jest ${(PODRYZYKA_WARIANTU[w] ?? []).length}`);
  }

  // Centrala podała kody i składki, ale nie rozbiła sum na podryzyka. Sumę
  // bierzemy z wariantu (ta z certyfikatu), więc rozliczać SIĘ DA i żaden
  // wariant nie może tu zgłaszać problemu.
  const problemy = problemyKonfiguracji(warianty);
  sprawdz("wszystkie warianty gotowe do rozliczenia", problemy.length === 0,
    problemy.map((p) => `${p.wariantId}: ${p.powod}`).join("; ") || "brak problemów");

  // Rozbicie, które nie sumuje się do składki wariantu, musi być złapane —
  // I TO NAWET WTEDY, gdy brakuje sum ubezpieczenia. Wcześniej brak sumy
  // przerywał sprawdzanie i rozjazd składek przechodziłby niezauważony,
  // a to jedyny problem dotykający wprost pieniędzy.
  const zle = PODRYZYKA_WARIANTU.w135;
  PODRYZYKA_WARIANTU.w135 = [
    { kodTaryfowy: "X", kluczStatystyczny: "Y", sumaUbezpieczenia: null, skladkaZl: 100 },
  ];
  const p = problemyKonfiguracji(["w135"]);
  sprawdz("rozjazd sumy jest wykrywany mimo braku sumy ubezpieczenia",
    p.some((x) => x.powod.includes("100.00")), p.map((x) => x.powod).join("; ") || "nie wykryto");
  PODRYZYKA_WARIANTU.w135 = zle;
}

console.log("\n[9] kody i składki przepisane z pięciu arkuszy centrali");
{
  // Przepisane niezależnie od tabeli w kodzie, wprost z arkuszy
  // „<wariant> Plik do rozliczeń online.xlsx". Kolejność wierszy jak tam.
  const Z_ARKUSZY: Record<string, [string, string, number][]> = {
    w60: [
      ["016818BK", "12201110100100070X", 43.1],
      ["028018BK", "12200070X", 6.2],
      ["02153018BK", "11070X", 2.7],
      ["02156018BK", "10070X", 5.7],
      ["184118BK", "070X", 1.1],
      ["18080018BK", "00", 1.2],
    ],
    w90: [
      ["016818BK", "12201110100100070X", 68.7],
      // W arkuszu 90 zł stoi „28018BK" — zgubione wiodące zero. Bierzemy
      // wersję z czterech pozostałych arkuszy, przy identycznym kluczu.
      ["028018BK", "12200070X", 9.8],
      ["02153018BK", "11070X", 3.0],
      ["02156018BK", "10070X", 6.2],
      ["184118BK", "070X", 1.1],
      ["18080018BK", "00", 1.2],
    ],
    w135: [
      ["016818BK", "12201110100100070X", 107.3],
      ["028018BK", "12200070X", 16.0],
      ["02153018BK", "11070X", 3.2],
      ["02156018BK", "10070X", 6.2],
      ["184118BK", "070X", 1.1],
      ["18080018BK", "00", 1.2],
    ],
    w180: [
      ["016818BK", "12201110100100070X", 145.9],
      ["028018BK", "12200070X", 22.2],
      ["02153018BK", "11070X", 3.4],
      ["02156018BK", "10070X", 6.2],
      ["184118BK", "070X", 1.1],
      ["18080018BK", "00", 1.2],
    ],
    w250: [
      ["016818BK", "12201110100100070X", 206.1],
      ["028018BK", "12200070X", 31.9],
      ["02153018BK", "11070X", 3.5],
      ["02156018BK", "10070X", 6.2],
      ["184118BK", "070X", 1.1],
      ["18080018BK", "00", 1.2],
    ],
  };

  for (const [wariantId, oczekiwane] of Object.entries(Z_ARKUSZY)) {
    const nasze = PODRYZYKA_WARIANTU[wariantId] ?? [];
    const zgodne = oczekiwane.every(([kod, klucz, skladka], i) =>
      nasze[i]?.kodTaryfowy === kod &&
      nasze[i]?.kluczStatystyczny === klucz &&
      Math.round((nasze[i]?.skladkaZl ?? 0) * 100) === Math.round(skladka * 100));
    sprawdz(`${wariantId}: kody, klucze i składki jak w arkuszu`, zgodne,
      zgodne ? "" : nasze.map((n) => `${n.kodTaryfowy}/${n.skladkaZl}`).join(" "));

    const suma = oczekiwane.reduce((a, [, , sk]) => a + sk, 0);
    sprawdz(`${wariantId}: składki sumują się do ${SKLADKI_WARIANTOW[wariantId]} zł`,
      Math.round(suma * 100) === Math.round(SKLADKI_WARIANTOW[wariantId] * 100),
      `${suma.toFixed(2)} zł`);
  }

  // Wiodące zera: kod zapisany kiedyś jako liczba wraca bez zera i przestaje
  // być tym kodem. Dokładnie to zdarzyło się centrali w arkuszu 90 zł.
  const zZerem = ["016818BK", "028018BK", "02153018BK", "02156018BK"];
  sprawdz("kody z wiodącym zerem mają je we wszystkich wariantach",
    Object.values(PODRYZYKA_WARIANTU).every((lista) =>
      lista.filter((x) => zZerem.includes(x.kodTaryfowy)).length === zZerem.length));

  // Ten sam zestaw kodów w każdym wariancie — różnić się mają tylko składki.
  const zestaw = (w: string) =>
    (PODRYZYKA_WARIANTU[w] ?? []).map((x) => `${x.kodTaryfowy}|${x.kluczStatystyczny}`).join(",");
  const wzorzec = zestaw("w60");
  sprawdz("wszystkie warianty mają ten sam zestaw podryzyk",
    Object.keys(SKLADKI_WARIANTOW).every((w) => zestaw(w) === wzorzec));
}

console.log("\n[10] brak sumy podryzyka bierze sumę ubezpieczenia wariantu");
{
  const bezSumy = PODRYZYKA.map((p) => ({ ...p, sumaUbezpieczenia: null }));
  const ws = await wczytaj(await plikRozliczenia(WIERSZE, { ...ZESTAW, podryzyka: bezSumy }));
  const r = ws.getRow(2);
  // 75 000 zł to suma z certyfikatu wariantu 135 zł — ta, którą dostał klient.
  sprawdz("Suma Ubezpieczenia z wariantu", r.getCell(9).value === 75000, String(r.getCell(9).value));
  sprawdz("Suma Ubezpieczenia max z wariantu", r.getCell(10).value === 75000, String(r.getCell(10).value));
  sprawdz("nadal liczba, nie tekst", typKomorki(r.getCell(9).value) === "liczba");

  // Gdy centrala poda sumę podryzyka, ma ona pierwszeństwo nad sumą wariantu.
  const zSuma = await wczytaj(await plikRozliczenia(WIERSZE, ZESTAW));
  sprawdz("suma podryzyka ma pierwszeństwo", zSuma.getRow(2).getCell(9).value === 20000,
    String(zSuma.getRow(2).getCell(9).value));
}

console.log(bledy === 0 ? "\nPlik zgodny z szablonem." : `\n${bledy} niezgodności.`);
process.exit(bledy === 0 ? 0 : 1);

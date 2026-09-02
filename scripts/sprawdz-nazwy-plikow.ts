/**
 * Sprawdzenie nazw plików polis: `npm run check:nazwy`.
 *
 * Reguły nazywania są krótkie, ale wszystkie pochodzą z Windows i żadnej nie
 * widać w typach: zakaz znaków < > : " / \ | ? *, zakaz kropki i spacji na
 * końcu, limit długości. Złamanie którejkolwiek kończy się plikiem, którego
 * biuro nie zapisze — i dowiemy się o tym od biura, nie od testu.
 *
 * Uruchamia się samym node (strip-types), bez bazy i bez Next.js.
 */
import { nazwaPlikuPolisy } from "../src/lib/interrisk/nazwa-pliku.ts";

const ZAKAZANE = /[<>:"/\\|?*]/;

interface Przypadek {
  nazwa: string;
  dane: Parameters<typeof nazwaPlikuPolisy>[0];
  oczekiwana?: string;
  po_co: string;
}

const przypadki: Przypadek[] = [
  {
    nazwa: "zwykła szkoła",
    dane: { szkola: "Szkoła Podstawowa nr 5 w Nowym Sączu", wariant: "65pln50", numerPolisy: "679857" },
    oczekiwana: "Szkoła Podstawowa nr 5 w Nowym Sączu_65pln50_679857.docx",
    po_co: "PRZYPADEK ZE ZGŁOSZENIA: nazwa placówki zamiast dopisywania jej z ręki",
  },
  {
    nazwa: "myślnik w nazwie",
    dane: { szkola: "Zespół Szkolno-Przedszkolny nr 3", wariant: "45pln", numerPolisy: "679858" },
    oczekiwana: "Zespół Szkolno-Przedszkolny nr 3_45pln_679858.docx",
    po_co: "myślnik jest legalny i MA zostać",
  },
  {
    nazwa: "ukośnik i dwukropek",
    dane: { szkola: "Fundacja IN ALTUM / Oddział: Kraków", wariant: "65pln50", numerPolisy: "679859" },
    oczekiwana: "Fundacja IN ALTUM Oddział Kraków_65pln50_679859.docx",
    po_co: "Windows nie przyjmie takiego pliku",
  },
  {
    nazwa: "cudzysłowy i nawiasy kątowe",
    dane: { szkola: 'Szkoła "Pod Dębem" <filia>', wariant: "45pln", numerPolisy: "679862" },
    oczekiwana: "Szkoła Pod Dębem filia_45pln_679862.docx",
    po_co: "znaki zakazane w nazwie pliku",
  },
  {
    nazwa: "bardzo długa nazwa",
    dane: {
      szkola:
        "Zespół Szkół Techniczno-Informatycznych im. Świętej Jadwigi Królowej w Wielkiej Miejscowości Podkarpackiej",
      wariant: "85pln",
      numerPolisy: "679860",
    },
    po_co: "ścieżka w Windows ma twardy limit — ucinamy na granicy słowa",
  },
  {
    nazwa: "bez szkoły",
    dane: { szkola: null, wariant: "65pln50", numerPolisy: "679861" },
    oczekiwana: "65pln50_679861.docx",
    po_co: "brak nazwy daje dokładnie to, co było wcześniej",
  },
  {
    nazwa: "sama spacja jako nazwa",
    dane: { szkola: "   ", wariant: "65pln50", numerPolisy: null },
    oczekiwana: "65pln50.docx",
    po_co: "pusta nazwa nie może zostawić wiszącego podkreślnika",
  },
  {
    nazwa: "kropka na końcu nazwy",
    dane: { szkola: "Szkoła Podstawowa im. J. Korczaka.", wariant: "45pln", numerPolisy: "679863" },
    po_co: "Windows odrzuca nazwy kończące się kropką",
  },
];

let bledy = 0;
for (const p of przypadki) {
  const wynik = nazwaPlikuPolisy(p.dane);
  const problemy: string[] = [];

  if (p.oczekiwana && wynik !== p.oczekiwana) problemy.push(`oczekiwano „${p.oczekiwana}"`);
  if (ZAKAZANE.test(wynik)) problemy.push("znak zakazany w nazwie pliku");
  if (/[. ]\.docx$/.test(wynik)) problemy.push("kropka albo spacja przed rozszerzeniem");
  if (/__/.test(wynik)) problemy.push("podwójny podkreślnik — pusty człon");
  if (wynik.length > 120) problemy.push(`za długa (${wynik.length} znaków)`);

  if (problemy.length) bledy++;
  console.log(
    `${problemy.length ? "BŁĄD" : "OK  "} (${String(wynik.length).padStart(3)}) ${wynik}` +
      `   // ${p.po_co}${problemy.length ? ` [${problemy.join("; ")}]` : ""}`,
  );
}

console.log(bledy === 0 ? "\nWszystkie przypadki przeszły." : `\n${bledy} przypadków nie przeszło.`);
process.exit(bledy === 0 ? 0 : 1);

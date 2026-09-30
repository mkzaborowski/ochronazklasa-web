/**
 * Sprawdzenie aneksów: `npm run check:aneksy`.
 *
 * Pytanie, na które odpowiada: czy aneks, który wychodzi z programu, mówi
 * szkole właściwą kwotę i wskazuje właściwą polisę. Kwota do zapłaty jest
 * liczona, a nie wpisywana — więc błąd w liczeniu (zwolnieni odjęci dwa razy,
 * grosze zaokrąglone w dół) wyszedłby na KAŻDYM aneksie naraz.
 *
 * Druga połowa sprawdza sam plik Worda: czy żaden {{znacznik}} nie został
 * niewypełniony, czy numer polisy trafił i do tytułu, i do § 2, czy dopisane
 * punkty mają kolejne numery i czy podpis z serwera naprawdę zastąpił zaślepkę.
 *
 * Uruchamia się samym node (strip-types), bez bazy i bez Next.js.
 */
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import {
  doZaplatyGrosze,
  formatujKwote,
  liniaLiczbyUbezpieczonych,
  normalizujNumerPolisy,
  oczyscPunkty,
  parsujKwote,
  rokSzkolnyDla,
  walidujAneks,
  type DaneAneksu,
} from "../src/lib/aneksy/tresc.ts";
import { zlozAneks } from "../src/lib/aneksy/dokument.ts";

let bledy = 0;
const sprawdz = (opis: string, warunek: boolean, szczegol = "") => {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"} ${opis}${szczegol ? `  (${szczegol})` : ""}`);
  if (!warunek) bledy++;
};
// Twarda spacja z formatujKwote na zwykłą — do czytelnych porównań.
const zwykle = (s: string) => s.replace(/ /g, " ");

const BAZA: DaneAneksu = {
  numerAneksu: "3/2026",
  numerPolisy: "679857",
  dataAneksu: "2026-09-30",
  nazwaSzkoly: "Szkoła Podstawowa nr 5 w Słupsku",
  rokSzkolny: "2026-2027",
  liczbaUbezpieczonych: 120,
  liczbaZwolnionych: 0,
  skladkaGrosze: 6500,
  dodatkowePunkty: [],
};

console.log("\n[1] kwoty");
{
  sprawdz("65 zł", parsujKwote("65") === 6500);
  sprawdz("przecinek i kropka to to samo", parsujKwote("42,50") === 4250 && parsujKwote("42.5") === 4250);
  sprawdz("dopisek zł i spacje w tysiącach", parsujKwote("1 250,00 zł") === 125000);
  sprawdz("tekst to nie kwota", parsujKwote("sześćdziesiąt") === null);
  sprawdz("trzy miejsca po przecinku to nie kwota", parsujKwote("65,123") === null);
  sprawdz("okrągła kwota bez groszy", zwykle(formatujKwote(6500)) === "65 zł");
  sprawdz("grosze zostają", zwykle(formatujKwote(4250)) === "42,50 zł");
  sprawdz("tysiące rozdzielone", zwykle(formatujKwote(780000)) === "7 800 zł");
  // 42,5 × 3 w liczbach zmiennoprzecinkowych potrafi dać 127,4999…
  sprawdz("grosze bez błędu zaokrąglenia",
    doZaplatyGrosze({ ...BAZA, liczbaUbezpieczonych: 3, skladkaGrosze: 4250 }) === 12750);
}

console.log("\n[2] punkt 1 § 1 — oba wzory biura");
{
  const bez = zwykle(liniaLiczbyUbezpieczonych(BAZA));
  sprawdz("BEZ ZWOLNIENIA: liczba x składka = kwota",
    bez === "Liczba osób ubezpieczonych w roku 2026-2027: 120 x 65 zł = 7 800 zł", bez);

  const zw = zwykle(liniaLiczbyUbezpieczonych({ ...BAZA, liczbaZwolnionych: 5 }));
  sprawdz("ZWOLNIENIE: całość, zwolnieni, płacący, kwota",
    zw === "Liczba osób ubezpieczonych w roku 2026-2027: 120, w tym: 5 zwolnionych z opłaty " +
      "składki 120 - 5 = 115; 115 x 65 zł = 7 475 zł", zw);
  sprawdz("zwolnieni odjęci raz, nie dwa razy",
    doZaplatyGrosze({ ...BAZA, liczbaZwolnionych: 5 }) === 115 * 6500);
}

console.log("\n[3] numer polisy, rok szkolny, walidacja");
{
  sprawdz("„A-A 679857”", normalizujNumerPolisy("A-A 679857") === "679857");
  sprawdz("„aa679 857”", normalizujNumerPolisy("aa679 857") === "679857");
  sprawdz("same cyfry", normalizujNumerPolisy("679857") === "679857");
  sprawdz("wrzesień zaczyna nowy rok szkolny", rokSzkolnyDla("2026-09-01") === "2026-2027");
  sprawdz("sierpień należy do starego", rokSzkolnyDla("2026-08-31") === "2025-2026");
  sprawdz("marzec", rokSzkolnyDla("2027-03-10") === "2026-2027");
  sprawdz("poprawny aneks przechodzi", walidujAneks(BAZA).length === 0, walidujAneks(BAZA).join("; "));
  sprawdz("zwolnionych więcej niż ubezpieczonych",
    walidujAneks({ ...BAZA, liczbaZwolnionych: 121 }).some((b) => b.includes("więcej")));
  sprawdz("brak numeru aneksu",
    walidujAneks({ ...BAZA, numerAneksu: "  " }).some((b) => b.includes("numer aneksu")));
  sprawdz("nieistniejąca data", walidujAneks({ ...BAZA, dataAneksu: "2026-02-30" }).length === 1);
  sprawdz("puste punkty wypadają", oczyscPunkty(["  ", "Zmiana maila", ""]).length === 1);
}

/** Tekst dokumentu: akapity rozdzielone \n, łamania linii jako ⏎. */
function tekstWorda(docx: Buffer): { tekst: string; xml: string; zip: PizZip } {
  const zip = new PizZip(docx);
  const xml = zip.file("word/document.xml")!.asText();
  const tekst = xml
    .split("</w:p>")
    .map((a) =>
      a
        .replace(/<w:br\/>/g, "⏎")
        .replace(/<w:tab\/>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
    )
    .join("\n");
  return { tekst: zwykle(tekst), xml, zip };
}

console.log("\n[4] plik Worda");
{
  // Podpis w teście to dowolny PNG — liczy się, czy trafił na miejsce zaślepki.
  const podpis = readFileSync("templates/aneksy/logo-interrisk.png");
  const dane: DaneAneksu = {
    ...BAZA,
    liczbaZwolnionych: 5,
    dodatkowePunkty: ["Zmiana adresu e-mail szkoły na sekretariat@sp5.pl", "Zmiana telefonu:\n59 842 11 22"],
  };
  const { tekst, xml, zip } = tekstWorda(zlozAneks(dane, podpis));

  sprawdz("żaden {{znacznik}} nie został", !tekst.includes("{{") && !tekst.includes("}}"));
  sprawdz("tytuł z numerem i datą", tekst.includes("Aneks nr 3/2026 z dnia 30.09.2026"));
  sprawdz("numer polisy pod tytułem", tekst.includes("do polisy A-A 679857"));
  sprawdz("ten sam numer w § 2", tekst.includes("integralną całość z polisą A-A 679857."));
  sprawdz("data pod § 3 = data aneksu", tekst.includes("Olsztyn, dnia 30.09.2026"));
  sprawdz("nazwa szkoły", tekst.includes("Szkoła Podstawowa nr 5 w Słupsku"));
  sprawdz("wyliczenie ze zwolnionymi", tekst.includes("115 x 65 zł = 7 475 zł"));
  sprawdz("korekta oświadczenia zawsze jest", tekst.includes("2. Korekta pkt 1 Oświadczenia"));

  const i3 = tekst.indexOf("3. Zmiana adresu e-mail");
  const i4 = tekst.indexOf("4. Zmiana telefonu");
  const iKorekta = tekst.indexOf("2. Korekta pkt 1");
  const iPozostale = tekst.indexOf("Pozostałe warunki ubezpieczenia nie ulegają zmianie.");
  const iPar2 = tekst.indexOf("§ 2");
  sprawdz("dopisane punkty mają numery 3 i 4", i3 > 0 && i4 > 0);
  sprawdz("kolejność: korekta → dopisane → „Pozostałe warunki” → § 2",
    iKorekta < i3 && i3 < i4 && i4 < iPozostale && iPozostale < iPar2);
  sprawdz("nowa linia w punkcie zostaje nową linią", tekst.includes("Zmiana telefonu:⏎59 842 11 22"));
  sprawdz("podpis z serwera zastąpił zaślepkę",
    zip.file("word/media/podpis.png")!.asNodeBuffer().equals(podpis));
  sprawdz("obraz podpisu jest w treści", xml.includes('r:embed="rIdPodpis"'));
}

console.log("\n[5] aneks bez dopisanych punktów i bez podpisu na serwerze");
{
  const zaslepka = readFileSync("templates/aneksy/podpis-zaslepka.png");
  const { tekst, zip } = tekstWorda(zlozAneks(BAZA, null));
  sprawdz("żaden {{znacznik}} nie został", !tekst.includes("{{"));
  sprawdz("nie ma pustego punktu 3", !/\n3\./.test(tekst));
  sprawdz("zaraz po oświadczeniu „Pozostałe warunki”",
    tekst.indexOf("pozasądowego rozpatrywania sporów.") < tekst.indexOf("Pozostałe warunki"));
  sprawdz("bez podpisu zostaje przezroczysta zaślepka",
    zip.file("word/media/podpis.png")!.asNodeBuffer().equals(zaslepka));
  sprawdz("kwota bez zwolnień", tekst.includes("120 x 65 zł = 7 800 zł"));
}

console.log(bledy === 0 ? "\nWszystkie sprawdzenia przeszły." : `\n${bledy} sprawdzeń nie przeszło.`);
process.exit(bledy === 0 ? 0 : 1);

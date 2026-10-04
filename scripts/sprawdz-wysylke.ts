/**
 * Sprawdzenie okresów automatycznej wysyłki: `npm run check:wysylka`.
 *
 * Zła granica miesiąca niczego nie wywala — po prostu zgłasza ubezpieczycielowi
 * sprzedaż z innego okresu albo gubi kilka dni. Wychodzi dopiero wtedy, gdy
 * ktoś po stronie centrali porówna sumy, czyli miesiąc za późno.
 */
import { okresDlaDnia, nazwaZestawu, plusDni, wOkresie } from "../src/lib/interrisk/okres.ts";

let bledy = 0;
const sprawdz = (opis: string, warunek: boolean, szczegol = "") => {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"} ${opis}${szczegol ? "  (" + szczegol + ")" : ""}`);
  if (!warunek) bledy++;
};

console.log("\n[1] poprzedni pełny miesiąc");
{
  const o = okresDlaDnia("2026-10-05", 1);
  sprawdz("5 X 2026 → wrzesień", o.od === "2026-09-01" && o.do === "2026-09-30", `${o.od} – ${o.do}`);
  sprawdz("etykieta 2026-09", o.etykieta === "2026-09", o.etykieta);
}

console.log("\n[2] miesiące o różnej długości");
{
  for (const [dzis, od, do_] of [
    ["2026-03-05", "2026-02-01", "2026-02-28"], // luty zwykły
    ["2024-03-05", "2024-02-01", "2024-02-29"], // luty przestępny
    ["2026-05-05", "2026-04-01", "2026-04-30"],
    ["2026-08-05", "2026-07-01", "2026-07-31"],
  ] as const) {
    const o = okresDlaDnia(dzis, 1);
    sprawdz(`${dzis} → ${od} – ${do_}`, o.od === od && o.do === do_, `${o.od} – ${o.do}`);
  }
}

console.log("\n[3] przełom roku");
{
  const o = okresDlaDnia("2027-01-05", 1);
  sprawdz("styczeń 2027 → grudzień 2026", o.od === "2026-12-01" && o.do === "2026-12-31",
    `${o.od} – ${o.do}`);
}

console.log("\n[4] dzień 31 nie przewija miesiąca");
{
  // „31 marca minus miesiąc" w naiwnej arytmetyce JS daje 3 marca, bo 31 lutego
  // nie istnieje. Wtedy paczka objęłaby luty+marzec zamiast samego lutego.
  const o = okresDlaDnia("2026-03-31", 1);
  sprawdz("31 III 2026 → luty, nie marzec", o.od === "2026-02-01" && o.do === "2026-02-28",
    `${o.od} – ${o.do}`);
  const m = okresDlaDnia("2026-05-31", 1);
  sprawdz("31 V 2026 → kwiecień", m.od === "2026-04-01" && m.do === "2026-04-30", `${m.od} – ${m.do}`);
}

console.log("\n[5] więcej miesięcy wstecz");
{
  const o = okresDlaDnia("2026-10-05", 2);
  sprawdz("2 miesiące wstecz → sierpień", o.od === "2026-08-01" && o.do === "2026-08-31",
    `${o.od} – ${o.do}`);
  const r = okresDlaDnia("2026-02-05", 3);
  sprawdz("3 miesiące wstecz przez rok → listopad 2025",
    r.od === "2025-11-01" && r.do === "2025-11-30", `${r.od} – ${r.do}`);
}

console.log("\n[6] okresy nie zachodzą na siebie i nie zostawiają dziur");
{
  // Dwanaście kolejnych wysyłek musi pokryć rok co do dnia: koniec jednego
  // okresu i początek następnego mają się stykać.
  const okresy = Array.from({ length: 12 }, (_, i) =>
    okresDlaDnia(`2026-${String(i + 1).padStart(2, "0")}-05`, 1));
  let ciagle = true;
  for (let i = 1; i < okresy.length; i++) {
    const poprzedniKoniec = new Date(`${okresy[i - 1].do}T00:00:00Z`);
    poprzedniKoniec.setUTCDate(poprzedniKoniec.getUTCDate() + 1);
    if (poprzedniKoniec.toISOString().slice(0, 10) !== okresy[i].od) ciagle = false;
  }
  sprawdz("dwanaście wysyłek pokrywa rok bez dziur", ciagle,
    okresy.map((o) => o.etykieta).join(" "));
  sprawdz("każdy okres ma inną etykietę", new Set(okresy.map((o) => o.etykieta)).size === 12);
}

console.log("\n[7] nazwa zestawu i termin płatności");
{
  sprawdz("nazwa z dnia wysyłki", nazwaZestawu("2026-10-05") === "ZESTAW 05.10.2026",
    nazwaZestawu("2026-10-05"));
  sprawdz("14 dni od 5 X to 19 X", plusDni("2026-10-05", 14) === "2026-10-19", plusDni("2026-10-05", 14));
  sprawdz("przez koniec miesiąca", plusDni("2026-10-25", 14) === "2026-11-08", plusDni("2026-10-25", 14));
  sprawdz("przez koniec roku", plusDni("2026-12-25", 14) === "2027-01-08", plusDni("2026-12-25", 14));
  // Zmiana czasu: ostatnia niedziela października. Doba „na południe UTC"
  // przechodzi przez nią bez gubienia ani dokładania dnia.
  sprawdz("przez zmianę czasu", plusDni("2026-10-24", 3) === "2026-10-27", plusDni("2026-10-24", 3));
}

console.log("\n[8] granice okresu są włączne");
{
  const o = okresDlaDnia("2026-10-05", 1);
  sprawdz("1 września wchodzi", wOkresie("2026-09-01", o));
  sprawdz("30 września wchodzi", wOkresie("2026-09-30", o));
  sprawdz("31 sierpnia nie wchodzi", !wOkresie("2026-08-31", o));
  sprawdz("1 października nie wchodzi", !wOkresie("2026-10-01", o));
}

console.log(bledy === 0 ? "\nOkresy się zgadzają." : `\n${bledy} niezgodności.`);
process.exit(bledy === 0 ? 0 : 1);

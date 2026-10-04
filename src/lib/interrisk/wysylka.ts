import { db } from "@/lib/db";
import { dzienWarszawski } from "@/lib/statystyki/dzienne";
import { paczkaRozliczen } from "@/lib/interrisk/paczka";
import { nazwaZestawu, okresDlaDnia, plusDni } from "@/lib/interrisk/okres";
import { PROWIZJA_PROCENT as PROWIZJA } from "@/lib/interrisk/rozliczenie-kody";
import { wyslijList, pocztaSkonfigurowana } from "@/lib/powiadomienia/poczta";

/**
 * Automatyczna wysyłka paczki rozliczeniowej do centrali.
 *
 * Wołane z crona co dziesięć minut, tą samą drogą co powiadomienia o sprzedaży.
 * Zadanie samo pilnuje, czy ma dziś coś wysłać — cron trzyma tylko rytm.
 *
 * DWA ZABEZPIECZENIA PRZED PODWÓJNĄ WYSYŁKĄ, bo to jest list do ubezpieczyciela
 * z załącznikiem, a nie powiadomienie: `ostatniOkres` w bazie odcina drugi
 * przebieg tego samego miesiąca, a klucz idempotencji w usłudze pocztowej
 * odcina duplikat, gdyby zapis do bazy nie zdążył się wykonać.
 */

export const ID_USTAWIEN = "domyslne";

export interface UstawieniaWysylki {
  wlaczona: boolean;
  odbiorcy: string[];
  dzienWysylki: number;
  miesiecyWstecz: number;
  dniDoPlatnosci: number;
  ostatniOkres: string | null;
  ostatniBlad: string | null;
  ostatniaProba: Date | null;
}

export const DOMYSLNE: UstawieniaWysylki = {
  wlaczona: false,
  odbiorcy: [],
  dzienWysylki: 5,
  miesiecyWstecz: 1,
  dniDoPlatnosci: 14,
  ostatniOkres: null,
  ostatniBlad: null,
  ostatniaProba: null,
};

export async function ustawieniaWysylki(): Promise<UstawieniaWysylki> {
  const w = await db.wysylkaRozliczenia.findUnique({ where: { id: ID_USTAWIEN } });
  return w ? { ...w, odbiorcy: w.odbiorcy ?? [] } : DOMYSLNE;
}

export interface WynikWysylki {
  stan: "wyslano" | "pominieto" | "blad";
  powod?: string;
  okres?: string;
  odbiorcy?: string[];
  wariantow?: number;
  osob?: number;
}

/**
 * Jeden przebieg zadania.
 *
 * `naSile` pomija sprawdzenie dnia i znacznika „już wysłane" — to jest przycisk
 * „wyślij teraz" w panelu. Reszta zabezpieczeń zostaje: bez odbiorców i bez
 * skonfigurowanej poczty nie wysyłamy nawet na żądanie.
 */
export async function wyslijRozliczenie(opcje: { naSile?: boolean; dzis?: string } = {}): Promise<WynikWysylki> {
  const u = await ustawieniaWysylki();
  const dzis = opcje.dzis ?? dzienWarszawski(new Date());

  if (!opcje.naSile && !u.wlaczona) return { stan: "pominieto", powod: "wysyłka wyłączona" };
  if (u.odbiorcy.length === 0) return { stan: "pominieto", powod: "brak odbiorców" };
  if (!pocztaSkonfigurowana()) return { stan: "pominieto", powod: "poczta nieskonfigurowana" };

  const dzienMiesiaca = Number(dzis.slice(8, 10));
  if (!opcje.naSile && dzienMiesiaca !== u.dzienWysylki) {
    return { stan: "pominieto", powod: `dziś ${dzienMiesiaca}, wysyłka ${u.dzienWysylki}. dnia` };
  }

  const okres = okresDlaDnia(dzis, u.miesiecyWstecz);
  if (!opcje.naSile && u.ostatniOkres === okres.etykieta) {
    return { stan: "pominieto", powod: `okres ${okres.etykieta} już wysłany` };
  }

  try {
    const zestaw = {
      nazwaKorekty: nazwaZestawu(dzis),
      // Aneks datujemy na koniec rozliczanego okresu, płatność na ustaloną
      // liczbę dni od wysyłki — tak samo, jak biuro wpisywało to ręcznie.
      dataAneksu: new Date(`${okres.do}T12:00:00`),
      dataPlatnosci: new Date(`${plusDni(dzis, u.dniDoPlatnosci)}T12:00:00`),
    };
    const paczka = await paczkaRozliczen(okres, zestaw);

    const pln = (x: number) =>
      x.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
    const z = paczka.zestawienie;
    const linie = z.wiersze.map(
      (w) =>
        `  ${w.numerPolisy} (${w.skladkaJednostkowaZl} zł) — ${w.osob} osób, ` +
        `składka ${pln(w.skladkaLacznieZl)}, prowizja ${pln(w.prowizjaZl)}`,
    );
    // Kwoty w treści, nie tylko w załączniku: osoba uzgadniająca rozliczenie
    // najpierw czyta maila, a dopiero potem otwiera arkusz — jeśli w ogóle.
    const podsumowanie = [
      "",
      `Składka łącznie:  ${pln(z.sumy.skladkaZl)}`,
      `Prowizja (${PROWIZJA}%):   ${pln(z.sumy.prowizjaZl)}`,
      `Do przekazania:   ${pln(z.sumy.doPrzekazaniaZl)}`,
    ];
    const uwagi = z.rozbieznosci.length
      ? ["", `UWAGA: ${z.rozbieznosci.length} wniosków z inną wpłatą niż składka polisy — wyjaśniamy po naszej stronie.`]
      : [];
    const ostrzezenia = paczka.pominieto.length
      ? ["", "UWAGA, pominięte warianty:", ...paczka.pominieto.map((p) => `  ${p.wariantId} — ${p.powod}`)]
      : [];

    await wyslijList({
      do: u.odbiorcy.join(", "),
      temat: `Rozliczenie online ${okres.etykieta} — ${zestaw.nazwaKorekty}`,
      tresc: [
        "Dzień dobry,",
        "",
        `w załączeniu rozliczenie sprzedaży online za okres ${okres.od} – ${okres.do}.`,
        "",
        `Plików w paczce: ${paczka.warianty.length + 1} (arkusze osobowe i zestawienie finansowe),`,
        `ubezpieczonych łącznie: ${paczka.osobLacznie}.`,
        "",
        ...linie,
        ...podsumowanie,
        ...uwagi,
        ...ostrzezenia,
        "",
        "Wiadomość wysłana automatycznie z panelu Ochrona z Klasą.",
      ].join("\n"),
      zalaczniki: [{ nazwa: paczka.nazwa, typ: "application/zip", dane: paczka.bytes }],
      kluczIdempotencji: `rozliczenie:${okres.etykieta}`,
    });

    await zapisz({ ostatniOkres: okres.etykieta, ostatniBlad: null, ostatniaProba: new Date() });
    return {
      stan: "wyslano",
      okres: okres.etykieta,
      odbiorcy: u.odbiorcy,
      wariantow: paczka.warianty.length,
      osob: paczka.osobLacznie,
    };
  } catch (e) {
    const powod = e instanceof Error ? e.message : String(e);
    // Błędu NIE zapisujemy jako „okres wysłany" — zadanie spróbuje ponownie
    // przy następnym przebiegu crona, a biuro widzi powód w panelu.
    await zapisz({ ostatniBlad: powod, ostatniaProba: new Date() });
    return { stan: "blad", powod, okres: okres.etykieta };
  }
}

async function zapisz(dane: { ostatniOkres?: string | null; ostatniBlad: string | null; ostatniaProba: Date }) {
  await db.wysylkaRozliczenia.upsert({
    where: { id: ID_USTAWIEN },
    update: dane,
    create: { id: ID_USTAWIEN, ...DOMYSLNE, ...dane },
  });
}

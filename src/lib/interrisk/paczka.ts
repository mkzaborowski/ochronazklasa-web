import PizZip from "pizzip";
import { dzienSprzedazy, pobierzRozliczenie, type WierszRozliczeniaApi } from "@/lib/online-api";
import {
  nazwaPlikuRozliczenia,
  plikRozliczenia,
  type OsobaDoRozliczenia,
} from "@/lib/interrisk/rozliczenie";
import { wOkresie } from "@/lib/interrisk/okres";
import { zestawienieFinansowe, type Zestawienie } from "@/lib/interrisk/zestawienie";
import { KONFIGURACJA, nazwaPlikuZestawienia, plikZestawienia } from "@/lib/interrisk/zestawienie-plik";
import {
  PODRYZYKA_WARIANTU,
  problemyKonfiguracji,
  PROWIZJA_PROCENT,
  UPRAWNIONY,
} from "@/lib/interrisk/rozliczenie-kody";

/**
 * Paczka rozliczeniowa: po jednym pliku na wariant, spięte w jeden zip.
 *
 * JEDEN PLIK NA POLISĘ GRUPOWĄ to wymóg szablonu — w kolumnie „numer polisy"
 * stoi jedna wartość na cały plik. U nas każdy wariant to osobna polisa, więc
 * biuro pobierało pięć plików po kolei, pięć razy wpisując te same trzy pola.
 * Paczka robi to raz.
 *
 * OKRES JEST OBOWIĄZKOWY, nie opcjonalny. Wcześniej plik brał WSZYSTKIE
 * wystawione certyfikaty od początku sprzedaży — przy jednorazowym rozliczeniu
 * to przechodziło, ale przy wysyłce co miesiąc oznaczałoby, że za każdym razem
 * zgłaszamy centrali całą historię od nowa. Dzień bierzemy ze sprzedaży, nie
 * z wystawienia certyfikatu (patrz `dzienSprzedazy`).
 */

export interface OkresRozliczenia {
  /** „2026-09-01", włącznie */
  od: string;
  /** „2026-09-30", włącznie */
  do: string;
}

export interface ZestawRozliczenia {
  /** np. „ZESTAW 01.10.2026" */
  nazwaKorekty: string;
  dataAneksu: Date;
  dataPlatnosci: Date;
}

export interface WariantWPaczce {
  wariantId: string;
  numerPolisy: string;
  osob: number;
  wierszy: number;
  nazwaPliku: string;
}

export interface Paczka {
  bytes: Buffer;
  nazwa: string;
  warianty: WariantWPaczce[];
  /** warianty ze sprzedażą, których NIE dało się złożyć — z powodem */
  pominieto: { wariantId: string; powod: string }[];
  osobLacznie: number;
  /** podsumowanie finansowe tej samej sprzedaży — leży w paczce jako osobny plik */
  zestawienie: Zestawienie;
}

/** Sprzedaż z okresu, pogrupowana po wariancie. Kolejność jak w pliku. */
export function wgWariantow(
  wiersze: WierszRozliczeniaApi[],
  okres: OkresRozliczenia,
): Map<string, WierszRozliczeniaApi[]> {
  const wg = new Map<string, WierszRozliczeniaApi[]>();
  for (const w of wiersze) {
    if (!wOkresie(dzienSprzedazy(w), okres)) continue;
    const lista = wg.get(w.wariantId) ?? [];
    lista.push(w);
    wg.set(w.wariantId, lista);
  }
  return wg;
}

const osoba = (w: WierszRozliczeniaApi): OsobaDoRozliczenia => ({
  numerPolisy: w.numerPolisy,
  imie: w.imie,
  nazwisko: w.nazwisko,
  pesel: w.pesel,
  dataUrodzenia: w.dataUrodzenia,
  okresOd: w.okresOd,
  okresDo: w.okresDo,
});

/** Plik dla jednego wariantu. Rzuca, gdy konfiguracja na to nie pozwala. */
export async function plikWariantu(
  wariantId: string,
  wiersze: WierszRozliczeniaApi[],
  zestaw: ZestawRozliczenia,
): Promise<{ bytes: Buffer; nazwa: string; numerPolisy: string }> {
  const problemy = problemyKonfiguracji([wariantId]);
  if (problemy.length > 0) throw new Error(problemy.map((p) => p.powod).join("; "));

  const numerPolisy = wiersze[0]?.numerPolisy ?? "";
  const bytes = await plikRozliczenia(wiersze.map(osoba), {
    ...zestaw,
    uprawniony: UPRAWNIONY,
    prowizjaProcent: PROWIZJA_PROCENT,
    podryzyka: PODRYZYKA_WARIANTU[wariantId] ?? [],
  });
  return { bytes, nazwa: nazwaPlikuRozliczenia(numerPolisy, zestaw.nazwaKorekty), numerPolisy };
}

/**
 * Buduje paczkę za okres.
 *
 * Wariant bez sprzedaży w okresie po prostu nie wchodzi do zipa — pusty arkusz
 * z samym nagłówkiem nie jest rozliczeniem, a centrala musiałaby zgadywać, czy
 * to znaczy „zero sprzedaży", czy „coś się zepsuło". Wariant ze sprzedażą,
 * którego nie da się złożyć, trafia do `pominieto` z powodem — i to jest
 * sytuacja, o której trzeba komuś powiedzieć, a nie przemilczeć ją.
 */
export async function paczkaRozliczen(
  okres: OkresRozliczenia,
  zestaw: ZestawRozliczenia,
): Promise<Paczka> {
  const { wiersze } = await pobierzRozliczenie();
  const wg = wgWariantow(wiersze, okres);

  const zip = new PizZip();
  const warianty: WariantWPaczce[] = [];
  const pominieto: { wariantId: string; powod: string }[] = [];
  let osobLacznie = 0;

  // Kolejność po składce, żeby zip za każdym razem wyglądał tak samo.
  const kolejnosc = [...wg.entries()].sort(
    (a, b) => (a[1][0]?.skladkaZl ?? 0) - (b[1][0]?.skladkaZl ?? 0),
  );

  for (const [wariantId, dlaWariantu] of kolejnosc) {
    try {
      const { bytes, nazwa, numerPolisy } = await plikWariantu(wariantId, dlaWariantu, zestaw);
      zip.file(nazwa, bytes);
      warianty.push({
        wariantId,
        numerPolisy,
        osob: dlaWariantu.length,
        wierszy: dlaWariantu.length * (PODRYZYKA_WARIANTU[wariantId]?.length ?? 0),
        nazwaPliku: nazwa,
      });
      osobLacznie += dlaWariantu.length;
    } catch (e) {
      pominieto.push({ wariantId, powod: e instanceof Error ? e.message : String(e) });
    }
  }

  // Zestawienie liczone z TYCH SAMYCH wierszy, co arkusze wyżej — stąd `wg`,
  // a nie drugie zapytanie. Wchodzi do paczki tylko dla wariantów, które
  // naprawdę się złożyły, żeby podsumowanie nie opisywało pliku, którego nie ma.
  const zlozone = new Map([...wg.entries()].filter(([id]) => warianty.some((w) => w.wariantId === id)));
  const zestawienie = zestawienieFinansowe(zlozone, okres, KONFIGURACJA);
  if (warianty.length > 0) {
    zip.file(nazwaPlikuZestawienia(zestaw.nazwaKorekty), await plikZestawienia(zestawienie, zestaw));
  }

  if (warianty.length === 0) {
    throw new Error(
      pominieto.length > 0
        ? `Żadnego wariantu nie dało się złożyć: ${pominieto.map((p) => `${p.wariantId} — ${p.powod}`).join("; ")}`
        : `Brak wystawionych certyfikatów z potwierdzoną płatnością w okresie ${okres.od} – ${okres.do}.`,
    );
  }

  return {
    bytes: zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer,
    nazwa: nazwaPaczki(zestaw.nazwaKorekty),
    warianty,
    pominieto,
    osobLacznie,
    zestawienie,
  };
}

/** „Rozliczenie ZESTAW 01.10.2026.zip" */
export function nazwaPaczki(nazwaKorekty: string): string {
  const czysty = nazwaKorekty
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `Rozliczenie ${czysty}.zip`.replace(/ +/g, " ");
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Walidacja parametrów pobierania — wspólna dla pliku i dla paczki, żeby obie
 * trasy odmawiały z tego samego powodu i tymi samymi słowami.
 */
export function sprawdzParametry(p: {
  nazwaKorekty: string;
  dataAneksu: string;
  dataPlatnosci: string;
  od: string;
  do: string;
}): string | null {
  if (!p.nazwaKorekty) return "Podaj nazwę zestawu";
  if (!DATA.test(p.dataAneksu) || !DATA.test(p.dataPlatnosci)) {
    return "Podaj daty aneksu i płatności";
  }
  if (!DATA.test(p.od) || !DATA.test(p.do)) return "Podaj okres rozliczenia";
  if (p.od > p.do) return "Początek okresu jest późniejszy niż koniec";
  return null;
}

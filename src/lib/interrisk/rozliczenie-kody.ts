/**
 * Rozbicie wariantów na podryzyka — wsad do pliku rozliczeniowego InterRisk.
 *
 * TO NIE JEST „JEDEN KOD NA WARIANT". Tak to wygląda w pliku przysłanym przez
 * centralę: 918 ubezpieczonych daje 5833 wiersze, czyli ponad sześć wierszy na
 * osobę. Każdy wiersz to JEDNO PODRYZYKO — osobny kod taryfowy, osobny klucz
 * statystyczny, własna suma ubezpieczenia i własna składka. Składki podryzyk
 * sumują się do tego, co klient zapłacił:
 *
 *   016818BK    SU  20 000   51,00 zł
 *   028018BK    SU  20 000   12,00 zł
 *   02153018BK  SU   4 000    4,10 zł
 *   02156018BK  SU  15 000    9,50 zł
 *   184118BK    SU   5 000    1,20 zł
 *   18080018BK  SU   5 000    1,20 zł
 *   ─────────────────────────────────
 *   jedna osoba              79,00 zł
 *
 * DLATEGO POTRZEBUJEMY OD CENTRALI TABELI, a nie pojedynczych kodów: dla
 * każdego naszego wariantu (60, 90, 135, 180, 250 zł) listy podryzyk z kodem,
 * kluczem, sumą i składką.
 *
 * Suma składek podryzyk MUSI się zgadzać ze składką wariantu. Panel i
 * `npm run check:rozliczenie` pilnują tego osobno — rozjazd znaczyłby, że
 * rozliczamy z ubezpieczycielem inną kwotę, niż pobraliśmy od rodzica,
 * a sumy zbiorcze i tak by się zgadzały i nikt by tego nie zauważył.
 */

export interface Podryzyko {
  /** np. „016818BK" — zaczyna się od zera, więc w pliku zawsze jako tekst */
  kodTaryfowy: string;
  /** np. „00711111101111070X" */
  kluczStatystyczny: string;
  /** suma ubezpieczenia TEGO podryzyka, nie całego wariantu */
  sumaUbezpieczenia: number;
  /** składka TEGO podryzyka; suma po wariancie = składka wariantu */
  skladkaZl: number;
}

/**
 * Klucz to identyfikator wariantu z ozk-api (w60, w90, w135, w180, w250).
 * Pusta lista = centrala jeszcze nie podała rozbicia dla tego wariantu.
 */
export const PODRYZYKA_WARIANTU: Record<string, Podryzyko[]> = {
  w60: [],
  w90: [],
  w135: [],
  w180: [],
  w250: [],
};

/**
 * Pośrednik i jego prowizja — jedna para dla całej agencji, ustalona
 * z centralą i niezmienna między rozliczeniami.
 */
export const UPRAWNIONY = "02/3008";
export const PROWIZJA_PROCENT = 40;

/** Składki wariantów — do sprawdzenia, czy rozbicie się z nimi zgadza. */
export const SKLADKI_WARIANTOW: Record<string, number> = {
  w60: 60,
  w90: 90,
  w135: 135,
  w180: 180,
  w250: 250,
};

export interface ProblemKonfiguracji {
  wariantId: string;
  powod: string;
}

/**
 * Czy da się już rozliczyć podane warianty.
 *
 * Sprawdzamy dwie rzeczy, bo obie kończą się błędnym rozliczeniem, a żadnej
 * nie widać po samym pliku: brak rozbicia i rozbicie, które nie sumuje się do
 * składki wariantu.
 */
export function problemyKonfiguracji(warianty: string[]): ProblemKonfiguracji[] {
  const problemy: ProblemKonfiguracji[] = [];
  for (const wariantId of warianty) {
    const lista = PODRYZYKA_WARIANTU[wariantId] ?? [];
    if (lista.length === 0) {
      problemy.push({ wariantId, powod: "brak rozbicia na podryzyka" });
      continue;
    }
    const brakKodu = lista.some(
      (p) => !p.kodTaryfowy.trim() || !p.kluczStatystyczny.trim(),
    );
    if (brakKodu) {
      problemy.push({ wariantId, powod: "podryzyko bez kodu taryfowego lub klucza" });
      continue;
    }
    const suma = lista.reduce((s, p) => s + p.skladkaZl, 0);
    const oczekiwana = SKLADKI_WARIANTOW[wariantId];
    // Grosze: porównanie liczb zmiennoprzecinkowych wprost potrafi odrzucić
    // poprawne rozbicie (0,1 + 0,2 !== 0,3).
    if (oczekiwana !== undefined && Math.round(suma * 100) !== Math.round(oczekiwana * 100)) {
      problemy.push({
        wariantId,
        powod: `podryzyka sumują się do ${suma.toFixed(2)} zł zamiast ${oczekiwana.toFixed(2)} zł`,
      });
    }
  }
  return problemy;
}

/**
 * Rozbicie wariantów na podryzyka — wsad do pliku rozliczeniowego InterRisk.
 *
 * TO NIE JEST „JEDEN KOD NA WARIANT". Tak to wygląda w pliku przysłanym przez
 * centralę: 918 ubezpieczonych daje 5833 wiersze, czyli ponad sześć wierszy na
 * osobę. Każdy wiersz to JEDNO PODRYZYKO — osobny kod taryfowy, osobny klucz
 * statystyczny, własna suma ubezpieczenia i własna składka. Składki podryzyk
 * sumują się do tego, co klient zapłacił.
 *
 * Kody i składki niżej są przepisane z pięciu arkuszy przysłanych przez
 * centralę („60 zł / 90 ZŁ / 135 ZŁ / 180 / 250 Plik do rozliczeń online.xlsx"),
 * po jednym na wariant. We wszystkich pięciu ten sam zestaw sześciu podryzyk —
 * różnią się wyłącznie składki. Dlatego trzymamy to jako JEDNĄ tabelę ze
 * składką na wariant, a nie pięć osobnych list: przy pięciu kopiach jedna
 * literówka w kodzie siedziałaby w kodzie tylko dla jednego wariantu i wyszła
 * dopiero przy imporcie u ubezpieczyciela.
 *
 * Suma składek podryzyk MUSI się zgadzać ze składką wariantu. Panel i
 * `npm run check:rozliczenie` pilnują tego osobno — rozjazd znaczyłby, że
 * rozliczamy z ubezpieczycielem inną kwotę, niż pobraliśmy od rodzica,
 * a sumy zbiorcze i tak by się zgadzały i nikt by tego nie zauważył.
 */

export interface Podryzyko {
  /** np. „016818BK" — zaczyna się od zera, więc w pliku zawsze jako tekst */
  kodTaryfowy: string;
  /** np. „12201110100100070X" */
  kluczStatystyczny: string;
  /**
   * Suma ubezpieczenia TEGO podryzyka, jeśli centrala ją poda.
   *
   * `null` — i tak jest dziś dla wszystkich sześciu — znaczy „weź sumę
   * ubezpieczenia wariantu", czyli tę wydrukowaną na certyfikacie: 29 000 zł
   * przy 60 zł składki, 150 000 zł przy 250 zł. W arkuszach z kodami centrala
   * zostawiła kolumny „Suma Ubezpieczenia (PLN)" puste, a system tę liczbę ma
   * i podaje ją klientowi, więc bierzemy ją stamtąd zamiast zgadywać.
   *
   * UWAGA NA PRZYSZŁOŚĆ: w przykładowym pliku z centrali (pakiet 79 zł) cztery
   * z sześciu podryzyk miały sumy INNE niż suma polisy — 4 000, 15 000, 5 000
   * i 5 000 przy polisie na 20 000. Jeśli centrala poda takie rozbicie i dla
   * naszych wariantów, wpisuje się je tutaj i ma pierwszeństwo.
   */
  sumaUbezpieczenia: number | null;
  /** składka TEGO podryzyka; suma po wariancie = składka wariantu */
  skladkaZl: number;
}

/** Wariant → składka podryzyka. Klucze jak w ozk-api. */
type SkladkiNaWariant = Record<string, number>;

interface WierszTabeli {
  kodTaryfowy: string;
  kluczStatystyczny: string;
  sumaUbezpieczenia: number | null;
  skladki: SkladkiNaWariant;
}

/**
 * Sześć składników pakietu EDU Plus, wprost z arkuszy centrali.
 *
 * Dwa ostatnie mają składkę stałą niezależnie od wariantu (1,10 i 1,20 zł) —
 * tak jest w każdym z pięciu arkuszy i nie jest to przeoczenie.
 */
const TABELA: WierszTabeli[] = [
  {
    kodTaryfowy: "016818BK",
    kluczStatystyczny: "12201110100100070X",
    sumaUbezpieczenia: null,
    skladki: { w60: 43.1, w90: 68.7, w135: 107.3, w180: 145.9, w250: 206.1 },
  },
  {
    // W arkuszu 90 zł stoi tu „28018BK", bez wiodącego zera — w pozostałych
    // czterech „028018BK", przy tym samym kluczu statystycznym. To jest zgubione
    // zero (Excel robi to kodom wpisanym jako liczba), a nie inny kod, więc
    // wpisujemy wersję z czterech arkuszy. Biuro ma to potwierdzić w centrali.
    kodTaryfowy: "028018BK",
    kluczStatystyczny: "12200070X",
    sumaUbezpieczenia: null,
    skladki: { w60: 6.2, w90: 9.8, w135: 16.0, w180: 22.2, w250: 31.9 },
  },
  {
    kodTaryfowy: "02153018BK",
    kluczStatystyczny: "11070X",
    sumaUbezpieczenia: null,
    skladki: { w60: 2.7, w90: 3.0, w135: 3.2, w180: 3.4, w250: 3.5 },
  },
  {
    kodTaryfowy: "02156018BK",
    kluczStatystyczny: "10070X",
    sumaUbezpieczenia: null,
    skladki: { w60: 5.7, w90: 6.2, w135: 6.2, w180: 6.2, w250: 6.2 },
  },
  {
    kodTaryfowy: "184118BK",
    kluczStatystyczny: "070X",
    sumaUbezpieczenia: null,
    skladki: { w60: 1.1, w90: 1.1, w135: 1.1, w180: 1.1, w250: 1.1 },
  },
  {
    kodTaryfowy: "18080018BK",
    kluczStatystyczny: "00",
    sumaUbezpieczenia: null,
    skladki: { w60: 1.2, w90: 1.2, w135: 1.2, w180: 1.2, w250: 1.2 },
  },
];

/** Składki wariantów — do sprawdzenia, czy rozbicie się z nimi zgadza. */
export const SKLADKI_WARIANTOW: Record<string, number> = {
  w60: 60,
  w90: 90,
  w135: 135,
  w180: 180,
  w250: 250,
};

/**
 * Klucz to identyfikator wariantu z ozk-api (w60, w90, w135, w180, w250).
 * Pusta lista = centrala nie podała rozbicia dla tego wariantu.
 */
export const PODRYZYKA_WARIANTU: Record<string, Podryzyko[]> = Object.fromEntries(
  Object.keys(SKLADKI_WARIANTOW).map((wariantId) => [
    wariantId,
    TABELA.filter((w) => w.skladki[wariantId] !== undefined).map((w) => ({
      kodTaryfowy: w.kodTaryfowy,
      kluczStatystyczny: w.kluczStatystyczny,
      sumaUbezpieczenia: w.sumaUbezpieczenia,
      skladkaZl: w.skladki[wariantId],
    })),
  ]),
);

/**
 * Pośrednik i jego prowizja — jedna para dla całej agencji, ustalona
 * z centralą i niezmienna między rozliczeniami.
 */
export const UPRAWNIONY = "02/3008";
export const PROWIZJA_PROCENT = 40;

export interface ProblemKonfiguracji {
  wariantId: string;
  powod: string;
}

/**
 * Czy da się już rozliczyć podane warianty.
 *
 * Każdy z tych przypadków kończy się błędnym rozliczeniem i żadnego nie widać
 * po samym pliku — arkusz wygląda poprawnie, wywraca się dopiero import albo,
 * gorzej, nie wywraca się wcale i rozliczamy złe dane.
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
    // Zgodność składek sprawdzamy ZAWSZE, nawet gdy brakuje sum ubezpieczenia.
    // Inaczej brak sumy — dziś prawdziwy dla wszystkich wariantów — zasłaniałby
    // rozjazd składek, czyli jedyny problem dotykający wprost pieniędzy.
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

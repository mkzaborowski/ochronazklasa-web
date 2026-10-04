/**
 * Rozbicie wariantów na podryzyka — wsad do pliku rozliczeniowego InterRisk.
 *
 * TO NIE JEST „JEDEN KOD NA WARIANT". Tak to wygląda w pliku przysłanym przez
 * centralę: 918 ubezpieczonych daje 5833 wiersze, czyli ponad sześć wierszy na
 * osobę. Każdy wiersz to JEDNO PODRYZYKO — osobny kod taryfowy, osobny klucz
 * statystyczny, własna suma ubezpieczenia i własna składka.
 *
 * Wszystko niżej jest przepisane z pięciu arkuszy centrali („<wariant> Plik do
 * rozliczeń online.xlsx", wersja poprawiona z 4.10.2026). We wszystkich pięciu
 * ten sam zestaw sześciu podryzyk — różnią się sumy i składki. Dlatego trzymamy
 * to jako JEDNĄ tabelę, a nie pięć osobnych list: przy pięciu kopiach literówka
 * w kodzie siedziałaby tylko w jednym wariancie i wyszła dopiero przy imporcie
 * u ubezpieczyciela.
 *
 * SUMA UBEZPIECZENIA JEST WŁASNOŚCIĄ PODRYZYKA, nie wariantu. Tylko dwa
 * pierwsze składniki mają sumę równą sumie z certyfikatu (29 000 zł przy 60 zł
 * składki); pozostałe cztery mają swoje własne, dużo niższe. Wcześniej, zanim
 * centrala je podała, wpisywaliśmy wszędzie sumę wariantu — i dla czterech
 * z sześciu wierszy było to zawyżone o rząd wielkości.
 *
 * Suma składek podryzyk MUSI się zgadzać ze składką wariantu. Panel i
 * `npm run check:rozliczenie` pilnują tego osobno — rozjazd znaczyłby, że
 * rozliczamy z ubezpieczycielem inną kwotę, niż pobraliśmy od rodzica,
 * a sumy zbiorcze i tak by się zgadzały i nikt by tego nie zauważył.
 */

export interface Podryzyko {
  /** np. „016818BK" — zaczyna się od zera, więc w pliku zawsze jako tekst */
  kodTaryfowy: string;
  /** np. „0070X" — też bywa z wiodącym zerem */
  kluczStatystyczny: string;
  /** suma ubezpieczenia TEGO podryzyka, nie całego wariantu */
  sumaUbezpieczenia: number;
  /** składka TEGO podryzyka; suma po wariancie = składka wariantu */
  skladkaZl: number;
}

/** Suma i składka tego podryzyka w danym wariancie. */
interface WgWariantu {
  su: number;
  skladka: number;
}

interface WierszTabeli {
  kodTaryfowy: string;
  kluczStatystyczny: string;
  wg: Record<string, WgWariantu>;
}

/**
 * Sześć składników pakietu EDU Plus, wprost z arkuszy centrali.
 *
 * Dwa ostatnie mają składkę stałą niezależnie od wariantu (1,10 i 1,20 zł)
 * i stałą sumę 5 000 zł — tak jest w każdym z pięciu arkuszy i nie jest to
 * przeoczenie.
 */
const TABELA: WierszTabeli[] = [
  {
    kodTaryfowy: "016818BK",
    kluczStatystyczny: "12201110100100070X",
    wg: {
      w60: { su: 29_000, skladka: 43.1 },
      w90: { su: 46_000, skladka: 68.7 },
      w135: { su: 75_000, skladka: 107.3 },
      w180: { su: 104_000, skladka: 145.9 },
      w250: { su: 150_000, skladka: 206.1 },
    },
  },
  {
    // W arkuszu 90 zł stoi tu „28018BK", bez wiodącego zera — w pozostałych
    // czterech „028018BK", przy identycznym kluczu statystycznym, identycznej
    // sumie i składce z tego samego szeregu. To zgubione zero (Excel robi to
    // kodom wpisanym jako liczba), a nie inny kod. W poprawionej wersji
    // arkuszy centrala naprawiła dwa inne wiodące zera (0070X, 000), a ten
    // został — biuro ma go potwierdzić przy pierwszym zaczytaniu.
    kodTaryfowy: "028018BK",
    kluczStatystyczny: "12200070X",
    wg: {
      w60: { su: 29_000, skladka: 6.2 },
      w90: { su: 46_000, skladka: 9.8 },
      w135: { su: 75_000, skladka: 16.0 },
      w180: { su: 104_000, skladka: 22.2 },
      w250: { su: 150_000, skladka: 31.9 },
    },
  },
  {
    kodTaryfowy: "02153018BK",
    kluczStatystyczny: "11070X",
    wg: {
      w60: { su: 2_700, skladka: 2.7 },
      w90: { su: 3_000, skladka: 3.0 },
      w135: { su: 3_200, skladka: 3.2 },
      w180: { su: 3_400, skladka: 3.4 },
      w250: { su: 3_500, skladka: 3.5 },
    },
  },
  {
    kodTaryfowy: "02156018BK",
    kluczStatystyczny: "10070X",
    wg: {
      w60: { su: 12_000, skladka: 5.7 },
      w90: { su: 13_000, skladka: 6.2 },
      w135: { su: 13_000, skladka: 6.2 },
      w180: { su: 13_000, skladka: 6.2 },
      w250: { su: 13_000, skladka: 6.2 },
    },
  },
  {
    kodTaryfowy: "184118BK",
    kluczStatystyczny: "0070X",
    wg: {
      w60: { su: 5_000, skladka: 1.1 },
      w90: { su: 5_000, skladka: 1.1 },
      w135: { su: 5_000, skladka: 1.1 },
      w180: { su: 5_000, skladka: 1.1 },
      w250: { su: 5_000, skladka: 1.1 },
    },
  },
  {
    kodTaryfowy: "18080018BK",
    kluczStatystyczny: "000",
    wg: {
      w60: { su: 5_000, skladka: 1.2 },
      w90: { su: 5_000, skladka: 1.2 },
      w135: { su: 5_000, skladka: 1.2 },
      w180: { su: 5_000, skladka: 1.2 },
      w250: { su: 5_000, skladka: 1.2 },
    },
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
    TABELA.filter((w) => w.wg[wariantId] !== undefined).map((w) => ({
      kodTaryfowy: w.kodTaryfowy,
      kluczStatystyczny: w.kluczStatystyczny,
      sumaUbezpieczenia: w.wg[wariantId].su,
      skladkaZl: w.wg[wariantId].skladka,
    })),
  ]),
);

/**
 * Pośrednik i jego prowizja — jedna para dla całej agencji, ustalona
 * z centralą i niezmienna między rozliczeniami.
 *
 * „33/073", nie „02/3008": ten drugi stał w pierwszej wersji arkuszy i należy
 * do innego oddziału. Wiodące zero w „073" jest znaczące, więc w pliku kolumna
 * idzie jako tekst.
 */
export const UPRAWNIONY = "33/073";
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

    // Suma ubezpieczenia opisuje ryzyko. Zero albo wartość ujemna przeszłyby
    // import bez szemrania i dopiero przy szkodzie okazałoby się, na co ta
    // osoba właściwie była ubezpieczona.
    const zlaSuma = lista.filter((p) => !(p.sumaUbezpieczenia > 0));
    if (zlaSuma.length > 0) {
      problemy.push({
        wariantId,
        powod: `suma ubezpieczenia ≤ 0 w podryzykach: ${zlaSuma.map((p) => p.kodTaryfowy).join(", ")}`,
      });
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

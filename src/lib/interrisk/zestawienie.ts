
/**
 * Zestawienie finansowe do uzgodnienia z centralą.
 *
 * Idzie razem z plikami certyfikatów i odpowiada na inne pytanie niż one:
 * tamte mówią KTO jest ubezpieczony, to mówi ZA ILE.
 *
 * KIERUNEK PIENIĘDZY: przelewamy do InterRisk CAŁĄ zebraną składkę, a dopiero
 * potem centrala zwraca nam 40% prowizji osobnym przelewem. Nie potrącamy
 * prowizji z przelewu. Dlatego „do przelewu" to pełna składka, a prowizja jest
 * osobną kwotą DO OTRZYMANIA — pomylenie tych dwóch znaczyłoby przelew niższy
 * o 40%, czyli niedopłatę do ubezpieczyciela przy każdym rozliczeniu.
 *
 * LICZONE Z TYCH SAMYCH WIERSZY, co pliki w paczce — dostaje je jako argument,
 * a nie pobiera własnym zapytaniem. Dwa niezależne odczyty tych samych danych
 * to dwa wyniki, które kiedyś się rozjadą, i wtedy nie wiadomo, który jest
 * prawdziwy: ten w arkuszu osobowym czy ten w podsumowaniu.
 *
 * SKŁADKA LICZONA WEDŁUG POLISY, nie według wpłaty. Dla ubezpieczyciela polisa
 * za 60 zł jest warta 60 zł niezależnie od tego, ile wpłynęło na nasze konto —
 * i tyle stoi w pliku osobowym, w rozbiciu na podryzyka. Gdyby wpłynęło mniej,
 * nie zmieniamy tu kwoty po cichu, tylko zgłaszamy to osobno (`rozbieznosci`).
 * Skoro przelewamy wartość polisy, każda niedopłata to realny ubytek gotówki
 * po naszej stronie, a nie sama niezgodność w papierach.
 * Uwaga: rozliczenie prowizji dla agentów liczy ODWROTNIE — od pieniędzy,
 * które naprawdę wpłynęły. Obie reguły są celowe i nie wolno ich zrównać.
 *
 * Moduł jest CELOWO bez importów lokalnych — stawka prowizji i liczba podryzyk
 * przychodzą argumentem, nie z konfiguracji. Dzięki temu `check:zestawienie`
 * uruchamia go samym node, bez bazy i bez Next.js, tak samo jak `zasady.ts`
 * przy prowizjach. Arkusz składa osobny moduł `zestawienie-plik.ts`.
 */

/** Tyle z wiersza rozliczenia, ile potrzeba do kwot. */
export interface WierszDoZestawienia {
  wniosekId: string;
  wariantId: string;
  numerPolisy: string;
  skladkaZl: number;
  /** kwota pobrana za CAŁY wniosek — powtarza się w każdym jego wierszu */
  kwotaWnioskuZl: number;
}

export interface Okres {
  od: string;
  do: string;
}

export interface WierszZestawienia {
  wariantId: string;
  numerPolisy: string;
  skladkaJednostkowaZl: number;
  osob: number;
  wierszyWPliku: number;
  /** pełna składka — tyle przelewamy do InterRisk */
  skladkaLacznieZl: number;
  /** 40% — tyle InterRisk zwraca nam osobnym przelewem */
  prowizjaZl: number;
  /** 60% — tyle zostaje po stronie ubezpieczyciela */
  zostajeWInterriskZl: number;
}

export interface Rozbieznosc {
  wniosekId: string;
  wariantId: string;
  wgPolisyZl: number;
  pobranoZl: number;
}

export interface Zestawienie {
  okres: Okres;
  wiersze: WierszZestawienia[];
  sumy: {
    osob: number;
    wierszyWPliku: number;
    /** pełna składka do przelania na konto InterRisk */
    skladkaZl: number;
    /** prowizja do otrzymania zwrotem */
    prowizjaZl: number;
    zostajeWInterriskZl: number;
  };
  /** wnioski, gdzie pobrano inną kwotę, niż wynika z polisy */
  rozbieznosci: Rozbieznosc[];
}

const grosze = (zl: number) => Math.round(zl * 100);
const zl = (gr: number) => gr / 100;

export function zestawienieFinansowe(
  wgWariantu: Map<string, WierszDoZestawienia[]>,
  okres: Okres,
  /** stawka prowizji i ile wierszy w pliku zajmuje jedna osoba danego wariantu */
  konfiguracja: { prowizjaProcent: number; podryzykNaOsobe: Record<string, number> },
): Zestawienie {
  const wiersze: WierszZestawienia[] = [];
  const rozbieznosci: Rozbieznosc[] = [];

  const kolejnosc = [...wgWariantu.entries()].sort(
    (a, b) => (a[1][0]?.skladkaZl ?? 0) - (b[1][0]?.skladkaZl ?? 0),
  );

  for (const [wariantId, dla] of kolejnosc) {
    const skladkaJednostkowa = dla[0]?.skladkaZl ?? 0;
    const skladkaGr = dla.reduce((s, w) => s + grosze(w.skladkaZl), 0);
    // Prowizja od sumy, nie od każdego wiersza osobno: zaokrąglanie po kolei
    // rozjeżdża kwotę o grosz przy każdej setce osób.
    const prowizjaGr = Math.round((skladkaGr * konfiguracja.prowizjaProcent) / 100);

    wiersze.push({
      wariantId,
      numerPolisy: dla[0]?.numerPolisy ?? "",
      skladkaJednostkowaZl: skladkaJednostkowa,
      osob: dla.length,
      wierszyWPliku: dla.length * (konfiguracja.podryzykNaOsobe[wariantId] ?? 0),
      skladkaLacznieZl: zl(skladkaGr),
      prowizjaZl: zl(prowizjaGr),
      zostajeWInterriskZl: zl(skladkaGr - prowizjaGr),
    });

    // Kwota pobrana dotyczy CAŁEGO wniosku i powtarza się w każdym jego
    // wierszu — bierzemy ją raz na wniosek, a składkę sumujemy po osobach.
    const wgWniosku = new Map<string, { pobranoGr: number; wgPolisyGr: number }>();
    for (const w of dla) {
      const x = wgWniosku.get(w.wniosekId) ?? { pobranoGr: grosze(w.kwotaWnioskuZl), wgPolisyGr: 0 };
      x.wgPolisyGr += grosze(w.skladkaZl);
      wgWniosku.set(w.wniosekId, x);
    }
    for (const [wniosekId, x] of wgWniosku) {
      if (x.pobranoGr !== x.wgPolisyGr) {
        rozbieznosci.push({
          wniosekId,
          wariantId,
          wgPolisyZl: zl(x.wgPolisyGr),
          pobranoZl: zl(x.pobranoGr),
        });
      }
    }
  }

  const sumy = wiersze.reduce(
    (s, w) => ({
      osob: s.osob + w.osob,
      wierszyWPliku: s.wierszyWPliku + w.wierszyWPliku,
      skladkaZl: s.skladkaZl + w.skladkaLacznieZl,
      prowizjaZl: s.prowizjaZl + w.prowizjaZl,
      zostajeWInterriskZl: s.zostajeWInterriskZl + w.zostajeWInterriskZl,
    }),
    { osob: 0, wierszyWPliku: 0, skladkaZl: 0, prowizjaZl: 0, zostajeWInterriskZl: 0 },
  );

  return { okres, wiersze, sumy, rozbieznosci };
}

import type { WniosekSkrot } from "@/lib/online-api";

/**
 * Sprzedaż online rozbita na dni.
 *
 * Liczby zbiorcze („ile w sumie") nie odpowiadają na pytanie, które zadaje się
 * codziennie: czy dziś było lepiej niż wczoraj i czy to w ogóle rośnie. Suma
 * wygląda tak samo, gdy sprzedaż stanęła tydzień temu.
 *
 * DZIEŃ LICZYMY W CZASIE WARSZAWSKIM, nie w UTC. Zakup o 23:30 należy do dnia,
 * w którym klient go zrobił — inaczej wieczorna sprzedaż w zimie wyglądałaby
 * na wczorajszą, a w lecie przeskakiwała między dniami zależnie od zmiany czasu.
 */

const STREFA = "Europe/Warsaw";

/** ISO → „2026-09-01" w czasie warszawskim. Locale sv-SE daje dokładnie ten zapis. */
export function dzienWarszawski(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: STREFA }).format(d);
}

export interface DzienSprzedazy {
  /** „2026-09-01" */
  dzien: string;
  /** przychód z wniosków OPŁACONYCH tego dnia */
  przychodZl: number;
  /** wnioski złożone tego dnia, niezależnie od statusu */
  wnioski: number;
  /** osoby objęte ochroną z wniosków opłaconych tego dnia */
  ubezpieczeni: number;
  /** ubezpieczeni narastająco — ilu w ogóle mamy na koniec tego dnia */
  ubezpieczeniLacznie: number;
}

/**
 * Wniosek, który się liczy do pieniędzy.
 *
 * Oczekujący na płatność bywa porzucany w bramce, więc wliczony do przychodu
 * pokazywałby pieniądze, których nie ma. Ten sam warunek stosuje portal agenta
 * — gdyby te dwa miejsca liczyły inaczej, ta sama sprzedaż miałaby dwie kwoty.
 */
const oplacony = (w: WniosekSkrot) => w.status !== "oczekuje_na_platnosc";

/**
 * Ostatnie `dni` dni, zawsze komplet — także te bez sprzedaży.
 *
 * Dni puste MUSZĄ być w serii. Wykres złożony wyłącznie z dni, w których coś
 * się wydarzyło, ściska tygodniową przerwę do jednego piksela i pokazuje ciągły
 * wzrost tam, gdzie sprzedaż stała.
 */
export function seriaDzienna(wnioski: WniosekSkrot[], dni = 30): DzienSprzedazy[] {
  const dzis = new Date();
  const kalendarz: string[] = [];
  for (let i = dni - 1; i >= 0; i--) {
    kalendarz.push(dzienWarszawski(new Date(dzis.getTime() - i * 86_400_000)));
  }
  const pierwszy = kalendarz[0];

  const wgDnia = new Map<string, { przychodZl: number; wnioski: number; ubezpieczeni: number }>();
  // Ubezpieczeni sprzed okna też się liczą do sumy narastającej: wykres ma
  // pokazywać, ilu klientów MAMY, a nie ilu przybyło od trzydziestu dni.
  let przedOknem = 0;

  for (const w of wnioski) {
    const dzien = dzienWarszawski(w.utworzono);
    if (!oplacony(w)) {
      if (dzien >= pierwszy) {
        const wpis = wgDnia.get(dzien) ?? { przychodZl: 0, wnioski: 0, ubezpieczeni: 0 };
        wpis.wnioski += 1;
        wgDnia.set(dzien, wpis);
      }
      continue;
    }
    if (dzien < pierwszy) {
      przedOknem += w.ubezpieczeni.length;
      continue;
    }
    const wpis = wgDnia.get(dzien) ?? { przychodZl: 0, wnioski: 0, ubezpieczeni: 0 };
    wpis.przychodZl += w.kwotaZl;
    wpis.wnioski += 1;
    wpis.ubezpieczeni += w.ubezpieczeni.length;
    wgDnia.set(dzien, wpis);
  }

  let narastajaco = przedOknem;
  return kalendarz.map((dzien) => {
    const d = wgDnia.get(dzien) ?? { przychodZl: 0, wnioski: 0, ubezpieczeni: 0 };
    narastajaco += d.ubezpieczeni;
    return { dzien, ...d, ubezpieczeniLacznie: narastajaco };
  });
}

/** „2026-09-01" → „1.09" — oś dnia czyta się w locie, nie sylabizuje. */
export function etykietaDnia(dzien: string): string {
  const [, m, d] = dzien.split("-");
  return `${Number(d)}.${m}`;
}

export interface PodsumowanieOkresu {
  przychodZl: number;
  ubezpieczeni: number;
  dniZeSprzedaza: number;
  /** średnia dzienna liczona po CAŁYM oknie, także dniach pustych */
  sredniaDziennaZl: number;
  najlepszyDzien: DzienSprzedazy | null;
}

export function podsumuj(seria: DzienSprzedazy[]): PodsumowanieOkresu {
  const przychodZl = seria.reduce((s, d) => s + d.przychodZl, 0);
  const zeSprzedaza = seria.filter((d) => d.przychodZl > 0);
  return {
    przychodZl,
    ubezpieczeni: seria.reduce((s, d) => s + d.ubezpieczeni, 0),
    dniZeSprzedaza: zeSprzedaza.length,
    // Dzielimy przez długość okna, nie przez dni ze sprzedażą: „średnio 135 zł
    // dziennie" ma znaczyć tyle, ile znaczy, a nie „135 zł w te dni, gdy coś było".
    sredniaDziennaZl: seria.length ? przychodZl / seria.length : 0,
    najlepszyDzien: zeSprzedaza.length
      ? zeSprzedaza.reduce((a, b) => (b.przychodZl > a.przychodZl ? b : a))
      : null,
  };
}

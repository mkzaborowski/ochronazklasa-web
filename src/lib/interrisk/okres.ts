/**
 * Arytmetyka okresów rozliczeniowych.
 *
 * Osobny moduł BEZ IMPORTÓW, bo to jedyna część wysyłki, którą da się pomylić
 * po cichu: zła granica miesiąca nie wywala niczego, tylko zgłasza centrali
 * sprzedaż z innego okresu. `npm run check:wysylka` uruchamia to samym node,
 * bez bazy i bez Next.js.
 */

export interface Okres {
  /** „2026-09-01", włącznie */
  od: string;
  /** „2026-09-30", włącznie */
  do: string;
  /** „2026-09" — do porównań „czy ten okres już poszedł" */
  etykieta: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Okres, który obejmuje paczka wysyłana danego dnia.
 *
 * `miesiecyWstecz` = 1 znaczy „poprzedni pełny miesiąc": paczka wychodząca
 * 5 października obejmuje 1–30 września.
 *
 * Liczymy przez `Date.UTC(rok, miesiac, 0)`, a nie przez odejmowanie miesiąca
 * od dzisiejszej daty. „31 marca minus miesiąc" daje w JS 3 marca, bo 31 lutego
 * nie istnieje i data się przewija — a wtedy paczka wysłana 31. dnia objęłaby
 * nie ten miesiąc, co trzeba, i nikt by tego nie zauważył poza centralą.
 */
export function okresDlaDnia(dzis: string, miesiecyWstecz: number): Okres {
  const [rok, miesiac] = dzis.split("-").map(Number);
  const poczatek = new Date(Date.UTC(rok, miesiac - 1 - miesiecyWstecz, 1));
  // Dzień 0 danego miesiąca = ostatni dzień miesiąca poprzedniego.
  const koniec = new Date(Date.UTC(rok, miesiac - miesiecyWstecz, 0));
  return { od: iso(poczatek), do: iso(koniec), etykieta: iso(poczatek).slice(0, 7) };
}

/** „ZESTAW 01.10.2026" — nazwa zestawu z dnia wysyłki, jak wpisuje ją biuro. */
export function nazwaZestawu(dzien: string): string {
  const [r, m, d] = dzien.split("-");
  return `ZESTAW ${d}.${m}.${r}`;
}

/** Dzień kalendarzowy przesunięty o `dni`. Południe UTC omija zmiany czasu. */
export function plusDni(dzien: string, dni: number): string {
  const d = new Date(`${dzien}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dni);
  return iso(d);
}

/**
 * Czy dany dzień sprzedaży wpada w okres. OBIE GRANICE WŁĄCZNIE: okres
 * „2026-09-01 – 2026-09-30" ma zawierać sprzedaż z 1 i z 30 września.
 * Porównanie na napisach ISO jest tu poprawne i odporne na strefy.
 */
export const wOkresie = (dzien: string, okres: { od: string; do: string }): boolean =>
  dzien >= okres.od && dzien <= okres.do;

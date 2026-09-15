/**
 * Kody InterRisk potrzebne w pliku rozliczeniowym.
 *
 * TE WARTOŚCI PRZYCHODZĄ Z CENTRALI i nie da się ich wyprowadzić z naszych
 * danych. Do czasu ich otrzymania plik generuje się z pustymi kolumnami —
 * świadomie, bo zmyślony kod taryfowy jest gorszy niż pusty: pusty zostanie
 * odrzucony przy zaczytaniu, a zmyślony wjedzie do systemu ubezpieczyciela pod
 * niewłaściwym produktem i nikt tego nie zauważy.
 *
 * Panel pokazuje ostrzeżenie, dopóki którykolwiek jest pusty.
 *
 * ŻEBY UZUPEŁNIĆ: wpisz wartości niżej i wypchnij zmianę. Kody są stałe dla
 * wariantu, więc to jednorazowa edycja, a nie coś, co biuro wpisuje przy
 * każdym rozliczeniu.
 */

export interface KodyWariantu {
  /** np. „016818BK" — zaczyna się od zera, więc zawsze jako tekst */
  kodTaryfowy: string;
  /** np. „00711111101111070X" */
  kluczStatystyczny: string;
}

/** Klucz to identyfikator wariantu z ozk-api (w60, w90, w135, w180, w250). */
export const KODY_WARIANTOW: Record<string, KodyWariantu> = {
  w60: { kodTaryfowy: "", kluczStatystyczny: "" },
  w90: { kodTaryfowy: "", kluczStatystyczny: "" },
  w135: { kodTaryfowy: "", kluczStatystyczny: "" },
  w180: { kodTaryfowy: "", kluczStatystyczny: "" },
  w250: { kodTaryfowy: "", kluczStatystyczny: "" },
};

/**
 * Pośrednik i jego prowizja — jedna para dla całej agencji.
 * W przysłanym przykładzie: „02/3008" i 40%.
 */
export const UPRAWNIONY = "";
export const PROWIZJA_PROCENT = 0;

/** Których wariantów jeszcze nie da się rozliczyć. Puste = wszystko gotowe. */
export function brakujaceKody(wariantyWUzyciu: string[]): string[] {
  const braki = wariantyWUzyciu.filter((w) => {
    const k = KODY_WARIANTOW[w];
    return !k?.kodTaryfowy?.trim() || !k?.kluczStatystyczny?.trim();
  });
  if (!UPRAWNIONY.trim() || PROWIZJA_PROCENT <= 0) braki.push("uprawniony i prowizja");
  return braki;
}

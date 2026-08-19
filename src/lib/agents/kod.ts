/**
 * Kod agenta i jego link polecający.
 *
 * Kod jest JEDYNYM, co łączy sprzedaż na ochronazklasa.pl z agentem. Wniosek
 * zapisuje się w bazie usługi sprzedaży (SQLite w ozk-api) z samym kodem, a
 * nazwisko dokładamy dopiero tutaj, przy wyświetlaniu. Dzięki temu zmiana
 * nazwiska agenta nie przepisuje historii sprzedaży, a awaria panelu nie
 * zatrzymuje sklepu.
 *
 * Kod bywa czytany na głos i przepisywany z ulotki, więc: tylko wielkie litery
 * bez ogonków, cyfry i myślnik. Bez znaków, które w adresie trzeba kodować.
 */

const OGONKI: Record<string, string> = {
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
};

export const MIN_DLUGOSC = 2;
export const MAKS_DLUGOSC = 16;

/** Adres publicznej strony — link agenta prowadzi wprost do kreatora zakupu. */
export const STRONA = process.env.PUBLIC_SITE_URL ?? "https://ochronazklasa.pl";

/** Nazwa parametru w adresie. Musi zgadzać się z `src/lib/polecenie.ts` w SPA. */
export const PARAMETR = "a";

/**
 * Sprowadza kod do postaci kanonicznej albo zwraca null.
 * Ta sama reguła obowiązuje w przeglądarce i w API — rozjazd oznaczałby
 * sprzedaż, która cicho gubi przypisanie.
 */
export function normalizujKod(surowy: unknown): string | null {
  if (typeof surowy !== "string") return null;
  const kod = surowy
    .trim()
    .toUpperCase()
    .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, (z) => OGONKI[z] ?? z)
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
  return kod.length >= MIN_DLUGOSC && kod.length <= MAKS_DLUGOSC ? kod : null;
}

/**
 * Proponuje kod na podstawie imienia i nazwiska: „Kamila Nowak" → „KNOWAK".
 *
 * Czytelny kod jest tu wart więcej niż losowy ciąg: agent podaje go przez
 * telefon, drukuje na ulotce i musi umieć rozpoznać własny w tabelce. Kolizje
 * rozstrzygamy numerem, a nie dopisywaniem kolejnych liter — „KNOWAK2" da się
 * podyktować, „KNOWAKI" myli się z innym nazwiskiem.
 */
export function proponujKod(nazwa: string, zajete: Iterable<string> = []): string {
  const zajeteKody = new Set([...zajete].map((k) => k.toUpperCase()));
  const czesci = nazwa
    .trim()
    .split(/\s+/)
    .map((c) => normalizujKod(c) ?? "")
    .filter(Boolean);

  const podstawa =
    czesci.length >= 2
      ? (czesci[0][0] + czesci[czesci.length - 1]).slice(0, MAKS_DLUGOSC)
      : (czesci[0] ?? "").slice(0, MAKS_DLUGOSC);

  // Nazwa złożona z samych znaków, których kod nie przyjmuje (albo pusta):
  // lepszy losowy kod niż agent bez linku.
  if (podstawa.length < MIN_DLUGOSC) {
    let losowy: string;
    do {
      losowy = "A" + Math.random().toString(36).slice(2, 7).toUpperCase();
    } while (zajeteKody.has(losowy));
    return losowy;
  }

  if (!zajeteKody.has(podstawa)) return podstawa;
  for (let i = 2; i < 1000; i++) {
    const kandydat = `${podstawa.slice(0, MAKS_DLUGOSC - String(i).length)}${i}`;
    if (!zajeteKody.has(kandydat)) return kandydat;
  }
  return `${podstawa.slice(0, 8)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/** Pełny link polecający agenta. */
export function linkPolecajacy(kod: string): string {
  return `${STRONA}/kup-ubezpieczenie?${PARAMETR}=${encodeURIComponent(kod)}`;
}

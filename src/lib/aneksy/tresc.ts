/**
 * Treść aneksu do polisy grupowej InterRisk — bez importów.
 *
 * PO CO OSOBNO. Wszystko, co w aneksie się LICZY albo SKŁADA z liczb (kwota do
 * zapłaty, zwolnieni z opłaty, rok szkolny, numer polisy), siedzi tutaj,
 * a nie w komponencie i nie we wzorze Worda. Dzięki temu da się to sprawdzić
 * skryptem bez bazy i bez przeglądarki (`npm run check:aneksy`) — a to jest
 * dokładnie ta część, w której pomyłka kosztuje: szkoła zapłaci tyle, ile
 * stoi w aneksie.
 *
 * Kwoty trzymamy w GROSZACH. Składka bywa z groszami (42,50 zł), a 42,5 × 3
 * w liczbach zmiennoprzecinkowych potrafi dać 127,49999… zł.
 */

export interface DaneAneksu {
  /** wpisywany ręcznie, np. „1/2026" — biuro nie zawsze wystawia aneks w programie */
  numerAneksu: string;
  /** same cyfry, np. „679857"; seria „A-A" jest we wzorze */
  numerPolisy: string;
  /** data wystawienia w formacie ISO (RRRR-MM-DD); idzie i na górę, i pod § 3 */
  dataAneksu: string;
  nazwaSzkoly: string;
  /** np. „2026-2027" */
  rokSzkolny: string;
  liczbaUbezpieczonych: number;
  /** 0 = wszyscy płacą (wzór „BEZ ZWOLNIENIA") */
  liczbaZwolnionych: number;
  skladkaGrosze: number;
  /** punkty § 1 dopisywane ręcznie, po „Korekcie pkt 1 Oświadczenia" */
  dodatkowePunkty: string[];
}

/** Najwięcej dopisanych punktów — więcej to już raczej nowa polisa niż aneks. */
export const MAKS_PUNKTOW = 20;
export const MAKS_DLUGOSC_PUNKTU = 2000;

/** „A-A 679 857", „aa679857", „679857" → „679857". */
export function normalizujNumerPolisy(surowy: string): string {
  return (surowy ?? "")
    .toUpperCase()
    .replace(/^\s*A\s*-?\s*A\b/, "")
    .replace(/\D/g, "");
}

/**
 * „65", „65,5", „65.50", „1 250,00 zł" → grosze; `null`, gdy to nie kwota.
 * Przecinek i kropka znaczą to samo — biuro pisze po polsku, klawiatura
 * numeryczna daje kropkę.
 */
export function parsujKwote(surowa: string): number | null {
  const t = (surowa ?? "")
    .replace(/zł/gi, "")
    .replace(/[\s ]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [zl, gr = ""] = t.split(".");
  return Number(zl) * 100 + Number(gr.padEnd(2, "0"));
}

/**
 * 6500 → „65 zł", 4250 → „42,50 zł", 780000 → „7 800 zł".
 *
 * Grosze pokazujemy tylko wtedy, gdy są — „65,00 zł" przy okrągłej składce
 * wygląda w aneksie jak z kasy fiskalnej. Tysiące oddziela TWARDA spacja,
 * żeby Word nie przełamał „7" i „800 zł" na dwie linie.
 */
export function formatujKwote(grosze: number): string {
  const zl = Math.floor(grosze / 100);
  const gr = grosze % 100;
  const calosc = String(zl).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return gr ? `${calosc},${String(gr).padStart(2, "0")} zł` : `${calosc} zł`;
}

/** Ile osób płaci składkę. */
export const liczbaPlacacych = (d: Pick<DaneAneksu, "liczbaUbezpieczonych" | "liczbaZwolnionych">) =>
  d.liczbaUbezpieczonych - d.liczbaZwolnionych;

/** Kwota do zapłaty przez szkołę, w groszach. */
export const doZaplatyGrosze = (
  d: Pick<DaneAneksu, "liczbaUbezpieczonych" | "liczbaZwolnionych" | "skladkaGrosze">,
) => liczbaPlacacych(d) * d.skladkaGrosze;

/**
 * Punkt 1 § 1 — w jednej z dwóch postaci, dokładnie jak we wzorach biura:
 *
 *   bez zwolnień: „…w roku 2026-2027: 120 x 65 zł = 7 800 zł"
 *   ze zwolnieniami: „…w roku 2026-2027: 120, w tym: 5 zwolnionych z opłaty
 *                     składki 120 - 5 = 115; 115 x 65 zł = 7 475 zł"
 */
export function liniaLiczbyUbezpieczonych(d: DaneAneksu): string {
  const poczatek = `Liczba osób ubezpieczonych w roku ${d.rokSzkolny}: `;
  const skladka = formatujKwote(d.skladkaGrosze);
  const kwota = formatujKwote(doZaplatyGrosze(d));
  if (d.liczbaZwolnionych <= 0) {
    return `${poczatek}${d.liczbaUbezpieczonych} x ${skladka} = ${kwota}`;
  }
  const placacy = liczbaPlacacych(d);
  return (
    `${poczatek}${d.liczbaUbezpieczonych}, w tym: ${d.liczbaZwolnionych} ` +
    `zwolnionych z opłaty składki ${d.liczbaUbezpieczonych} - ${d.liczbaZwolnionych} = ${placacy}; ` +
    `${placacy} x ${skladka} = ${kwota}`
  );
}

/**
 * Rok szkolny, w którym wypada data: od września nowy.
 * 2026-09-30 → „2026-2027", 2027-03-10 → „2026-2027".
 */
export function rokSzkolnyDla(iso: string): string {
  const [r, m] = iso.split("-").map(Number);
  const start = m >= 9 ? r : r - 1;
  return `${start}-${start + 1}`;
}

/** „2026-09-30" → „30.09.2026". */
export function dataPL(iso: string): string {
  const [r, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${r}`;
}

/** Dzisiejsza data w Polsce jako ISO — serwer chodzi w UTC. */
export function dzisISO(teraz = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(teraz);
}

const poprawnaData = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

/** Lista błędów po polsku; pusta = aneks da się wystawić. */
export function walidujAneks(d: DaneAneksu): string[] {
  const b: string[] = [];
  if (!d.numerAneksu.trim()) b.push("Wpisz numer aneksu.");
  if (!/^\d{4,}$/.test(d.numerPolisy)) b.push("Wpisz numer polisy (same cyfry po „A-A”).");
  if (!poprawnaData(d.dataAneksu)) b.push("Podaj poprawną datę aneksu.");
  if (!d.nazwaSzkoly.trim()) b.push("Wpisz nazwę szkoły.");
  if (!/^\d{4}-\d{4}$/.test(d.rokSzkolny)) b.push("Rok szkolny wpisz jako np. 2026-2027.");
  if (!Number.isInteger(d.liczbaUbezpieczonych) || d.liczbaUbezpieczonych < 1)
    b.push("Liczba ubezpieczonych musi być dodatnią liczbą całkowitą.");
  if (!Number.isInteger(d.liczbaZwolnionych) || d.liczbaZwolnionych < 0)
    b.push("Liczba zwolnionych nie może być ujemna.");
  else if (d.liczbaZwolnionych > d.liczbaUbezpieczonych)
    b.push("Zwolnionych nie może być więcej niż ubezpieczonych.");
  if (!Number.isInteger(d.skladkaGrosze) || d.skladkaGrosze <= 0)
    b.push("Podaj składkę, np. 65 albo 42,50.");
  if (d.dodatkowePunkty.length > MAKS_PUNKTOW)
    b.push(`Najwyżej ${MAKS_PUNKTOW} dodatkowych punktów.`);
  if (d.dodatkowePunkty.some((p) => p.length > MAKS_DLUGOSC_PUNKTU))
    b.push(`Punkt może mieć najwyżej ${MAKS_DLUGOSC_PUNKTU} znaków.`);
  return b;
}

/** Puste punkty wypadają — przycisk „Dodaj punkt" kliknięty na zapas nie drukuje numeru bez treści. */
export const oczyscPunkty = (punkty: string[]) =>
  punkty.map((p) => p.replace(/\r\n/g, "\n").trim()).filter(Boolean);

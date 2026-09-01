/**
 * Rozpoznanie kodu opiekuna, którego nie ma wprost w bazie.
 *
 * DLACZEGO TO W OGÓLE ISTNIEJE. Kod agenta trafia do wniosku na dwa sposoby:
 * z linku polecającego (wtedy jest dokładnie taki, jak w bazie) albo z ręki —
 * rodzic wpisuje go w polu „kod opiekuna", bo usłyszał przez telefon albo
 * przeczytał z ulotki. Wpisany z ręki bywa inny niż kanoniczny: agent Marcel
 * Motycki ma w bazie MMOTYCKI, a klient wpisał MARCELMOTYCKI. Do tej pory taka
 * sprzedaż wisiała w panelu jako „(nieznany)" i nie liczyła się nikomu.
 *
 * ZASADA: rozpoznajemy tylko wtedy, gdy odpowiedź jest JEDNA. Kod, który
 * pasuje do dwóch osób równie dobrze (dwoje agentów o tym samym nazwisku),
 * zostaje nierozpoznany i czeka na decyzję administratora. Zgadnięcie źle jest
 * tu gorsze niż nierozpoznanie: pieniądze policzyłyby się nie tej osobie, co
 * trzeba, i nikt by się o tym nie dowiedział — bo wiersz wyglądałby normalnie.
 *
 * Rozpoznanie NIE JEST zapisem. Liczy się na bieżąco przy wyświetlaniu, więc
 * poprawka w tym pliku od razu naprawia całą historię, a pomyłka nie zostawia
 * po sobie śladu w bazie. Trwałe przypisanie robi administrator ręcznie —
 * ląduje wtedy w `codeAliases` agenta i od tej chwili jest dopasowaniem
 * dokładnym, nie zgadywaniem.
 *
 * Moduł jest CELOWO bez importów — czysta funkcja od (kod, agenci) do decyzji.
 * Dzięki temu `npm run check:kody` uruchamia go samym node, bez bazy, bez
 * Next.js i bez ustawiania środowiska.
 */

/** Agent w postaci potrzebnej do rozpoznawania — tyle, ile wyciągamy z bazy. */
export interface KandydatAgenta {
  id: string;
  name: string;
  active: boolean;
  code: string | null;
  codeHistory: string[];
  /** kody przypisane ręcznie przez administratora */
  codeAliases: string[];
}

export interface Rozpoznanie {
  agentId: string;
  /** 0–1; poniżej PROG nie rozpoznajemy w ogóle */
  pewnosc: number;
  /** po ludzku, do pokazania w panelu i do wpisu w dzienniku zdarzeń */
  powod: string;
}

/**
 * Minimalna pewność, żeby w ogóle uznać kod za rozpoznany.
 * Niżej zaczynają się dopasowania typu „ma wspólne litery", a te nie są
 * podstawą do przypisania komuś przychodu.
 */
export const PROG = 0.62;

/**
 * O tyle najlepszy kandydat musi wyprzedzać drugiego.
 * Bez tego marginesu dwoje agentów o nazwisku Zaborowski dostawałoby sprzedaż
 * na przemian, zależnie od kolejności rekordów w bazie.
 */
export const MARGINES = 0.12;

/** Najkrótszy fragment nazwiska, który jeszcze coś znaczy. „NOW" to nie nazwisko. */
const MIN_FRAGMENT = 4;

const OGONKI: Record<string, string> = {
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
};

/**
 * Postać do PORÓWNYWANIA — te same znaki co `normalizujKod`, ale bez bramki
 * długości. Kod dłuższy niż 16 znaków nie może dziś powstać (pole w sklepie
 * ucina go wcześniej), ale rozpoznawanie ma odpowiadać na pytanie „do kogo to
 * pasuje", a nie „czy to prawidłowy kod" — odrzucenie takiego napisu dawałoby
 * ciche „nie wiem" zamiast trafnej odpowiedzi.
 */
function doPorownania(surowy: string): string {
  return surowy
    .trim()
    .toUpperCase()
    .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, (z) => OGONKI[z] ?? z)
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

/** Odległość edycyjna Levenshteina — ile poprawek dzieli dwa napisy. */
export function odlegloscEdycyjna(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Jeden wiersz macierzy zamiast całej: przy kodach do 16 znaków to bez
  // znaczenia dla czasu, ale trzyma pamięć na stałym poziomie.
  let poprzedni = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const biezacy = [i];
    for (let j = 1; j <= b.length; j++) {
      const koszt = a[i - 1] === b[j - 1] ? 0 : 1;
      biezacy[j] = Math.min(biezacy[j - 1] + 1, poprzedni[j] + 1, poprzedni[j - 1] + koszt);
    }
    poprzedni = biezacy;
  }
  return poprzedni[b.length];
}

/** Człony nazwiska sprowadzone do alfabetu kodu: „Kamila Bazuń" → ["KAMILA","BAZUN"]. */
function czlony(nazwa: string): string[] {
  return nazwa
    .trim()
    .split(/\s+/)
    .map((c) => doPorownania(c))
    .filter((c) => c.length > 0);
}

/**
 * Wszystkie sensowne postacie kodu dla danego nazwiska.
 *
 * Lista jest celowo krótka i przewidywalna — to postacie, które człowiek
 * faktycznie wpisuje: imię z nazwiskiem, inicjał z nazwiskiem (tak generuje
 * kody `proponujKod`), samo nazwisko, i te same w odwrotnej kolejności.
 * Dokładanie kolejnych wariantów podnosi ryzyko trafienia w cudzy kod.
 */
export function postacieKodu(nazwa: string): string[] {
  const cz = czlony(nazwa);
  if (cz.length === 0) return [];
  const imie = cz[0];
  const nazwisko = cz[cz.length - 1];
  if (cz.length === 1) return [imie];

  const formy = [
    imie + nazwisko,
    imie[0] + nazwisko,
    nazwisko,
    nazwisko + imie,
    nazwisko + imie[0],
    `${imie}-${nazwisko}`,
    imie + nazwisko[0],
  ];
  return [...new Set(formy.filter((f) => f.length >= 2))];
}

/**
 * Jak bardzo kod pasuje do jednego agenta. Zwraca najlepsze trafienie.
 * Dopasowanie dokładne (kod, kod historyczny, kod przypisany ręcznie) jest tu
 * też obsłużone, żeby ta funkcja dała się użyć samodzielnie — ale w praktyce
 * warstwa wyżej rozstrzyga je wcześniej i tutaj nie dochodzą.
 */
export function dopasowanieDoAgenta(
  kod: string,
  agent: KandydatAgenta,
): { pewnosc: number; powod: string } {
  const wlasne = [agent.code, ...agent.codeHistory, ...agent.codeAliases].filter(
    (k): k is string => Boolean(k),
  );
  if (wlasne.includes(kod)) return { pewnosc: 1, powod: "kod agenta" };

  const formy = postacieKodu(agent.name);
  let najlepsze = { pewnosc: 0, powod: "" };
  const rozwaz = (pewnosc: number, powod: string) => {
    if (pewnosc > najlepsze.pewnosc) najlepsze = { pewnosc, powod };
  };

  const nazwisko = czlony(agent.name).at(-1) ?? "";

  for (const forma of formy) {
    if (kod === forma) {
      rozwaz(0.92, `zapisane nazwisko agenta w postaci ${forma}`);
      continue;
    }
    // MOTYCKI2, MOTYCKI-2 — ktoś dopisał numer, żeby kod „wyglądał na kod".
    if (/^\d{1,3}$/.test(kod.slice(forma.length).replace(/^-/, "")) && kod.startsWith(forma)) {
      rozwaz(0.84, `postać ${forma} z dopiskiem`);
      continue;
    }
    const odleglosc = odlegloscEdycyjna(kod, forma);
    // Próg zależy od długości: przy krótkim kodzie jedna litera różnicy to już
    // zupełnie inne nazwisko, przy długim to najczęściej literówka.
    if (odleglosc === 1 && forma.length >= 6) {
      rozwaz(0.78, `jedna literówka względem ${forma}`);
    } else if (odleglosc === 2 && forma.length >= 9) {
      rozwaz(0.66, `dwie literówki względem ${forma}`);
    }
  }

  // Kod zawiera całe nazwisko (MOTYCKI wewnątrz ANNAMOTYCKI). Słabsze niż
  // dopasowanie do konkretnej postaci, bo pasuje też do rodzeństwa i małżeństw
  // — ale jeśli w bazie jest tylko jeden agent o tym nazwisku, margines
  // przepuści to dalej, a jeśli dwoje, zatrzyma.
  for (const wariant of wlasne.length ? [...wlasne, ...formy] : formy) {
    if (wariant.length < MIN_FRAGMENT) continue;
    if (kod.includes(wariant)) rozwaz(0.72, `zawiera ${wariant}`);
    if (wariant.includes(kod) && kod.length >= MIN_FRAGMENT) {
      rozwaz(0.64, `skrót od ${wariant}`);
    }
  }
  if (nazwisko.length >= MIN_FRAGMENT && kod.includes(nazwisko)) {
    rozwaz(0.74, `zawiera nazwisko ${nazwisko}`);
  }

  return najlepsze;
}

/**
 * Rozpoznaje kod albo mówi „nie wiem".
 *
 * `null` nie jest porażką — jest odpowiedzią, na którą panel reaguje prośbą
 * o ręczne przypisanie. Zwracamy też, kto był drugi: administrator podejmujący
 * decyzję powinien widzieć, między kim system się wahał.
 */
export function rozpoznajKod(
  surowyKod: string,
  agenci: KandydatAgenta[],
): { trafienie: Rozpoznanie | null; kandydaci: (Rozpoznanie & { name: string })[] } {
  const kod = doPorownania(surowyKod);
  if (kod.length < 2 || agenci.length === 0) return { trafienie: null, kandydaci: [] };

  const oceny = agenci
    .map((a) => {
      const { pewnosc, powod } = dopasowanieDoAgenta(kod, a);
      return { agentId: a.id, name: a.name, pewnosc, powod, aktywny: a.active };
    })
    .filter((o) => o.pewnosc > 0)
    // Aktywny agent wygrywa remis: kod wpisywany dziś z ręki należy do kogoś,
    // kto dziś sprzedaje, a nie do wyłączonej karty sprzed lat.
    .sort((a, b) => b.pewnosc - a.pewnosc || Number(b.aktywny) - Number(a.aktywny));

  const kandydaci = oceny.map(({ agentId, name, pewnosc, powod }) => ({
    agentId,
    name,
    pewnosc,
    powod,
  }));

  const [pierwszy, drugi] = oceny;
  if (!pierwszy || pierwszy.pewnosc < PROG) return { trafienie: null, kandydaci };
  // Remis rozstrzygnięty samą aktywnością to nadal remis — dwie osoby pasują
  // tak samo dobrze i to człowiek ma powiedzieć, o którą chodzi.
  if (drugi && pierwszy.pewnosc - drugi.pewnosc < MARGINES) {
    return { trafienie: null, kandydaci };
  }

  return {
    trafienie: {
      agentId: pierwszy.agentId,
      pewnosc: pierwszy.pewnosc,
      powod: pierwszy.powod,
    },
    kandydaci,
  };
}

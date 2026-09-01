import { etykietaDnia, type DzienSprzedazy } from "@/lib/statystyki/dzienne";

/**
 * Dwa wykresy sprzedaży online — rysowane po stronie serwera, w gołym SVG.
 *
 * DLACZEGO BEZ BIBLIOTEKI. Panel nie ma żadnej biblioteki wykresów, a te dwa
 * rysunki to słupki i linia. Dociągnięcie kilkuset kilobajtów JavaScriptu do
 * przeglądarki po to, żeby narysować trzydzieści prostokątów, kosztowałoby
 * więcej niż jest warte — a SVG z serwera działa też wtedy, gdy skrypt nie
 * wstanie.
 *
 * KOLORY BIORĄ SIĘ ZE ZMIENNYCH CSS panelu (--chart-1, --border, --muted-*),
 * więc tryb ciemny działa sam z siebie. To jest możliwe wyłącznie dlatego, że
 * SVG jest WPISANE w stronę: ten sam rysunek w <img> nie dziedziczy zmiennych
 * i wyszedłby czarno-biały.
 *
 * Podpowiedź pod kursorem robi <title> wewnątrz elementu — natywny dymek
 * przeglądarki. Czyta go też czytnik ekranu, czego własny dymek na divach by
 * nie dał.
 */

/** Górna krecha osi: zaokrąglona w górę do 1/2/5 × 10ⁿ, żeby podziałka była okrągła. */
function gornaOs(maks: number): number {
  if (maks <= 0) return 1;
  const rzad = 10 ** Math.floor(Math.log10(maks));
  for (const krok of [1, 2, 2.5, 5, 10]) {
    if (maks <= krok * rzad) return krok * rzad;
  }
  return 10 * rzad;
}

const zl = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pelnaData = (dzien: string) => {
  const [r, m, d] = dzien.split("-");
  return `${Number(d)}.${m}.${r}`;
};

// Geometria wspólna dla obu wykresów, żeby oś dnia stała w tych samych miejscach.
const SZER = 720;
const WYS = 190;
const LEWY = 46; // miejsce na podpisy osi wartości
const PRAWY = 12;
const GORA = 14;
const DOL = 24; // miejsce na oś dnia
const PLOTNO_SZER = SZER - LEWY - PRAWY;
const PLOTNO_WYS = WYS - GORA - DOL;

/**
 * Które dni podpisać na osi.
 *
 * Liczymy OD KOŃCA, nie od początku. Dzisiejszy dzień musi być podpisany —
 * to od niego czyta się wykres — a odliczanie od zera stawiało go tuż obok
 * poprzedniej etykiety i oba napisy się na siebie nakładały („31.08" wchodziło
 * w „1.09"). Idąc od końca, odstęp jest równy wszędzie.
 */
function indeksyEtykiet(ile: number): Set<number> {
  const krok = Math.max(1, Math.ceil(ile / 8));
  const wybrane = new Set<number>();
  for (let i = ile - 1; i >= 0; i -= krok) wybrane.add(i);
  return wybrane;
}

function OsWartosci({
  gora,
  format,
}: {
  gora: number;
  format: (v: number) => string;
}) {
  const kreski = [0, 0.5, 1];
  return (
    <>
      {kreski.map((u) => {
        const y = GORA + PLOTNO_WYS * (1 - u);
        return (
          <g key={u}>
            <line
              x1={LEWY}
              x2={SZER - PRAWY}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={LEWY - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--muted-foreground)"
            >
              {format(gora * u)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function OsDni({ seria }: { seria: DzienSprzedazy[] }) {
  const podpisane = indeksyEtykiet(seria.length);
  const szerokoscSlotu = PLOTNO_SZER / seria.length;
  return (
    <>
      {seria.map((d, i) =>
        podpisane.has(i) ? (
          <text
            key={d.dzien}
            x={LEWY + szerokoscSlotu * (i + 0.5)}
            y={WYS - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {etykietaDnia(d.dzien)}
          </text>
        ) : null,
      )}
    </>
  );
}

function Pusto({ tekst }: { tekst: string }) {
  return (
    <div className="flex h-[190px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {tekst}
    </div>
  );
}

/**
 * Przychód dzienny — słupki.
 *
 * Słupki, nie linia: każdy dzień jest osobną wielkością, a nie punktem na
 * ciągłej krzywej. Linia między dwoma dniami sugerowałaby, że po drodze coś
 * było; słupek zerowy mówi wprost, że nie było nic.
 */
export function WykresPrzychodu({ seria }: { seria: DzienSprzedazy[] }) {
  const maks = Math.max(...seria.map((d) => d.przychodZl), 0);
  if (maks === 0) {
    return <Pusto tekst="W tym okresie nie było jeszcze opłaconej sprzedaży." />;
  }

  const gora = gornaOs(maks);
  const szerokoscSlotu = PLOTNO_SZER / seria.length;
  // Słupek nigdy nie wypełnia całego slotu: 2 px odstępu w kolorze tła to
  // to, co oddziela sąsiadów. Górna granica 24 px trzyma proporcje, gdy dni
  // jest mało i slot robi się szeroki.
  const szerokoscSlupka = Math.min(24, Math.max(3, szerokoscSlotu - 2));
  const promien = Math.min(4, szerokoscSlupka / 2);
  const najlepszy = seria.reduce((a, b) => (b.przychodZl > a.przychodZl ? b : a));

  return (
    <svg
      viewBox={`0 0 ${SZER} ${WYS}`}
      className="h-[190px] w-full"
      role="img"
      aria-label={`Przychód dzienny ze sprzedaży online, ostatnie ${seria.length} dni. Najwięcej ${zl(najlepszy.przychodZl)} zł dnia ${pelnaData(najlepszy.dzien)}.`}
    >
      <OsWartosci gora={gora} format={(v) => zl(v)} />
      {seria.map((d, i) => {
        const x = LEWY + szerokoscSlotu * (i + 0.5) - szerokoscSlupka / 2;
        const wysokosc = (d.przychodZl / gora) * PLOTNO_WYS;
        const y = GORA + PLOTNO_WYS - wysokosc;
        return (
          <g key={d.dzien}>
            {/* Cały slot jest celem najechania, nie sam słupek: w dzień bez
                sprzedaży nie ma czego dotknąć, a data i zero to też odpowiedź. */}
            <rect
              x={LEWY + szerokoscSlotu * i}
              y={GORA}
              width={szerokoscSlotu}
              height={PLOTNO_WYS}
              fill="transparent"
            >
              {/* Jeden ciąg, nie sklejka wielu dzieci: <title> w SVG przyjmuje
                  wyłącznie tekst, a React na kilku dzieciach po prostu odmawia. */}
              <title>
                {`${pelnaData(d.dzien)}: ${zl(d.przychodZl)} zł${
                  d.wnioski ? ` · ${d.wnioski} ${d.wnioski === 1 ? "wniosek" : "wniosków"}` : ""
                }`}
              </title>
            </rect>
            {d.przychodZl > 0 ? (
              <rect
                x={x}
                y={y}
                width={szerokoscSlupka}
                height={Math.max(wysokosc, promien)}
                rx={promien}
                fill="var(--chart-1)"
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}
      {/* Podpisany JEDEN słupek — najwyższy. Liczba nad każdym słupkiem to
          tabela udająca wykres i nikt jej nie czyta. */}
      <text
        x={Math.min(
          SZER - PRAWY,
          Math.max(
            LEWY,
            LEWY + szerokoscSlotu * (seria.indexOf(najlepszy) + 0.5),
          ),
        )}
        y={Math.max(GORA + 10, GORA + PLOTNO_WYS - (najlepszy.przychodZl / gora) * PLOTNO_WYS - 6)}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {zl(najlepszy.przychodZl)} zł
      </text>
      <line
        x1={LEWY}
        x2={SZER - PRAWY}
        y1={GORA + PLOTNO_WYS}
        y2={GORA + PLOTNO_WYS}
        stroke="var(--border)"
        strokeWidth={1}
      />
      <OsDni seria={seria} />
    </svg>
  );
}

/**
 * Ubezpieczeni narastająco — linia.
 *
 * Linia, bo to jedna wielkość mierzona w czasie i nigdy nie maleje; pytanie
 * brzmi „jak szybko rośnie", a na to odpowiada nachylenie, nie wysokość
 * słupka. Liczba na końcu jest podpisana wprost — to jest ta, po którą się tu
 * przychodzi.
 */
export function WykresKlientow({ seria }: { seria: DzienSprzedazy[] }) {
  const koniec = seria.at(-1)?.ubezpieczeniLacznie ?? 0;
  if (koniec === 0) {
    return <Pusto tekst="Nikt nie jest jeszcze objęty ochroną ze sprzedaży online." />;
  }

  const gora = gornaOs(Math.max(...seria.map((d) => d.ubezpieczeniLacznie)));
  const krok = seria.length > 1 ? PLOTNO_SZER / (seria.length - 1) : 0;
  const punkt = (d: DzienSprzedazy, i: number): [number, number] => [
    LEWY + krok * i,
    GORA + PLOTNO_WYS - (d.ubezpieczeniLacznie / gora) * PLOTNO_WYS,
  ];
  const punkty = seria.map(punkt);
  const linia = punkty.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ostatniX, ostatniY] = punkty.at(-1)!;

  return (
    <svg
      viewBox={`0 0 ${SZER} ${WYS}`}
      className="h-[190px] w-full"
      role="img"
      aria-label={`Liczba osób objętych ochroną ze sprzedaży online, narastająco: ${koniec} na dziś.`}
    >
      <OsWartosci gora={gora} format={(v) => String(Math.round(v))} />
      {/* Wypełnienie pod linią to lekka mgiełka, nie drugi kolor: ma dać
          kierunek wzrostu kątem oka, a nie konkurować z samą linią. */}
      <polygon
        points={`${LEWY},${GORA + PLOTNO_WYS} ${linia} ${ostatniX},${GORA + PLOTNO_WYS}`}
        fill="var(--chart-1)"
        opacity={0.1}
      />
      <polyline
        points={linia}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {seria.map((d, i) => {
        const [x] = punkt(d, i);
        return (
          <rect
            key={d.dzien}
            x={x - krok / 2}
            y={GORA}
            width={Math.max(krok, 6)}
            height={PLOTNO_WYS}
            fill="transparent"
          >
            <title>
              {`${pelnaData(d.dzien)}: ${d.ubezpieczeniLacznie} ${
                d.ubezpieczeniLacznie === 1 ? "osoba" : "osób"
              } pod ochroną${d.ubezpieczeni ? ` (+${d.ubezpieczeni} tego dnia)` : ""}`}
            </title>
          </rect>
        );
      })}
      {/* Pierścień w kolorze tła — kropka zostaje czytelna także tam, gdzie
          nachodzi na linię albo na krechę osi. */}
      <circle cx={ostatniX} cy={ostatniY} r={6} fill="var(--card)" pointerEvents="none" />
      <circle cx={ostatniX} cy={ostatniY} r={4} fill="var(--chart-1)" pointerEvents="none" />
      {/* Kropka końcowa siedzi pod sufitem zawsze, gdy ostatnia wartość jest
          jednocześnie maksimum skali — a przy rosnącej sumie to reguła, nie
          wyjątek. Podpis idzie wtedy POD kropkę, zamiast wyjeżdżać poza rysunek. */}
      <text
        x={ostatniX - 10}
        y={ostatniY - GORA < 16 ? ostatniY + 16 : ostatniY - 10}
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {koniec}
      </text>
      <line
        x1={LEWY}
        x2={SZER - PRAWY}
        y1={GORA + PLOTNO_WYS}
        y2={GORA + PLOTNO_WYS}
        stroke="var(--border)"
        strokeWidth={1}
      />
      <OsDni seria={seria} />
    </svg>
  );
}

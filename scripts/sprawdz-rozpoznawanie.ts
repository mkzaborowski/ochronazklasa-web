/**
 * Sprawdzenie rozpoznawania kodów opiekuna: `npm run check:kody`.
 *
 * Ten plik jest jedynym miejscem, w którym widać NARAZ, co rozpoznawanie ma
 * łapać i czego ma NIE zgadywać. Próg i margines w `rozpoznawanie.ts` to dwie
 * liczby - dopiero ta lista mówi, co one znaczą w praktyce.
 *
 * Uruchamia się samym node (strip-types), bez bazy i bez Next.js.
 */
import { rozpoznajKod, type KandydatAgenta } from "../src/lib/agents/rozpoznawanie.ts";

const a = (
  id: string,
  name: string,
  code: string | null,
  extra: Partial<KandydatAgenta> = {},
): KandydatAgenta => ({
  id,
  name,
  code,
  active: true,
  codeHistory: [],
  codeAliases: [],
  ...extra,
});

// Roster zbliżony do prawdziwego, z celową kolizją nazwisk (dwoje Zaborowskich).
const agenci: KandydatAgenta[] = [
  a("motycki", "Marcel Motycki", "MMOTYCKI"),
  a("dariusz", "Dariusz Zaborowski", "DZABOROWSKI"),
  a("marceli", "Marceli Zaborowski", "MZABOROWSKI"),
  a("bazun", "Katarzyna Bazuń", "KBAZUN"),
  a("pajak", "Jarosław Pająk", "JPAJAK"),
  a("nowak", "Kamila Nowak", "KNOWAK"),
  a("stary", "Anna Lis", "ALIS", { active: false }),
];

interface Przypadek {
  kod: string;
  oczekiwany: string | null;
  po_co: string;
}

const przypadki: Przypadek[] = [
  { kod: "MMOTYCKI", oczekiwany: "motycki", po_co: "kod dokładny" },
  { kod: "MARCELMOTYCKI", oczekiwany: "motycki", po_co: "PRZYPADEK Z PANELU: imię+nazwisko z ręki" },
  { kod: "marcelmotycki", oczekiwany: "motycki", po_co: "małe litery" },
  { kod: "MOTYCKI", oczekiwany: "motycki", po_co: "samo nazwisko" },
  { kod: "MOTYCKIMARCEL", oczekiwany: "motycki", po_co: "odwrotna kolejność" },
  { kod: "MARCEL-MOTYCKI", oczekiwany: "motycki", po_co: "z myślnikiem" },
  { kod: "MMOTYCKII", oczekiwany: "motycki", po_co: "literówka w kodzie" },
  { kod: "KATARZYNABAZUN", oczekiwany: "bazun", po_co: "ogonki w nazwisku (Bazuń)" },
  { kod: "JAROSLAWPAJAK", oczekiwany: "pajak", po_co: "ogonki (Pająk)" },
  { kod: "JARO-PAJAK", oczekiwany: "pajak", po_co: "skrócone imię + nazwisko" },

  { kod: "ZABOROWSKI", oczekiwany: null, po_co: "DWOJE o tym nazwisku — ma NIE zgadywać" },
  { kod: "MARCELIZABOROWSKI", oczekiwany: "marceli", po_co: "imię rozstrzyga między Zaborowskimi" },
  { kod: "DARIUSZZABOROWSKI", oczekiwany: "dariusz", po_co: "imię rozstrzyga między Zaborowskimi" },
  // Pole w sklepie ucina kod do 16 znaków, więc pełne imię i nazwisko dojeżdża
  // do nas obcięte. To NIE jest przypadek teoretyczny — tak wygląda dane wejście.
  { kod: "DARIUSZZABOROWSK", oczekiwany: "dariusz", po_co: "obcięte do 16 znaków przez pole w sklepie" },
  { kod: "MARCELIZABOROWSK", oczekiwany: "marceli", po_co: "obcięte do 16 znaków przez pole w sklepie" },

  { kod: "XYZ123", oczekiwany: null, po_co: "śmieci" },
  { kod: "SZKOLA7", oczekiwany: null, po_co: "kod, który nie jest niczyim nazwiskiem" },
  { kod: "KOWALSKI", oczekiwany: null, po_co: "nazwisko spoza bazy" },
];

let bledy = 0;
for (const p of przypadki) {
  const { trafienie, kandydaci } = rozpoznajKod(p.kod, agenci);
  const got = trafienie?.agentId ?? null;
  const ok = got === p.oczekiwany;
  if (!ok) bledy++;
  const szczegol = trafienie
    ? `${trafienie.agentId} (${trafienie.pewnosc.toFixed(2)} — ${trafienie.powod})`
    : `nierozpoznany [kandydaci: ${kandydaci
        .slice(0, 2)
        .map((k) => `${k.name} ${k.pewnosc.toFixed(2)}`)
        .join(", ") || "brak"}]`;
  console.log(`${ok ? "OK  " : "BŁĄD"} ${p.kod.padEnd(18)} → ${szczegol}   // ${p.po_co}`);
}

console.log(bledy === 0 ? "\nWszystkie przypadki przeszły." : `\n${bledy} przypadków nie przeszło.`);
process.exit(bledy === 0 ? 0 : 1);

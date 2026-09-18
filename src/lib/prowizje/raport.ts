import { pobierzRozliczenie } from "@/lib/online-api";
import { dopasujAgentow } from "@/lib/agents/atrybucja";
import { normalizujKod } from "@/lib/agents/kod";
import { dzienWarszawski } from "@/lib/statystyki/dzienne";
import {
  ADMINISTRATOR,
  SZEF,
  podzielSprzedaz,
  zestawWyplaty,
  type Podzial,
  type SprzedazDoPodzialu,
  type Zestawienie,
} from "@/lib/prowizje/zasady";

/**
 * Raport prowizji za okres — dane z usługi sprzedaży, zasady z `zasady.ts`.
 *
 * TE SAME SPRZEDAŻE, CO W ROZLICZENIU Z INTERRISK: wystawione certyfikaty
 * z potwierdzoną płatnością. Gdyby prowizje liczyły się z innego zbioru, pula
 * do podziału rozjechałaby się z tym, co faktycznie przyjdzie od ubezpieczyciela.
 *
 * TO SAMO ROZPOZNAWANIE KODÓW, CO W RESZTY PANELU: kod wpisany z ręki
 * („MARCELMOTYCKI") płaci Marcelowi Motyckiemu tak samo, jak jest mu przypisany
 * na liście sprzedaży. Dwie różne odpowiedzi na „czyja to sprzedaż" w dwóch
 * zakładkach to prosta droga do sporu o pieniądze.
 */

export interface SprzedazWRaporcie extends SprzedazDoPodzialu {
  podzial: Podzial;
  certyfikaty: string[];
}

export interface RaportProwizji {
  od: string;
  do: string;
  zestawienie: Zestawienie;
  sprzedaze: SprzedazWRaporcie[];
}

/**
 * SQLite zapisuje `datetime('now')` w UTC, bez strefy: „2026-09-30 22:30:00".
 * `new Date()` na takim napisie zgaduje strefę po swojemu, więc dopisujemy ją
 * wprost. Bez tego zakup o 0:30 w nocy 1 października wpadłby do września.
 */
const zSqlite = (t: string) => new Date(`${t.replace(" ", "T")}Z`);

/** Pierwszy dzień bieżącego miesiąca i dzisiaj — w czasie warszawskim. */
export function domyslnyOkres(): { od: string; do: string } {
  const dzis = dzienWarszawski(new Date());
  return { od: `${dzis.slice(0, 7)}-01`, do: dzis };
}

export async function raportProwizji(od: string, do_: string): Promise<RaportProwizji> {
  const { wiersze } = await pobierzRozliczenie();

  // Wiersze przychodzą PO UBEZPIECZONYM; prowizja liczy się od SPRZEDAŻY,
  // bo to sprzedaż ma kod agenta. Trójka dzieci w jednym zakupie to jedna
  // sprzedaż za trzykrotną składkę.
  const wgWniosku = new Map<
    string,
    { dzien: string; skladkaGr: number; osob: number; kod: string | null; certyfikaty: string[] }
  >();
  for (const w of wiersze) {
    const dzien = dzienWarszawski(zSqlite(w.utworzono));
    if (dzien < od || dzien > do_) continue;
    const s = wgWniosku.get(w.wniosekId) ?? {
      dzien, skladkaGr: 0, osob: 0, kod: w.kodAgenta, certyfikaty: [],
    };
    s.skladkaGr += Math.round(w.skladkaZl * 100);
    s.osob += 1;
    if (w.numerCertyfikatu) s.certyfikaty.push(w.numerCertyfikatu);
    wgWniosku.set(w.wniosekId, s);
  }

  const kody = [...wgWniosku.values()].map((s) => s.kod);
  if (SZEF.kodAgenta) kody.push(SZEF.kodAgenta);
  if (ADMINISTRATOR.kodAgenta) kody.push(ADMINISTRATOR.kodAgenta);
  const agenci = await dopasujAgentow(kody);
  const idPoKodzie = (kod: string | null) => {
    const k = normalizujKod(kod);
    return k ? (agenci.get(k)?.id ?? null) : null;
  };

  const sprzedaze: SprzedazWRaporcie[] = [...wgWniosku.entries()].map(([wniosekId, s]) => {
    const kodSurowy = s.kod?.trim() || null;
    const kod = normalizujKod(kodSurowy);
    const agent = kod ? agenci.get(kod) : undefined;
    const rodzaj: SprzedazDoPodzialu["rodzaj"] = !kodSurowy
      ? "bez_agenta"
      : agent
        ? "agent"
        : "kod_nierozstrzygniety";
    return {
      wniosekId,
      dzien: s.dzien,
      skladkaGr: s.skladkaGr,
      osob: s.osob,
      kod: kod ?? kodSurowy,
      rodzaj,
      agentId: agent?.id ?? null,
      agentNazwa: agent?.name ?? null,
      podzial: podzielSprzedaz(s.skladkaGr, rodzaj),
      certyfikaty: s.certyfikaty,
    };
  });
  sprzedaze.sort((a, b) => a.dzien.localeCompare(b.dzien) || a.wniosekId.localeCompare(b.wniosekId));

  return {
    od,
    do: do_,
    zestawienie: zestawWyplaty(sprzedaze, {
      szefAgentId: idPoKodzie(SZEF.kodAgenta),
      administratorAgentId: idPoKodzie(ADMINISTRATOR.kodAgenta),
    }),
    sprzedaze,
  };
}

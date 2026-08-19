import { db } from "@/lib/db";
import { normalizujKod } from "@/lib/agents/kod";

/**
 * Dopasowanie kodu z wniosku do agenta.
 *
 * Sprzedaż online żyje w osobnej usłudze (ozk-api) i zapisuje przy wniosku
 * sam KOD, nie identyfikator agenta. Dlatego nazwisko dokłada się dopiero
 * tutaj, przy wyświetlaniu.
 *
 * Kod nierozpoznany NIE jest błędem do ukrycia — pokazujemy go wprost jako
 * nieznany. Sprzedaż z literówki w linku ma być widoczna, bo ktoś ją zrobił
 * i ktoś się o nią upomni.
 */

export interface DopasowanyAgent {
  id: string;
  name: string;
  active: boolean;
  /** true, gdy wniosek przyszedł ze starego kodu tego agenta */
  poprzedniKod: boolean;
}

/**
 * Buduje słownik kod → agent dla podanych kodów.
 *
 * Bierzemy pod uwagę także kody historyczne, więc zmiana kodu nie odpina
 * agentowi wcześniejszej sprzedaży. Kod aktualny zawsze wygrywa z historycznym
 * — gdyby ktoś dostał kod porzucony przez kogoś innego, nowy właściciel jest
 * tym, kto tę sprzedaż faktycznie zrobił.
 */
export async function dopasujAgentow(
  kody: Iterable<string | null | undefined>,
): Promise<Map<string, DopasowanyAgent>> {
  const szukane = new Set<string>();
  for (const k of kody) {
    const kod = normalizujKod(k);
    if (kod) szukane.add(kod);
  }
  if (szukane.size === 0) return new Map();

  const lista = [...szukane];
  const agenci = await db.agent
    .findMany({
      where: { OR: [{ code: { in: lista } }, { codeHistory: { hasSome: lista } }] },
      select: { id: true, name: true, active: true, code: true, codeHistory: true },
    })
    .catch(() => []);

  const mapa = new Map<string, DopasowanyAgent>();
  // najpierw historyczne, potem aktualne — aktualne nadpisuje
  for (const a of agenci) {
    for (const kod of a.codeHistory) {
      if (szukane.has(kod)) {
        mapa.set(kod, { id: a.id, name: a.name, active: a.active, poprzedniKod: true });
      }
    }
  }
  for (const a of agenci) {
    if (a.code && szukane.has(a.code)) {
      mapa.set(a.code, { id: a.id, name: a.name, active: a.active, poprzedniKod: false });
    }
  }
  return mapa;
}

/** Wszystkie kody, po których należy liczyć sprzedaż danego agenta. */
export function kodyAgenta(agent: { code: string | null; codeHistory: string[] }): string[] {
  return [agent.code, ...agent.codeHistory].filter((k): k is string => Boolean(k));
}

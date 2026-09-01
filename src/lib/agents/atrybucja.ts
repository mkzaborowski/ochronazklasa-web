import { db } from "@/lib/db";
import { normalizujKod } from "@/lib/agents/kod";
import { rozpoznajKod, type KandydatAgenta } from "@/lib/agents/rozpoznawanie";

/**
 * Dopasowanie kodu z wniosku do agenta.
 *
 * Sprzedaż online żyje w osobnej usłudze (ozk-api) i zapisuje przy wniosku
 * sam KOD, nie identyfikator agenta. Dlatego nazwisko dokłada się dopiero
 * tutaj, przy wyświetlaniu.
 *
 * DWA POZIOMY DOPASOWANIA:
 *
 *   dokładne  — kod jest w bazie: aktualny, historyczny albo przypisany ręcznie.
 *               Zero wątpliwości, tak działa każdy kod z linku polecającego.
 *   rozpoznane— kodu nie ma w bazie, ale pasuje do nazwiska dokładnie jednego
 *               agenta (MARCELMOTYCKI → Marcel Motycki). Kod wpisany z ręki
 *               rzadko jest kanoniczny, a sprzedaż ma się liczyć temu, kto ją
 *               zrobił, a nie wisieć jako „nieznany".
 *
 * Kod, którego nie da się rozstrzygnąć, NADAL nie jest błędem do ukrycia —
 * pokazujemy go wprost jako nieznany i czekamy na decyzję administratora.
 * Zgadnięcie źle byłoby gorsze: pieniądze policzyłyby się nie tej osobie,
 * a wiersz wyglądałby zupełnie normalnie.
 */

export interface DopasowanyAgent {
  id: string;
  name: string;
  active: boolean;
  /** true, gdy wniosek przyszedł ze starego kodu tego agenta */
  poprzedniKod: boolean;
  /**
   * Wypełnione tylko dla dopasowań ZGADYWANYCH. Panel pokazuje to obok
   * nazwiska, żeby nie dało się pomylić rozpoznania z pewnikiem — i żeby
   * administrator wiedział, co potwierdza, gdy przypisuje kod na stałe.
   */
  rozpoznany?: { pewnosc: number; powod: string };
}

/** Agenci w postaci, której potrzebuje rozpoznawanie. Kart agentów są dziesiątki. */
async function wszyscyAgenci(): Promise<KandydatAgenta[]> {
  return db.agent
    .findMany({
      select: {
        id: true,
        name: true,
        active: true,
        code: true,
        codeHistory: true,
        codeAliases: true,
      },
    })
    .catch(() => []);
}

/**
 * Buduje słownik kod → agent dla podanych kodów.
 *
 * Bierzemy pod uwagę także kody historyczne i przypisane ręcznie, więc zmiana
 * kodu nie odpina agentowi wcześniejszej sprzedaży. Kod aktualny zawsze wygrywa
 * z historycznym — gdyby ktoś dostał kod porzucony przez kogoś innego, nowy
 * właściciel jest tym, kto tę sprzedaż faktycznie zrobił.
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

  const agenci = await wszyscyAgenci();
  const mapa = new Map<string, DopasowanyAgent>();

  // najpierw historyczne i przypisane ręcznie, potem aktualne — aktualne nadpisuje
  for (const a of agenci) {
    for (const kod of [...a.codeHistory, ...a.codeAliases]) {
      if (szukane.has(kod)) {
        mapa.set(kod, {
          id: a.id,
          name: a.name,
          active: a.active,
          poprzedniKod: a.codeHistory.includes(kod),
        });
      }
    }
  }
  for (const a of agenci) {
    if (a.code && szukane.has(a.code)) {
      mapa.set(a.code, { id: a.id, name: a.name, active: a.active, poprzedniKod: false });
    }
  }

  // Dopiero to, czego nie było w bazie, idzie do rozpoznawania.
  for (const kod of szukane) {
    if (mapa.has(kod)) continue;
    const { trafienie } = rozpoznajKod(kod, agenci);
    if (!trafienie) continue;
    const a = agenci.find((x) => x.id === trafienie.agentId);
    if (!a) continue;
    mapa.set(kod, {
      id: a.id,
      name: a.name,
      active: a.active,
      poprzedniKod: false,
      rozpoznany: { pewnosc: trafienie.pewnosc, powod: trafienie.powod },
    });
  }

  return mapa;
}

/**
 * Kody nierozpoznane wraz z tym, między kim system się wahał.
 * To jest wsad dla ekranu, na którym administrator przypisuje kod ręcznie —
 * bez listy kandydatów musiałby zgadywać dokładnie tak samo jak system.
 */
export async function kodyDoRozstrzygniecia(
  kody: Iterable<string | null | undefined>,
): Promise<{ kod: string; kandydaci: { agentId: string; name: string; pewnosc: number }[] }[]> {
  const szukane = new Set<string>();
  for (const k of kody) {
    const kod = normalizujKod(k);
    if (kod) szukane.add(kod);
  }
  if (szukane.size === 0) return [];

  const agenci = await wszyscyAgenci();
  const znane = new Set(
    agenci.flatMap((a) => [a.code, ...a.codeHistory, ...a.codeAliases]).filter(Boolean) as string[],
  );

  const wynik = [];
  for (const kod of szukane) {
    if (znane.has(kod)) continue;
    const { trafienie, kandydaci } = rozpoznajKod(kod, agenci);
    if (trafienie) continue;
    wynik.push({
      kod,
      // Trzech kandydatów wystarczy do decyzji; dłuższa lista to już przewijanie
      // zamiast wyboru. Pełna lista agentów i tak jest w rozwijanym polu obok.
      kandydaci: kandydaci.slice(0, 3).map((k) => ({
        agentId: k.agentId,
        name: k.name,
        pewnosc: k.pewnosc,
      })),
    });
  }
  return wynik.sort((a, b) => a.kod.localeCompare(b.kod, "pl"));
}

/**
 * Wszystkie kody, po których należy liczyć sprzedaż danego agenta —
 * DOKŁADNE, czyli te, które ma zapisane w bazie.
 */
export function kodyAgenta(agent: {
  code: string | null;
  codeHistory: string[];
  codeAliases?: string[];
}): string[] {
  return [agent.code, ...agent.codeHistory, ...(agent.codeAliases ?? [])].filter(
    (k): k is string => Boolean(k),
  );
}

/**
 * Kody agenta powiększone o te, które rozpoznajemy jako jego.
 *
 * Portal agenta i statystyki filtrują sprzedaż PO KODACH, po stronie usługi
 * sprzedaży. Gdyby brały tylko kody z bazy, agent nie zobaczyłby u siebie
 * sprzedaży z kodu wpisanego z ręki — mimo że w panelu administratora stoi
 * przy niej jego nazwisko. Dwie prawdy o tej samej sprzedaży są gorsze niż
 * jedna niedoskonała.
 *
 * `kodyWSprzedazy` to kody, które faktycznie występują we wnioskach —
 * rozpoznajemy tylko je, żeby nie wymyślać kodów, których nikt nie użył.
 */
export async function kodySprzedazyAgenta(
  agent: { id: string; code: string | null; codeHistory: string[]; codeAliases?: string[] },
  kodyWSprzedazy: Iterable<string>,
): Promise<string[]> {
  const kody = new Set(kodyAgenta(agent));
  const agenci = await wszyscyAgenci();
  if (agenci.length === 0) return [...kody];

  for (const surowy of kodyWSprzedazy) {
    const kod = normalizujKod(surowy);
    if (!kod || kody.has(kod)) continue;
    const { trafienie } = rozpoznajKod(kod, agenci);
    if (trafienie?.agentId === agent.id) kody.add(kod);
  }
  return [...kody];
}

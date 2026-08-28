import { db } from "@/lib/db";
import { pobierzWnioski } from "@/lib/online-api";
import { dopasujAgentow } from "@/lib/agents/atrybucja";
import { pocztaSkonfigurowana, wyslijList } from "./poczta";
import { temat, trescHtml, trescTekstowa, type DaneListu } from "./list-o-sprzedazy";

/**
 * Powiadamia agenta mailem o sprzedaży, która weszła z jego kodu opiekuna.
 *
 * Po co: agent, który nie wie, że ktoś kupił z jego polecenia, nie zadzwoni do
 * tego klienta ani nie dopilnuje szkoły. Do tej pory dowiadywał się o tym
 * dopiero wtedy, gdy sam zajrzał do panelu.
 *
 * DLACZEGO DOPIERO PO OPŁACENIU. Wniosek oczekujący na płatność bywa porzucany
 * w bramce; mail o sprzedaży, której nie było, jest gorszy niż brak maila.
 *
 * Zadanie jest IDEMPOTENTNE na dwa sposoby: ślad w bazie (jeden wniosek =
 * jedno powiadomienie) i klucz idempotencji w usłudze pocztowej. Sam klucz by
 * wystarczył, ale wtedy o powtórce dowiadywalibyśmy się od agenta, który
 * dostał dwa takie same maile.
 */

/** Ile dni wstecz w ogóle patrzymy. Zabezpiecza przed lawiną po dłuższej awarii. */
const OKNO_DNI = 7;

export interface WynikPowiadomien {
  sprawdzone: number;
  wyslane: number;
  pominiete: { powod: string; ile: number }[];
  bledy: string[];
}

export async function powiadomONowejSprzedazy(): Promise<WynikPowiadomien> {
  const wynik: WynikPowiadomien = { sprawdzone: 0, wyslane: 0, pominiete: [], bledy: [] };
  const pomin = new Map<string, number>();
  const odnotuj = (powod: string) => pomin.set(powod, (pomin.get(powod) ?? 0) + 1);

  if (!pocztaSkonfigurowana()) {
    wynik.bledy.push("POCZTA_KLUCZ nieustawiony — nie ma czym wysłać");
    return wynik;
  }

  const { wnioski } = await pobierzWnioski({});
  const granica = Date.now() - OKNO_DNI * 86_400_000;

  const kandydaci = wnioski.filter((w) => {
    if (w.status === "oczekuje_na_platnosc") return false;
    if (!w.kodAgenta) return false;
    return new Date(w.utworzono).getTime() >= granica;
  });
  wynik.sprawdzone = kandydaci.length;
  if (kandydaci.length === 0) return wynik;

  // Jedno zapytanie zamiast jednego na wniosek — przy kilkudziesięciu nowych
  // sprzedażach dziennie różnica jest niewielka, ale zadanie chodzi co kilka
  // minut i nie ma powodu tłuc bazy w kółko.
  const juzWyslane = new Set(
    (
      await db.powiadomienieSprzedazy.findMany({
        where: { wniosekId: { in: kandydaci.map((w) => w.id) } },
        select: { wniosekId: true },
      })
    ).map((p) => p.wniosekId),
  );

  const agenci = await dopasujAgentow(kandydaci.map((w) => w.kodAgenta));
  const karty = await db.agent.findMany({
    where: { id: { in: [...new Set([...agenci.values()].map((a) => a.id))] } },
    select: { id: true, name: true, email: true, powiadomieniaEmail: true },
  });
  const wgId = new Map(karty.map((a) => [a.id, a]));

  for (const w of kandydaci) {
    if (juzWyslane.has(w.id)) { odnotuj("już powiadomiony"); continue; }

    const dopasowany = w.kodAgenta ? agenci.get(w.kodAgenta) : undefined;
    if (!dopasowany) { odnotuj("kod spoza bazy agentów"); continue; }

    const karta = wgId.get(dopasowany.id);
    if (!karta) { odnotuj("brak karty agenta"); continue; }
    if (!karta.powiadomieniaEmail) { odnotuj("agent wyłączył powiadomienia"); continue; }
    if (!karta.email) { odnotuj("agent bez adresu e-mail"); continue; }

    const dane: DaneListu = {
      agent: karta.name,
      kod: w.kodAgenta!,
      wariant: w.wariant.skladka ? `EDU Plus ${w.wariant.skladka} zł` : `EDU Plus ${w.wariant.id}`,
      skladkaZl: w.kwotaZl,
      ubezpieczeni: w.ubezpieczeni.map((u) => `${u.imie} ${u.nazwisko}`),
      oplacajacy: `${w.oplacajacy.imie} ${w.oplacajacy.nazwisko}`,
      dataStartu: w.dataStartu,
      numerCertyfikatu: w.numerCertyfikatu,
      linkPortalu: `${process.env.PANEL_URL ?? "https://web.ochronazklasa.pl"}/moje`,
    };

    try {
      await wyslijList({
        do: karta.email,
        temat: temat(dane),
        tresc: trescTekstowa(dane),
        trescHtml: trescHtml(dane),
        kluczIdempotencji: `sprzedaz-${w.id}`,
      });
      // Ślad zapisujemy PO udanej wysyłce: zapis przed nią znaczyłby, że
      // nieudany list nigdy się nie ponowi, bo wniosek wygląda na obsłużony.
      await db.powiadomienieSprzedazy.create({
        data: { wniosekId: w.id, agentId: karta.id, email: karta.email },
      });
      wynik.wyslane++;
    } catch (e) {
      wynik.bledy.push(`${w.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  wynik.pominiete = [...pomin].map(([powod, ile]) => ({ powod, ile }));
  return wynik;
}

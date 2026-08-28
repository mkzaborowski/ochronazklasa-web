import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { kodyAgenta } from "@/lib/agents/atrybucja";
import { wszystkiePolisy, type WynikPolis } from "@/lib/polisy/wszystkie";

/**
 * Portal agenta — jego własne dane i nic poza nimi.
 *
 * Agent loguje się do tego samego panelu co biuro, ale widzi wyłącznie swoją
 * kartę: przypisane szkoły, polisy tych szkół i sprzedaż online ze swoich kodów.
 * Bez edycji — karta agenta, przypisania szkół i numery polis to rzeczy, które
 * ustala biuro, a nie osoba, której dotyczą.
 *
 * ZAWĘŻENIE ROBIMY W ZAPYTANIU, nie po pobraniu. Filtrowanie tablicy w komponencie
 * wygląda tak samo na ekranie, ale wystarczy jedno przeoczone miejsce (eksport,
 * licznik, sortowanie), żeby cudze dane wyszły na wierzch.
 */

export interface KartaAgenta {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  code: string | null;
  codeHistory: string[];
  active: boolean;
  powiadomieniaEmail: boolean;
}

/** Konto zalogowane, ale bez powiązanej karty agenta. */
export const BRAK_KARTY = "brak-karty" as const;

/**
 * Karta agenta zalogowanego użytkownika albo BRAK_KARTY.
 *
 * Świadomie NIE przekierowuje: strona portalu musi umieć powiedzieć „twoje
 * konto nie jest jeszcze podpięte", a nie odesłać w miejsce, z którego rola
 * AGENT i tak zostanie odesłana z powrotem. Przekierowanie w obie strony to
 * pętla, w której użytkownik nie widzi żadnego komunikatu.
 */
export async function kartaZalogowanegoAgenta(): Promise<KartaAgenta | typeof BRAK_KARTY> {
  const user = await requireUser();
  if (!user.id) return BRAK_KARTY; // tryb deweloperski bez bazy

  const konto = await db.user
    .findUnique({
      where: { id: user.id },
      select: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            code: true,
            codeHistory: true,
            active: true,
            powiadomieniaEmail: true,
          },
        },
      },
    })
    .catch(() => null);

  return konto?.agent ?? BRAK_KARTY;
}

export interface DaneSzkolyAgenta {
  id: string;
  nazwa: string;
  adres: string;
  liczbaPolis: number;
}

export interface PortalAgenta {
  karta: KartaAgenta;
  szkoly: DaneSzkolyAgenta[];
  polisy: WynikPolis;
  statystyki: {
    szkoly: number;
    polisyGrupowe: number;
    sprzedazOnline: number;
    onlineOplacone: number;
    przychodOnlineZl: number;
  };
}

/** Komplet danych portalu dla jednej karty agenta. */
export async function daneAgenta(karta: KartaAgenta): Promise<PortalAgenta> {
  const kody = kodyAgenta(karta);

  const [szkolySurowe, polisy] = await Promise.all([
    db.school
      .findMany({
        where: { agentId: karta.id },
        orderBy: { nazwa: "asc" },
        select: { id: true, nazwa: true, adres: true, _count: { select: { policies: true } } },
      })
      .catch(() => []),
    wszystkiePolisy({ agentId: karta.id, kodyAgenta: kody }),
  ]);

  const szkoly = szkolySurowe.map((s) => ({
    id: s.id,
    nazwa: s.nazwa,
    adres: s.adres,
    liczbaPolis: s._count.policies,
  }));

  const online = polisy.wiersze.filter((w) => w.zrodlo === "online");
  // „Opłacone" liczymy po statusie, nie po napisie na ekranie: wniosek
  // oczekujący na płatność jeszcze niczego nie wnosi, a wliczenie go do
  // przychodu pokazywałoby agentowi pieniądze, których nie ma.
  const oplacone = online.filter((w) => w.statusOnline && w.statusOnline !== "oczekuje_na_platnosc");

  return {
    karta,
    szkoly,
    polisy,
    statystyki: {
      szkoly: szkoly.length,
      polisyGrupowe: polisy.liczby.grupowa,
      sprzedazOnline: online.length,
      onlineOplacone: oplacone.length,
      przychodOnlineZl: oplacone.reduce((s, w) => s + (w.skladkaZl ?? 0), 0),
    },
  };
}

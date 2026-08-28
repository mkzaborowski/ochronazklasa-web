import { db } from "@/lib/db";
import { clientLabel, formatDate, statusLabel, statusBadgeClass } from "@/lib/format";
import {
  pobierzWnioski,
  ETYKIETY_STATUSU,
  KLASA_STATUSU,
  type StatusWniosku,
  type WniosekSkrot,
} from "@/lib/online-api";
import { dopasujAgentow } from "@/lib/agents/atrybucja";

/**
 * Jedna lista polis ze wszystkich trzech miejsc, w których żyją.
 *
 * Polisy leżały dotąd w trzech rozłącznych miejscach i każde miało własną
 * zakładkę: ręcznie wpisane w „Polisach", grupowe szkolne przy szkole,
 * a sprzedaż online w osobnej usłudze. Odpowiedź na pytanie „ile mamy polis"
 * wymagała otwarcia trzech ekranów i dodania w pamięci — a strona „Polisy"
 * pokazywała zero, choć wystawionych było kilkadziesiąt.
 *
 * Scalamy przy WYŚWIETLANIU, nie w bazie. Każde źródło ma inny cykl życia
 * i innego właściciela (grupowe generuje panel, online osobna usługa z własną
 * bazą), więc kopiowanie ich do wspólnej tabeli znaczyłoby utrzymywanie trzech
 * kopii prawdy zamiast jednej.
 */

export type ZrodloPolisy = "reczna" | "grupowa" | "online";

export const ETYKIETY_ZRODLA: Record<ZrodloPolisy, string> = {
  reczna: "Wpisana ręcznie",
  grupowa: "Grupowa (szkoła)",
  online: "Sprzedaż online",
};

export interface WierszPolisy {
  klucz: string;
  zrodlo: ZrodloPolisy;
  numer: string | null;
  produkt: string;
  /** klient, szkoła albo rodzic — zależnie od źródła */
  ubezpieczajacy: string;
  ubezpieczyciel: string;
  status: string;
  klasaStatusu: string;
  /**
   * Status w postaci nieprzetłumaczonej — tylko dla sprzedaży online.
   * Liczniki porównują się WŁAŚNIE z tym, a nie z etykietą: poprawka literówki
   * w napisie nie może po cichu zepsuć statystyki przychodu.
   */
  statusOnline?: StatusWniosku;
  okres: string;
  skladkaZl: number | null;
  /** nazwisko agenta, jeśli znane; kod, jeśli nie ma go w bazie */
  agent: string | null;
  /** dokąd prowadzi wiersz; null = nie ma dokąd */
  href: string | null;
  /** do sortowania: najnowsze na górze */
  kiedy: Date;
}

export interface WynikPolis {
  wiersze: WierszPolisy[];
  /** źródła, których nie udało się odczytać — mówimy o tym wprost */
  niedostepne: string[];
  liczby: Record<ZrodloPolisy, number>;
}

/** „01-09-2026 - 31-08-2027" albo daty Date → jeden zapis dla całej tabeli. */
function okres(od: Date | string | null, do_: Date | string | null): string {
  const f = (d: Date | string | null) =>
    d instanceof Date ? formatDate(d) : d ? String(d) : "";
  const a = f(od);
  const b = f(do_);
  return a && b ? `${a} – ${b}` : a || b || "—";
}

async function reczne(): Promise<WierszPolisy[]> {
  const polisy = await db.policy.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return polisy.map((p) => ({
    klucz: `reczna:${p.id}`,
    zrodlo: "reczna" as const,
    numer: p.policyNumber,
    produkt: p.productType,
    ubezpieczajacy: clientLabel(p.client),
    ubezpieczyciel: p.insurer,
    status: statusLabel(p.status),
    klasaStatusu: statusBadgeClass(p.status),
    okres: okres(p.startDate, p.endDate),
    skladkaZl: p.premium ? Number(p.premium) : null,
    agent: null,
    href: `/policies/${p.id}`,
    kiedy: p.createdAt,
  }));
}

async function grupowe(agentId?: string): Promise<WierszPolisy[]> {
  const polisy = await db.generatedPolicy.findMany({
    // Zawężamy zapytaniem, nie filtrem po pobraniu: portal agenta nie powinien
    // w ogóle wyciągać z bazy polis szkół, które nie są jego.
    where: agentId ? { school: { agentId } } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      policyNumber: true,
      variantCode: true,
      insurancePeriod: true,
      createdAt: true,
      schoolId: true,
      school: { select: { nazwa: true, agent: { select: { name: true } } } },
    },
  });
  return polisy.map((p) => ({
    klucz: `grupowa:${p.id}`,
    zrodlo: "grupowa" as const,
    numer: p.policyNumber,
    produkt: `NNW ${p.variantCode}`,
    ubezpieczajacy: p.school.nazwa,
    ubezpieczyciel: "INTERRISK",
    status: "Wystawiona",
    klasaStatusu: "bg-emerald-100 text-emerald-800",
    okres: p.insurancePeriod || "—",
    skladkaZl: null,
    agent: p.school.agent?.name ?? null,
    href: `/schools/${p.schoolId}`,
    kiedy: p.createdAt,
  }));
}

async function online(opcje: { kody?: string[]; tylkoAgenta: boolean }): Promise<WierszPolisy[]> {
  // PUSTA LISTA KODÓW NIE ZNACZY „BEZ FILTRU". Agent bez nadanego kodu nie ma
  // żadnej sprzedaży online - gdybyśmy potraktowali brak kodów jak brak filtru,
  // zobaczyłby sprzedaż wszystkich. Widok pełny (administrator) prosi o niego
  // wprost, przez tylkoAgenta=false.
  if (opcje.tylkoAgenta && !opcje.kody?.length) return [];

  // Filtr po kodach robi API, a nie my po pobraniu: portal agenta nie powinien
  // w ogóle ściągać cudzej sprzedaży, żeby nie dało się jej podejrzeć.
  const dane = await pobierzWnioski(opcje.kody?.length ? { agent: opcje.kody.join(",") } : {});
  const wnioski: WniosekSkrot[] = dane.wnioski;
  const agenci = await dopasujAgentow(wnioski.map((w) => w.kodAgenta));

  return wnioski.map((w) => ({
    klucz: `online:${w.id}`,
    zrodlo: "online" as const,
    numer: w.numerCertyfikatu,
    produkt: `EDU Plus ${w.wariant.skladka ? `${w.wariant.skladka} zł` : w.wariant.id}`,
    ubezpieczajacy:
      w.ubezpieczeni.length === 1
        ? `${w.ubezpieczeni[0].imie} ${w.ubezpieczeni[0].nazwisko}`
        : `${w.oplacajacy.imie} ${w.oplacajacy.nazwisko} (${w.ubezpieczeni.length} dzieci)`,
    ubezpieczyciel: "INTERRISK",
    status: ETYKIETY_STATUSU[w.status] ?? w.status,
    klasaStatusu: KLASA_STATUSU[w.status] ?? "bg-gray-100 text-gray-800",
    statusOnline: w.status,
    okres: okres(w.dataStartu, w.koniecOchrony),
    skladkaZl: w.kwotaZl,
    agent: w.kodAgenta ? (agenci.get(w.kodAgenta)?.name ?? `${w.kodAgenta} (nieznany)`) : null,
    href: `/online/${w.id}`,
    kiedy: new Date(w.utworzono),
  }));
}

/**
 * Wszystkie polisy naraz. Awaria jednego źródła nie może wygasić tabeli —
 * pokazujemy, co się dało, i mówimy wprost, czego brakuje. Sprzedaż online
 * stoi w osobnej usłudze, więc jej niedostępność jest realnym scenariuszem.
 */
export async function wszystkiePolisy(
  opcje: { agentId?: string; kodyAgenta?: string[] } = {},
): Promise<WynikPolis> {
  // Widok agenta: polisy wpisane ręcznie zostają poza nim. Wiszą przy kliencie
  // agencji, nie przy szkole ani przy kodzie, więc nie ma po czym rozstrzygnąć,
  // czyje są - a zgadywanie znaczyłoby pokazanie agentowi cudzej sprzedaży.
  const widokAgenta = Boolean(opcje.agentId || opcje.kodyAgenta);
  const [r, g, o] = await Promise.allSettled([
    widokAgenta ? Promise.resolve<WierszPolisy[]>([]) : reczne(),
    grupowe(opcje.agentId),
    online({ kody: opcje.kodyAgenta, tylkoAgenta: widokAgenta }),
  ]);

  const niedostepne: string[] = [];
  const zebrane = (wynik: PromiseSettledResult<WierszPolisy[]>, nazwa: string) => {
    if (wynik.status === "fulfilled") return wynik.value;
    niedostepne.push(nazwa);
    return [];
  };

  const wiersze = [
    ...zebrane(r, "polisy wpisane ręcznie"),
    ...zebrane(g, "polisy grupowe"),
    ...zebrane(o, "sprzedaż online"),
  ].sort((a, b) => b.kiedy.getTime() - a.kiedy.getTime());

  const liczby: Record<ZrodloPolisy, number> = { reczna: 0, grupowa: 0, online: 0 };
  for (const w of wiersze) liczby[w.zrodlo]++;

  return { wiersze, niedostepne, liczby };
}

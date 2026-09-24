/**
 * Podział prowizji ze sprzedaży online.
 *
 * InterRisk płaci firmie 40% składki. Te 40% dzieli się tak:
 *
 *   sprzedaż Z KODEM AGENTA     agent 20%   administrator 5%    szef reszta (15%)
 *   sprzedaż BEZ KODU           —           administrator 10%   szef reszta (30%)
 *
 * Wszystkie procenty liczone od SKŁADKI, nie od prowizji: „agent dostaje 20%
 * od sprzedaży" znaczy 27 zł przy polisie za 135 zł, a nie 20% z 54 zł.
 *
 * UDZIAŁ SZEFA TO RESZTA, NIE OSOBNY PROCENT. Liczymy go jako pulę minus
 * pozostałe udziały, w groszach. Gdyby liczyć każdy udział osobno i zaokrąglać,
 * przy nieokrągłych kwotach suma wypłat rozjeżdżałaby się z prowizją od
 * InterRisk o grosz tu i tam — a przy setkach sprzedaży robi się z tego kwota,
 * której nikt nie umie wytłumaczyć.
 *
 * Moduł jest CELOWO bez importów, żeby `npm run check:prowizje` uruchamiał go
 * samym node, bez bazy i bez Next.js.
 */

export const PROWIZJA_FIRMY_PROC = 40;

export const STAWKI = {
  zAgentem: { agent: 20, administrator: 5 },
  bezAgenta: { administrator: 10 },
} as const;

/**
 * Kto jest kim. Administrator i szef to osoby, nie stanowiska do obsadzenia —
 * ale mogą też sprzedawać z własnego kodu. Wtedy ich udział agenta i udział
 * z roli łączą się w jedną wypłatę.
 *
 * Dariusz ma w bazie kartę agenta (DZABOROWSKI) — jego sprzedaż z kodu daje mu
 * 20% agenta i 15% szefa naraz. Administrator karty agenta nie ma.
 */
export const ADMINISTRATOR = { nazwa: "Marceli Zaborowski", kodAgenta: null as string | null };
export const SZEF = { nazwa: "Dariusz Zaborowski", kodAgenta: "DZABOROWSKI" as string | null };

/**
 * Jak sprzedaż trafiła do systemu.
 *
 *   agent               — kod rozpoznany: wiadomo, czyj to agent
 *   bez_agenta          — klient nie podał żadnego kodu
 *   kod_nierozstrzygniety — kod JEST, ale system nie wie, czyj (dwoje o tym
 *                         samym nazwisku albo nikt). To NIE jest sprzedaż bez
 *                         agenta: ktoś ją zrobił i się o nią upomni. Udział
 *                         agenta czeka, aż biuro przypisze kod.
 */
export type RodzajSprzedazy = "agent" | "bez_agenta" | "kod_nierozstrzygniety";

export interface Podzial {
  /** 40% składki — tyle płaci InterRisk */
  pula: number;
  agent: number;
  administrator: number;
  szef: number;
}

/** Procent od kwoty w groszach, zaokrąglony do grosza. */
const procent = (gr: number, proc: number) => Math.round((gr * proc) / 100);

/** Dzieli składkę jednej sprzedaży. Wszystko w groszach. */
export function podzielSprzedaz(skladkaGr: number, rodzaj: RodzajSprzedazy): Podzial {
  const pula = procent(skladkaGr, PROWIZJA_FIRMY_PROC);
  if (rodzaj === "bez_agenta") {
    const administrator = procent(skladkaGr, STAWKI.bezAgenta.administrator);
    return { pula, agent: 0, administrator, szef: pula - administrator };
  }
  // Kod nierozstrzygnięty dzieli się jak sprzedaż agenta — kod był, więc to
  // była sprzedaż agenta. Nie wiadomo tylko KTÓREGO; administrator i szef
  // dostają swoje niezależnie od odpowiedzi.
  const agent = procent(skladkaGr, STAWKI.zAgentem.agent);
  const administrator = procent(skladkaGr, STAWKI.zAgentem.administrator);
  return { pula, agent, administrator, szef: pula - agent - administrator };
}

/**
 * Podstawa prowizji dla jednego wniosku.
 *
 * Bierzemy MNIEJSZĄ z dwóch kwot: tej faktycznie pobranej przez bramkę i tej,
 * która wynika z wariantu. Zwykle są równe i nie ma o czym mówić — różnią się
 * w dwóch przypadkach i oba kończą się wypłatą nie z tych pieniędzy:
 *
 *   · pobrano MNIEJ (zakup testowy bramki: złotówka za polisę za 60 zł) —
 *     prowizja od 60 zł byłaby wypłatą z pieniędzy, które nigdy nie wpłynęły;
 *   · pobrano WIĘCEJ (nadpłata, pomyłka w przelewie) — nadwyżka nie jest
 *     składką i wróci do klienta, więc nie dzielimy jej między agentów.
 *
 * Cicha zgoda na którykolwiek z nich wyszłaby dopiero wtedy, gdyby ktoś ręcznie
 * przeliczył jedną sprzedaż — a wypłaty idą wcześniej.
 */
export function podstawaProwizji(pobranoGr: number, wgWariantuGr: number): number {
  return Math.min(pobranoGr, wgWariantuGr);
}

/** Stawki nie mogą przekraczać puli — inaczej udział szefa wyszedłby ujemny. */
export function stawkiSpojne(): boolean {
  const zAgentem = STAWKI.zAgentem.agent + STAWKI.zAgentem.administrator;
  return zAgentem <= PROWIZJA_FIRMY_PROC && STAWKI.bezAgenta.administrator <= PROWIZJA_FIRMY_PROC;
}

// ---------------------------------------------------------------------------
// Zestawienie wypłat
// ---------------------------------------------------------------------------

export interface SprzedazDoPodzialu {
  wniosekId: string;
  /** dzień sprzedaży w czasie warszawskim, „2026-09-16" */
  dzien: string;
  skladkaGr: number;
  osob: number;
  kod: string | null;
  rodzaj: RodzajSprzedazy;
  /** wypełnione tylko przy rodzaju „agent" */
  agentId: string | null;
  agentNazwa: string | null;
}

export interface WyplataOsoby {
  klucz: string;
  nazwa: string;
  /** role, z których składa się wypłata — do pokazania obok kwoty */
  role: ("agent" | "administrator" | "szef")[];
  zeSprzedazyGr: number;
  zAdministratoraGr: number;
  zSzefaGr: number;
  razemGr: number;
  /** sprzedaże z WŁASNEGO kodu; dla samej roli administratora/szefa 0 */
  sprzedazy: number;
}

export interface Zestawienie {
  osoby: WyplataOsoby[];
  /** udziały agenta czekające, aż biuro przypisze kod */
  nierozstrzygniete: { kod: string; gr: number; sprzedazy: number }[];
  sumy: {
    skladkaGr: number;
    pulaGr: number;
    wyplatyGr: number;
    czekaGr: number;
    sprzedazy: number;
    zAgentem: number;
    bezAgenta: number;
  };
}

/**
 * Zbiera podziały pojedynczych sprzedaży w wypłaty na osobę.
 *
 * `szefAgentId` / `administratorAgentId` łączą rolę z kartą agenta: jeśli szef
 * sprzedaje z własnego kodu, dostaje jedną wypłatę z dwóch źródeł, a nie dwie
 * osobne pozycje, które trzeba potem dodawać w głowie.
 */
export function zestawWyplaty(
  sprzedaze: SprzedazDoPodzialu[],
  powiazania: { szefAgentId: string | null; administratorAgentId: string | null },
): Zestawienie {
  const osoby = new Map<string, WyplataOsoby>();
  const osoba = (klucz: string, nazwa: string) => {
    let o = osoby.get(klucz);
    if (!o) {
      o = {
        klucz, nazwa, role: [],
        zeSprzedazyGr: 0, zAdministratoraGr: 0, zSzefaGr: 0, razemGr: 0, sprzedazy: 0,
      };
      osoby.set(klucz, o);
    }
    return o;
  };
  const dodajRole = (o: WyplataOsoby, rola: WyplataOsoby["role"][number]) => {
    if (!o.role.includes(rola)) o.role.push(rola);
  };

  const kluczAdministratora = powiazania.administratorAgentId
    ? `agent:${powiazania.administratorAgentId}`
    : "administrator";
  const kluczSzefa = powiazania.szefAgentId ? `agent:${powiazania.szefAgentId}` : "szef";

  const czeka = new Map<string, { kod: string; gr: number; sprzedazy: number }>();
  const sumy = {
    skladkaGr: 0, pulaGr: 0, wyplatyGr: 0, czekaGr: 0, sprzedazy: 0, zAgentem: 0, bezAgenta: 0,
  };

  for (const s of sprzedaze) {
    const p = podzielSprzedaz(s.skladkaGr, s.rodzaj);
    sumy.skladkaGr += s.skladkaGr;
    sumy.pulaGr += p.pula;
    sumy.sprzedazy += 1;
    if (s.rodzaj === "bez_agenta") sumy.bezAgenta += 1;
    else sumy.zAgentem += 1;

    if (s.rodzaj === "agent" && s.agentId) {
      const o = osoba(`agent:${s.agentId}`, s.agentNazwa ?? "Agent");
      o.zeSprzedazyGr += p.agent;
      o.sprzedazy += 1;
      dodajRole(o, "agent");
    } else if (s.rodzaj === "kod_nierozstrzygniety" && p.agent > 0) {
      const kod = s.kod ?? "?";
      const c = czeka.get(kod) ?? { kod, gr: 0, sprzedazy: 0 };
      c.gr += p.agent;
      c.sprzedazy += 1;
      czeka.set(kod, c);
      sumy.czekaGr += p.agent;
    }

    const adm = osoba(kluczAdministratora, ADMINISTRATOR.nazwa);
    adm.zAdministratoraGr += p.administrator;
    dodajRole(adm, "administrator");

    const szef = osoba(kluczSzefa, SZEF.nazwa);
    szef.zSzefaGr += p.szef;
    dodajRole(szef, "szef");
  }

  for (const o of osoby.values()) {
    o.razemGr = o.zeSprzedazyGr + o.zAdministratoraGr + o.zSzefaGr;
    sumy.wyplatyGr += o.razemGr;
  }

  return {
    // Najpierw agenci po kwocie, na końcu dwie role stałe — tak, jak czyta się
    // listę wypłat: od tych, do których trzeba zadzwonić, do „nas".
    osoby: [...osoby.values()].sort((a, b) => {
      const stala = (o: WyplataOsoby) => (o.role.includes("agent") ? 0 : 1);
      return stala(a) - stala(b) || b.razemGr - a.razemGr || a.nazwa.localeCompare(b.nazwa, "pl");
    }),
    nierozstrzygniete: [...czeka.values()].sort((a, b) => b.gr - a.gr),
    sumy,
  };
}

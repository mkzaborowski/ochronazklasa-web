/**
 * Sprawdzenie podziału prowizji: `npm run check:prowizje`.
 *
 * To są wypłaty dla ludzi. Błąd tutaj nie wywala strony — cicho zaniża albo
 * zawyża komuś pieniądze i wychodzi dopiero wtedy, gdy ktoś sam przeliczy.
 * Dlatego sprawdzamy nie tylko pojedyncze kwoty, ale i to, że SUMA WYPŁAT
 * ZAWSZE RÓWNA SIĘ PROWIZJI OD INTERRISK — co do grosza.
 *
 * Uruchamia się samym node (strip-types), bez bazy i bez Next.js.
 */
import {
  podstawaProwizji,
  podzielSprzedaz,
  stawkiSpojne,
  zestawWyplaty,
  type SprzedazDoPodzialu,
} from "../src/lib/prowizje/zasady.ts";

let bledy = 0;
const sprawdz = (opis: string, warunek: boolean, szczegol = "") => {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"} ${opis}${szczegol ? "  (" + szczegol + ")" : ""}`);
  if (!warunek) bledy++;
};
const zl = (gr: number) => (gr / 100).toFixed(2);

console.log("\n[1] sprzedaż z kodem agenta — 20 / 5 / reszta");
{
  const p = podzielSprzedaz(13500, "agent");
  sprawdz("pula 40% z 135 zł = 54,00", p.pula === 5400, zl(p.pula));
  sprawdz("agent 20% = 27,00", p.agent === 2700, zl(p.agent));
  sprawdz("administrator 5% = 6,75", p.administrator === 675, zl(p.administrator));
  sprawdz("szef reszta = 20,25 (15%)", p.szef === 2025, zl(p.szef));
}

console.log("\n[2] sprzedaż bez kodu — administrator 10 / szef reszta");
{
  const p = podzielSprzedaz(13500, "bez_agenta");
  sprawdz("agent nic", p.agent === 0);
  sprawdz("administrator 10% = 13,50", p.administrator === 1350, zl(p.administrator));
  sprawdz("szef reszta = 40,50 (30%)", p.szef === 4050, zl(p.szef));
}

console.log("\n[3] wszystkie warianty — podział zawsze domyka się do puli");
{
  for (const zlotych of [60, 90, 135, 180, 250, 270, 405]) {
    for (const rodzaj of ["agent", "bez_agenta", "kod_nierozstrzygniety"] as const) {
      const p = podzielSprzedaz(zlotych * 100, rodzaj);
      const suma = p.agent + p.administrator + p.szef;
      sprawdz(`${String(zlotych).padStart(3)} zł ${rodzaj.padEnd(22)}`,
        suma === p.pula && p.szef >= 0, `${zl(p.agent)} + ${zl(p.administrator)} + ${zl(p.szef)} = ${zl(p.pula)}`);
    }
  }
}

console.log("\n[4] nieokrągłe kwoty — grosz nie ginie przy zaokrąglaniu");
{
  // Kwoty, przy których zaokrąglanie każdego udziału osobno rozjechałoby sumę.
  for (const gr of [1, 3333, 9999, 12345, 101]) {
    const p = podzielSprzedaz(gr, "agent");
    sprawdz(`${zl(gr)} zł`, p.agent + p.administrator + p.szef === p.pula && p.szef >= 0,
      `pula ${zl(p.pula)}, szef ${zl(p.szef)}`);
  }
}

console.log("\n[5] podstawa prowizji — tylko od pieniędzy, które wpłynęły");
{
  // Sierpień 2026, prawdziwy wniosek: bramkę testowano złotówką przy wariancie
  // za 60 zł, a certyfikat wystawił się normalnie. Prowizja liczona od wariantu
  // rozdałaby 24 zł, których nikt nie wpłacił.
  sprawdz("zakup testowy: podstawą jest złotówka, nie wariant",
    podstawaProwizji(100, 6000) === 100, zl(podstawaProwizji(100, 6000)));
  sprawdz("i prowizja z tego to 40 gr, a nie 24 zł",
    podzielSprzedaz(podstawaProwizji(100, 6000), "bez_agenta").pula === 40,
    zl(podzielSprzedaz(podstawaProwizji(100, 6000), "bez_agenta").pula));

  sprawdz("zwykła sprzedaż: bez zmian", podstawaProwizji(13500, 13500) === 13500);
  sprawdz("troje dzieci w jednym wniosku", podstawaProwizji(40500, 40500) === 40500);
  // Nadpłata nie jest składką — wróci do klienta, więc jej nie dzielimy.
  sprawdz("nadpłata nie podnosi prowizji", podstawaProwizji(20000, 13500) === 13500,
    zl(podstawaProwizji(20000, 13500)));
}

console.log("\n[6] stawki nie przekraczają puli");
sprawdz("20 + 5 ≤ 40 i 10 ≤ 40", stawkiSpojne());

console.log("\n[7] zestawienie — kto ile dostaje");
{
  const s = (
    id: string, gr: number, rodzaj: SprzedazDoPodzialu["rodzaj"],
    agentId: string | null = null, agentNazwa: string | null = null, kod: string | null = null,
  ): SprzedazDoPodzialu => ({
    wniosekId: id, dzien: "2026-09-16", skladkaGr: gr, osob: 1, kod, rodzaj, agentId, agentNazwa,
  });

  const z = zestawWyplaty(
    [
      s("a", 13500, "agent", "kasia", "Katarzyna Bazuń", "KBAZUN"),
      s("b", 25000, "agent", "kasia", "Katarzyna Bazuń", "KBAZUN"),
      s("c", 6000, "agent", "darek", "Dariusz Zaborowski", "DZABOROWSKI"),
      s("d", 13500, "bez_agenta"),
      s("e", 9000, "kod_nierozstrzygniety", null, null, "ZABOROWSKI"),
    ],
    { szefAgentId: "darek", administratorAgentId: null },
  );
  const po = (nazwa: string) => z.osoby.find((o) => o.nazwa === nazwa);

  // Kasia: 20% z 135 + 20% z 250 = 27 + 50 = 77 zł
  sprawdz("agent dostaje 20% z każdej swojej sprzedaży", po("Katarzyna Bazuń")?.razemGr === 7700,
    zl(po("Katarzyna Bazuń")?.razemGr ?? 0));
  sprawdz("liczy się liczba jego sprzedaży", po("Katarzyna Bazuń")?.sprzedazy === 2);

  // Dariusz: z własnej sprzedaży 20% z 60 = 12, plus reszta z każdej sprzedaży:
  // 20,25 + 37,50 + 9,00 + 40,50 + 13,50 = 120,75 → razem 132,75
  const darek = po("Dariusz Zaborowski");
  sprawdz("szef sprzedający z kodu: JEDNA wypłata, nie dwie",
    z.osoby.filter((o) => o.nazwa === "Dariusz Zaborowski").length === 1);
  sprawdz("jego udział agenta", darek?.zeSprzedazyGr === 1200, zl(darek?.zeSprzedazyGr ?? 0));
  sprawdz("jego udział szefa", darek?.zSzefaGr === 12075, zl(darek?.zSzefaGr ?? 0));
  sprawdz("ma obie role", !!darek?.role.includes("agent") && !!darek?.role.includes("szef"));

  // Administrator: 5% z 135, 250, 60, 90 (nierozstrzygnięty to też sprzedaż agenta)
  // + 10% z 135 bez kodu = 6,75 + 12,50 + 3,00 + 4,50 + 13,50 = 40,25
  sprawdz("administrator: 5% z agentów + 10% bez kodu", po("Marceli Zaborowski")?.razemGr === 4025,
    zl(po("Marceli Zaborowski")?.razemGr ?? 0));

  // Kod nierozstrzygnięty: udział agenta (20% z 90 = 18) czeka, nie znika
  // i nie trafia do nikogo z automatu.
  sprawdz("udział z nieprzypisanego kodu czeka", z.sumy.czekaGr === 1800, zl(z.sumy.czekaGr));
  sprawdz("i wiadomo, na który kod", z.nierozstrzygniete[0]?.kod === "ZABOROWSKI");

  // Najważniejsze: nic nie ginie i nic się nie mnoży.
  sprawdz("wypłaty + oczekujące = prowizja od InterRisk",
    z.sumy.wyplatyGr + z.sumy.czekaGr === z.sumy.pulaGr,
    `${zl(z.sumy.wyplatyGr)} + ${zl(z.sumy.czekaGr)} = ${zl(z.sumy.pulaGr)}`);
  sprawdz("pula = 40% łącznej składki", z.sumy.pulaGr === Math.round(z.sumy.skladkaGr * 0.4),
    `${zl(z.sumy.pulaGr)} z ${zl(z.sumy.skladkaGr)}`);
}

console.log(bledy === 0 ? "\nPodział się zgadza." : `\n${bledy} niezgodności.`);
process.exit(bledy === 0 ? 0 : 1);

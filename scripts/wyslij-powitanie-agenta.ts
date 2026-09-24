/**
 * Wysyła agentowi list powitalny z danymi do logowania.
 *
 * Uzycie: node --experimental-strip-types scripts/wyslij-powitanie-agenta.ts <KOD> <haslo> [--wyslij]
 *         bez --wyslij tylko pokazuje, co poszłoby na skrzynkę.
 *
 * HASŁO JEST WERYFIKOWANE PRZED WYSŁANIEM. List mówi wprost „hasło sprawdzone
 * przed wysłaniem" i to musi być prawda: porównujemy je z hashem zapisanym na
 * koncie i odmawiamy, jeśli nie pasuje. Wysłanie komuś hasła, które nie działa,
 * kosztuje dwa telefony i pierwsze wrażenie, a wygląda identycznie jak wysłanie
 * dobrego. Skrypt hasła NIE USTAWIA — od tego jest `npm run konto-agenta`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync } from "node:fs";
import {
  temat,
  trescHtml,
  trescTekstowa,
  type DanePowitania,
} from "../src/lib/powiadomienia/list-powitalny-agenta.ts";
import { wyslijList, pocztaSkonfigurowana } from "../src/lib/powiadomienia/poczta.ts";

const [kodSurowy, haslo, ...reszta] = process.argv.slice(2);
const wyslac = reszta.includes("--wyslij");

if (!kodSurowy || !haslo) {
  console.error("Uzycie: ... <KOD-AGENTA> <haslo> [--wyslij]");
  process.exit(1);
}

const kod = kodSurowy.trim().toUpperCase();
const STRONA = process.env.PUBLIC_SITE_URL ?? "https://ochronazklasa.pl";
const PANEL = process.env.PANEL_URL ?? "https://web.ochronazklasa.pl";

const db = new PrismaClient();
const zle = (powod: string): never => {
  console.error(`ODMOWA: ${powod}`);
  process.exit(1);
};

try {
  const agent = await db.agent.findFirst({ where: { code: kod } });
  if (!agent) zle(`nie ma agenta o kodzie ${kod}`);

  const konto = await db.user.findFirst({ where: { agentId: agent!.id } });
  // Bez konta list byłby zaproszeniem donikąd: adres i hasło, które nie wpuszczą.
  if (!konto) zle(`agent ${agent!.name} nie ma jeszcze konta — najpierw: npm run konto-agenta`);
  if (!konto!.active) zle(`konto ${konto!.email} jest wyłączone`);
  if (konto!.role !== "AGENT") zle(`konto ${konto!.email} ma rolę ${konto!.role}, nie AGENT`);

  const pasuje = konto!.passwordHash
    ? await bcrypt.compare(haslo, konto!.passwordHash)
    : false;
  if (!pasuje) zle(`podane hasło NIE pasuje do konta ${konto!.email} — nie wysyłam`);

  const dane: DanePowitania = {
    // Samo imię: „Cześć Leno", nie „Cześć Lena Giska".
    agent: agent!.name.trim().split(/\s+/)[0],
    login: konto!.email,
    haslo,
    kod,
    linkPolecajacy: `${STRONA}/kup-ubezpieczenie?a=${encodeURIComponent(kod)}`,
    linkPanelu: PANEL,
    linkQr: `${PANEL}/api/agenci/${encodeURIComponent(kod)}/qr`,
    // Panel nie ma jeszcze ekranu zmiany hasła — dopóki nie ma, list nie może
    // kazać go zmienić, bo nie ma gdzie.
    zmianaHaslaMozliwa: false,
  };

  console.log(`Agent:   ${agent!.name} (${kod})`);
  console.log(`Konto:   ${konto!.email}  — hasło pasuje`);
  console.log(`Temat:   ${temat(dane)}`);

  if (!wyslac) {
    const plik = "/tmp/powitanie-" + kod + ".html";
    writeFileSync(plik, trescHtml(dane));
    console.log(`\nPODGLĄD (nic nie wysłano). HTML: ${plik}\n`);
    console.log(trescTekstowa(dane));
    process.exit(0);
  }

  if (!pocztaSkonfigurowana()) zle("POCZTA_KLUCZ nieustawiony — nie ma czym wysłać");

  await wyslijList({
    do: konto!.email,
    temat: temat(dane),
    tresc: trescTekstowa(dane),
    trescHtml: trescHtml(dane),
    // Drugie uruchomienie tej samej komendy nie wyśle drugiego listu.
    kluczIdempotencji: `powitanie-agenta:${kod}:${konto!.email}`,
  });
  console.log(`\nWYSŁANE na ${konto!.email}`);
} finally {
  await db.$disconnect();
}

/**
 * Zakłada partiami karty agentów, konta do logowania i wysyła listy powitalne.
 *
 * Uzycie: node --experimental-strip-types scripts/zaloz-konta-agentow.ts \
 *             <lista.json | '[{...}]'> --admin=<adres> [--wyslij]
 *         bez --wyslij NIC NIE ZAPISUJE i nic nie wysyła — tylko wypisuje, co by zrobił.
 *
 * Lista: [{ "nazwa": "Patrycja Bany", "email": "...", "telefon": "..." }, ...]
 * Podaje się ją jako ścieżkę do pliku ALBO wprost w komendzie — to drugie,
 * gdy uruchamia się skrypt w kontenerze, do którego nie wgrywa się plików.
 *
 * SUCHY BIEG JEST DOMYŚLNY, bo ten skrypt robi trzy rzeczy nieodwracalne naraz:
 * zapisuje do bazy, nadaje hasła i wysyła listy do ludzi. Pomyłka w pliku
 * wejściowym (literówka w adresie, zła kolejność imienia i nazwiska) kosztuje
 * wtedy tylko ponowne uruchomienie, a nie tłumaczenie się czterem osobom.
 *
 * Idempotentny po ADRESIE E-MAIL — to on jest w bazie unikalny. Karta, która
 * już istnieje, zostaje nietknięta poza uzupełnieniem braków; kodu NIE
 * podmieniamy nigdy, bo kod jest jedynym, co łączy wcześniejszą sprzedaż
 * z agentem.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { linkPolecajacy, proponujKod } from "../src/lib/agents/kod.ts";
import {
  temat as tematPowitania,
  trescHtml as powitanieHtml,
  trescTekstowa as powitanieTekst,
} from "../src/lib/powiadomienia/list-powitalny-agenta.ts";
import {
  temat as tematPodsumowania,
  trescHtml as podsumowanieHtml,
  trescTekstowa as podsumowanieTekst,
  type KontoWPodsumowaniu,
} from "../src/lib/powiadomienia/list-podsumowanie-kont.ts";
import { pocztaSkonfigurowana, wyslijList } from "../src/lib/powiadomienia/poczta.ts";

const [plik, ...reszta] = process.argv.slice(2);
const naprawde = reszta.includes("--wyslij");
if (!plik) {
  console.error("Uzycie: ... scripts/zaloz-konta-agentow.ts <lista.json|JSON> --admin=<adres> [--wyslij]");
  process.exit(1);
}

const PANEL = process.env.PANEL_URL ?? "https://web.ochronazklasa.pl";
// Adres podsumowania podaje się jawnie, a nie przez zmienną środowiskową:
// na ten adres idzie list z hasłami, więc ma być widoczny w komendzie,
// którą ktoś uruchamia, a nie schowany w konfiguracji serwera.
const ADMIN = (reszta.find((x) => x.startsWith("--admin="))?.slice(8) ?? "").trim();

/** Hasło do podyktowania przez telefon: dwa słowa i cztery cyfry. */
const SLOWA = [
  "Sosna", "Migdal", "Latarnia", "Kompas", "Zagiel", "Bursztyn", "Kasztan",
  "Wydma", "Zenit", "Portal", "Granit", "Klucz", "Lawenda", "Orzech", "Przystan",
];
const haslo = () =>
  `${SLOWA[randomInt(SLOWA.length)]}-${SLOWA[randomInt(SLOWA.length)]}-${randomInt(1000, 9999)}`;

interface Wejscie {
  nazwa: string;
  email: string;
  telefon?: string;
}

const lista: Wejscie[] = JSON.parse(
  plik.trimStart().startsWith("[") ? plik : readFileSync(plik, "utf8"),
);
const db = new PrismaClient();

try {
  if (naprawde && !pocztaSkonfigurowana()) {
    console.error("POCZTA_KLUCZ nieustawiony — listy by nie wyszły, przerywam.");
    process.exit(1);
  }
  // Brak adresu wykrywamy PRZED zapisem, nie po: inaczej konta powstają,
  // hasła idą do ludzi, a jedyna kopia haseł nigdzie nie trafia.
  if (naprawde && !ADMIN) {
    console.error("Podaj --admin=<adres> — to jedyne miejsce, gdzie trafiają hasła.");
    process.exit(1);
  }

  const wszyscy = await db.agent.findMany({ select: { code: true, codeHistory: true } });
  const zajete = new Set(
    wszyscy.flatMap((a) => [a.code, ...(a.codeHistory ?? [])]).filter(Boolean) as string[],
  );

  const podsumowanie: KontoWPodsumowaniu[] = [];

  for (const osoba of lista) {
    const email = osoba.email.trim().toLowerCase();
    const nazwa = osoba.nazwa.trim();
    const istniejacy = await db.agent.findUnique({ where: { email } });

    const kod = istniejacy?.code ?? proponujKod(nazwa, zajete);
    zajete.add(kod);

    const nowaKarta = !istniejacy;
    const tajne = haslo();

    console.log(
      `${nowaKarta ? "NOWA KARTA" : "karta już jest"}  ${nazwa.padEnd(24)} ${kod.padEnd(14)} ${email}`,
    );

    if (!naprawde) {
      podsumowanie.push({
        agent: nazwa, kod, login: email, haslo: "(suchy bieg)",
        telefon: osoba.telefon ?? null, nowaKarta,
        linkPolecajacy: linkPolecajacy(kod), powitanieWyslane: false,
      });
      continue;
    }

    const karta = istniejacy
      ? await db.agent.update({
          where: { id: istniejacy.id },
          // Nazwy i kodu nie nadpisujemy — mogły być poprawione ręcznie.
          data: { code: istniejacy.code ?? kod, phone: istniejacy.phone ?? osoba.telefon ?? null, active: true },
        })
      : await db.agent.create({
          data: { name: nazwa, email, phone: osoba.telefon ?? null, code: kod, active: true },
        });

    // Jedna karta = jedno konto; inaczej nie wiadomo, kto się zalogował.
    const zajeteKonto = await db.user.findFirst({
      where: { agentId: karta.id, email: { not: email } },
      select: { email: true },
    });
    if (zajeteKonto) {
      console.error(`  POMINIĘTE: karta ${karta.name} ma już konto ${zajeteKonto.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(tajne, 12);
    await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "AGENT", active: true, agentId: karta.id },
      create: { email, name: karta.name, passwordHash, role: "AGENT", active: true, agentId: karta.id },
    });

    const dane = {
      agent: karta.name.trim().split(/\s+/)[0],
      login: email,
      haslo: tajne,
      kod: karta.code!,
      linkPolecajacy: linkPolecajacy(karta.code!),
      linkPanelu: PANEL,
      linkQr: `${PANEL}/api/agenci/${encodeURIComponent(karta.code!)}/qr`,
      zmianaHaslaMozliwa: false,
    };

    let wyslane = false;
    try {
      await wyslijList({
        do: email,
        temat: tematPowitania(dane),
        tresc: powitanieTekst(dane),
        trescHtml: powitanieHtml(dane),
        kluczIdempotencji: `powitanie-agenta:${karta.code}:${email}`,
      });
      wyslane = true;
      console.log(`  list powitalny → ${email}`);
    } catch (e) {
      console.error(`  BŁĄD wysyłki do ${email}: ${e instanceof Error ? e.message : e}`);
    }

    podsumowanie.push({
      agent: karta.name, kod: karta.code!, login: email, haslo: tajne,
      telefon: karta.phone, nowaKarta,
      linkPolecajacy: linkPolecajacy(karta.code!), powitanieWyslane: wyslane,
    });
  }

  // Podsumowanie dla biura na końcu, żeby zawierało też to, co się nie udało.
  if (podsumowanie.length > 0) {
    const dane = { konta: podsumowanie, linkPanelu: PANEL };
    if (!naprawde) {
      console.log(`\n[suchy bieg] podsumowanie poszłoby na: ${ADMIN || "(ADMIN_EMAIL nieustawiony)"}`);
    } else {
      await wyslijList({
        do: ADMIN,
        temat: tematPodsumowania(dane),
        tresc: podsumowanieTekst(dane),
        trescHtml: podsumowanieHtml(dane),
      });
      console.log(`\npodsumowanie → ${ADMIN}`);
    }
  }

  if (!naprawde) console.log("\nSUCHY BIEG — nic nie zapisano i nic nie wysłano. Dodaj --wyslij.");
} finally {
  await db.$disconnect();
}

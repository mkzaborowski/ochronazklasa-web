// Nadaje kod polecajacy agentom, ktorzy jeszcze go nie maja.
// Uzycie: npm run agenci:kody          (podglad, nic nie zapisuje)
//         npm run agenci:kody -- --zapisz
//
// Agenci zalozeni przed wprowadzeniem linkow polecajacych nie maja kodu, wiec
// nie maja linku - a bez linku ich sprzedaz online nie ma jak sie przypisac.
// Skrypt jest idempotentny: agenta z kodem pomija.

import { PrismaClient } from "@prisma/client";

const OGONKI = { Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z" };

const normalizuj = (s) =>
  typeof s === "string"
    ? (s.trim().toUpperCase().replace(/[ĄĆĘŁŃÓŚŹŻ]/g, (z) => OGONKI[z] ?? z)
        .replace(/[^A-Z0-9-]/g, "").replace(/^-+|-+$/g, "") || null)
    : null;

const proponuj = (nazwa, zajete) => {
  const czesci = nazwa.trim().split(/\s+/).map(normalizuj).filter(Boolean);
  let podstawa = czesci.length >= 2
    ? (czesci[0][0] + czesci[czesci.length - 1]).slice(0, 16)
    : (czesci[0] ?? "").slice(0, 16);
  if (podstawa.length < 2) podstawa = "AGENT";
  if (!zajete.has(podstawa)) return podstawa;
  for (let i = 2; i < 1000; i++) {
    const k = `${podstawa.slice(0, 16 - String(i).length)}${i}`;
    if (!zajete.has(k)) return k;
  }
  throw new Error(`nie udalo sie znalezc wolnego kodu dla ${nazwa}`);
};

const zapisz = process.argv.includes("--zapisz");
const db = new PrismaClient();

try {
  const agenci = await db.agent.findMany({
    select: { id: true, name: true, code: true, codeHistory: true },
    orderBy: { name: "asc" },
  });
  const zajete = new Set(
    agenci.flatMap((a) => [a.code, ...a.codeHistory]).filter(Boolean),
  );

  let nadane = 0;
  for (const a of agenci) {
    if (a.code) {
      console.log(`  =    ${a.name.padEnd(28)} ma juz kod ${a.code}`);
      continue;
    }
    const kod = proponuj(a.name, zajete);
    zajete.add(kod);
    nadane++;
    console.log(`  ${zapisz ? "+" : "?"}    ${a.name.padEnd(28)} -> ${kod}`);
    if (zapisz) await db.agent.update({ where: { id: a.id }, data: { code: kod } });
  }

  console.log(
    nadane === 0
      ? "\nWszyscy agenci maja kod - nic do zrobienia.\n"
      : zapisz
        ? `\nNadano ${nadane} kodow.\n`
        : `\n${nadane} agentow bez kodu. Uruchom ponownie z --zapisz, zeby zapisac.\n`,
  );
} finally {
  await db.$disconnect();
}

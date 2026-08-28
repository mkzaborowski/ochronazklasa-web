// Zaklada (albo aktualizuje) konto agenta w panelu i podpina je do jego karty.
// Uzycie: npm run konto-agenta -- <email-logowania> <haslo> <KOD-AGENTA>
//
// Konto z rola AGENT widzi wylacznie /moje: swoja karte, swoje szkoly, polisy
// tych szkol i sprzedaz online ze swoich kodow. Reszta panelu jest dla niego
// zamknieta - patrz requireBiuro w src/lib/auth-helpers.ts.
//
// Bez podpiecia do karty (agentId) konto dziala, ale nie ma czego pokazac,
// dlatego kod agenta jest tu obowiazkowy.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, haslo, kodSurowy] = process.argv.slice(2);

if (!email || !haslo || !kodSurowy) {
  console.error("Uzycie: npm run konto-agenta -- <email> <haslo> <KOD-AGENTA>");
  process.exit(1);
}
if (haslo.length < 10) {
  console.error("Haslo musi miec co najmniej 10 znakow.");
  process.exit(1);
}

const kod = kodSurowy.trim().toUpperCase();
const db = new PrismaClient();

try {
  const agent = await db.agent.findFirst({ where: { code: kod } });
  if (!agent) {
    const dostepne = await db.agent.findMany({
      where: { code: { not: null } },
      select: { name: true, code: true },
      orderBy: { name: "asc" },
    });
    console.error(`Nie ma agenta o kodzie ${kod}. Dostepne kody:`);
    for (const a of dostepne) console.error(`  ${String(a.code).padEnd(16)} ${a.name}`);
    process.exit(1);
  }

  // Jedna karta = jedno konto. Inaczej nie wiadomo, kto naprawdę sie zalogowal.
  const zajete = await db.user.findFirst({
    where: { agentId: agent.id, email: { not: email } },
    select: { email: true },
  });
  if (zajete) {
    console.error(`Karta ${agent.name} jest juz podpieta do konta ${zajete.email}.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(haslo, 12);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "AGENT", active: true, agentId: agent.id },
    create: {
      email,
      name: agent.name,
      passwordHash,
      role: "AGENT",
      active: true,
      agentId: agent.id,
    },
  });

  console.log(`OK  ${user.email} -> ${agent.name} (kod ${kod})`);
  console.log("    Logowanie: https://web.ochronazklasa.pl/login");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await db.$disconnect();
}

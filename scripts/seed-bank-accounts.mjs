// Import bank accounts from a CSV into the BankAccount pool.
// CSV format (header required): accountNumber,variantCode
//
// Usage: npm run seed-accounts -- data/bank-accounts.csv

import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const file = process.argv[2] ?? "data/bank-accounts.csv";

const raw = await readFile(file, "utf8").catch(() => {
  console.error(`Cannot read ${file}`);
  process.exit(1);
});

const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const header = lines.shift()?.toLowerCase();
if (!header || !header.includes("accountnumber") || !header.includes("variantcode")) {
  console.error('CSV must start with header: accountNumber,variantCode');
  process.exit(1);
}

const db = new PrismaClient();
let created = 0;
let skipped = 0;

try {
  for (const line of lines) {
    const [accountNumber, variantCode] = line.split(",").map((s) => s.trim());
    if (!accountNumber || !variantCode) continue;
    const numberValue = Number.parseInt(accountNumber.replace(/\D/g, "").slice(-6), 10) || null;
    const res = await db.bankAccount.upsert({
      where: { accountNumber },
      update: { variantCode, numberValue },
      create: { accountNumber, variantCode, numberValue },
    });
    res ? created++ : skipped++;
  }
  const summary = await db.bankAccount.groupBy({
    by: ["variantCode"],
    where: { assigned: false },
    _count: true,
  });
  console.log(`✓ Imported/updated ${created} accounts.`);
  console.log("Available (unassigned) per variant:");
  for (const row of summary) console.log(`  ${row.variantCode}: ${row._count}`);
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}

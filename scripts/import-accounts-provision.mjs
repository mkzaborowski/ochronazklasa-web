// ONE-TIME provisioning import of the bank-account / policy-number pool from a
// "Stan druków" XLSX. Unlike the normal Settings upload (which only takes free
// accounts), this seeds the WHOLE current state:
//   - Wykorzystane = true  -> imported as assigned=true  (used; number reserved)
//   - Wykorzystane = false -> imported as assigned=false (free; available)
//
// Idempotent (skipDuplicates by accountNumber). Use only for first provisioning.
//   node scripts/import-accounts-provision.mjs <file.xlsx>

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
if (!file) {
  console.error("usage: node import-accounts-provision.mjs <file.xlsx>");
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];

const col = {};
ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
  if (c.value != null) col[String(c.value).trim()] = i;
});
const acctCol = col["Numer rachunku"];
const usedCol = col["Wykorzystane"];
if (!acctCol) {
  console.error("Missing 'Numer rachunku' column");
  process.exit(1);
}

const seen = new Set();
const records = [];
ws.eachRow((row, r) => {
  if (r === 1) return;
  const acct = String(row.getCell(acctCol)?.value ?? "").trim();
  if (!acct || seen.has(acct)) return;
  seen.add(acct);
  const raw = usedCol ? row.getCell(usedCol)?.value : false;
  const used = raw === true || String(raw).toLowerCase() === "true";
  records.push({
    accountNumber: acct,
    numberValue: Number.parseInt(acct.replace(/\D/g, "").slice(-6), 10) || null,
    variantCode: null,
    assigned: used,
    assignedAt: used ? new Date() : null,
  });
});

const usedN = records.filter((r) => r.assigned).length;
console.log(`Parsed ${records.length} accounts (used: ${usedN}, free: ${records.length - usedN}).`);

const db = new PrismaClient();
try {
  let inserted = 0;
  for (let i = 0; i < records.length; i += 500) {
    const res = await db.bankAccount.createMany({
      data: records.slice(i, i + 500),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  const [used, free] = await Promise.all([
    db.bankAccount.count({ where: { assigned: true } }),
    db.bankAccount.count({ where: { assigned: false } }),
  ]);
  console.log(`✓ Inserted ${inserted} (skipped ${records.length - inserted} already present).`);
  console.log(`Pool now → used: ${used}, free: ${free}`);
} catch (e) {
  console.error("Import failed:", e.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}

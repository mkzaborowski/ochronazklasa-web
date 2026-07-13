"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { policyNumberFromAccount } from "@/lib/interrisk/variants";

export type ImportSummary = {
  totalRows: number;
  candidates: number; // unique account numbers found in the file
  alreadyHave: number; // already known to the app (pool or issued policy)
  imported: number;
};

export type ImportState = { error?: string; summary?: ImportSummary };

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown };
    if (o.text != null) return String(o.text);
    if (o.result != null) return String(o.result);
  }
  return String(v).trim();
}

/**
 * Import bank accounts / policy numbers from a "Stan druków" XLSX.
 *
 * Usage ("wykorzystane") is tracked by the APP, not by the document: the file's
 * "Wykorzystane" column is ignored. A number is skipped only when the app
 * already knows it — it's in the pool (free or assigned) or its policy number
 * already appears on an issued policy. Everything else is added as free.
 * (Initial provisioning that trusted the document was a one-time step:
 * scripts/import-accounts-provision.mjs.)
 */
export async function importBankAccounts(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireRole(["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Wybierz plik XLSX." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Plik musi być w formacie .xlsx" };

  let ws: ExcelJS.Worksheet | undefined;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    ws = wb.worksheets[0];
  } catch {
    return { error: "Nie udało się odczytać pliku XLSX." };
  }
  if (!ws) return { error: "Plik nie zawiera arkusza." };

  // Map columns by header
  const col: Record<string, number> = {};
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
    const v = cellStr(c.value);
    if (v) col[v] = i;
  });
  const cAcct = col["Numer rachunku"];
  if (!cAcct) return { error: 'Brak kolumny "Numer rachunku" w pliku.' };

  // Collect ALL account numbers from the file (de-duped)
  const seen = new Set<string>();
  const candidates: string[] = [];
  let totalRows = 0;
  ws.eachRow((row, r) => {
    if (r === 1) return;
    totalRows++;
    const accountNumber = cellStr(row.getCell(cAcct).value).replace(/\s+/g, " ").trim();
    if (!accountNumber || seen.has(accountNumber)) return;
    seen.add(accountNumber);
    candidates.push(accountNumber);
  });

  // App-side usage check: skip numbers already in the pool (any state) or
  // already printed on an issued policy.
  const [existing, issued] = await Promise.all([
    db.bankAccount.findMany({
      where: { accountNumber: { in: candidates } },
      select: { accountNumber: true },
    }),
    db.generatedPolicy.findMany({
      where: { policyNumber: { in: candidates.map(policyNumberFromAccount) } },
      select: { policyNumber: true },
    }),
  ]);
  const have = new Set(existing.map((e) => e.accountNumber));
  const usedNumbers = new Set(issued.map((p) => p.policyNumber));

  const toInsert = candidates.filter(
    (a) => !have.has(a) && !usedNumbers.has(policyNumberFromAccount(a)),
  );

  if (toInsert.length > 0) {
    await db.bankAccount.createMany({
      data: toInsert.map((accountNumber) => ({
        accountNumber,
        numberValue: Number.parseInt(policyNumberFromAccount(accountNumber), 10) || null,
        variantCode: null,
        assigned: false,
      })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    userId: user.id,
    action: "bankaccounts.import",
    entity: "BankAccount",
    metadata: { file: file.name, imported: toInsert.length, candidates: candidates.length },
  });
  revalidatePath("/settings");

  return {
    summary: {
      totalRows,
      candidates: candidates.length,
      alreadyHave: candidates.length - toInsert.length,
      imported: toInsert.length,
    },
  };
}

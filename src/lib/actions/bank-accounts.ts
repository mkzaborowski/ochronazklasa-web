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
  importedUsed: number; // of imported: marked used per the file's Wykorzystane
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
 * Precedence rule: what the APP has recorded is authoritative. A number the app
 * already knows (a pool row — free or assigned — or a policy number on an
 * issued policy) is skipped and its state is never changed by the file.
 * Only numbers NEW to the app are inserted, and for those the file's
 * "Wykorzystane" column is respected: true → stored as used (reserved, never
 * assigned), false → free.
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
  const cUsed = col["Wykorzystane"];
  if (!cAcct) return { error: 'Brak kolumny "Numer rachunku" w pliku.' };

  // Collect ALL account numbers from the file (de-duped) + their file-side state
  const seen = new Set<string>();
  const candidates: { accountNumber: string; fileUsed: boolean }[] = [];
  let totalRows = 0;
  ws.eachRow((row, r) => {
    if (r === 1) return;
    totalRows++;
    const accountNumber = cellStr(row.getCell(cAcct).value).replace(/\s+/g, " ").trim();
    if (!accountNumber || seen.has(accountNumber)) return;
    seen.add(accountNumber);
    const usedRaw = cUsed ? row.getCell(cUsed).value : false;
    const fileUsed = usedRaw === true || String(usedRaw).toLowerCase() === "true";
    candidates.push({ accountNumber, fileUsed });
  });

  // App precedence: numbers the app already knows (pool row in any state, or a
  // policy number on an issued policy) are skipped — their recorded state wins.
  const accountNumbers = candidates.map((c) => c.accountNumber);
  const [existing, issued] = await Promise.all([
    db.bankAccount.findMany({
      where: { accountNumber: { in: accountNumbers } },
      select: { accountNumber: true },
    }),
    db.generatedPolicy.findMany({
      where: { policyNumber: { in: accountNumbers.map(policyNumberFromAccount) } },
      select: { policyNumber: true },
    }),
  ]);
  const have = new Set(existing.map((e) => e.accountNumber));
  const usedNumbers = new Set(issued.map((p) => p.policyNumber));

  const toInsert = candidates.filter(
    (c) => !have.has(c.accountNumber) && !usedNumbers.has(policyNumberFromAccount(c.accountNumber)),
  );

  if (toInsert.length > 0) {
    const now = new Date();
    await db.bankAccount.createMany({
      data: toInsert.map((c) => ({
        accountNumber: c.accountNumber,
        numberValue: Number.parseInt(policyNumberFromAccount(c.accountNumber), 10) || null,
        variantCode: null,
        // New-to-app numbers respect the file's Wykorzystane column
        assigned: c.fileUsed,
        assignedAt: c.fileUsed ? now : null,
      })),
      skipDuplicates: true,
    });
  }

  const importedUsed = toInsert.filter((c) => c.fileUsed).length;

  await logAudit({
    userId: user.id,
    action: "bankaccounts.import",
    entity: "BankAccount",
    metadata: {
      file: file.name,
      imported: toInsert.length,
      importedUsed,
      candidates: candidates.length,
    },
  });
  revalidatePath("/settings");

  return {
    summary: {
      totalRows,
      candidates: candidates.length,
      alreadyHave: candidates.length - toInsert.length,
      imported: toInsert.length,
      importedUsed,
    },
  };
}

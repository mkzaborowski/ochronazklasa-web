"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { policyNumberFromAccount } from "@/lib/interrisk/variants";

// ---------------------------------------------------------------------------
// Controlled two-stage import: preview (parse + cross-check) -> user reviews
// and edits decisions row by row -> commit. App-recorded state stays
// authoritative: numbers the app already knows are never modified by a file.
// ---------------------------------------------------------------------------

export type ImportRowStatus = "new" | "pool-free" | "pool-used" | "issued";
export type ImportDecision = "free" | "used" | "skip";

export type ImportPreviewRow = {
  accountNumber: string;
  policyNumber: string;
  fileUsed: boolean; // the file's "Wykorzystane" column
  status: ImportRowStatus; // what the app already knows about this number
};

export type PreviewState = {
  error?: string;
  fileName?: string;
  totalRows?: number;
  rows?: ImportPreviewRow[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown };
    if (o.text != null) return String(o.text);
    if (o.result != null) return String(o.result);
  }
  return String(v).trim();
}

/** Stage 1: parse the XLSX and cross-check every number against the app DB. */
export async function previewBankAccountImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  await requireRole(["ADMIN"]);
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

  const col: Record<string, number> = {};
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
    const v = cellStr(c.value);
    if (v) col[v] = i;
  });
  const cAcct = col["Numer rachunku"];
  const cUsed = col["Wykorzystane"];
  if (!cAcct) return { error: 'Brak kolumny "Numer rachunku" w pliku.' };

  const seen = new Set<string>();
  const parsed: { accountNumber: string; fileUsed: boolean }[] = [];
  let totalRows = 0;
  ws.eachRow((row, r) => {
    if (r === 1) return;
    totalRows++;
    const accountNumber = cellStr(row.getCell(cAcct).value).replace(/\s+/g, " ").trim();
    if (!accountNumber || seen.has(accountNumber)) return;
    seen.add(accountNumber);
    const usedRaw = cUsed ? row.getCell(cUsed).value : false;
    parsed.push({
      accountNumber,
      fileUsed: usedRaw === true || String(usedRaw).toLowerCase() === "true",
    });
  });

  const accountNumbers = parsed.map((p) => p.accountNumber);
  const [existing, issued] = await Promise.all([
    db.bankAccount.findMany({
      where: { accountNumber: { in: accountNumbers } },
      select: { accountNumber: true, assigned: true },
    }),
    db.generatedPolicy.findMany({
      where: { policyNumber: { in: accountNumbers.map(policyNumberFromAccount) } },
      select: { policyNumber: true },
    }),
  ]);
  const pool = new Map(existing.map((e) => [e.accountNumber, e.assigned]));
  const issuedNums = new Set(issued.map((p) => p.policyNumber));

  const rows: ImportPreviewRow[] = parsed.map((p) => {
    const policyNumber = policyNumberFromAccount(p.accountNumber);
    let status: ImportRowStatus = "new";
    if (pool.has(p.accountNumber)) status = pool.get(p.accountNumber) ? "pool-used" : "pool-free";
    else if (issuedNums.has(policyNumber)) status = "issued";
    return { accountNumber: p.accountNumber, policyNumber, fileUsed: p.fileUsed, status };
  });

  return { fileName: file.name, totalRows, rows };
}

export type CommitState = {
  error?: string;
  addedFree?: number;
  addedUsed?: number;
  skipped?: number;
};

/** Stage 2: commit the reviewed decisions. Re-validates against the DB. */
export async function commitBankAccountImport(
  decisions: { accountNumber: string; decision: ImportDecision }[],
): Promise<CommitState> {
  const user = await requireRole(["ADMIN"]);
  const wanted = decisions.filter((d) => d.decision !== "skip");
  if (wanted.length === 0) return { error: "Nie wybrano żadnych numerów do dodania." };
  if (wanted.length > 5000) return { error: "Zbyt wiele wierszy naraz (limit 5000)." };

  // Re-check against the DB at commit time (app state is authoritative).
  const nums = wanted.map((d) => d.accountNumber);
  const [existing, issued] = await Promise.all([
    db.bankAccount.findMany({
      where: { accountNumber: { in: nums } },
      select: { accountNumber: true },
    }),
    db.generatedPolicy.findMany({
      where: { policyNumber: { in: nums.map(policyNumberFromAccount) } },
      select: { policyNumber: true },
    }),
  ]);
  const have = new Set(existing.map((e) => e.accountNumber));
  const issuedNums = new Set(issued.map((p) => p.policyNumber));

  const now = new Date();
  const toInsert = wanted.filter(
    (d) => !have.has(d.accountNumber) && !issuedNums.has(policyNumberFromAccount(d.accountNumber)),
  );

  if (toInsert.length > 0) {
    await db.bankAccount.createMany({
      data: toInsert.map((d) => ({
        accountNumber: d.accountNumber,
        numberValue: Number.parseInt(policyNumberFromAccount(d.accountNumber), 10) || null,
        variantCode: null,
        assigned: d.decision === "used",
        assignedAt: d.decision === "used" ? now : null,
      })),
      skipDuplicates: true,
    });
  }

  const addedFree = toInsert.filter((d) => d.decision === "free").length;
  const addedUsed = toInsert.length - addedFree;
  await logAudit({
    userId: user.id,
    action: "bankaccounts.import",
    entity: "BankAccount",
    metadata: { addedFree, addedUsed, requested: wanted.length },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/pool");
  return { addedFree, addedUsed, skipped: wanted.length - toInsert.length };
}

// ---------------------------------------------------------------------------
// Pool management: bulk + range operations and single-number edits.
// Guard: a number linked to an issued policy (assignedToPolicyId) is LOCKED.
// ---------------------------------------------------------------------------

export type PoolOp = "reserve" | "release" | "delete";
export type PoolOpResult = { error?: string; affected?: number };

async function runPoolOp(
  where: { id?: { in: string[] }; numberValue?: { gte: number; lte: number } },
  op: PoolOp,
): Promise<number> {
  if (op === "reserve") {
    const res = await db.bankAccount.updateMany({
      where: { ...where, assigned: false },
      data: { assigned: true, assignedAt: new Date() },
    });
    return res.count;
  }
  if (op === "release") {
    const res = await db.bankAccount.updateMany({
      // never release a number attached to a real policy
      where: { ...where, assigned: true, assignedToPolicyId: null },
      data: { assigned: false, assignedAt: null, assignedToSchoolId: null },
    });
    return res.count;
  }
  const res = await db.bankAccount.deleteMany({
    where: { ...where, assignedToPolicyId: null },
  });
  return res.count;
}

/** Apply an operation to explicitly selected pool rows. */
export async function poolBulkOp(ids: string[], op: PoolOp): Promise<PoolOpResult> {
  const user = await requireRole(["ADMIN"]);
  if (ids.length === 0) return { error: "Nie zaznaczono żadnych numerów." };
  if (ids.length > 2000) return { error: "Zbyt wiele wierszy naraz (limit 2000)." };
  const affected = await runPoolOp({ id: { in: ids } }, op);
  await logAudit({
    userId: user.id,
    action: `bankaccounts.${op}`,
    entity: "BankAccount",
    metadata: { selected: ids.length, affected },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/pool");
  return { affected };
}

/** Apply an operation to a numeric policy-number range (inclusive). */
export async function poolRangeOp(from: number, to: number, op: PoolOp): Promise<PoolOpResult> {
  const user = await requireRole(["ADMIN"]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    return { error: "Nieprawidłowy zakres numerów." };
  }
  if (to - from > 100000) return { error: "Zakres zbyt szeroki." };
  const affected = await runPoolOp({ numberValue: { gte: from, lte: to } }, op);
  await logAudit({
    userId: user.id,
    action: `bankaccounts.range.${op}`,
    entity: "BankAccount",
    metadata: { from, to, affected },
  });
  revalidatePath("/settings");
  revalidatePath("/settings/pool");
  return { affected };
}

/** Correct a single account number (typo fix). Locked for policy-linked rows. */
export async function updatePoolAccountNumber(
  id: string,
  newAccountNumber: string,
): Promise<PoolOpResult> {
  const user = await requireRole(["ADMIN"]);
  const clean = newAccountNumber.replace(/\s+/g, " ").trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 16) return { error: "Numer konta wygląda na niekompletny." };

  const row = await db.bankAccount.findUnique({ where: { id } });
  if (!row) return { error: "Nie znaleziono numeru." };
  if (row.assignedToPolicyId) {
    return { error: "Ten numer jest powiązany z wystawioną polisą — edycja zablokowana." };
  }
  const dup = await db.bankAccount.findUnique({ where: { accountNumber: clean } });
  if (dup && dup.id !== id) return { error: "Taki numer konta już istnieje w puli." };

  await db.bankAccount.update({
    where: { id },
    data: {
      accountNumber: clean,
      numberValue: Number.parseInt(policyNumberFromAccount(clean), 10) || null,
    },
  });
  await logAudit({
    userId: user.id,
    action: "bankaccounts.edit",
    entity: "BankAccount",
    entityId: id,
    metadata: { from: row.accountNumber, to: clean },
  });
  revalidatePath("/settings/pool");
  return { affected: 1 };
}

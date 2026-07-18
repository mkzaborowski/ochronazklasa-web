import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PoolTable, type PoolRow } from "@/components/pool-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const fieldClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function buildWhere(q?: string, status?: string): Prisma.BankAccountWhereInput {
  const and: Prisma.BankAccountWhereInput[] = [];
  if (status === "free") and.push({ assigned: false });
  else if (status === "reserved") and.push({ assigned: true, assignedToPolicyId: null });
  else if (status === "issued") and.push({ assignedToPolicyId: { not: null } });
  if (q?.trim()) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.BankAccountWhereInput[] = [{ accountNumber: { contains: q.trim() } }];
    if (digits.length >= 1 && digits.length <= 6) {
      const n = Number.parseInt(digits, 10);
      // prefix match on the 6-digit policy number, e.g. "6768" -> 676800..676899
      const span = 10 ** (6 - digits.length);
      or.push({ numberValue: { gte: n * span, lte: n * span + span - 1 } });
    }
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

export default async function PoolPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where = buildWhere(sp.q, sp.status);

  let rows: PoolRow[] = [];
  let total = 0;
  let stats = { free: 0, reserved: 0, issued: 0 };
  let dbError = false;
  try {
    const [found, count, free, reserved, issued] = await Promise.all([
      db.bankAccount.findMany({
        where,
        orderBy: [{ numberValue: { sort: "asc", nulls: "last" } }, { accountNumber: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          school: { select: { id: true, nazwa: true } },
        },
      }),
      db.bankAccount.count({ where }),
      db.bankAccount.count({ where: { assigned: false } }),
      db.bankAccount.count({ where: { assigned: true, assignedToPolicyId: null } }),
      db.bankAccount.count({ where: { assignedToPolicyId: { not: null } } }),
    ]);
    total = count;
    stats = { free, reserved, issued };
    rows = found.map((a) => ({
      id: a.id,
      accountNumber: a.accountNumber,
      policyNumber: a.numberValue != null ? String(a.numberValue).padStart(6, "0") : "—",
      status: a.assignedToPolicyId ? "issued" : a.assigned ? "reserved" : "free",
      schoolId: a.school?.id ?? null,
      schoolName: a.school?.nazwa ?? null,
    }));
  } catch {
    dbError = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, page: sp.page, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/settings" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pula numerów</h1>
          <p className="text-sm text-muted-foreground">
            {dbError
              ? "Baza danych niedostępna."
              : `wolne: ${stats.free} · zarezerwowane: ${stats.reserved} · na polisach: ${stats.issued}`}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Szukaj: nr polisy (np. 676815) lub fragment konta…"
          className={`${fieldClass} min-w-64 flex-1`}
        />
        <select name="status" defaultValue={sp.status ?? ""} className={fieldClass}>
          <option value="">Wszystkie</option>
          <option value="free">Wolne</option>
          <option value="reserved">Wykorzystane (zarezerwowane)</option>
          <option value="issued">Na wystawionych polisach</option>
        </select>
        <button type="submit" className={`${fieldClass} bg-secondary px-4 font-medium`}>
          Filtruj
        </button>
      </form>

      {!dbError && (
        <>
          <PoolTable rows={rows} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total.toLocaleString("pl-PL")} pozycji · strona {page} z {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={qs({ page: page - 1 })} className={`${fieldClass} flex items-center px-3`}>
                  Poprzednia
                </Link>
              )}
              {page < totalPages && (
                <Link href={qs({ page: page + 1 })} className={`${fieldClass} flex items-center px-3`}>
                  Następna
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

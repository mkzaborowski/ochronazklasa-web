import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { digitsOnly, normalizeRegon } from "@/lib/identifiers";
import { SchoolAgentSelect } from "@/components/school-agent-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const VOIVODESHIPS = [
  "DOLNOŚLĄSKIE", "KUJAWSKO-POMORSKIE", "LUBELSKIE", "LUBUSKIE", "ŁÓDZKIE",
  "MAŁOPOLSKIE", "MAZOWIECKIE", "OPOLSKIE", "PODKARPACKIE", "PODLASKIE",
  "POMORSKIE", "ŚLĄSKIE", "ŚWIĘTOKRZYSKIE", "WARMIŃSKO-MAZURSKIE",
  "WIELKOPOLSKIE", "ZACHODNIOPOMORSKIE",
];
const fieldClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function buildWhere(q?: string, voivodeship?: string, agent?: string): Prisma.SchoolRecordWhereInput {
  const and: Prisma.SchoolRecordWhereInput[] = [];
  if (voivodeship) and.push({ voivodeship });
  if (agent === "none") and.push({ assignedAgentId: null });
  else if (agent && agent !== "all") and.push({ assignedAgentId: agent });
  if (q && q.trim()) {
    const digits = digitsOnly(q);
    const or: Prisma.SchoolRecordWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
    if (digits.length >= 4) {
      or.push({ regonNormalized: normalizeRegon(q) });
      or.push({ regonRaw: { contains: digits } });
    }
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; voiv?: string; agent?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const where = buildWhere(sp.q, sp.voiv, sp.agent);

  let rows: Awaited<ReturnType<typeof db.schoolRecord.findMany>> = [];
  let total = 0;
  let agents: { id: string; name: string }[] = [];
  let dbError = false;
  try {
    [rows, total, agents] = await Promise.all([
      db.schoolRecord.findMany({
        where,
        include: { assignedAgent: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.schoolRecord.count({ where }),
      db.agent.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
  } catch {
    dbError = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, voiv: sp.voiv, agent: sp.agent, page: sp.page, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Baza szkół</h1>
        <p className="text-sm text-muted-foreground">
          {dbError ? "Baza danych niedostępna." : `${total.toLocaleString("pl-PL")} szkół w bazie referencyjnej`}
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Szukaj: nazwa, miasto, REGON…" className={`${fieldClass} min-w-60 flex-1`} />
        <select name="voiv" defaultValue={sp.voiv ?? ""} className={fieldClass}>
          <option value="">Wszystkie województwa</option>
          {VOIVODESHIPS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select name="agent" defaultValue={sp.agent ?? ""} className={fieldClass}>
          <option value="">Wszyscy agenci</option>
          <option value="none">Bez agenta</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="submit" className={`${fieldClass} bg-secondary px-4 font-medium`}>Filtruj</button>
      </form>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Brak połączenia z bazą. Uruchom <code>npm run db:push</code> oraz <code>npm run import:schools</code>.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>REGON</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Miasto</TableHead>
                  <TableHead>Województwo</TableHead>
                  <TableHead className="text-right">Uczniów</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Brak wyników.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-64 truncate font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.regonRaw}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.type ?? "—"}</TableCell>
                      <TableCell>{s.city ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.voivodeship ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.studentCount ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.phone ?? ""}
                        {s.email ? <div className="truncate">{s.email}</div> : null}
                      </TableCell>
                      <TableCell>
                        <SchoolAgentSelect schoolRecordId={s.id} agentId={s.assignedAgentId} agents={agents} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Strona {page} z {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={qs({ page: page - 1 })} className={`${fieldClass} flex items-center px-3`}>Poprzednia</Link>
              ) : null}
              {page < totalPages ? (
                <Link href={qs({ page: page + 1 })} className={`${fieldClass} flex items-center px-3`}>Następna</Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

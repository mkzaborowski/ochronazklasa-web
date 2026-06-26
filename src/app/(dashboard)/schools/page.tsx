import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function loadSchools(q?: string) {
  try {
    const schools = await db.school.findMany({
      where: q
        ? {
            OR: [
              { nazwa: { contains: q, mode: "insensitive" } },
              { regonPesel: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { policies: true } } },
    });
    return { schools, dbError: false };
  } catch {
    return { schools: [], dbError: true };
  }
}

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { schools, dbError } = await loadSchools(q);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Szkoły / Ubezpieczający</h1>
          <p className="text-sm text-muted-foreground">
            {schools.length} {schools.length === 1 ? "profil" : "profili"} z polisami InterRisk
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/schools/new" />}>
          <Plus className="size-4" /> Wystaw polisę
        </Button>
      </div>

      <form className="flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Szukaj: nazwa, REGON…" className="pl-8" />
        </div>
      </form>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> i uruchom{" "}
          <code>npm run db:push</code>.
        </div>
      ) : schools.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Brak szkół. Kliknij „Wystaw polisę”, aby utworzyć pierwszy profil.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {schools.map((s) => (
            <Link
              key={s.id}
              href={`/schools/${s.id}`}
              className="flex items-center gap-4 p-4 hover:bg-accent/50"
            >
              <div className="flex-1">
                <div className="font-medium">{s.nazwa}</div>
                <div className="text-xs text-muted-foreground">
                  REGON/PESEL: {s.regonPesel} · dodano {formatDate(s.createdAt)}
                </div>
              </div>
              <Badge variant="secondary">
                {s._count.policies} {s._count.policies === 1 ? "polisa" : "polis"}
              </Badge>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

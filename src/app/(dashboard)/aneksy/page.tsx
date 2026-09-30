import Link from "next/link";
import { Download, FilePlus2, Pencil } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBiuro } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { dataPL, doZaplatyGrosze, formatujKwote, normalizujNumerPolisy } from "@/lib/aneksy/tresc";

export const dynamic = "force-dynamic";

const fieldClass =
  "h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const kiedy = (d: Date) =>
  d.toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

/**
 * Wspólna lista aneksów. Widzi ją każde konto biura — kto wystawił, widać
 * w kolumnie, ale nikt nie ma „swoich" aneksów, do których inni nie mają
 * dostępu.
 */
export default async function AneksyPage({
  searchParams,
}: {
  searchParams: Promise<{ szukaj?: string }>;
}) {
  await requireBiuro();
  const { szukaj = "" } = await searchParams;
  const fraza = szukaj.trim();
  const cyfry = normalizujNumerPolisy(fraza);

  const where: Prisma.AneksWhereInput = fraza
    ? {
        OR: [
          ...(cyfry.length >= 3 ? [{ numerPolisy: { contains: cyfry } }] : []),
          { nazwaSzkoly: { contains: fraza, mode: "insensitive" } },
          { etykieta: { contains: fraza, mode: "insensitive" } },
          { numerAneksu: { contains: fraza, mode: "insensitive" } },
        ],
      }
    : {};

  const aneksy = await db.aneks.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
  const ludzie = await db.user.findMany({
    where: {
      id: { in: [...new Set(aneksy.flatMap((a) => [a.createdById, a.updatedById]))].filter((x): x is string => !!x) },
    },
    select: { id: true, name: true, email: true },
  });
  const kto = (uid: string | null) => {
    const u = ludzie.find((x) => x.id === uid);
    return u ? u.name?.trim() || u.email : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Aneksy</h1>
          <p className="text-sm text-muted-foreground">
            Wszystkie aneksy do polis grupowych, wystawione przez całe biuro.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/aneksy/nowy" />}>
          <FilePlus2 /> Wystaw aneks
        </Button>
      </div>

      <form className="flex gap-2">
        <input
          name="szukaj"
          defaultValue={fraza}
          placeholder="Szukaj: numer polisy, szkoła, numer aneksu"
          className={fieldClass}
        />
        <Button type="submit" variant="outline" size="lg">Szukaj</Button>
      </form>

      {aneksy.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {fraza ? "Nic nie pasuje do wyszukiwania." : "Nie ma jeszcze żadnego aneksu."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aneks</TableHead>
                <TableHead>Polisa</TableHead>
                <TableHead>Szkoła</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Do zapłaty</TableHead>
                <TableHead>Wystawił(a)</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aneksy.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link href={`/aneksy/${a.id}`} className="hover:underline">nr {a.numerAneksu}</Link>
                  </TableCell>
                  <TableCell className="font-mono">A-A {a.numerPolisy}</TableCell>
                  <TableCell className="max-w-72 truncate" title={a.nazwaSzkoly}>
                    {a.etykieta || a.nazwaSzkoly}
                  </TableCell>
                  <TableCell>{dataPL(a.dataAneksu.toISOString())}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatujKwote(doZaplatyGrosze(a))}
                    {a.liczbaZwolnionych > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {a.liczbaUbezpieczonych} os., {a.liczbaZwolnionych} zwoln.
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">{a.liczbaUbezpieczonych} os.</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {kto(a.createdById)}
                    <div className="text-xs text-muted-foreground">{kiedy(a.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" title="Pobierz Word" nativeButton={false} render={<a href={`/api/aneksy/${a.id}/pobierz`} />}>
                        <Download />
                      </Button>
                      <Button size="icon-sm" variant="ghost" title="Popraw" nativeButton={false} render={<Link href={`/aneksy/${a.id}`} />}>
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

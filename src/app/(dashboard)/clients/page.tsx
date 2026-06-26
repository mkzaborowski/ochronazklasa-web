import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { clientLabel, formatDate } from "@/lib/format";
import { deleteClient } from "@/lib/actions/clients";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { DeleteButton } from "@/components/delete-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type ClientRow = Awaited<ReturnType<typeof loadClients>>["clients"][number];

async function loadClients(q?: string) {
  try {
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { companyName: { contains: q, mode: "insensitive" as const } },
            { nip: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const clients = await db.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { policies: true } } },
    });
    return { clients, dbError: false };
  } catch {
    return { clients: [], dbError: true };
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { clients, dbError } = await loadClients(q);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Klienci</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "klient" : "klientów"} w bazie
          </p>
        </div>
        <ClientFormDialog />
      </div>

      <form className="flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Szukaj: nazwisko, firma, NIP, email…"
            className="pl-8"
          />
        </div>
      </form>

      {dbError ? <DbNotice /> : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klient</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="text-center">Polisy</TableHead>
              <TableHead>Dodano</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && !dbError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Brak klientów. Dodaj pierwszego klienta przyciskiem powyżej.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c: ClientRow) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{clientLabel(c)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {c.type === "COMPANY" ? "Firma" : "Os. fizyczna"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email ?? c.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">{c._count.policies}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DeleteButton action={deleteClient.bind(null, c.id)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DbNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> w pliku{" "}
      <code>.env</code> i uruchom <code>npm run db:push</code>, aby zobaczyć dane.
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { clientLabel, formatDate, statusLabel, statusBadgeClass } from "@/lib/format";
import type { PolicyStatus } from "@prisma/client";
import { INSURERS, PRODUCT_TYPES, POLICY_STATUS_LABELS } from "@/lib/constants";
import { deletePolicy } from "@/lib/actions/policies";
import { PolicyFormDialog } from "@/components/policy-form-dialog";
import { DeleteButton } from "@/components/delete-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fieldClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function loadData(filters: { q?: string; insurer?: string; status?: string }) {
  try {
    const policies = await db.policy.findMany({
      where: {
        insurer:
          filters.insurer === "HESTIA" || filters.insurer === "INTERRISK"
            ? filters.insurer
            : undefined,
        status:
          filters.status && filters.status in POLICY_STATUS_LABELS
            ? (filters.status as PolicyStatus)
            : undefined,
        ...(filters.q
          ? {
              OR: [
                { policyNumber: { contains: filters.q, mode: "insensitive" as const } },
                {
                  client: {
                    OR: [
                      { lastName: { contains: filters.q, mode: "insensitive" as const } },
                      { companyName: { contains: filters.q, mode: "insensitive" as const } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const clients = await db.client.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return { policies, clients, dbError: false };
  } catch {
    return { policies: [], clients: [], dbError: true };
  }
}

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; insurer?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const { policies, clients, dbError } = await loadData(filters);
  const clientOptions = clients.map((c) => ({ id: c.id, label: clientLabel(c) }));
  const productLabel = (id: string) =>
    PRODUCT_TYPES.find((p) => p.id === id)?.label ?? id;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Polisy</h1>
          <p className="text-sm text-muted-foreground">
            {policies.length} {policies.length === 1 ? "polisa" : "polis"}
          </p>
        </div>
        <PolicyFormDialog clients={clientOptions} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Szukaj: numer, klient…"
          className={`${fieldClass} min-w-56 flex-1`}
        />
        <select name="insurer" defaultValue={filters.insurer ?? ""} className={fieldClass}>
          <option value="">Wszyscy ubezpieczyciele</option>
          {Object.values(INSURERS).map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className={fieldClass}>
          <option value="">Wszystkie statusy</option>
          {Object.entries(POLICY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={`${fieldClass} bg-secondary px-4 font-medium`}>
          Filtruj
        </button>
      </form>

      {dbError ? <DbNotice /> : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numer / Produkt</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Ubezpieczyciel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Składka</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length === 0 && !dbError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Brak polis. Dodaj pierwszą polisę przyciskiem powyżej.
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.policyNumber ?? "(bez numeru)"}</div>
                    <div className="text-xs text-muted-foreground">
                      {productLabel(p.productType)}
                    </div>
                  </TableCell>
                  <TableCell>{clientLabel(p.client)}</TableCell>
                  <TableCell>{INSURERS[p.insurer].label}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.premium ? `${p.premium} ${p.currency}` : "—"}
                  </TableCell>
                  <TableCell>
                    <DeleteButton action={deletePolicy.bind(null, p.id)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Wystawianie polis z automatycznym generowaniem dokumentów (Ergo Hestia,
        InterRisk) zostanie dodane w kolejnej fazie —{" "}
        <Link href="/policies/new" className="underline">
          podgląd
        </Link>
        .
      </p>
    </div>
  );
}

function DbNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> w pliku{" "}
      <code>.env</code> i uruchom <code>npm run db:push</code>.
    </div>
  );
}

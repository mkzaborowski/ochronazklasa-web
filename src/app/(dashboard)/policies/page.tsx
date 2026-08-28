import Link from "next/link";
import { db } from "@/lib/db";
import { clientLabel } from "@/lib/format";
import { deletePolicy } from "@/lib/actions/policies";
import { PolicyFormDialog } from "@/components/policy-form-dialog";
import { DeleteButton } from "@/components/delete-button";
import { wszystkiePolisy, ETYKIETY_ZRODLA, type ZrodloPolisy } from "@/lib/polisy/wszystkie";
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

const KLASA_ZRODLA: Record<ZrodloPolisy, string> = {
  reczna: "bg-slate-100 text-slate-700",
  grupowa: "bg-indigo-100 text-indigo-800",
  online: "bg-sky-100 text-sky-800",
};

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zrodlo?: string }>;
}) {
  const filtry = await searchParams;

  const [wynik, klienci] = await Promise.all([
    wszystkiePolisy().catch(() => null),
    db.client.findMany({ orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []),
  ]);

  const szukane = (filtry.q ?? "").trim().toLowerCase();
  const zrodlo = filtry.zrodlo as ZrodloPolisy | undefined;
  const wszystkie = wynik?.wiersze ?? [];
  const wiersze = wszystkie.filter(
    (w) =>
      (!zrodlo || w.zrodlo === zrodlo) &&
      (!szukane ||
        [w.numer, w.ubezpieczajacy, w.produkt, w.agent]
          .filter(Boolean)
          .some((p) => String(p).toLowerCase().includes(szukane))),
  );

  const suma = wiersze.reduce((s, w) => s + (w.skladkaZl ?? 0), 0);
  const klienciOpcje = klienci.map((c) => ({ id: c.id, label: clientLabel(c) }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Polisy</h1>
          <p className="text-sm text-muted-foreground">
            {wiersze.length} z {wszystkie.length} — wszystkie źródła razem
          </p>
        </div>
        <PolicyFormDialog clients={klienciOpcje} />
      </div>

      {/* Liczniki są klikalne i działają jak filtr: „ile mamy polis" i „pokaż
          mi tamte" to w praktyce to samo pytanie zadane dwa razy. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(ETYKIETY_ZRODLA) as ZrodloPolisy[]).map((z) => (
          <Link
            key={z}
            href={zrodlo === z ? "/policies" : `/policies?zrodlo=${z}`}
            className={`rounded-lg border p-4 transition-colors hover:bg-accent ${
              zrodlo === z ? "border-primary bg-accent" : ""
            }`}
          >
            <div className="text-2xl font-semibold tabular-nums">{wynik?.liczby[z] ?? 0}</div>
            <div className="text-sm text-muted-foreground">{ETYKIETY_ZRODLA[z]}</div>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={filtry.q}
          placeholder="Szukaj: numer, szkoła, klient, agent…"
          className={`${fieldClass} min-w-56 flex-1`}
        />
        <select name="zrodlo" defaultValue={zrodlo ?? ""} className={fieldClass}>
          <option value="">Wszystkie źródła</option>
          {(Object.keys(ETYKIETY_ZRODLA) as ZrodloPolisy[]).map((z) => (
            <option key={z} value={z}>
              {ETYKIETY_ZRODLA[z]}
            </option>
          ))}
        </select>
        <button type="submit" className={`${fieldClass} bg-secondary px-4 font-medium`}>
          Filtruj
        </button>
      </form>

      {wynik === null ? (
        <Uwaga>Nie udało się wczytać żadnego źródła polis.</Uwaga>
      ) : wynik.niedostepne.length > 0 ? (
        <Uwaga>
          Poniższa lista jest niepełna — nie odpowiada: {wynik.niedostepne.join(", ")}.
        </Uwaga>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numer / Produkt</TableHead>
              <TableHead>Ubezpieczający</TableHead>
              <TableHead>Źródło</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Składka</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {wiersze.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {wszystkie.length === 0
                    ? "Brak polis w żadnym ze źródeł."
                    : "Nic nie pasuje do filtrów."}
                </TableCell>
              </TableRow>
            ) : (
              wiersze.map((w) => (
                <TableRow key={w.klucz}>
                  <TableCell>
                    <div className="font-medium">
                      {w.href ? (
                        <Link href={w.href} className="hover:underline">
                          {w.numer ?? "(bez numeru)"}
                        </Link>
                      ) : (
                        (w.numer ?? "(bez numeru)")
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{w.produkt}</div>
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={w.ubezpieczajacy}>
                    {w.ubezpieczajacy}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${KLASA_ZRODLA[w.zrodlo]}`}
                    >
                      {ETYKIETY_ZRODLA[w.zrodlo]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.agent ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${w.klasaStatusu}`}
                    >
                      {w.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.okres}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {w.skladkaZl != null
                      ? `${w.skladkaZl.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {/* Usunąć da się tylko to, co powstało tutaj. Polisa grupowa
                        wisi przy szkole, a sprzedaż online żyje w osobnej usłudze
                        z własną bazą — kasowanie ich z ekranu, który tylko je
                        pokazuje, byłoby usuwaniem cudzych danych. */}
                    {w.zrodlo === "reczna" ? (
                      <DeleteButton action={deletePolicy.bind(null, w.klucz.slice("reczna:".length))} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {suma > 0 ? (
        <p className="text-right text-sm text-muted-foreground">
          Składka razem (widoczne wiersze):{" "}
          <strong className="tabular-nums text-foreground">
            {suma.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
          </strong>
        </p>
      ) : null}
    </div>
  );
}

function Uwaga({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </div>
  );
}

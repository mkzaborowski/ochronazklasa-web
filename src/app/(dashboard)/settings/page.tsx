import Link from "next/link";
import { ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BankAccountImport } from "@/components/bank-account-import";

export const dynamic = "force-dynamic";

async function loadPool() {
  try {
    const [total, free] = await Promise.all([
      db.bankAccount.count(),
      db.bankAccount.count({ where: { assigned: false } }),
    ]);
    return { total, free, used: total - free, dbError: false };
  } catch {
    return { total: 0, free: 0, used: 0, dbError: true };
  }
}

export default async function SettingsPage() {
  const pool = await loadPool();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Pula kont bankowych i numerów polis.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pula numerów polis / kont bankowych</CardTitle>
          <CardDescription>
            Każdy numer konta to jednocześnie numer polisy (ostatnie 6 cyfr). Numery są
            uniwersalne — przypisywane kolejno przy wystawianiu polisy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {pool.dbError ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> i uruchom{" "}
              <code>npm run db:push</code>.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Wszystkie" value={pool.total} href="/settings/pool" />
              <Stat label="Wolne" value={pool.free} accent="emerald" href="/settings/pool?status=free" />
              <Stat label="Wykorzystane" value={pool.used} href="/settings/pool?status=reserved" />
            </div>
          )}

          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/settings/pool" />}
            className="w-fit"
          >
            <ListChecks className="size-4" /> Zarządzaj pulą numerów (przegląd / edycja / usuwanie)
          </Button>

          <div className="grid gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">Wgraj nowe konta („Stan druków”) — z podglądem</h3>
            <BankAccountImport />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent?: "emerald";
  href: string;
}) {
  return (
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:bg-accent/40">
      <div className={`text-2xl font-semibold ${accent === "emerald" ? "text-emerald-600" : ""}`}>
        {value.toLocaleString("pl-PL")}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

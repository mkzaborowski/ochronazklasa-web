import Link from "next/link";
import {
  Building2,
  Database,
  FileText,
  Link2,
  ShoppingCart,
  UserCog,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { pobierzWnioski, type SprzedazAgenta } from "@/lib/online-api";

export const dynamic = "force-dynamic";

const kwota = (zl: number) => zl.toLocaleString("pl-PL", { minimumFractionDigits: 2 });

async function loadStats() {
  try {
    const [policies, policyholders, schoolRecords, agents] = await Promise.all([
      db.generatedPolicy.count(),
      db.school.count(),
      db.schoolRecord.count(),
      db.agent.count({ where: { active: true } }),
    ]);
    return { values: [policies, policyholders, schoolRecords, agents], dbError: false };
  } catch {
    return { values: ["—", "—", "—", "—"] as const, dbError: true };
  }
}

/**
 * Sprzedaż online z rozbiciem na agentów.
 *
 * Usługa sprzedaży zna wyłącznie kody, więc nazwiska dokładamy tutaj. Jej
 * awaria nie może przewrócić pulpitu — wtedy po prostu nie ma tej sekcji,
 * a reszta panelu działa dalej.
 */
async function loadOnline() {
  try {
    const { statystyki } = await pobierzWnioski();
    const kody = statystyki.wgAgenta.map((p) => p.kod);
    const agenci = kody.length
      ? await db.agent
          .findMany({
            where: { OR: [{ code: { in: kody } }, { codeHistory: { hasSome: kody } }] },
            select: { id: true, name: true, code: true, codeHistory: true },
          })
          .catch(() => [])
      : [];

    // Sumujemy po AGENCIE, nie po kodzie: agent, który zmienił kod, ma jeden
    // wiersz, a nie dwa połówkowe.
    const wgId = new Map<string, { id: string; name: string; sprzedaz: SprzedazAgenta }>();
    const nierozpoznane: SprzedazAgenta[] = [];

    for (const pozycja of statystyki.wgAgenta) {
      const agent = agenci.find(
        (a) => a.code === pozycja.kod || a.codeHistory.includes(pozycja.kod),
      );
      if (!agent) {
        nierozpoznane.push(pozycja);
        continue;
      }
      const biezacy = wgId.get(agent.id);
      if (biezacy) {
        biezacy.sprzedaz.wnioski += pozycja.wnioski;
        biezacy.sprzedaz.oplacone += pozycja.oplacone;
        biezacy.sprzedaz.przychodZl += pozycja.przychodZl;
      } else {
        wgId.set(agent.id, { id: agent.id, name: agent.name, sprzedaz: { ...pozycja } });
      }
    }

    return {
      statystyki,
      agenci: [...wgId.values()].sort(
        (a, b) => b.sprzedaz.oplacone - a.sprzedaz.oplacone || b.sprzedaz.wnioski - a.sprzedaz.wnioski,
      ),
      nierozpoznane,
    };
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const [{ values, dbError }, online] = await Promise.all([loadStats(), loadOnline()]);

  const stats = [
    { label: "Wystawione polisy", value: values[0], icon: FileText, hint: "InterRisk", href: "/schools" },
    { label: "Ubezpieczający", value: values[1], icon: Building2, hint: "profile z polisami", href: "/schools" },
    { label: "Szkoły w bazie", value: values[2], icon: Database, hint: "dane referencyjne", href: "/directory" },
    { label: "Agenci", value: values[3], icon: UserCog, hint: "aktywni", href: "/agents" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Pulpit</h1>
        <p className="text-sm text-muted-foreground">
          Przegląd polis, ubezpieczających i sprzedaży online.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-ring/40 group-hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[var(--blekit)]">
                  <s.icon className="size-4" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {typeof s.value === "number" ? s.value.toLocaleString("pl-PL") : s.value}
                </div>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> i uruchom{" "}
          <code>npm run db:push</code>.
        </div>
      ) : null}

      {online ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4 text-[var(--blekit)]" />
                Sprzedaż online
              </CardTitle>
              <CardDescription>
                Polisy indywidualne kupione na ochronazklasa.pl — {online.statystyki.oplacone}{" "}
                opłaconych, {kwota(online.statystyki.przychodZl)} zł składki.
              </CardDescription>
            </div>
            <Link href="/online" className="shrink-0 text-sm underline underline-offset-4">
              Zobacz wszystkie
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {online.agenci.length === 0 && online.nierozpoznane.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Żaden zakup nie przyszedł jeszcze z linku polecającego. Linki agentów są w{" "}
                <Link href="/agents" className="underline underline-offset-4">
                  zakładce Agenci
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {online.agenci.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/agents/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {a.sprzedaz.oplacone} opłaconych z {a.sprzedaz.wnioski} ·{" "}
                      <strong className="font-medium text-foreground">
                        {kwota(a.sprzedaz.przychodZl)} zł
                      </strong>
                    </span>
                  </li>
                ))}
                {online.nierozpoznane.map((p) => (
                  <li key={p.kod} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-amber-700" title="Kod nie pasuje do żadnego agenta">
                      {p.kod} (nieznany kod)
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {p.oplacone} opłaconych z {p.wnioski}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
              <Link2 className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Zakup bez linku polecającego nie jest przypisany do nikogo — dziś{" "}
                <strong className="font-medium text-foreground">
                  {online.statystyki.bezAgenta}
                </strong>{" "}
                z {online.statystyki.wszystkie} wniosków.
              </span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

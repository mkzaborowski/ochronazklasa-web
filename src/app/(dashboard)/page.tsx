import Link from "next/link";
import { FileText, Building2, Database, UserCog } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export default async function OverviewPage() {
  const { values, dbError } = await loadStats();
  const stats = [
    { label: "Wystawione polisy", value: values[0], icon: FileText, hint: "InterRisk", href: "/schools" },
    { label: "Ubezpieczający", value: values[1], icon: Building2, hint: "profile z polisami", href: "/schools" },
    { label: "Szkoły w bazie", value: values[2], icon: Database, hint: "dane referencyjne", href: "/directory" },
    { label: "Agenci", value: values[3], icon: UserCog, hint: "aktywni", href: "/agents" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pulpit</h1>
        <p className="text-sm text-muted-foreground">
          Przegląd polis, ubezpieczających i bazy szkół.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
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

      <Card>
        <CardHeader>
          <CardTitle>Witaj w panelu Ochrona z Klasą</CardTitle>
          <CardDescription>
            „Szkoły w bazie” to dane referencyjne (~28 tys.) do automatycznego
            uzupełniania formularzy po numerze REGON. „Ubezpieczający” to profile
            utworzone podczas wystawiania polis — to one są liczone jako klienci.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Wystawianie polis InterRisk</Badge>
          <Badge variant="secondary">Autouzupełnianie po REGON</Badge>
          <Badge variant="secondary">Agenci</Badge>
          <Badge variant="secondary">Baza szkół</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { AgentActiveToggle } from "@/components/agent-active-toggle";
import { AgentLink } from "@/components/agent-link";
import { linkPolecajacy } from "@/lib/agents/kod";
import { kodyAgenta } from "@/lib/agents/atrybucja";
import { pobierzWnioski } from "@/lib/online-api";

export const dynamic = "force-dynamic";

/**
 * Sprzedaż online tego agenta.
 *
 * Liczymy po WSZYSTKICH jego kodach, także porzuconych — zmiana kodu nie może
 * skasować mu dorobku. Awaria usługi sprzedaży nie może zaś przewrócić profilu
 * agenta, więc błąd kończy się brakiem kafelków, a nie białą stroną.
 */
async function sprzedazOnline(agent: { code: string | null; codeHistory: string[] }) {
  const kody = new Set(kodyAgenta(agent));
  if (kody.size === 0) return null;
  try {
    const { statystyki } = await pobierzWnioski();
    const moje = statystyki.wgAgenta.filter((p) => kody.has(p.kod));
    return moje.reduce(
      (suma, p) => ({
        wnioski: suma.wnioski + p.wnioski,
        oplacone: suma.oplacone + p.oplacone,
        przychodZl: suma.przychodZl + p.przychodZl,
      }),
      { wnioski: 0, oplacone: 0, przychodZl: 0 },
    );
  } catch {
    return null;
  }
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent
    .findUnique({
      where: { id },
      include: {
        _count: { select: { schoolRecords: true, policyholders: true } },
        schoolRecords: { take: 50, orderBy: { name: "asc" } },
      },
    })
    .catch(() => null);
  if (!agent) notFound();

  const [policiesCount, online] = await Promise.all([
    db.generatedPolicy.count({ where: { school: { agentId: id } } }).catch(() => 0),
    sprzedazOnline(agent),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/agents" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">
              {agent.email}
              {agent.phone ? ` · ${agent.phone}` : ""}
              {agent.code ? ` · kod ${agent.code}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AgentActiveToggle agentId={agent.id} active={agent.active} />
          <AgentFormDialog agent={agent} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Przypisane szkoły" value={agent._count.schoolRecords} href={`/directory?agent=${agent.id}`} />
        <Stat label="Ubezpieczający" value={agent._count.policyholders} />
        <Stat label="Wystawione polisy" value={policiesCount} />
        <Stat
          label="Sprzedaż online (opłacone)"
          value={online?.oplacone ?? 0}
          href={
            agent.code
              ? `/online?agent=${encodeURIComponent(kodyAgenta(agent).join(","))}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link polecający</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.code ? (
            <>
              <AgentLink link={linkPolecajacy(agent.code)} kod={agent.code} />
              <p className="text-sm text-muted-foreground">
                Zakup zrobiony z tego linku przypisuje się do agenta{" "}
                <strong className="font-medium text-foreground">{agent.name}</strong> — także
                wtedy, gdy klient najpierw poczyta stronę i wróci później (polecenie ważne
                30 dni). Kto wejdzie na ochronazklasa.pl bez linku, kupuje bez rekomendacji
                i taka sprzedaż nie jest przypisana do nikogo.
              </p>
              {online ? (
                <p className="text-sm text-muted-foreground">
                  Z tego linku: <strong className="text-foreground">{online.wnioski}</strong>{" "}
                  {online.wnioski === 1 ? "wniosek" : "wniosków"},{" "}
                  <strong className="text-foreground">{online.oplacone}</strong> opłaconych,{" "}
                  <strong className="text-foreground">
                    {online.przychodZl.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                  </strong>{" "}
                  składki.
                </p>
              ) : null}
              {agent.codeHistory.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Wcześniejsze kody ({agent.codeHistory.join(", ")}) nadal działają dla sprzedaży,
                  która już się odbyła, ale rozdawaj wyłącznie link powyżej.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ten agent nie ma jeszcze kodu, więc nie ma linku polecającego. Nadaj kod w{" "}
              <em>Edytuj</em> albo uruchom <code>npm run agenci:kody -- --zapisz</code>.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Przypisane szkoły (pierwsze 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.schoolRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak przypisanych szkół.{" "}
              <Link href="/directory" className="underline">Przypisz w bazie szkół</Link>.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {agent.schoolRecords.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {s.city ?? ""} · REGON {s.regonRaw}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {agent._count.schoolRecords > 50 ? (
            <Link href={`/directory?agent=${agent.id}`} className="mt-3 inline-block text-sm underline">
              Zobacz wszystkie ({agent._count.schoolRecords})
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <Card>
      <CardContent className="py-5">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

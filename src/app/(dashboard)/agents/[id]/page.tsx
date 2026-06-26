import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { AgentActiveToggle } from "@/components/agent-active-toggle";

export const dynamic = "force-dynamic";

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

  const policiesCount = await db.generatedPolicy
    .count({ where: { school: { agentId: id } } })
    .catch(() => 0);

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Przypisane szkoły" value={agent._count.schoolRecords} href={`/directory?agent=${agent.id}`} />
        <Stat label="Ubezpieczający" value={agent._count.policyholders} />
        <Stat label="Wystawione polisy" value={policiesCount} />
      </div>

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

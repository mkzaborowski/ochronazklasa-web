import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentFormDialog } from "@/components/agent-form-dialog";
import { AgentActiveToggle } from "@/components/agent-active-toggle";

export const dynamic = "force-dynamic";

async function loadAgents() {
  try {
    const agents = await db.agent.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { schoolRecords: true, policyholders: true } } },
    });
    return { agents, dbError: false };
  } catch {
    return { agents: [], dbError: true };
  }
}

export default async function AgentsPage() {
  const { agents, dbError } = await loadAgents();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agenci</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzanie agentami i przypisaniami szkół.
          </p>
        </div>
        <AgentFormDialog />
      </div>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Brak połączenia z bazą danych. Ustaw <code>DATABASE_URL</code> i uruchom{" "}
          <code>npm run db:push</code>.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead className="text-center">Szkoły</TableHead>
                <TableHead className="text-center">Ubezpieczający</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Brak agentów. Dodaj pierwszego agenta.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/agents/${a.id}`} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                      {a.code ? (
                        <Badge variant="secondary" className="ml-2">{a.code}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ""}
                    </TableCell>
                    <TableCell className="text-center">{a._count.schoolRecords}</TableCell>
                    <TableCell className="text-center">{a._count.policyholders}</TableCell>
                    <TableCell>
                      <AgentActiveToggle agentId={a.id} active={a.active} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/agents/${a.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

"use client";

import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAgentActive } from "@/lib/actions/agents";

export function AgentActiveToggle({ agentId, active }: { agentId: string; active: boolean }) {
  return (
    <form action={setAgentActive.bind(null, agentId, !active)}>
      <Button variant="ghost" size="sm" type="submit" title={active ? "Dezaktywuj" : "Aktywuj"}>
        <Power className={`size-4 ${active ? "text-emerald-600" : "text-muted-foreground"}`} />
        {active ? "Aktywny" : "Nieaktywny"}
      </Button>
    </form>
  );
}

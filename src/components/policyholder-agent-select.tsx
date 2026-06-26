"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setPolicyholderAgent } from "@/lib/actions/agents";

const fieldClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function PolicyholderAgentSelect({
  schoolId,
  agentId,
  agents,
}: {
  schoolId: string;
  agentId: string | null;
  agents: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      className={fieldClass}
      defaultValue={agentId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await setPolicyholderAgent(schoolId, v || null);
          toast.success("Agent zaktualizowany.");
        });
      }}
    >
      <option value="">— brak agenta —</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

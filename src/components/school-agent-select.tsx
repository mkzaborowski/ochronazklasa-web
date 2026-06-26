"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { assignSchoolAgent } from "@/lib/actions/agents";

const fieldClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function SchoolAgentSelect({
  schoolRecordId,
  agentId,
  agents,
}: {
  schoolRecordId: string;
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
          await assignSchoolAgent(schoolRecordId, v || null);
          toast.success("Agent przypisany.");
        });
      }}
    >
      <option value="">— brak —</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { agentSchema } from "@/lib/validations";
import type { ActionState } from "@/lib/actions/clients";

const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function createAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = agentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  const d = parsed.data;
  try {
    const agent = await db.agent.create({
      data: { name: d.name, email: d.email, phone: nn(d.phone), code: nn(d.code), notes: nn(d.notes) },
    });
    await logAudit({ userId: user.id, action: "agent.create", entity: "Agent", entityId: agent.id });
  } catch {
    return { error: "Agent z takim emailem lub kodem już istnieje." };
  }
  revalidatePath("/agents");
  return { ok: true };
}

export async function updateAgent(
  agentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = agentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  const d = parsed.data;
  try {
    await db.agent.update({
      where: { id: agentId },
      data: { name: d.name, email: d.email, phone: nn(d.phone), code: nn(d.code), notes: nn(d.notes) },
    });
    await logAudit({ userId: user.id, action: "agent.update", entity: "Agent", entityId: agentId });
  } catch {
    return { error: "Nie udało się zapisać (email/kod muszą być unikalne)." };
  }
  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

export async function setAgentActive(agentId: string, active: boolean) {
  const user = await requireRole(["ADMIN"]);
  await db.agent.update({ where: { id: agentId }, data: { active } });
  await logAudit({
    userId: user.id,
    action: active ? "agent.activate" : "agent.deactivate",
    entity: "Agent",
    entityId: agentId,
  });
  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
}

/** Assign (or change) the agent of a policyholder (School). */
export async function setPolicyholderAgent(schoolId: string, agentId: string | null) {
  const user = await requireRole(["ADMIN"]);
  await db.school.update({ where: { id: schoolId }, data: { agentId: agentId || null } });
  await logAudit({
    userId: user.id,
    action: "policyholder.assignAgent",
    entity: "School",
    entityId: schoolId,
    metadata: { agentId },
  });
  revalidatePath(`/schools/${schoolId}`);
}

/** Assign (or clear) the agent of a reference school. */
export async function assignSchoolAgent(schoolRecordId: string, agentId: string | null) {
  const user = await requireRole(["ADMIN"]);
  await db.schoolRecord.update({
    where: { id: schoolRecordId },
    data: { assignedAgentId: agentId || null },
  });
  await logAudit({
    userId: user.id,
    action: "school.assignAgent",
    entity: "SchoolRecord",
    entityId: schoolRecordId,
    metadata: { agentId },
  });
  revalidatePath("/directory");
}

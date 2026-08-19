"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { agentSchema } from "@/lib/validations";
import { normalizujKod, proponujKod } from "@/lib/agents/kod";
import type { ActionState } from "@/lib/actions/clients";

const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

/**
 * Wszystkie kody, które są już w użyciu — łącznie z historycznymi.
 * Historyczne też muszą być zajęte: gdyby nowy agent dostał kod porzucony
 * przez kogoś innego, sprzedaż sprzed lat trafiłaby do niewłaściwej osoby.
 */
async function zajeteKody(): Promise<string[]> {
  const agenci = await db.agent.findMany({ select: { code: true, codeHistory: true } });
  return agenci.flatMap((a) => [a.code, ...a.codeHistory]).filter((k): k is string => Boolean(k));
}

export async function createAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = agentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  const d = parsed.data;

  // KAŻDY agent dostaje kod, także gdy pole zostało puste — bez kodu nie ma
  // linku polecającego, a bez linku agent nie ma jak zapisać sobie sprzedaży.
  const zajete = await zajeteKody();
  const podany = normalizujKod(d.code);
  if (nn(d.code) && !podany) {
    return { error: "Kod może zawierać tylko litery, cyfry i myślnik (2–16 znaków)." };
  }
  if (podany && zajete.includes(podany)) {
    return { error: `Kod ${podany} jest już zajęty.` };
  }
  const kod = podany ?? proponujKod(d.name, zajete);

  try {
    const agent = await db.agent.create({
      data: { name: d.name, email: d.email, phone: nn(d.phone), code: kod, notes: nn(d.notes) },
    });
    await logAudit({
      userId: user.id, action: "agent.create", entity: "Agent", entityId: agent.id,
      metadata: { code: kod },
    });
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

  const obecny = await db.agent.findUnique({
    where: { id: agentId },
    select: { code: true, codeHistory: true },
  });
  if (!obecny) return { error: "Nie znaleziono agenta." };

  const podany = normalizujKod(d.code);
  if (nn(d.code) && !podany) {
    return { error: "Kod może zawierać tylko litery, cyfry i myślnik (2–16 znaków)." };
  }
  // Wyczyszczenie pola ZOSTAWIA dotychczasowy kod. Skasowanie kodu zerwałoby
  // linki, które agent zdążył rozdać - a tego nikt by nie zauważył do chwili,
  // gdy sprzedaż przestaje mu się liczyć.
  const zajete = (await zajeteKody()).filter(
    (k) => k !== obecny.code && !obecny.codeHistory.includes(k),
  );
  if (podany && zajete.includes(podany)) {
    return { error: `Kod ${podany} należy do innego agenta.` };
  }
  const kod = podany ?? obecny.code ?? proponujKod(d.name, await zajeteKody());

  // Stary kod idzie do historii, żeby wcześniejsza sprzedaż nadal się liczyła.
  const historia = obecny.codeHistory.filter((k) => k !== kod);
  if (obecny.code && obecny.code !== kod && !historia.includes(obecny.code)) {
    historia.push(obecny.code);
  }

  try {
    await db.agent.update({
      where: { id: agentId },
      data: {
        name: d.name, email: d.email, phone: nn(d.phone),
        code: kod, codeHistory: historia, notes: nn(d.notes),
      },
    });
    await logAudit({
      userId: user.id, action: "agent.update", entity: "Agent", entityId: agentId,
      metadata: obecny.code !== kod ? { codeFrom: obecny.code, codeTo: kod } : undefined,
    });
  } catch {
    return { error: "Nie udało się zapisać (email/kod muszą być unikalne)." };
  }
  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/online");
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

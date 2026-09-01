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
  const agenci = await db.agent.findMany({
    select: { code: true, codeHistory: true, codeAliases: true },
  });
  return agenci
    .flatMap((a) => [a.code, ...a.codeHistory, ...a.codeAliases])
    .filter((k): k is string => Boolean(k));
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

/**
 * Przypisuje kod opiekuna do agenta RĘCZNIE.
 *
 * Ostatnie słowo, gdy rozpoznawanie mówi „nie wiem": kod pasuje do dwóch osób
 * równie dobrze (dwoje agentów o tym samym nazwisku) albo do nikogo, bo klient
 * wpisał coś po swojemu. Zapisany kod przestaje być zgadywany — od tej chwili
 * jest dopasowaniem dokładnym i liczy się agentowi wszędzie: w panelu,
 * w jego portalu i w powiadomieniach o sprzedaży.
 *
 * Działa też WSTECZ. Wnioski trzymają sam kod, a nazwisko dokładamy przy
 * wyświetlaniu — więc jedno przypisanie naprawia całą dotychczasową historię
 * tego kodu, nie tylko przyszłą sprzedaż.
 */
export async function przypiszKodAgentowi(surowyKod: string, agentId: string) {
  const user = await requireRole(["ADMIN"]);
  const kod = normalizujKod(surowyKod);
  if (!kod) return { error: "Nieprawidłowy kod." };

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, code: true, codeHistory: true, codeAliases: true },
  });
  if (!agent) return { error: "Nie znaleziono agenta." };

  // Kod, który jest już czyimś kodem właściwym lub historycznym, NIE może zostać
  // przypisany komu innemu: sprzedaż sprzed lat przeniosłaby się na inną osobę.
  const wlasciciel = await db.agent.findFirst({
    where: {
      id: { not: agentId },
      OR: [{ code: kod }, { codeHistory: { has: kod } }, { codeAliases: { has: kod } }],
    },
    select: { name: true },
  });
  if (wlasciciel) return { error: `Kod ${kod} należy już do agenta ${wlasciciel.name}.` };

  if (agent.code === kod || agent.codeHistory.includes(kod) || agent.codeAliases.includes(kod)) {
    return { ok: true };
  }

  await db.agent.update({
    where: { id: agentId },
    data: { codeAliases: { push: kod } },
  });
  await logAudit({
    userId: user.id,
    action: "agent.assignCode",
    entity: "Agent",
    entityId: agentId,
    metadata: { kod },
  });
  revalidatePath("/online");
  revalidatePath("/");
  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

/**
 * Odpina kod przypisany ręcznie. Pomyłka przy przypisywaniu jest cicha —
 * wiersz po prostu wygląda normalnie, tylko przy złym nazwisku — więc musi
 * dać się cofnąć równie łatwo, jak się ją zrobiło.
 *
 * Odpiąć da się WYŁĄCZNIE kod przypisany ręcznie. Kod właściwy i historyczny
 * zostają: to nie są zgadywania, tylko kody, które agent faktycznie miał.
 */
export async function odepnijKodAgenta(surowyKod: string, agentId: string) {
  const user = await requireRole(["ADMIN"]);
  const kod = normalizujKod(surowyKod);
  if (!kod) return { error: "Nieprawidłowy kod." };

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { codeAliases: true },
  });
  if (!agent) return { error: "Nie znaleziono agenta." };
  if (!agent.codeAliases.includes(kod)) {
    return { error: `Kod ${kod} nie jest przypisany ręcznie do tego agenta.` };
  }

  await db.agent.update({
    where: { id: agentId },
    data: { codeAliases: agent.codeAliases.filter((k) => k !== kod) },
  });
  await logAudit({
    userId: user.id,
    action: "agent.unassignCode",
    entity: "Agent",
    entityId: agentId,
    metadata: { kod },
  });
  revalidatePath("/online");
  revalidatePath("/");
  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

/**
 * Wersja dla formularza z listą agentów (ekran „kody do rozstrzygnięcia").
 * Kod przychodzi przez `bind`, bo jest częścią tożsamości wiersza, a nie
 * czymś, co administrator wpisuje — wybiera wyłącznie osobę.
 */
export async function przypiszKodZFormularza(
  kod: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const agentId = String(formData.get("agentId") ?? "").trim();
  if (!agentId) return { error: "Wybierz agenta." };
  return przypiszKodAgentowi(kod, agentId);
}

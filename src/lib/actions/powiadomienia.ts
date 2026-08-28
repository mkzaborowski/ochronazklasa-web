"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Agent włącza i wyłącza własne powiadomienia o sprzedaży.
 *
 * Świadomie NIE requireBiuro: to jedyna rzecz, którą agent może w panelu
 * zmienić, i dotyczy wyłącznie jego skrzynki. Kartę odczytujemy z konta
 * zalogowanego użytkownika, a nie z parametru — agent nie może wyciszyć
 * powiadomień koledze.
 */
export async function ustawPowiadomienia(wlaczone: boolean) {
  const user = await requireUser();
  if (!user.id) return { ok: false, komunikat: "Brak zalogowanego konta." };

  const konto = await db.user.findUnique({
    where: { id: user.id },
    select: { agentId: true },
  });
  if (!konto?.agentId) return { ok: false, komunikat: "Konto nie jest podpięte do karty agenta." };

  await db.agent.update({
    where: { id: konto.agentId },
    data: { powiadomieniaEmail: wlaczone },
  });
  revalidatePath("/moje");
  return {
    ok: true,
    komunikat: wlaczone ? "Powiadomienia włączone." : "Powiadomienia wyłączone.",
  };
}

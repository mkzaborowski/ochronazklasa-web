"use server";

import { revalidatePath } from "next/cache";
import { ponowRealizacje, wyslijPonownie } from "@/lib/online-api";
import { requireBiuro } from "@/lib/auth-helpers";

export async function resendCertificateAction(id: string) {
  await requireBiuro();
  try {
    const wynik = await wyslijPonownie(id);
    revalidatePath(`/online/${id}`);
    return { ok: true, message: wynik.komunikat };
  } catch (error) {
    return { ok: false, message: String(error instanceof Error ? error.message : error) };
  }
}

export async function retryFulfilmentAction(id: string) {
  await requireBiuro();
  try {
    const wynik = await ponowRealizacje(id);
    revalidatePath(`/online/${id}`);
    revalidatePath("/online");
    return { ok: true, message: wynik.komunikat };
  } catch (error) {
    return { ok: false, message: String(error instanceof Error ? error.message : error) };
  }
}

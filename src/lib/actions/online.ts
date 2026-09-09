"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  poprawWniosek,
  ponowRealizacje,
  wyslijPonownie,
  wystawPonownie,
} from "@/lib/online-api";
import { requireBiuro, requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

/**
 * Sprawdza hasło zalogowanego użytkownika.
 *
 * PO CO DRUGI RAZ, skoro jest już zalogowany. Bo to nie jest pytanie „czy masz
 * dostęp", tylko „czy to na pewno TY i czy wiesz, co robisz". Poprawka zmienia
 * dane na wystawionym dokumencie ubezpieczeniowym — przy zostawionej otwartej
 * przeglądarce ktoś przechodzący obok mógłby to zrobić jednym kliknięciem.
 *
 * Konto bez hasła (logowanie przez SSO) nie może tędy przejść. Wolę odmówić
 * z wyjaśnieniem niż wpuścić bez potwierdzenia, bo „przecież nie ma czym".
 */
async function potwierdzHaslem(haslo: string): Promise<{ email: string } | { error: string }> {
  const user = await requireRole(["ADMIN"]);
  if (!haslo.trim()) return { error: "Podaj hasło, żeby potwierdzić zmianę." };

  // Tryb deweloperski nie ma konta w bazie; nie udajemy, że sprawdziliśmy.
  if (!user.id) return { email: user.email ?? "tryb deweloperski" };

  const konto = await db.user
    .findUnique({ where: { id: user.id }, select: { email: true, passwordHash: true } })
    .catch(() => null);
  if (!konto) return { error: "Nie znaleziono konta." };
  if (!konto.passwordHash) {
    return { error: "To konto loguje się bez hasła — poprawki może wprowadzić konto z hasłem." };
  }
  if (!(await bcrypt.compare(haslo, konto.passwordHash))) {
    return { error: "Nieprawidłowe hasło." };
  }
  return { email: konto.email };
}

export interface KorektaFormularza {
  powod: string;
  haslo: string;
  oplacajacy?: Record<string, unknown>;
  ubezpieczeni?: Record<string, unknown>[];
}

/**
 * Poprawia dane wniosku po potwierdzeniu hasłem.
 *
 * NIE WYSTAWIA certyfikatu na nowo. To jest osobne, świadome kliknięcie —
 * najpierw widać, co się zapisało, dopiero potem cokolwiek wychodzi do klienta.
 */
export async function correctApplicationAction(id: string, dane: KorektaFormularza) {
  const kto = await potwierdzHaslem(dane.haslo);
  if ("error" in kto) return { ok: false, message: kto.error };
  if (!dane.powod.trim()) return { ok: false, message: "Napisz, co poprawiasz i dlaczego." };

  try {
    const wynik = await poprawWniosek(id, {
      kto: kto.email,
      powod: dane.powod.trim(),
      oplacajacy: dane.oplacajacy,
      ubezpieczeni: dane.ubezpieczeni,
    });
    await logAudit({
      userId: (await requireRole(["ADMIN"])).id,
      action: "online.correct",
      entity: "WniosekOnline",
      entityId: id,
      metadata: { powod: dane.powod.trim() },
    });
    revalidatePath(`/online/${id}`);
    revalidatePath("/online");
    return { ok: true, message: wynik.komunikat };
  } catch (error) {
    return { ok: false, message: String(error instanceof Error ? error.message : error) };
  }
}

/**
 * Wystawia poprawiony certyfikat — z tym samym numerem — i wysyła go klientowi.
 * Osobno od „Wyślij ponownie", które wysyła stary plik bez zmian.
 */
export async function reissueCertificateAction(id: string, haslo: string) {
  const kto = await potwierdzHaslem(haslo);
  if ("error" in kto) return { ok: false, message: kto.error };
  try {
    const wynik = await wystawPonownie(id);
    await logAudit({
      userId: (await requireRole(["ADMIN"])).id,
      action: "online.reissue",
      entity: "WniosekOnline",
      entityId: id,
      metadata: { numer: wynik.numerCertyfikatu },
    });
    revalidatePath(`/online/${id}`);
    revalidatePath("/online");
    return { ok: true, message: wynik.komunikat };
  } catch (error) {
    return { ok: false, message: String(error instanceof Error ? error.message : error) };
  }
}

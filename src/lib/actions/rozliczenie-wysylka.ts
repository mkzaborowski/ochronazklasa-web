"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DOMYSLNE, ID_USTAWIEN, wyslijRozliczenie } from "@/lib/interrisk/wysylka";

/**
 * Zapis ustawień automatycznej wysyłki i wysyłka na żądanie.
 *
 * TYLKO ADMIN. To jest ustawienie, które samo z siebie wysyła listy do
 * ubezpieczyciela — zmiana odbiorcy znaczy, że nasze rozliczenia zaczynają
 * chodzić gdzie indziej.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function tylkoAdmin() {
  const u = await getCurrentUser();
  const deweloperski =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!deweloperski && u?.role !== "ADMIN") throw new Error("Brak uprawnień");
}

export async function zapiszWysylke(formularz: FormData): Promise<{ blad?: string; ok?: string }> {
  await tylkoAdmin();

  const odbiorcy = String(formularz.get("odbiorcy") ?? "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const zle = odbiorcy.filter((x) => !EMAIL.test(x));
  if (zle.length > 0) return { blad: `To nie wygląda na adresy e-mail: ${zle.join(", ")}` };

  const wlaczona = formularz.get("wlaczona") === "on";
  // Włączenie bez odbiorcy to harmonogram, który co miesiąc nic nie robi
  // i wygląda, jakby działał.
  if (wlaczona && odbiorcy.length === 0) {
    return { blad: "Podaj przynajmniej jeden adres, zanim włączysz wysyłkę." };
  }

  const liczba = (nazwa: string, min: number, maks: number, domyslna: number) => {
    const x = Number(formularz.get(nazwa));
    return Number.isFinite(x) && x >= min && x <= maks ? Math.trunc(x) : domyslna;
  };
  // 1-28: dni 29-31 nie ma w każdym miesiącu, więc wysyłka cicho by przepadała.
  const dzienWysylki = liczba("dzienWysylki", 1, 28, DOMYSLNE.dzienWysylki);
  const miesiecyWstecz = liczba("miesiecyWstecz", 1, 12, DOMYSLNE.miesiecyWstecz);
  const dniDoPlatnosci = liczba("dniDoPlatnosci", 0, 90, DOMYSLNE.dniDoPlatnosci);

  const dane = { wlaczona, odbiorcy, dzienWysylki, miesiecyWstecz, dniDoPlatnosci };
  await db.wysylkaRozliczenia.upsert({
    where: { id: ID_USTAWIEN },
    update: dane,
    create: { id: ID_USTAWIEN, ...DOMYSLNE, ...dane },
  });

  revalidatePath("/rozliczenia");
  return { ok: wlaczona ? "Zapisane — wysyłka włączona." : "Zapisane — wysyłka wyłączona." };
}

export async function wyslijTeraz(): Promise<{ blad?: string; ok?: string }> {
  await tylkoAdmin();
  const w = await wyslijRozliczenie({ naSile: true });
  revalidatePath("/rozliczenia");
  if (w.stan === "wyslano") {
    return { ok: `Wysłane za ${w.okres}: ${w.wariantow} plików, ${w.osob} ubezpieczonych.` };
  }
  return { blad: w.stan === "blad" ? `Nie wysłano: ${w.powod}` : `Pominięto: ${w.powod}` };
}

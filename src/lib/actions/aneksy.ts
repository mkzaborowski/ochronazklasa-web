"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBiuro } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  normalizujNumerPolisy,
  oczyscPunkty,
  walidujAneks,
  type DaneAneksu,
} from "@/lib/aneksy/tresc";

/** Aneks już zapisany w bazie — do podpowiedzi przy numerze polisy. */
export type AneksDoPolisy = {
  id: string;
  numerAneksu: string;
  dataAneksu: string;
  wystawil: string | null;
};

export type WynikSzukaniaPolisy = {
  /** polisa wystawiona w programie; `null` = numeru nie ma (np. polisa robiona ręcznie) */
  polisa: {
    schoolId: string;
    nazwa: string;
    etykieta: string | null;
    wariant: string;
    okres: string;
  } | null;
  /** aneksy do tej polisy, które już są w bazie — żeby nie wystawić drugiego „1/2026" */
  aneksy: AneksDoPolisy[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Nazwy osób po id — aneks trzyma samo id, jak GeneratedPolicy. */
async function nazwyUzytkownikow(ids: (string | null)[]): Promise<Map<string, string>> {
  const unikalne = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unikalne.length) return new Map();
  const u = await db.user.findMany({
    where: { id: { in: unikalne } },
    select: { id: true, name: true, email: true },
  });
  return new Map(u.map((x) => [x.id, x.name?.trim() || x.email]));
}

/**
 * Po wpisaniu numeru polisy: nazwa szkoły z polis wystawionych w programie
 * i lista aneksów, które do tej polisy już są.
 *
 * Nazwę bierzemy ze szkoły (School), a nie z pliku polisy: biuro poprawia dane
 * szkoły w panelu, więc tam jest nowsza wersja. Formularz i tak pozwala ją
 * zmienić — polisy robione ręcznie w programie w ogóle nie istnieją.
 */
export async function znajdzPoliseDoAneksu(surowyNumer: string): Promise<WynikSzukaniaPolisy> {
  await requireBiuro();
  const numer = normalizujNumerPolisy(surowyNumer);
  if (numer.length < 4) return { polisa: null, aneksy: [] };

  const [polisa, aneksy] = await Promise.all([
    db.generatedPolicy.findFirst({
      where: { policyNumber: numer },
      orderBy: { createdAt: "desc" },
      select: {
        variantCode: true,
        insurancePeriod: true,
        school: { select: { id: true, nazwa: true, etykieta: true } },
      },
    }),
    db.aneks.findMany({
      where: { numerPolisy: numer },
      orderBy: { createdAt: "asc" },
      select: { id: true, numerAneksu: true, dataAneksu: true, createdById: true },
    }),
  ]);
  const nazwy = await nazwyUzytkownikow(aneksy.map((a) => a.createdById));

  return {
    polisa: polisa?.school
      ? {
          schoolId: polisa.school.id,
          nazwa: polisa.school.nazwa,
          etykieta: polisa.school.etykieta,
          wariant: polisa.variantCode,
          okres: polisa.insurancePeriod,
        }
      : null,
    aneksy: aneksy.map((a) => ({
      id: a.id,
      numerAneksu: a.numerAneksu,
      dataAneksu: iso(a.dataAneksu),
      wystawil: a.createdById ? (nazwy.get(a.createdById) ?? null) : null,
    })),
  };
}

export type FormularzAneksu = Omit<DaneAneksu, "numerPolisy"> & {
  numerPolisy: string;
  etykieta: string;
};

export type WynikZapisu =
  | { ok: true; id: string; wersja: string }
  | { ok: false; bledy: string[] }
  /** ten sam numer aneksu do tej samej polisy już jest — zapis po potwierdzeniu */
  | { ok: false; duplikat: AneksDoPolisy }
  /** ktoś inny zapisał ten aneks, kiedy formularz był otwarty */
  | { ok: false; konflikt: { kto: string | null; kiedy: string } };

/**
 * Zapis aneksu — nowego albo poprawionego.
 *
 * PRACA W KILKA OSÓB NARAZ. Nic nie jest blokowane: każdy formularz żyje
 * osobno, a nowe aneksy to po prostu nowe wiersze. Jedyne miejsce, w którym
 * dwie osoby mogą sobie wejść w drogę, to poprawianie TEGO SAMEGO aneksu —
 * wtedy późniejszy zapis nie nadpisuje po cichu wcześniejszego, tylko
 * dostaje komunikat, kto i kiedy zmienił aneks, i prośbę o odświeżenie.
 * Pilnuje tego `wersja` (updatedAt z chwili otwarcia formularza).
 */
export async function zapiszAneks(
  formularz: FormularzAneksu,
  opcje: { id?: string; wersja?: string; mimoDuplikatu?: boolean } = {},
): Promise<WynikZapisu> {
  const user = await requireBiuro();

  const dane: DaneAneksu = {
    numerAneksu: String(formularz.numerAneksu ?? "").trim(),
    numerPolisy: normalizujNumerPolisy(String(formularz.numerPolisy ?? "")),
    dataAneksu: String(formularz.dataAneksu ?? ""),
    nazwaSzkoly: String(formularz.nazwaSzkoly ?? "").trim(),
    rokSzkolny: String(formularz.rokSzkolny ?? "").replace(/\s/g, ""),
    liczbaUbezpieczonych: Number(formularz.liczbaUbezpieczonych),
    liczbaZwolnionych: Number(formularz.liczbaZwolnionych) || 0,
    skladkaGrosze: Number(formularz.skladkaGrosze),
    dodatkowePunkty: oczyscPunkty(
      Array.isArray(formularz.dodatkowePunkty) ? formularz.dodatkowePunkty.map(String) : [],
    ),
  };
  const bledy = walidujAneks(dane);
  if (bledy.length) return { ok: false, bledy };

  if (!opcje.mimoDuplikatu) {
    const powtorka = await db.aneks.findFirst({
      where: {
        numerPolisy: dane.numerPolisy,
        numerAneksu: { equals: dane.numerAneksu, mode: "insensitive" },
        ...(opcje.id ? { id: { not: opcje.id } } : {}),
      },
      select: { id: true, numerAneksu: true, dataAneksu: true, createdById: true },
    });
    if (powtorka) {
      const nazwy = await nazwyUzytkownikow([powtorka.createdById]);
      return {
        ok: false,
        duplikat: {
          id: powtorka.id,
          numerAneksu: powtorka.numerAneksu,
          dataAneksu: iso(powtorka.dataAneksu),
          wystawil: powtorka.createdById ? (nazwy.get(powtorka.createdById) ?? null) : null,
        },
      };
    }
  }

  // Szkoła z programu, jeśli numer polisy jest w bazie — do powiązania,
  // nie do treści: w aneksie stoi nazwa z formularza.
  const polisa = await db.generatedPolicy.findFirst({
    where: { policyNumber: dane.numerPolisy },
    orderBy: { createdAt: "desc" },
    select: { schoolId: true },
  });

  const wiersz = {
    numerAneksu: dane.numerAneksu,
    numerPolisy: dane.numerPolisy,
    dataAneksu: new Date(`${dane.dataAneksu}T00:00:00Z`),
    nazwaSzkoly: dane.nazwaSzkoly,
    etykieta: String(formularz.etykieta ?? "").trim() || null,
    rokSzkolny: dane.rokSzkolny,
    liczbaUbezpieczonych: dane.liczbaUbezpieczonych,
    liczbaZwolnionych: dane.liczbaZwolnionych,
    skladkaGrosze: dane.skladkaGrosze,
    dodatkowePunkty: dane.dodatkowePunkty,
    schoolId: polisa?.schoolId ?? null,
    updatedById: user.id,
  };

  let id: string;
  let wersja: Date;
  if (opcje.id) {
    const zmienione = await db.aneks.updateMany({
      where: { id: opcje.id, ...(opcje.wersja ? { updatedAt: new Date(opcje.wersja) } : {}) },
      data: wiersz,
    });
    if (zmienione.count === 0) {
      const teraz = await db.aneks.findUnique({
        where: { id: opcje.id },
        select: { updatedAt: true, updatedById: true },
      });
      if (!teraz) return { ok: false, bledy: ["Tego aneksu już nie ma — ktoś go usunął."] };
      const nazwy = await nazwyUzytkownikow([teraz.updatedById]);
      return {
        ok: false,
        konflikt: {
          kto: teraz.updatedById ? (nazwy.get(teraz.updatedById) ?? null) : null,
          kiedy: teraz.updatedAt.toISOString(),
        },
      };
    }
    const po = await db.aneks.findUniqueOrThrow({ where: { id: opcje.id }, select: { updatedAt: true } });
    id = opcje.id;
    wersja = po.updatedAt;
  } else {
    const nowy = await db.aneks.create({
      data: { ...wiersz, createdById: user.id },
      select: { id: true, updatedAt: true },
    });
    id = nowy.id;
    wersja = nowy.updatedAt;
  }

  await logAudit({
    userId: user.id,
    action: opcje.id ? "aneks.update" : "aneks.create",
    entity: "Aneks",
    entityId: id,
    metadata: {
      numerAneksu: dane.numerAneksu,
      numerPolisy: dane.numerPolisy,
      mimoDuplikatu: !!opcje.mimoDuplikatu,
    },
  });
  revalidatePath("/aneksy");
  return { ok: true, id, wersja: wersja.toISOString() };
}

/** Usuwa aneks i wraca do listy. Wywoływane z przycisku z potwierdzeniem. */
export async function usunAneks(id: string): Promise<void> {
  const user = await requireBiuro();
  const aneks = await db.aneks.findUnique({
    where: { id },
    select: { numerAneksu: true, numerPolisy: true },
  });
  if (aneks) {
    await db.aneks.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      action: "aneks.delete",
      entity: "Aneks",
      entityId: id,
      metadata: aneks,
    });
  }
  revalidatePath("/aneksy");
  redirect("/aneksy");
}

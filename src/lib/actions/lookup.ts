"use server";

import { db } from "@/lib/db";
import { requireBiuro } from "@/lib/auth-helpers";
import { classifyIdentifier, normalizeRegon, digitsOnly } from "@/lib/identifiers";

export type PolicyholderMatch = {
  /**
   * "zapisany" — ubezpieczający, którego już kiedyś wystawialiśmy. Ma
   * pierwszeństwo przed katalogiem, bo niesie poprawki wpisane przez biuro.
   */
  source: "zapisany" | "school" | "client";
  id: string;
  nazwa: string;
  adres: string;
  regonPesel: string;
  telefon: string;
  email: string;
  kontaktNazwa: string;
  kontaktTelefon: string;
  kontaktEmail: string;
  agentId: string | null;
  agentName: string | null;
  /** rekord katalogu, z którego to wyszło - potrzebny do zapisu poprawek */
  sourceSchoolRecordId?: string | null;
  /** kiedy ostatnio wystawialiśmy na te dane (tylko dla „zapisany") */
  ostatnioUzyty?: string | null;
  meta?: { city?: string | null; type?: string | null; studentCount?: number | null };
};

export type LookupResult = {
  kind: "REGON" | "PESEL" | "UNKNOWN";
  matches: PolicyholderMatch[];
};

function schoolAddress(r: {
  street: string | null;
  buildingNumber: string | null;
  apartmentNumber: string | null;
  postalCode: string | null;
  postOffice: string | null;
  city: string | null;
}): string {
  const building =
    r.buildingNumber && r.apartmentNumber
      ? `${r.buildingNumber}/${r.apartmentNumber}`
      : r.buildingNumber || r.apartmentNumber || "";
  const line1 = [r.street, building].filter(Boolean).join(" ").trim();
  const line2 = [r.postalCode, r.postOffice || r.city].filter(Boolean).join(" ").trim();
  return [line1, line2].filter(Boolean).join(", ");
}

/**
 * Look up a policyholder by identifier:
 *   - REGON-like -> the imported school directory (SchoolRecord)
 *   - PESEL-like -> existing individual clients (Client)
 * Returns 0..n matches; the caller decides how to present them. Never throws on
 * "no match" — manual entry must always remain possible.
 */
export async function lookupPolicyholder(identifier: string): Promise<LookupResult> {
  await requireBiuro();
  const kind = classifyIdentifier(identifier);

  if (kind === "REGON") {
    const norm = normalizeRegon(identifier);

    // NAJPIERW ubezpieczający, których już wystawialiśmy.
    //
    // Katalog szkół to import z rejestru ministerialnego - nie ma w nim
    // fundacji, stowarzyszeń ani spółek, a te też bywają ubezpieczającym.
    // Dopóki szukaliśmy wyłącznie w katalogu, taki podmiot trzeba było
    // wpisywać od zera przy KAŻDEJ polisie, choć w bazie leżało już
    // kilka jego kopii. Dotyczyło to 29 ze 150 ubezpieczających.
    //
    // Rekord zapisany wygrywa też dlatego, że niesie poprawki biura:
    // adres, osobę do kontaktu i przypisanego agenta, czyli rzeczy,
    // których katalog nie zna albo ma nieaktualne.
    const zapisani = await db.school
      .findMany({
        // Cztery postacie tego samego numeru, bo REGON-y trafiły do bazy
        // z różnych stron: z formularza, z importu z Excela (bez zer wiodących)
        // i z katalogu. Szukanie wyłącznie po tym, co wpisano, gubiłoby rekord
        // zapisany w innym zapisie tej samej liczby.
        where: {
          regonPesel: {
            in: [...new Set([
              identifier.trim(),
              norm,
              digitsOnly(identifier),
              digitsOnly(identifier).replace(/^0+/, ""),
            ])].filter(Boolean),
          },
        },
        include: { agent: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
      .catch(() => []);

    // Ten sam podmiot bywa zapisany raz na polisę - pokazujemy najnowszy wpis
    // na REGON, a nie listę identycznych kopii do wyboru.
    const wgRegonu = new Map<string, (typeof zapisani)[number]>();
    for (const s of zapisani) {
      const k = normalizeRegon(s.regonPesel);
      if (!wgRegonu.has(k)) wgRegonu.set(k, s);
    }

    const zZapisanych: PolicyholderMatch[] = [...wgRegonu.values()].map((s) => ({
      source: "zapisany" as const,
      id: s.id,
      nazwa: s.nazwa,
      adres: s.adres,
      regonPesel: s.regonPesel,
      telefon: s.telefon,
      email: s.email,
      kontaktNazwa: s.kontaktNazwa,
      kontaktTelefon: s.kontaktTelefon,
      kontaktEmail: s.kontaktEmail,
      agentId: s.agentId,
      agentName: s.agent?.name ?? null,
      sourceSchoolRecordId: s.sourceSchoolRecordId,
      ostatnioUzyty: s.createdAt.toISOString().slice(0, 10),
    }));

    const rows = await db.schoolRecord.findMany({
      where: { regonNormalized: norm },
      include: { assignedAgent: { select: { id: true, name: true } } },
      take: 8,
    });

    // Rekord katalogu, który mamy już zapisany, nie wraca drugi raz jako
    // osobna pozycja - to ten sam podmiot, tylko w gorszej wersji.
    const zeZrodla = new Set(zZapisanych.map((z) => z.sourceSchoolRecordId).filter(Boolean));

    return {
      kind,
      matches: [...zZapisanych, ...rows.filter((r) => !zeZrodla.has(r.id)).map((r) => ({
        source: "school" as const,
        id: r.id,
        nazwa: r.name,
        adres: schoolAddress(r),
        regonPesel: r.regonRaw,
        telefon: r.phone ?? "",
        email: r.email ?? "",
        kontaktNazwa: "",
        kontaktTelefon: r.phone ?? "",
        kontaktEmail: r.email ?? "",
        agentId: r.assignedAgentId,
        agentName: r.assignedAgent?.name ?? null,
        sourceSchoolRecordId: r.id,
        meta: { city: r.city, type: r.type, studentCount: r.studentCount },
      }))],
    };
  }

  if (kind === "PESEL") {
    const pesel = digitsOnly(identifier);
    const rows = await db.client.findMany({ where: { pesel }, take: 8 });
    return {
      kind,
      matches: rows.map((c) => {
        const nazwa =
          c.type === "COMPANY"
            ? c.companyName ?? ""
            : [c.firstName, c.lastName].filter(Boolean).join(" ");
        const adres = [
          [c.street].filter(Boolean).join(" "),
          [c.postalCode, c.city].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(", ");
        return {
          source: "client" as const,
          id: c.id,
          nazwa,
          adres,
          regonPesel: c.pesel ?? pesel,
          telefon: c.phone ?? "",
          email: c.email ?? "",
          kontaktNazwa: "",
          kontaktTelefon: c.phone ?? "",
          kontaktEmail: c.email ?? "",
          agentId: null,
          agentName: null,
        };
      }),
    };
  }

  return { kind: "UNKNOWN", matches: [] };
}

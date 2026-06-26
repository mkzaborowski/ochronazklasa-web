"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { classifyIdentifier, normalizeRegon, digitsOnly } from "@/lib/identifiers";

export type PolicyholderMatch = {
  source: "school" | "client";
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
  await requireUser();
  const kind = classifyIdentifier(identifier);

  if (kind === "REGON") {
    const norm = normalizeRegon(identifier);
    const rows = await db.schoolRecord.findMany({
      where: { regonNormalized: norm },
      include: { assignedAgent: { select: { id: true, name: true } } },
      take: 8,
    });
    return {
      kind,
      matches: rows.map((r) => ({
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
        meta: { city: r.city, type: r.type, studentCount: r.studentCount },
      })),
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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { issuePolicySchema } from "@/lib/validations";
import {
  POLICY_VARIANTS,
  isVariantCode,
  policyNumberFromAccount,
  type VariantCode,
} from "@/lib/interrisk/variants";
import { buildFieldData, generatePolicyDocx } from "@/lib/interrisk/generate";

export type PreviewRow =
  | { variantCode: VariantCode; label: string; accountNumber: string; policyNumber: string; error?: undefined }
  | { variantCode: VariantCode; label: string; error: string; accountNumber?: undefined; policyNumber?: undefined };

/**
 * Read-only peek of the bank account that *would* be assigned to each variant,
 * plus its derived policy number. Used on the review screen. The real (atomic)
 * assignment happens in `generatePolicies`.
 */
export async function previewAssignments(variantCodes: string[]): Promise<PreviewRow[]> {
  await requireUser();
  const codes = [...new Set(variantCodes)].filter(isVariantCode);
  const rows: PreviewRow[] = [];

  try {
    // Universal pool: peek the next N free accounts and map them to the variants.
    const free = await db.bankAccount.findMany({
      where: { assigned: false },
      orderBy: [{ createdAt: "asc" }, { accountNumber: "asc" }],
      take: codes.length,
    });
    codes.forEach((code, i) => {
      const label = POLICY_VARIANTS[code].label;
      const account = free[i];
      if (!account) {
        rows.push({ variantCode: code, label, error: "Brak wolnego konta bankowego" });
      } else {
        rows.push({
          variantCode: code,
          label,
          accountNumber: account.accountNumber,
          policyNumber: policyNumberFromAccount(account.accountNumber),
        });
      }
    });
  } catch {
    return codes.map((code) => ({
      variantCode: code,
      label: POLICY_VARIANTS[code].label,
      error: "Baza danych niedostępna",
    }));
  }
  return rows;
}

export type GenerateResult = { error?: string };

export async function generatePolicies(input: unknown): Promise<GenerateResult> {
  const user = await requireUser();

  const parsed = issuePolicySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji danych" };
  }
  const data = parsed.data;

  const codes = [...new Set(data.variants)].filter(isVariantCode);
  if (codes.length === 0) {
    return { error: "Nie wybrano poprawnych wariantów." };
  }

  // Pre-flight availability check (universal pool: need one free account per variant).
  let freeCount = 0;
  try {
    freeCount = await db.bankAccount.count({ where: { assigned: false } });
  } catch {
    return {
      error:
        "Nie można połączyć się z bazą danych. Uruchom PostgreSQL, a następnie `npm run db:push`.",
    };
  }
  if (freeCount < codes.length) {
    return {
      error: `Za mało wolnych kont bankowych (dostępne: ${freeCount}, potrzebne: ${codes.length}). Wgraj nowe konta w Ustawieniach.`,
    };
  }

  let schoolId: string;
  try {
    schoolId = await db.$transaction(
      async (tx) => {
        const school = await tx.school.create({
          data: {
            nazwa: data.nazwa,
            adres: data.adres,
            regonPesel: data.regonPesel,
            telefon: data.telefon,
            email: data.email,
            kontaktNazwa: data.kontaktNazwa,
            kontaktTelefon: data.kontaktTelefon,
            kontaktEmail: data.kontaktEmail,
            agentId: data.agentId.trim(),
            sourceSchoolRecordId: data.sourceSchoolRecordId?.trim() || null,
          },
        });

        for (const code of codes) {
          // Claim the next unused account atomically (conditional update wins the race).
          const candidate = await tx.bankAccount.findFirst({
            where: { assigned: false },
            orderBy: [{ createdAt: "asc" }, { accountNumber: "asc" }],
          });
          if (!candidate) {
            throw new Error("Brak wolnego konta bankowego — wgraj nowe konta w Ustawieniach.");
          }
          const claim = await tx.bankAccount.updateMany({
            where: { id: candidate.id, assigned: false },
            data: { assigned: true, assignedToSchoolId: school.id, assignedAt: new Date() },
          });
          if (claim.count === 0) {
            throw new Error("Konto bankowe zostało właśnie zajęte — spróbuj ponownie.");
          }

          const accountNumber = candidate.accountNumber;
          const policyNumber = policyNumberFromAccount(accountNumber);
          const fields = buildFieldData(data, data.insurancePeriod, accountNumber);
          const { bytes, fileName } = await generatePolicyDocx(code, fields);

          const policy = await tx.generatedPolicy.create({
            data: {
              schoolId: school.id,
              variantCode: code,
              templatePath: POLICY_VARIANTS[code].templatePath,
              fileName,
              fileData: new Uint8Array(bytes),
              bankAccountNumber: accountNumber,
              policyNumber,
              insurancePeriod: data.insurancePeriod,
              createdById: user.id || null,
            },
          });

          await tx.bankAccount.update({
            where: { id: candidate.id },
            data: { assignedToPolicyId: policy.id },
          });
        }

        return school.id;
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się wygenerować polis." };
  }

  await logAudit({
    userId: user.id,
    action: "policy.issue",
    entity: "School",
    entityId: schoolId,
    metadata: { variants: codes, count: codes.length },
  });
  revalidatePath("/schools");
  redirect(`/schools/${schoolId}`);
}

/** Replace a generated policy's DOCX with an edited upload. */
export async function updatePolicyFile(
  policyId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Wybierz plik DOCX." };
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { error: "Plik musi być w formacie .docx" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const policy = await db.generatedPolicy.update({
    where: { id: policyId },
    data: { fileData: bytes, fileName: file.name },
  });
  await logAudit({
    userId: user.id,
    action: "policy.file.update",
    entity: "GeneratedPolicy",
    entityId: policyId,
  });
  revalidatePath(`/schools/${policy.schoolId}`);
  return { ok: true };
}

export async function deleteSchool(id: string) {
  const user = await requireUser();
  await db.school.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "school.delete", entity: "School", entityId: id });
  revalidatePath("/schools");
  redirect("/schools");
}

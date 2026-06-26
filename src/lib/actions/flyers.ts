"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { isVariantCode, type VariantCode } from "@/lib/interrisk/variants";
import { selectFlyerTemplate } from "@/lib/flyers/flyer-template-registry";
import { generateFlyerPdf } from "@/lib/flyers/generate-flyer";
import type { PaymentType } from "@/lib/flyers/flyer-types";

export type FlyerActionState = { error?: string; ok?: boolean };

export async function generateFlyer(
  _prev: FlyerActionState,
  formData: FormData,
): Promise<FlyerActionState> {
  const user = await requireUser();
  const schoolId = String(formData.get("schoolId") ?? "");
  const payment = String(formData.get("payment") ?? "") as PaymentType;
  if (payment !== "cash" && payment !== "wire") return { error: "Wybierz formę płatności." };

  const school = await db.school.findUnique({
    where: { id: schoolId },
    include: { policies: true, agent: true },
  });
  if (!school) return { error: "Nie znaleziono ubezpieczającego." };
  if (!school.agent) {
    return { error: "Przypisz agenta (opiekuna) przed wygenerowaniem ulotki." };
  }

  const variants = school.policies
    .map((p) => p.variantCode)
    .filter(isVariantCode) as VariantCode[];
  const tpl = selectFlyerTemplate(variants, payment);
  if (!tpl) {
    return { error: "Brak ulotki dla tej kombinacji wariantów i formy płatności." };
  }

  const rows = school.policies
    .filter((p) => isVariantCode(p.variantCode))
    .map((p) => {
      const override = formData.get(`num_${p.variantCode}`);
      const policyNumber = (override ? String(override) : p.policyNumber).trim() || p.policyNumber;
      return {
        variantCode: p.variantCode as VariantCode,
        policyNumber,
        accountNumber: p.bankAccountNumber,
      };
    });

  let bytes: Buffer;
  let fileName: string;
  try {
    const doc = await generateFlyerPdf({
      templateKey: tpl.key,
      payment,
      rows,
      schoolName: school.nazwa,
      opiekun: { name: school.agent.name, phone: school.agent.phone ?? "", email: school.agent.email },
    });
    bytes = doc.bytes;
    fileName = doc.fileName;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się wygenerować ulotki." };
  }

  const flyer = await db.generatedFlyer.create({
    data: {
      schoolId,
      templateKey: tpl.key,
      payment,
      fileName,
      fileData: new Uint8Array(bytes),
      createdById: user.id || null,
    },
  });
  await logAudit({
    userId: user.id,
    action: "flyer.generate",
    entity: "GeneratedFlyer",
    entityId: flyer.id,
    metadata: { payment, template: tpl.key },
  });
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true };
}

export async function deleteFlyer(id: string) {
  const user = await requireUser();
  const flyer = await db.generatedFlyer.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "flyer.delete", entity: "GeneratedFlyer", entityId: id });
  revalidatePath(`/schools/${flyer.schoolId}`);
}

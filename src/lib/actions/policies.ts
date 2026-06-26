"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { policySchema } from "@/lib/validations";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/clients";

const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function createPolicy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = policySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }
  const d = parsed.data;

  const policy = await db.policy.create({
    data: {
      clientId: d.clientId,
      insurer: d.insurer,
      productType: d.productType,
      status: d.status,
      policyNumber: nn(d.policyNumber),
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      premium: nn(d.premium), // Prisma Decimal accepts a numeric string
      currency: d.currency || "PLN",
      createdById: user.id || null,
    },
  });

  await logAudit({
    userId: user.id,
    action: "policy.create",
    entity: "Policy",
    entityId: policy.id,
  });
  revalidatePath("/policies");
  return { ok: true };
}

export async function deletePolicy(id: string) {
  const user = await requireUser();
  await db.policy.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    action: "policy.delete",
    entity: "Policy",
    entityId: id,
  });
  revalidatePath("/policies");
}

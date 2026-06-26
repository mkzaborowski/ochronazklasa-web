"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientSchema } from "@/lib/validations";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

/** Empty string -> null (so optional DB columns stay null, not ""). */
const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function createClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Błąd walidacji" };
  }
  const d = parsed.data;

  const client = await db.client.create({
    data: {
      type: d.type,
      firstName: nn(d.firstName),
      lastName: nn(d.lastName),
      pesel: nn(d.pesel),
      companyName: nn(d.companyName),
      nip: nn(d.nip),
      regon: nn(d.regon),
      email: nn(d.email),
      phone: nn(d.phone),
      street: nn(d.street),
      city: nn(d.city),
      postalCode: nn(d.postalCode),
      notes: nn(d.notes),
    },
  });

  await logAudit({
    userId: user.id,
    action: "client.create",
    entity: "Client",
    entityId: client.id,
  });
  revalidatePath("/clients");
  return { ok: true };
}

export async function deleteClient(id: string) {
  const user = await requireUser();
  await db.client.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    action: "client.delete",
    entity: "Client",
    entityId: id,
  });
  revalidatePath("/clients");
}

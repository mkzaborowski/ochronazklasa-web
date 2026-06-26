import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Write an audit-trail entry. Required for mutating/sensitive actions
 * (RODO accountability + security forensics). Never throws — a failed audit
 * write must not break the underlying action.
 */
export async function logAudit(input: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        ip: h.get("x-forwarded-for") ?? h.get("x-real-ip"),
        userAgent: h.get("user-agent"),
      },
    });
  } catch {
    // swallow — auditing must never block the operation
  }
}

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

/** Returns the current session user or null (no redirect). */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Dev-only: same escape hatch as the proxy guard (never true in production). */
function devAuthBypass() {
  return process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
}

/** Requires a logged-in user; redirects to /login otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (user) return user;
  if (devAuthBypass()) {
    // Act as an in-memory admin so server actions run without a login.
    // id is empty -> coerced to null on nullable creator/audit columns.
    return {
      id: "",
      name: "Tryb deweloperski",
      email: "dev@local",
      image: null,
      role: "ADMIN" as Role,
    };
  }
  redirect("/login");
}

/** Requires one of the given roles; redirects home if the role is insufficient. */
export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!user.role || !roles.includes(user.role)) redirect("/");
  return user;
}

/**
 * Wymaga konta BIURA (admin albo podgląd).
 *
 * Rola AGENT ma własny portal i nie wykonuje pracy biura: nie zakłada klientów,
 * nie generuje polis ani ulotek, nie kasuje niczego. Sam layout panelu nie
 * wystarczy, żeby to wymusić — akcje serwerowe i trasy API da się wywołać
 * z pominięciem strony, na której stoi blokada.
 */
export async function requireBiuro() {
  return requireRole(["ADMIN", "VIEWER"]);
}

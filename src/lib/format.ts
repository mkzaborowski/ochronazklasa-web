import { POLICY_STATUS_LABELS } from "@/lib/constants";

export function clientLabel(c: {
  type: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}): string {
  if (c.type === "COMPANY") return c.companyName?.trim() || "(firma bez nazwy)";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || "(klient bez nazwiska)";
}

export function formatDate(d?: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
}

export function statusLabel(status: string): string {
  return POLICY_STATUS_LABELS[status] ?? status;
}

/** Tailwind classes for a status badge. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "ISSUED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "DRAFT":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "EXPIRED":
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

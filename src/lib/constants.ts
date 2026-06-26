/**
 * Domain constants shared across the app.
 * Keep insurer- and product-specific config here so the policy-issuance
 * modules (Hestia, InterRisk) have a single source of truth.
 */

export const INSURERS = {
  HESTIA: {
    id: "HESTIA",
    label: "Ergo Hestia",
    color: "#005ca9",
  },
  INTERRISK: {
    id: "INTERRISK",
    label: "InterRisk",
    color: "#e30613",
  },
} as const;

export type InsurerId = keyof typeof INSURERS;

/** Common Polish insurance product types (extend as needed). */
export const PRODUCT_TYPES = [
  { id: "OC", label: "OC komunikacyjne" },
  { id: "AC", label: "Autocasco" },
  { id: "NNW", label: "NNW" },
  { id: "MAJATKOWE", label: "Ubezpieczenie majątkowe" },
  { id: "PODROZE", label: "Ubezpieczenie podróżne" },
  { id: "ZYCIE", label: "Ubezpieczenie na życie" },
] as const;

export const POLICY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Szkic",
  ISSUED: "Wystawiona",
  ACTIVE: "Aktywna",
  EXPIRED: "Wygasła",
  CANCELLED: "Anulowana",
  RENEWED: "Wznowiona",
};

import { z } from "zod";

const optionalStr = z.string().trim().optional().or(z.literal(""));

export const clientSchema = z
  .object({
    type: z.enum(["INDIVIDUAL", "COMPANY"]),
    firstName: optionalStr,
    lastName: optionalStr,
    pesel: z
      .string()
      .trim()
      .regex(/^\d{11}$/, "PESEL musi mieć 11 cyfr")
      .optional()
      .or(z.literal("")),
    companyName: optionalStr,
    nip: optionalStr,
    regon: optionalStr,
    email: z.string().trim().email("Nieprawidłowy email").optional().or(z.literal("")),
    phone: optionalStr,
    street: optionalStr,
    city: optionalStr,
    postalCode: optionalStr,
    notes: optionalStr,
  })
  .superRefine((d, ctx) => {
    if (d.type === "INDIVIDUAL" && !d.lastName) {
      ctx.addIssue({ code: "custom", message: "Nazwisko jest wymagane", path: ["lastName"] });
    }
    if (d.type === "COMPANY" && !d.companyName) {
      ctx.addIssue({ code: "custom", message: "Nazwa firmy jest wymagana", path: ["companyName"] });
    }
  });

export const policySchema = z.object({
  clientId: z.string().min(1, "Wybierz klienta"),
  insurer: z.enum(["HESTIA", "INTERRISK"]),
  productType: z.string().min(1, "Wybierz produkt"),
  status: z
    .enum(["DRAFT", "ISSUED", "ACTIVE", "EXPIRED", "CANCELLED", "RENEWED"])
    .default("DRAFT"),
  policyNumber: optionalStr,
  startDate: optionalStr,
  endDate: optionalStr,
  premium: optionalStr,
  currency: z.string().default("PLN"),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type PolicyInput = z.infer<typeof policySchema>;

// --- InterRisk issuance wizard ---

export const schoolSchema = z.object({
  nazwa: z.string().trim().min(1, "Nazwa jest wymagana"),
  adres: z.string().trim().min(1, "Adres jest wymagany"),
  regonPesel: z.string().trim().min(1, "REGON/PESEL jest wymagany"),
  telefon: z.string().trim().min(1, "Telefon jest wymagany"),
  email: z.string().trim().email("Nieprawidłowy email"),
  kontaktNazwa: z.string().trim().min(1, "Nazwa kontaktu jest wymagana"),
  kontaktTelefon: z.string().trim().min(1, "Telefon kontaktu jest wymagany"),
  kontaktEmail: z.string().trim().email("Nieprawidłowy email kontaktu"),
});

export const issuePolicySchema = schoolSchema.extend({
  insurancePeriod: z.string().trim().min(1, "Wybierz okres ubezpieczenia"),
  issueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę wystawienia"),
  variants: z.array(z.string().min(1)).min(1, "Wybierz co najmniej jeden wariant"),
  agentId: z.string().trim().min(1, "Każda polisa musi mieć przypisanego agenta"),
  sourceSchoolRecordId: optionalStr,
});

export type SchoolFormInput = z.infer<typeof schoolSchema>;
export type IssuePolicyInput = z.infer<typeof issuePolicySchema>;

// --- Agents ---

export const agentSchema = z.object({
  name: z.string().trim().min(1, "Imię i nazwisko jest wymagane"),
  email: z.string().trim().email("Nieprawidłowy email"),
  phone: optionalStr,
  code: optionalStr,
  notes: optionalStr,
});

export type AgentInput = z.infer<typeof agentSchema>;

import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderDocx } from "@/lib/documents/docx";
import { POLICY_VARIANTS, policyNumberFromAccount, type VariantCode } from "@/lib/interrisk/variants";

/** Data injected into every policy template (only these fields are touched). */
export type PolicyFieldData = {
  ubezpieczajacy_nazwa: string;
  ubezpieczajacy_adres: string;
  ubezpieczajacy_regon_pesel: string;
  ubezpieczajacy_telefon: string;
  ubezpieczajacy_email: string;
  kontakt_nazwa: string;
  kontakt_telefon: string;
  kontakt_email: string;
  okres_ubezpieczenia: string;
  numer_polisy: string;
  numer_konta_bankowego: string;
  data_wystawienia: string; // DD.MM.YYYY, printed in the signature block
};

export type SchoolInput = {
  nazwa: string;
  adres: string;
  regonPesel: string;
  telefon: string;
  email: string;
  kontaktNazwa: string;
  kontaktTelefon: string;
  kontaktEmail: string;
};

/** Format an ISO date (yyyy-mm-dd) as DD.MM.YYYY for the policy signature block. */
export function formatIssueDate(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function buildFieldData(
  school: SchoolInput,
  insurancePeriod: string,
  accountNumber: string,
  issueDate: string, // DD.MM.YYYY
): PolicyFieldData {
  return {
    ubezpieczajacy_nazwa: school.nazwa,
    ubezpieczajacy_adres: school.adres,
    ubezpieczajacy_regon_pesel: school.regonPesel,
    ubezpieczajacy_telefon: school.telefon,
    ubezpieczajacy_email: school.email,
    kontakt_nazwa: school.kontaktNazwa,
    kontakt_telefon: school.kontaktTelefon,
    kontakt_email: school.kontaktEmail,
    okres_ubezpieczenia: insurancePeriod,
    numer_polisy: policyNumberFromAccount(accountNumber),
    numer_konta_bankowego: accountNumber,
    data_wystawienia: issueDate,
  };
}

export async function loadTemplate(code: VariantCode): Promise<Buffer> {
  const variant = POLICY_VARIANTS[code];
  // Statically scoped under templates/policies to keep build tracing tight.
  const abs = path.join(process.cwd(), "templates", "policies", `${code}.docx`);
  try {
    return await readFile(abs);
  } catch {
    throw new Error(
      `Brak szablonu DOCX dla wariantu ${code} (${variant.templatePath}). ` +
        `Umieść plik w katalogu templates/policies/.`,
    );
  }
}

/** Render a single policy DOCX for the given variant + data. */
export async function generatePolicyDocx(
  code: VariantCode,
  fields: PolicyFieldData,
): Promise<{ bytes: Buffer; fileName: string }> {
  const template = await loadTemplate(code);
  const bytes = renderDocx(template, fields);
  const fileName = `${code}_${fields.numer_polisy || "polisa"}.docx`;
  return { bytes, fileName };
}

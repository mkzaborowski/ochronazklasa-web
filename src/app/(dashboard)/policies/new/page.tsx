import { redirect } from "next/navigation";

// The InterRisk issuance wizard now lives under /schools/new.
export default function NewPolicyRedirect() {
  redirect("/schools/new");
}

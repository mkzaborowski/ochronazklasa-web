import { db } from "@/lib/db";
import { PolicyWizard } from "@/components/policy-wizard";

export const dynamic = "force-dynamic";

export default async function NewSchoolPage() {
  const agents = await db.agent
    .findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    .catch(() => []);
  return <PolicyWizard agents={agents} />;
}

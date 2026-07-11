import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { POLICY_VARIANTS, isVariantCode, type VariantCode } from "@/lib/interrisk/variants";
import {
  availableFlyersForCombination,
  periodKeyFromInsurancePeriod,
} from "@/lib/flyers/flyer-template-registry";
import { deleteSchool } from "@/lib/actions/issue";
import { deleteFlyer } from "@/lib/actions/flyers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicyEditDialog } from "@/components/policy-edit-dialog";
import { PolicyholderAgentSelect } from "@/components/policyholder-agent-select";
import { FlyerSection } from "@/components/flyer-section";
import { DeleteButton } from "@/components/delete-button";

export const dynamic = "force-dynamic";

function variantLabel(code: string) {
  return isVariantCode(code) ? POLICY_VARIANTS[code].label : code;
}

export default async function SchoolProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const school = await db.school
    .findUnique({
      where: { id },
      include: {
        policies: { orderBy: { createdAt: "asc" } },
        flyers: { orderBy: { createdAt: "desc" } },
      },
    })
    .catch(() => null);

  if (!school) notFound();

  const agents = await db.agent
    .findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    .catch(() => []);

  const variants = school.policies.map((p) => p.variantCode).filter(isVariantCode) as VariantCode[];
  const flyerPeriod = periodKeyFromInsurancePeriod(school.policies[0]?.insurancePeriod ?? "");
  const availablePayments = [
    ...new Set(availableFlyersForCombination(variants, flyerPeriod).map((t) => t.payment)),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/schools" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{school.nazwa}</h1>
            <p className="text-sm text-muted-foreground">
              REGON/PESEL: {school.regonPesel} · utworzono {formatDate(school.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agent:</span>
            <PolicyholderAgentSelect schoolId={school.id} agentId={school.agentId} agents={agents} />
          </div>
          <DeleteButton
            action={deleteSchool.bind(null, school.id)}
            confirmText="Usunąć szkołę wraz ze wszystkimi polisami? Tej operacji nie można cofnąć."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ubezpieczający</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <dt>Adres</dt><dd className="text-foreground">{school.adres}</dd>
              <dt>Telefon</dt><dd className="text-foreground">{school.telefon}</dd>
              <dt>Email</dt><dd className="text-foreground">{school.email}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kontakt</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <dt>Nazwa</dt><dd className="text-foreground">{school.kontaktNazwa}</dd>
              <dt>Telefon</dt><dd className="text-foreground">{school.kontaktTelefon}</dd>
              <dt>Email</dt><dd className="text-foreground">{school.kontaktEmail}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <FlyerSection
        schoolId={school.id}
        policies={school.policies.map((p) => ({ variantCode: p.variantCode, policyNumber: p.policyNumber }))}
        availablePayments={availablePayments}
        hasAgent={Boolean(school.agentId)}
      />

      {school.flyers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Ulotki ({school.flyers.length})</h2>
          <div className="divide-y rounded-lg border">
            {school.flyers.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{f.payment === "cash" ? "Gotówka" : "Przelew"}</span>{" "}
                  <span className="text-muted-foreground">· {f.templateKey} · {formatDate(f.createdAt)}</span>
                </div>
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/flyers/${f.id}/download`} />}>
                  <Download className="size-4" /> Pobierz
                </Button>
                <DeleteButton action={deleteFlyer.bind(null, f.id)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Wygenerowane polisy ({school.policies.length})</h2>
        {school.policies.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            Brak polis dla tego profilu.
          </div>
        ) : (
          <div className="grid gap-3">
            {school.policies.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <FileText className="size-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">{variantLabel(p.variantCode)}</div>
                    <div className="text-xs text-muted-foreground">{p.insurancePeriod}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Nr polisy</div>
                    <div className="font-mono font-medium">A-A {p.policyNumber}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Konto bankowe</div>
                    <div className="font-mono text-xs">{p.bankAccountNumber}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={`/api/policies/${p.id}/download`} />}
                    >
                      <Download className="size-4" /> Pobierz
                    </Button>
                    <PolicyEditDialog policyId={p.id} fileName={p.fileName} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Loader2, AlertTriangle, Database, X, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VARIANT_LIST, INSURANCE_PERIODS } from "@/lib/interrisk/variants";
import {
  previewAssignments,
  generatePolicies,
  type PreviewRow,
} from "@/lib/actions/issue";
import { lookupPolicyholder, type PolicyholderMatch } from "@/lib/actions/lookup";
import { classifyIdentifier } from "@/lib/identifiers";
import { useDebounce } from "@/hooks/use-debounce";

type LookupState = "idle" | "searching" | "found" | "multiple" | "none";

type Form = {
  nazwa: string;
  adres: string;
  regonPesel: string;
  telefon: string;
  email: string;
  kontaktNazwa: string;
  kontaktTelefon: string;
  kontaktEmail: string;
};

const EMPTY: Form = {
  nazwa: "",
  adres: "",
  regonPesel: "",
  telefon: "",
  email: "",
  kontaktNazwa: "",
  kontaktTelefon: "",
  kontaktEmail: "",
};

const STEPS = [
  "Ubezpieczający",
  "Kontakt",
  "Agent",
  "Okres",
  "Warianty",
  "Podsumowanie",
];

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PolicyWizard({ agents }: { agents: { id: string; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [period, setPeriod] = useState<string>(INSURANCE_PERIODS[0].value);
  const [variants, setVariants] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // REGON/PESEL lookup + the agent/source carried into issuance
  const [lookup, setLookup] = useState<LookupState>("idle");
  const [matches, setMatches] = useState<PolicyholderMatch[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const debouncedId = useDebounce(form.regonPesel, 450);
  const lastSearched = useRef<string>("");

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyMatch = (mch: PolicyholderMatch) => {
    setForm((f) => ({
      ...f,
      nazwa: mch.nazwa,
      adres: mch.adres,
      regonPesel: mch.regonPesel || f.regonPesel,
      telefon: mch.telefon,
      email: mch.email,
      kontaktNazwa: mch.kontaktNazwa || f.kontaktNazwa,
      kontaktTelefon: mch.kontaktTelefon || f.kontaktTelefon,
      kontaktEmail: mch.kontaktEmail || f.kontaktEmail,
    }));
    setAgentId(mch.agentId ?? "");
    setAgentName(mch.agentName ?? "");
    setSourceId(mch.source === "school" ? mch.id : "");
    setLookup("found");
    setMatches([]);
  };

  const clearData = () => {
    setForm(EMPTY);
    setAgentId(""); setAgentName(""); setSourceId("");
    setLookup("idle"); setMatches([]);
    lastSearched.current = "";
  };

  // Debounced REGON/PESEL search
  useEffect(() => {
    const id = debouncedId.trim();
    if (classifyIdentifier(id) === "UNKNOWN") { setLookup("idle"); setMatches([]); return; }
    if (id === lastSearched.current) return;
    lastSearched.current = id;
    let cancelled = false;
    setLookup("searching");
    lookupPolicyholder(id).then((res) => {
      if (cancelled) return;
      if (res.matches.length === 1) applyMatch(res.matches[0]);
      else if (res.matches.length > 1) { setMatches(res.matches); setLookup("multiple"); }
      else { setMatches([]); setLookup("none"); }
    }).catch(() => { if (!cancelled) setLookup("none"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedId]);

  const toggleVariant = (code: string) =>
    setVariants((v) => (v.includes(code) ? v.filter((c) => c !== code) : [...v, code]));

  const stepValid = (): boolean => {
    if (step === 0)
      return Boolean(form.nazwa && form.adres && form.regonPesel && form.telefon && form.email);
    if (step === 1)
      return Boolean(form.kontaktNazwa && form.kontaktTelefon && form.kontaktEmail);
    if (step === 2) return agentId !== "";
    if (step === 4) return variants.length > 0;
    return true;
  };

  const next = () => {
    setError(null);
    if (step === 4) {
      // entering review — fetch provisional account assignments
      setStep(5);
      startTransition(async () => {
        const rows = await previewAssignments(variants);
        setPreview(rows);
      });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const hasUnavailable = preview?.some((r) => r.error) ?? false;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await generatePolicies({
        ...form,
        insurancePeriod: period,
        variants,
        agentId,
        sourceSchoolRecordId: sourceId,
      });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Polisy zostały wygenerowane.");
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wystaw polisę — InterRisk</h1>
        <p className="text-sm text-muted-foreground">
          Krok {step + 1} z {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      <Stepper step={step} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {step === 0 && (
            <>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>
                    REGON / PESEL<span className="text-destructive"> *</span>
                  </Label>
                  <button
                    type="button"
                    onClick={clearData}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" /> Wyczyść dane
                  </button>
                </div>
                <Input
                  value={form.regonPesel}
                  onChange={set("regonPesel")}
                  placeholder="Wpisz REGON (szkoła) lub PESEL (osoba)…"
                />
                <LookupStatus state={lookup} />
                {lookup === "multiple" && (
                  <div className="rounded-md border">
                    <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
                      Znaleziono {matches.length} szkół — wybierz:
                    </div>
                    <ul className="max-h-56 divide-y overflow-auto">
                      {matches.map((mch) => (
                        <li key={mch.id}>
                          <button
                            type="button"
                            onClick={() => applyMatch(mch)}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                          >
                            <span className="font-medium">{mch.nazwa}</span>
                            <span className="text-xs text-muted-foreground">
                              {mch.adres} {mch.meta?.type ? `· ${mch.meta.type}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Field label="Nazwa szkoły / osoby" required>
                <Input value={form.nazwa} onChange={set("nazwa")} />
              </Field>
              <Field label="Adres" required>
                <Input value={form.adres} onChange={set("adres")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefon" required>
                  <Input value={form.telefon} onChange={set("telefon")} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={set("email")} />
                </Field>
              </div>

              {agentName && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCog className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Agent przypisany do polisy:</span>
                  <Badge variant="secondary">{agentName}</Badge>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Nazwa kontaktu" required>
                <Input value={form.kontaktNazwa} onChange={set("kontaktNazwa")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefon kontaktu" required>
                  <Input value={form.kontaktTelefon} onChange={set("kontaktTelefon")} />
                </Field>
                <Field label="Email kontaktu" required>
                  <Input type="email" value={form.kontaktEmail} onChange={set("kontaktEmail")} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <Field label="Agent prowadzący (opiekun polisy)" required>
                <select
                  className={fieldClass}
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setAgentName(agents.find((a) => a.id === e.target.value)?.name ?? "");
                  }}
                >
                  <option value="">— wybierz agenta —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              {agents.length === 0 ? (
                <p className="text-xs text-amber-600">
                  Brak agentów — dodaj agenta w zakładce „Agenci”, aby wystawić polisę.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Każda polisa musi mieć przypisanego agenta. Jeśli szkoła została
                  znaleziona po REGON, agent jest podpowiadany automatycznie.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              {INSURANCE_PERIODS.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="period"
                    value={p.value}
                    checked={period === p.value}
                    onChange={() => setPeriod(p.value)}
                  />
                  <span className="font-medium">{p.label}</span>
                  <span className="ml-auto font-mono text-muted-foreground">{p.value}</span>
                </label>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {VARIANT_LIST.map((v) => (
                <label
                  key={v.code}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    checked={variants.includes(v.code)}
                    onChange={() => toggleVariant(v.code)}
                  />
                  <span className="font-medium">{v.label}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{v.code}</span>
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <Review form={form} period={period} preview={preview} pending={pending} />
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0 || pending}>
          <ArrowLeft className="size-4" /> Wstecz
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!stepValid() || pending}>
            Dalej <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={confirm}
            disabled={pending || !preview || hasUnavailable || variants.length === 0}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generowanie…
              </>
            ) : (
              <>
                <Check className="size-4" /> Utwórz szkołę i wygeneruj polisy
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              i < step
                ? "bg-primary text-primary-foreground"
                : i === step
                  ? "border-2 border-primary text-primary"
                  : "border text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function LookupStatus({ state }: { state: LookupState }) {
  if (state === "idle") return null;
  if (state === "searching")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Szukam w bazie…
      </p>
    );
  if (state === "found")
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Database className="size-3" /> Znaleziono w bazie — dane uzupełnione (możesz je edytować).
      </p>
    );
  if (state === "multiple")
    return (
      <p className="flex items-center gap-1.5 text-xs text-blue-600">
        <Database className="size-3" /> Znaleziono kilka dopasowań.
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <AlertTriangle className="size-3" /> Nie znaleziono w bazie — wpisz dane ręcznie.
    </p>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Review({
  form,
  period,
  preview,
  pending,
}: {
  form: Form;
  period: string;
  preview: PreviewRow[] | null;
  pending: boolean;
}) {
  return (
    <div className="grid gap-4 text-sm">
      <section className="grid gap-1">
        <h3 className="font-medium">Ubezpieczający</h3>
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
          <dt>Nazwa</dt><dd className="text-foreground">{form.nazwa}</dd>
          <dt>Adres</dt><dd className="text-foreground">{form.adres}</dd>
          <dt>REGON/PESEL</dt><dd className="text-foreground">{form.regonPesel}</dd>
          <dt>Telefon</dt><dd className="text-foreground">{form.telefon}</dd>
          <dt>Email</dt><dd className="text-foreground">{form.email}</dd>
        </dl>
      </section>

      <section className="grid gap-1">
        <h3 className="font-medium">Kontakt</h3>
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
          <dt>Nazwa</dt><dd className="text-foreground">{form.kontaktNazwa}</dd>
          <dt>Telefon</dt><dd className="text-foreground">{form.kontaktTelefon}</dd>
          <dt>Email</dt><dd className="text-foreground">{form.kontaktEmail}</dd>
        </dl>
      </section>

      <section className="grid gap-1">
        <h3 className="font-medium">Okres ubezpieczenia</h3>
        <p className="font-mono text-muted-foreground">{period}</p>
      </section>

      <section className="grid gap-2">
        <h3 className="font-medium">Polisy do wygenerowania</h3>
        {pending && !preview ? (
          <p className="text-muted-foreground">Sprawdzanie dostępnych kont…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Wariant</th>
                  <th className="p-2 font-medium">Konto bankowe</th>
                  <th className="p-2 font-medium">Nr polisy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview?.map((r) => (
                  <tr key={r.variantCode}>
                    <td className="p-2 font-medium">{r.label}</td>
                    {r.error ? (
                      <td className="p-2 text-rose-600" colSpan={2}>
                        {r.error}
                      </td>
                    ) : (
                      <>
                        <td className="p-2 font-mono text-xs">{r.accountNumber}</td>
                        <td className="p-2 font-mono">A-A {r.policyNumber}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Konta są przypisywane ostatecznie w chwili generowania.
        </p>
      </section>
    </div>
  );
}

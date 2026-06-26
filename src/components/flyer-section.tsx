"use client";

import { useActionState, useEffect } from "react";
import { FileDown, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POLICY_VARIANTS, isVariantCode } from "@/lib/interrisk/variants";
import { generateFlyer, type FlyerActionState } from "@/lib/actions/flyers";

type PolicyRow = { variantCode: string; policyNumber: string };

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function variantLabel(code: string) {
  return isVariantCode(code) ? POLICY_VARIANTS[code].label : code;
}

export function FlyerSection({
  schoolId,
  policies,
  availablePayments,
  hasAgent,
}: {
  schoolId: string;
  policies: PolicyRow[];
  availablePayments: ("cash" | "wire")[];
  hasAgent: boolean;
}) {
  const [state, formAction, pending] = useActionState<FlyerActionState, FormData>(
    generateFlyer,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Ulotka wygenerowana.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const matched = availablePayments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" /> Ulotka
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!matched ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Brak ulotki dla tej kombinacji wariantów. Dostępne są tylko wybrane,
              przygotowane wcześniej zestawy.
            </span>
          </div>
        ) : !hasAgent ? (
          <p className="text-sm text-amber-600">
            Przypisz agenta (opiekuna) powyżej, aby wygenerować ulotkę.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="schoolId" value={schoolId} />

            <div className="grid gap-2">
              <Label>Forma płatności</Label>
              <div className="flex flex-wrap gap-3">
                {availablePayments.map((p, i) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input type="radio" name="payment" value={p} defaultChecked={i === 0} />
                    {p === "cash" ? "Gotówka" : "Przelew"}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Numery polis (edytowalne)</Label>
              <div className="grid gap-2">
                {policies.map((p) => (
                  <div key={p.variantCode} className="grid grid-cols-[1fr_160px] items-center gap-2">
                    <span className="text-sm">{variantLabel(p.variantCode)}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">A-A</span>
                      <Input
                        name={`num_${p.variantCode}`}
                        defaultValue={p.policyNumber}
                        className={`${fieldClass} h-8`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generowanie…
                </>
              ) : (
                <>
                  <FileDown className="size-4" /> Generuj ulotkę
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

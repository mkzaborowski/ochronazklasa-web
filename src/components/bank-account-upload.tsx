"use client";

import { useActionState, useEffect } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importBankAccounts, type ImportState } from "@/lib/actions/bank-accounts";

export function BankAccountUpload() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importBankAccounts,
    {},
  );

  useEffect(() => {
    if (state.summary) toast.success(`Zaimportowano ${state.summary.imported} kont.`);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-3">
      <input
        type="file"
        name="file"
        accept=".xlsx"
        required
        className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Plik „Stan druków” (.xlsx). Zaimportowane zostaną tylko wolne, niewykorzystane
        konta, których nie ma jeszcze w systemie.
      </p>
      <Button type="submit" disabled={pending} className="w-fit">
        <Upload className="size-4" /> {pending ? "Wgrywanie…" : "Wgraj plik"}
      </Button>

      {state.summary ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Wierszy w pliku: {state.summary.totalRows} · wolnych: {state.summary.free} ·
            już w bazie / wykorzystanych: {state.summary.alreadyHave} ·{" "}
            <strong>zaimportowano: {state.summary.imported}</strong>
          </span>
        </div>
      ) : null}
    </form>
  );
}

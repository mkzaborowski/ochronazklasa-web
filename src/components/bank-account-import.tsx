"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Upload, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  previewBankAccountImport,
  commitBankAccountImport,
  type PreviewState,
  type ImportDecision,
  type ImportPreviewRow,
} from "@/lib/actions/bank-accounts";

const selClass =
  "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs shadow-sm outline-none";

const STATUS_LABEL: Record<ImportPreviewRow["status"], string> = {
  new: "nowy",
  "pool-free": "w puli (wolny)",
  "pool-used": "w puli (wykorzystany)",
  issued: "na wystawionej polisie",
};

export function BankAccountImport() {
  const [preview, previewAction, previewPending] = useActionState<PreviewState, FormData>(
    previewBankAccountImport,
    {},
  );
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [committing, startCommit] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const newRows = useMemo(() => (preview.rows ?? []).filter((r) => r.status === "new"), [preview.rows]);
  const knownRows = useMemo(() => (preview.rows ?? []).filter((r) => r.status !== "new"), [preview.rows]);

  // Default decision per row: the file's Wykorzystane column
  useEffect(() => {
    if (!preview.rows) return;
    setDone(null);
    setSelected(new Set());
    setDecisions(Object.fromEntries(newRows.map((r) => [r.accountNumber, r.fileUsed ? "used" : "free"])));
  }, [preview.rows, newRows]);

  useEffect(() => {
    if (preview.error) toast.error(preview.error);
  }, [preview]);

  const setMany = (keys: string[], d: ImportDecision) =>
    setDecisions((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, d])) }));

  const counts = useMemo(() => {
    const vals = newRows.map((r) => decisions[r.accountNumber] ?? "free");
    return {
      free: vals.filter((v) => v === "free").length,
      used: vals.filter((v) => v === "used").length,
      skip: vals.filter((v) => v === "skip").length,
    };
  }, [newRows, decisions]);

  const commit = () =>
    startCommit(async () => {
      const res = await commitBankAccountImport(
        newRows.map((r) => ({
          accountNumber: r.accountNumber,
          decision: decisions[r.accountNumber] ?? "free",
        })),
      );
      if (res.error) toast.error(res.error);
      else {
        const msg = `Dodano ${res.addedFree} wolnych i ${res.addedUsed} wykorzystanych numerów.`;
        setDone(msg);
        toast.success(msg);
      }
    });

  return (
    <div className="grid gap-3">
      <form action={previewAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" disabled={previewPending} variant="outline" className="w-fit">
          {previewPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {previewPending ? "Analizowanie…" : "Wczytaj do podglądu"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Plik „Stan druków” (.xlsx). Nic nie trafia do bazy przed Twoim zatwierdzeniem —
        najpierw zobaczysz każdy numer i zdecydujesz, co z nim zrobić.
      </p>

      {preview.rows && (
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{preview.fileName}</span>
            <Badge variant="secondary">wierszy: {preview.totalRows}</Badge>
            <Badge variant="secondary">nowych: {newRows.length}</Badge>
            <Badge variant="secondary">znanych aplikacji: {knownRows.length}</Badge>
          </div>

          {newRows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  Zaznaczone: {selected.size || "—"} · ustaw dla{" "}
                  {selected.size > 0 ? "zaznaczonych" : "wszystkich"}:
                </span>
                {(["free", "used", "skip"] as const).map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setMany(
                        selected.size > 0 ? [...selected] : newRows.map((r) => r.accountNumber),
                        d,
                      )
                    }
                  >
                    {d === "free" ? "wolne" : d === "used" ? "wykorzystane" : "pomiń"}
                  </Button>
                ))}
              </div>

              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="w-8 p-2">
                        <input
                          type="checkbox"
                          checked={selected.size === newRows.length && newRows.length > 0}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? new Set(newRows.map((r) => r.accountNumber))
                                : new Set(),
                            )
                          }
                        />
                      </th>
                      <th className="p-2 font-medium">Nr polisy</th>
                      <th className="p-2 font-medium">Numer konta</th>
                      <th className="p-2 font-medium">Wg pliku</th>
                      <th className="p-2 font-medium">Decyzja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {newRows.map((r) => (
                      <tr key={r.accountNumber} className={decisions[r.accountNumber] === "skip" ? "opacity-45" : ""}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.has(r.accountNumber)}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(r.accountNumber) : next.delete(r.accountNumber);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="p-2 font-mono font-medium">{r.policyNumber}</td>
                        <td className="p-2 font-mono text-xs">{r.accountNumber}</td>
                        <td className="p-2 text-xs">{r.fileUsed ? "wykorzystany" : "wolny"}</td>
                        <td className="p-2">
                          <select
                            className={selClass}
                            value={decisions[r.accountNumber] ?? "free"}
                            onChange={(e) =>
                              setMany([r.accountNumber], e.target.value as ImportDecision)
                            }
                          >
                            <option value="free">dodaj jako wolny</option>
                            <option value="used">dodaj jako wykorzystany</option>
                            <option value="skip">pomiń</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Do dodania: <strong>{counts.free}</strong> wolnych,{" "}
                  <strong>{counts.used}</strong> wykorzystanych · pominiętych: {counts.skip}
                </span>
                <Button onClick={commit} disabled={committing || counts.free + counts.used === 0}>
                  {committing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Zatwierdź import ({counts.free + counts.used})
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Wszystkie numery z pliku są już znane aplikacji — nie ma nic do dodania.
            </p>
          )}

          {knownRows.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">
                <ShieldAlert className="mr-1 inline size-3" />
                Znane aplikacji — pominięte, stan w systemie pozostaje bez zmian ({knownRows.length})
              </summary>
              <ul className="mt-2 grid max-h-40 gap-0.5 overflow-auto font-mono">
                {knownRows.map((r) => (
                  <li key={r.accountNumber}>
                    {r.policyNumber} · {r.accountNumber} — {STATUS_LABEL[r.status]}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="size-4" /> {done}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

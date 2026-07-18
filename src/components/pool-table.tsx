"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  poolBulkOp,
  poolRangeOp,
  updatePoolAccountNumber,
  type PoolOp,
} from "@/lib/actions/bank-accounts";

export type PoolRow = {
  id: string;
  accountNumber: string;
  policyNumber: string;
  status: "free" | "reserved" | "issued";
  schoolId: string | null;
  schoolName: string | null;
};

const STATUS_BADGE: Record<PoolRow["status"], { label: string; cls: string }> = {
  free: { label: "Wolny", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  reserved: { label: "Wykorzystany", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  issued: { label: "Na polisie", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
};

const fieldClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PoolTable({ rows }: { rows: PoolRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [editRow, setEditRow] = useState<PoolRow | null>(null);
  const [editValue, setEditValue] = useState("");

  const selectable = rows.filter((r) => r.status !== "issued");

  const runBulk = (op: PoolOp) => {
    const label = op === "reserve" ? "oznaczyć jako wykorzystane" : op === "release" ? "przywrócić jako wolne" : "USUNĄĆ";
    if (op === "delete" && !window.confirm(`Na pewno ${label} ${selected.size} numerów? Tej operacji nie można cofnąć.`)) return;
    start(async () => {
      const res = await poolBulkOp([...selected], op);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Zmieniono ${res.affected} numerów.`);
        setSelected(new Set());
        router.refresh();
      }
    });
  };

  const runRange = (op: PoolOp) => {
    const from = Number.parseInt(rangeFrom, 10);
    const to = Number.parseInt(rangeTo, 10);
    if (op === "delete" && !window.confirm(`Na pewno USUNĄĆ wolne/zarezerwowane numery z zakresu ${from}–${to}?`)) return;
    start(async () => {
      const res = await poolRangeOp(from, to, op);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Zmieniono ${res.affected} numerów w zakresie.`);
        router.refresh();
      }
    });
  };

  const saveEdit = () => {
    if (!editRow) return;
    start(async () => {
      const res = await updatePoolAccountNumber(editRow.id, editValue);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Numer zaktualizowany.");
        setEditRow(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-3">
      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 text-sm">
        <span className="text-xs text-muted-foreground">
          Zaznaczone: <strong>{selected.size}</strong>
        </span>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pending || selected.size === 0} onClick={() => runBulk("reserve")}>
          Oznacz jako wykorzystane
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pending || selected.size === 0} onClick={() => runBulk("release")}>
          Przywróć jako wolne
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive" disabled={pending || selected.size === 0} onClick={() => runBulk("delete")}>
          <Trash2 className="size-3" /> Usuń
        </Button>

        <span className="mx-2 h-5 w-px bg-border" />

        <span className="text-xs text-muted-foreground">Zakres nr polis:</span>
        <Input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="od (676800)" className={`${fieldClass} w-28`} inputMode="numeric" />
        <Input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="do (676899)" className={`${fieldClass} w-28`} inputMode="numeric" />
        {(["reserve", "release", "delete"] as const).map((op) => (
          <Button
            key={op}
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${op === "delete" ? "text-destructive" : ""}`}
            disabled={pending || !rangeFrom || !rangeTo}
            onClick={() => runRange(op)}
          >
            {op === "reserve" ? "wykorzystane" : op === "release" ? "wolne" : "usuń"}
          </Button>
        ))}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Numery powiązane z wystawionymi polisami (<Lock className="inline size-3" />) są
        zablokowane — nie można ich zwolnić, usunąć ani edytować.
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 p-2">
                <input
                  type="checkbox"
                  checked={selected.size === selectable.length && selectable.length > 0}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(selectable.map((r) => r.id)) : new Set())
                  }
                />
              </th>
              <th className="p-2 font-medium">Nr polisy</th>
              <th className="p-2 font-medium">Numer konta</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Ubezpieczający</th>
              <th className="w-10 p-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-20 p-2 text-center text-muted-foreground">
                  Brak numerów spełniających kryteria.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2">
                    {r.status === "issued" ? (
                      <Lock className="size-3.5 text-muted-foreground" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(r.id) : next.delete(r.id);
                            return next;
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="p-2 font-mono font-medium">{r.policyNumber}</td>
                  <td className="p-2 font-mono text-xs">{r.accountNumber}</td>
                  <td className="p-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status].cls}`}>
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </td>
                  <td className="max-w-52 truncate p-2 text-xs">
                    {r.schoolId ? (
                      <Link href={`/schools/${r.schoolId}`} className="underline">
                        {r.schoolName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {r.status !== "issued" && (
                      <button
                        type="button"
                        title="Popraw numer konta"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditRow(r);
                          setEditValue(r.accountNumber);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Popraw numer konta</DialogTitle>
            <DialogDescription>
              Nr polisy zostanie przeliczony automatycznie (ostatnie 6 cyfr).
            </DialogDescription>
          </DialogHeader>
          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="font-mono" />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button">Anuluj</Button>} />
            <Button onClick={saveEdit} disabled={pending}>
              {pending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

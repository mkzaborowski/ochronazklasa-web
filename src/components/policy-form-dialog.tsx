"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPolicy } from "@/lib/actions/policies";
import type { ActionState } from "@/lib/actions/clients";
import { INSURERS, PRODUCT_TYPES, POLICY_STATUS_LABELS } from "@/lib/constants";

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ClientOption = { id: string; label: string };

export function PolicyFormDialog({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPolicy,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Polisa została dodana.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={clients.length === 0}>
            <Plus className="size-4" /> Dodaj polisę
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nowa polisa</DialogTitle>
            <DialogDescription>
              Zarejestruj polisę i powiąż ją z klientem.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="clientId">Klient</Label>
              <select id="clientId" name="clientId" className={fieldClass} required>
                <option value="">— wybierz klienta —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="insurer">Ubezpieczyciel</Label>
                <select id="insurer" name="insurer" className={fieldClass}>
                  {Object.values(INSURERS).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="productType">Produkt</Label>
                <select id="productType" name="productType" className={fieldClass}>
                  {PRODUCT_TYPES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="policyNumber">Numer polisy</Label>
                <Input id="policyNumber" name="policyNumber" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" className={fieldClass} defaultValue="DRAFT">
                  {Object.entries(POLICY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Początek</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">Koniec</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="premium">Składka</Label>
                <Input id="premium" name="premium" inputMode="decimal" placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Waluta</Label>
                <Input id="currency" name="currency" defaultValue="PLN" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" type="button">
                  Anuluj
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisywanie…" : "Zapisz polisę"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

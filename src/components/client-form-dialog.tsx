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
import { createClient, type ActionState } from "@/lib/actions/clients";

const fieldClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ClientFormDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createClient,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Klient został dodany.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> Dodaj klienta
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nowy klient</DialogTitle>
            <DialogDescription>
              Dodaj klienta indywidualnego lub firmę.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="type">Typ klienta</Label>
              <select
                id="type"
                name="type"
                className={fieldClass}
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="INDIVIDUAL">Osoba fizyczna</option>
                <option value="COMPANY">Firma</option>
              </select>
            </div>

            {type === "INDIVIDUAL" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Imię</Label>
                  <Input id="firstName" name="firstName" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Nazwisko</Label>
                  <Input id="lastName" name="lastName" />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="pesel">PESEL</Label>
                  <Input id="pesel" name="pesel" inputMode="numeric" maxLength={11} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="companyName">Nazwa firmy</Label>
                  <Input id="companyName" name="companyName" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nip">NIP</Label>
                  <Input id="nip" name="nip" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="regon">REGON</Label>
                  <Input id="regon" name="regon" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="street">Ulica i nr</Label>
                <Input id="street" name="street" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postalCode">Kod</Label>
                <Input id="postalCode" name="postalCode" />
              </div>
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="city">Miasto</Label>
                <Input id="city" name="city" />
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
              {pending ? "Zapisywanie…" : "Zapisz klienta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

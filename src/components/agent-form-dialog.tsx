"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
import { createAgent, updateAgent } from "@/lib/actions/agents";
import type { ActionState } from "@/lib/actions/clients";

type Agent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  code: string | null;
  notes: string | null;
};

export function AgentFormDialog({ agent }: { agent?: Agent }) {
  const editing = Boolean(agent);
  const [open, setOpen] = useState(false);
  const action = editing
    ? (prev: ActionState, fd: FormData) => updateAgent(agent!.id, prev, fd)
    : createAgent;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Agent zaktualizowany." : "Agent dodany.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, editing]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edytuj
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Dodaj agenta
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edytuj agenta" : "Nowy agent"}</DialogTitle>
            <DialogDescription>Dane agenta ubezpieczeniowego.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="name">Imię i nazwisko</Label>
              <Input id="name" name="name" defaultValue={agent?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={agent?.email} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" name="phone" defaultValue={agent?.phone ?? ""} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Kod agenta</Label>
              <Input id="code" name="code" defaultValue={agent?.code ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notatki</Label>
              <Input id="notes" name="notes" defaultValue={agent?.notes ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button">Anuluj</Button>} />
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
import { updatePolicyFile } from "@/lib/actions/issue";

/**
 * "Edit" a generated policy = download it, edit in Word, then upload the
 * revised .docx here to replace the stored file.
 */
export function PolicyEditDialog({
  policyId,
  fileName,
}: {
  policyId: string;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);
  const action = updatePolicyFile.bind(null, policyId);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean }, formData: FormData) =>
      action(formData),
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Plik polisy zaktualizowany.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" /> Edytuj
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Aktualizuj plik polisy</DialogTitle>
            <DialogDescription>
              Pobierz dokument, wprowadź zmiany w programie Word, a następnie
              wgraj poprawioną wersję (.docx). Zastąpi ona obecny plik.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <input
              type="file"
              name="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-xs text-muted-foreground">Obecnie: {fileName}</p>
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
              {pending ? "Wgrywanie…" : "Zapisz nową wersję"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
